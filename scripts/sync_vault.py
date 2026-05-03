"""
sync_vault.py — VELCRO Vault Indexer

Reads all .md files from Simon's Obsidian Vault, chunks them, generates
OpenAI embeddings, and upserts into Supabase pgvector.

Incremental: only re-indexes files whose modification time is newer than
their last_synced timestamp in the database.

Usage:
    python sync_vault.py              # incremental sync
    python sync_vault.py --full       # force full re-index of everything
    python sync_vault.py --dry-run    # show what would be indexed, no writes
"""

import os
import sys
import json
import time
import hashlib
import argparse
from datetime import datetime, timezone
from pathlib import Path
from typing import Generator

import tiktoken
from dotenv import load_dotenv
from openai import OpenAI
from supabase import create_client, Client

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

load_dotenv(Path(__file__).parent / ".env")

VAULT_PATH = os.environ["VAULT_PATH"]
OPENAI_API_KEY = os.environ["OPENAI_API_KEY"]
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIM = 1536

# Chunk size in tokens. 800 tokens ~ 600 words, fits well in Claude context.
CHUNK_SIZE = 800
CHUNK_OVERLAP = 100

# OpenAI embeds up to 2048 inputs per batch call. Stay well under limit.
BATCH_SIZE = 100

# Files/folders to skip
SKIP_DIRS = {".obsidian", ".trash", ".git", "_templates", "templates"}
SKIP_FILES = {".DS_Store"}

# ---------------------------------------------------------------------------
# Clients
# ---------------------------------------------------------------------------

openai_client = OpenAI(api_key=OPENAI_API_KEY)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
tokenizer = tiktoken.get_encoding("cl100k_base")


# ---------------------------------------------------------------------------
# File discovery
# ---------------------------------------------------------------------------

def iter_markdown_files(vault_path: str) -> Generator[Path, None, None]:
    """Yield all .md files in the vault, skipping hidden/template dirs."""
    root = Path(vault_path)
    if not root.exists():
        raise FileNotFoundError(f"Vault not found: {vault_path}")

    for path in root.rglob("*.md"):
        # Skip any file inside a blocked directory
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        if path.name in SKIP_FILES:
            continue
        yield path


# ---------------------------------------------------------------------------
# Chunking
# ---------------------------------------------------------------------------

def chunk_text(text: str, file_path: str) -> list[dict]:
    """
    Split text into overlapping token-based chunks.
    Returns list of dicts: {chunk_index, content, token_count}
    """
    tokens = tokenizer.encode(text)
    chunks = []
    start = 0
    index = 0

    while start < len(tokens):
        end = min(start + CHUNK_SIZE, len(tokens))
        chunk_tokens = tokens[start:end]
        content = tokenizer.decode(chunk_tokens)

        # Skip chunks that are mostly whitespace or very short
        if len(content.strip()) > 50:
            chunks.append({
                "chunk_index": index,
                "content": content,
                "token_count": len(chunk_tokens),
            })
            index += 1

        if end == len(tokens):
            break
        start = end - CHUNK_OVERLAP

    return chunks


# ---------------------------------------------------------------------------
# Sync state
# ---------------------------------------------------------------------------

def get_synced_files() -> dict[str, datetime]:
    """
    Return a dict of {file_path: last_synced} for all files in the DB.
    Uses the max last_synced per file_path.
    """
    response = (
        supabase.table("vault_chunks")
        .select("file_path, last_synced")
        .execute()
    )

    synced: dict[str, datetime] = {}
    for row in response.data:
        fp = row["file_path"]
        ts = datetime.fromisoformat(row["last_synced"])
        if fp not in synced or ts > synced[fp]:
            synced[fp] = ts

    return synced


def file_needs_reindex(
    path: Path,
    vault_root: str,
    synced: dict[str, datetime],
    force: bool,
) -> bool:
    rel = str(path.relative_to(vault_root))
    if force or rel not in synced:
        return True
    mtime = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)
    return mtime > synced[rel]


# ---------------------------------------------------------------------------
# Embedding
# ---------------------------------------------------------------------------

def embed_batch(texts: list[str]) -> list[list[float]]:
    """Call OpenAI embeddings API for a batch of texts."""
    response = openai_client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=texts,
    )
    return [item.embedding for item in response.data]


# ---------------------------------------------------------------------------
# Database operations
# ---------------------------------------------------------------------------

def delete_file_chunks(rel_path: str) -> None:
    """Remove all existing chunks for a file before re-indexing."""
    supabase.table("vault_chunks").delete().eq("file_path", rel_path).execute()


def upsert_chunks(rows: list[dict]) -> None:
    """Upsert chunk rows into vault_chunks."""
    supabase.table("vault_chunks").upsert(rows, on_conflict="file_path,chunk_index").execute()


# ---------------------------------------------------------------------------
# Main sync
# ---------------------------------------------------------------------------

def sync(vault_path: str, force: bool = False, dry_run: bool = False) -> None:
    print(f"\nVELCRO Vault Sync — {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Vault:   {vault_path}")
    print(f"Mode:    {'FULL' if force else 'INCREMENTAL'}{' (dry-run)' if dry_run else ''}")
    print("-" * 60)

    # Load existing sync state
    if not force and not dry_run:
        print("Lade Sync-Status aus Supabase...")
        synced = get_synced_files()
        print(f"  {len(synced)} Dateien bereits indexiert.")
    else:
        synced = {}

    # Discover files
    all_files = list(iter_markdown_files(vault_path))
    print(f"Gefundene .md Dateien: {len(all_files)}")

    # Filter to files that need re-indexing
    to_index = [
        f for f in all_files
        if file_needs_reindex(f, vault_path, synced, force)
    ]
    skip_count = len(all_files) - len(to_index)

    print(f"Zu indexieren: {len(to_index)}  |  Unveraendert: {skip_count}")

    if not to_index:
        print("\nAlles aktuell. Nichts zu tun.")
        return

    if dry_run:
        print("\nDateien die indexiert wuerden:")
        for f in to_index:
            rel = str(f.relative_to(vault_path))
            chunks = chunk_text(f.read_text(encoding="utf-8", errors="ignore"), rel)
            print(f"  {rel}  ({len(chunks)} Chunks)")
        return

    # Process in batches
    now_iso = datetime.now(timezone.utc).isoformat()
    total_chunks = 0
    total_files = 0

    # Collect all chunks across files, then embed in batches
    pending_rows: list[dict] = []
    pending_texts: list[str] = []

    def flush_batch() -> None:
        nonlocal total_chunks
        if not pending_texts:
            return
        embeddings = embed_batch(pending_texts)
        for row, emb in zip(pending_rows, embeddings):
            row["embedding"] = emb
        upsert_chunks(pending_rows)
        total_chunks += len(pending_rows)
        pending_rows.clear()
        pending_texts.clear()

    for i, path in enumerate(to_index, 1):
        rel = str(path.relative_to(vault_path))
        print(f"[{i:>3}/{len(to_index)}] {rel}", end="", flush=True)

        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except Exception as e:
            print(f"  FEHLER: {e}")
            continue

        chunks = chunk_text(text, rel)
        if not chunks:
            print(f"  (leer, uebersprungen)")
            continue

        # Remove old chunks for this file
        delete_file_chunks(rel)

        for chunk in chunks:
            pending_rows.append({
                "file_path": rel,
                "chunk_index": chunk["chunk_index"],
                "content": chunk["content"],
                "last_synced": now_iso,
                # embedding filled in flush_batch
            })
            pending_texts.append(chunk["content"])

            if len(pending_texts) >= BATCH_SIZE:
                flush_batch()

        print(f"  ({len(chunks)} Chunks)")
        total_files += 1

        # Small delay to respect OpenAI rate limits on large vaults
        if i % 20 == 0:
            time.sleep(0.5)

    # Flush remaining
    flush_batch()

    print("-" * 60)
    print(f"Fertig. {total_files} Dateien, {total_chunks} Chunks indexiert.")
    print(f"Timestamp: {now_iso}")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="VELCRO Vault Indexer")
    parser.add_argument(
        "--full",
        action="store_true",
        help="Force full re-index (ignores last_synced timestamps)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be indexed without writing to DB",
    )
    args = parser.parse_args()

    try:
        sync(VAULT_PATH, force=args.full, dry_run=args.dry_run)
    except KeyboardInterrupt:
        print("\nAbgebrochen.")
        sys.exit(1)
    except Exception as e:
        print(f"\nFEHLER: {e}")
        raise
