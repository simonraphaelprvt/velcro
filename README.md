# VELCRO

Persönlicher Voice-Assistant. Simon spricht, VELCRO antwortet.

---

## Tech-Stack

| Schicht | Technologie |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind |
| LLM | Claude Sonnet via Anthropic API |
| Speech-to-Text | OpenAI Whisper API |
| Text-to-Speech | ElevenLabs API |
| Vector Store | Supabase pgvector |
| Embeddings | OpenAI text-embedding-3-small |
| Vault-Sync | Python-Script (lokal auf Simon's Mac) |
| Deployment | Vercel |

---

## Setup

### 1. Node-Dependencies installieren

```bash
npm install
```

### 2. Environment-Variablen anlegen

```bash
cp .env.example .env.local
```

Dann `.env.local` mit echten Werten befüllen. Alle Variablen sind in der Datei dokumentiert.

### 3. Dev-Server starten

```bash
npm run dev
```

App läuft auf [http://localhost:3000](http://localhost:3000).

### 4. Vault-Sync einrichten (Phase 2)

Siehe [Vault-Sync Anleitung](#vault-sync-python-script) weiter unten.

---

## Architektur

```
[Simons Mac]
  └── Obsidian Vault (lokal)
  └── scripts/sync_vault.py  ── Cron 07:00 ──►  [Supabase pgvector]
                                                          ▲
[Browser]                                                 │
  └── Next.js App ──► /api/transcribe (Whisper)           │
                  ──► /api/chat (Claude + Vault-Suche) ───┘
                  ──► /api/calendar (Google Calendar)
                  ──► /api/mail (Gmail)
                  ──► /api/speak (ElevenLabs)
```

---

## Build-Phasen

| Phase | Status | Beschreibung |
|---|---|---|
| 1 | Abgeschlossen | Projekt-Setup, Skeleton |
| 2 | Offen | Vault-Indexer (Python) |
| 3 | Offen | Chat-Backend mit Vault-Suche |
| 4 | Offen | Voice-Pipeline (Whisper + ElevenLabs) |
| 5 | Offen | Frontend (Voice-UI) |
| 6 | Offen | Google Calendar + Gmail |
| 7 | Optional | Note-Writing in Vault |

---

## Vault-Sync (Python-Script)

Das Script `scripts/sync_vault.py` läuft lokal auf Simons Mac und indexiert den Obsidian Vault in Supabase.

### Einrichtung

```bash
# Im scripts/ Verzeichnis
cd scripts

# Virtuelle Umgebung anlegen
python3 -m venv .venv
source .venv/bin/activate

# Dependencies installieren
pip install -r requirements.txt

# Environment anlegen
cp .env.example .env
# scripts/.env mit echten Werten befüllen
```

### Manuell ausführen

```bash
cd scripts
source .venv/bin/activate
python sync_vault.py
```

### Supabase: Tabelle anlegen

SQL in Supabase SQL-Editor ausführen (Phase 2 Anleitung).

### Als Scheduled Task (Cowork)

Phase 2 enthält die genaue Anleitung für den Cowork-Scheduler.

---

## Supabase-Schema

### vault_chunks

```sql
create extension if not exists vector;

create table vault_chunks (
  id uuid primary key default gen_random_uuid(),
  file_path text not null,
  chunk_index integer not null,
  content text not null,
  embedding vector(1536),
  last_synced timestamptz default now(),
  unique(file_path, chunk_index)
);

create index on vault_chunks using ivfflat (embedding vector_cosine_ops);
```

### conversations

```sql
create table conversations (
  id uuid primary key default gen_random_uuid(),
  query text not null,
  response text not null,
  sources jsonb,
  created_at timestamptz default now()
);
```

---

## Deployment auf Vercel

```bash
# Vercel CLI (einmalig)
npm i -g vercel
vercel login

# Deploy
vercel --prod
```

Alle `.env.local` Variablen müssen in Vercel unter Settings > Environment Variables gesetzt werden.

---

## Secrets

Niemals `.env.local` committen. Die `.env.example` enthält Dummy-Werte und ist sicher zu committen.
