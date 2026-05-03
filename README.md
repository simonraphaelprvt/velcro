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
| 2 | Abgeschlossen | Vault-Indexer (Python) |
| 3 | Abgeschlossen | Chat-Backend mit Vault-Suche |
| 4 | Abgeschlossen | Voice-Pipeline (Whisper + ElevenLabs) |
| 5 | Abgeschlossen | Frontend (Voice-UI) |
| 6 | Abgeschlossen | Google Calendar + Gmail |
| 7 | Optional | Note-Writing in Vault |

---

## Phase 2: Vault-Sync einrichten

### Schritt 1: Supabase-Schema anlegen

1. Supabase Dashboard aufrufen: `https://supabase.com/dashboard`
2. Dein Projekt > **SQL Editor** > **New query**
3. Inhalt von `scripts/supabase_schema.sql` reinkopieren und ausfuehren

Das legt an:
- Tabelle `vault_chunks` mit pgvector-Index
- Funktion `match_vault_chunks()` fuer Similarity-Search
- Tabelle `conversations` fuer Chat-History
- Row Level Security (kein direkter Anon-Zugriff)

### Schritt 2: Python-Umgebung einrichten

```bash
cd scripts

# Virtuelle Umgebung anlegen
python3 -m venv .venv
source .venv/bin/activate

# Dependencies installieren
pip install -r requirements.txt
```

### Schritt 3: Environment anlegen

```bash
cp scripts/.env.example scripts/.env
```

Dann `scripts/.env` oeffnen und befuellen:

| Variable | Wo zu finden |
|---|---|
| `OPENAI_API_KEY` | platform.openai.com > API keys |
| `SUPABASE_URL` | Supabase > Settings > API > Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase > Settings > API > service_role |
| `VAULT_PATH` | Bereits gesetzt: `/Users/simon/Claude Workspace/Simon's Brain` |

### Schritt 4: Ersten Sync starten

```bash
cd scripts
source .venv/bin/activate

# Dry-run: zeigt was indexiert werden wuerde, schreibt nichts
python sync_vault.py --dry-run

# Erster vollstaendiger Index
python sync_vault.py --full

# Danach immer nur inkrementell (nur geaenderte Dateien)
python sync_vault.py
```

**Erwartete Ausgabe:**
```
VELCRO Vault Sync — 2026-05-03 07:00:00
Vault:   /Users/simon/Claude Workspace/Simon's Brain
Mode:    FULL
------------------------------------------------------------
Gefundene .md Dateien: 347
Zu indexieren: 347  |  Unveraendert: 0
[  1/347] Projekte/Porsche.md  (12 Chunks)
[  2/347] Clients/Karin.md  (8 Chunks)
...
------------------------------------------------------------
Fertig. 347 Dateien, 2841 Chunks indexiert.
```

### Schritt 5: Taeglichen Cron einrichten (Cowork Scheduled Task)

Der Vault soll jeden Morgen um 07:00 Uhr automatisch synced werden.

**Option A: macOS launchd (empfohlen, kein extra Tool noetig)**

```bash
# Datei erstellen: ~/Library/LaunchAgents/dev.velcro.vault-sync.plist
```

Inhalt (Pfade anpassen):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>dev.velcro.vault-sync</string>
  <key>ProgramArguments</key>
  <array>
    <string>/Users/simon/Desktop/Claude Workspace/VELCRO/scripts/.venv/bin/python</string>
    <string>/Users/simon/Desktop/Claude Workspace/VELCRO/scripts/sync_vault.py</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>7</integer>
    <key>Minute</key>
    <integer>0</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>/tmp/velcro-vault-sync.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/velcro-vault-sync.err</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HOME</key>
    <string>/Users/simon</string>
  </dict>
</dict>
</plist>
```

Aktivieren:
```bash
launchctl load ~/Library/LaunchAgents/dev.velcro.vault-sync.plist
# Deaktivieren: launchctl unload ~/Library/LaunchAgents/dev.velcro.vault-sync.plist
# Log pruefen: tail -f /tmp/velcro-vault-sync.log
```

**Option B: Cowork Scheduled Task**

In Cowork einen neuen Scheduled Task anlegen:
- Command: `cd /Users/simon/Desktop/Claude\ Workspace/VELCRO/scripts && source .venv/bin/activate && python sync_vault.py`
- Schedule: `0 7 * * *` (jeden Morgen 07:00)

---

## Supabase-Schema (Referenz)

Vollstaendiges Schema liegt in `scripts/supabase_schema.sql`.

Kernfunktion fuer Vault-Search:

```sql
select * from match_vault_chunks(
  query_embedding := '[0.1, 0.2, ...]'::vector,
  match_count := 8,
  match_threshold := 0.3
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
