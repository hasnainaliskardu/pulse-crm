# HANA CRM

Offline-first internal outreach CRM for a lead-generation agency. Works with zero internet — leads, touches, tasks, notes, and pipeline moves made offline are queued on-device and sync automatically when back online.

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS + shadcn/ui (Pepper theme)
- Supabase (Postgres, Auth, Realtime, RLS, Storage)
- Dexie.js (IndexedDB local mirror + outbox queue)
- PWA (installable, service worker)
- Deploys on Vercel (free tier friendly)

## Features

- **Login only** — no signup. Founder creates members (Team → Create Member).
- **Leads**: table + kanban views, filters, search, 50/page, bulk import (CSV/TSV paste or .csv upload, auto column mapping, duplicate warnings), detail page with touch timeline, notes, tasks, files.
- **Offline-first**: every read comes from the local IndexedDB mirror (instant), every write goes to a persistent outbox queue and replays with retries + exponential backoff. Conflict resolution merges field-by-field (newest non-null wins) and writes an audit row.
- **Touch logging**: channel/direction/summary/full message — logged offline, points computed at sync time.
- **Tasks & Calendar**: due dates, priorities, lead links, today view, month calendar with follow-ups.
- **Leaderboard & gamification**: Today/Week/Month, points (touch 1 · research 2 · reply 5 · positive 10 · call 20 · WON 100), levels L1 Rookie → L5 Legend.
- **Founder dashboards**: KPIs, funnel (touches → replies → positives → calls → proposals → wins), 7/30-day trends, live activity feed, team target attainment.
- **Team management**: create/edit/deactivate members, reset passwords, per-member daily targets, member detail (14-day hit/miss, workload, recent activity).
- **Revenue**: clients (ACTIVE/CHURNED), MRR, commission pool (30% of first-month revenue; 25% split equally among active members ≥80% monthly target + 5% to the monthly #1 performer).
- **Reports**: metric × group-by (member/city/status/source) + date range → chart + CSV export.
- **Custom fields** (Settings): add text/number/select/date fields to Leads/Clients — no code.
- **Workflow rules** (Settings): e.g. status = INTERESTED → create task "Send proposal" due +1 day. Runs inside the sync engine.
- **Google Sheet backup**: fire-and-forget webhook on lead create + status change (retry 2x, silent if unset).
- **Activity log**: append-only, every mutation logged with before/after — nothing is ever lost.
- **PWA**: install on phone home screen, works airplane-mode (see test checklist below).

## Setup

```bash
npm install
cp .env.example .env.local   # fill values
```

### 1. Supabase

1. Create a free project at supabase.com.
2. Open **SQL Editor** and run the three files in order:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_activity_and_points.sql`
   - `supabase/migrations/0003_hana_offline.sql`
3. **Project Settings → API**: copy Project URL, `anon` key, `service_role` key into `.env.local`.

> The `lead-files` storage bucket + policies are created by 0003. If the bucket insert fails (older projects), create a **private** bucket named `lead-files` manually.

### 2. Seed the founder

```bash
FOUNDER_EMAIL=founder@youragency.com FOUNDER_PASSWORD=YourPass123 npm run seed:founder
```

(Or put them in `.env.local` and run `npm run seed:founder`.) The script is idempotent.

### 3. Run

```bash
npm run dev        # http://localhost:3000
npm run build      # production build
```

Create your first MEMBER: sign in as founder → **Team → Create Member**.

## Deploy to Vercel

1. Push the repo to GitHub.
2. Vercel → New Project → import the repo (framework auto-detected).
3. Add env vars (same as `.env.example`).
4. Deploy. Then run the seed script once locally against production Supabase keys.

## Env vars

| Var | Where |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same |
| `SUPABASE_SERVICE_ROLE_KEY` | same — server-only, never ship to client |
| `SHEETS_WEBHOOK_URL` | optional — Apps Script web app URL |
| `FOUNDER_EMAIL` / `FOUNDER_PASSWORD` | local seed script only |

## Offline test checklist (airplane mode)

1. Sign in while online (data hydrates into IndexedDB).
2. Turn off Wi-Fi / enable airplane mode → amber "Offline mode" banner appears.
3. Add a lead, edit a lead, log a touch, drag a kanban card → all work; rows show a "PENDING" badge; header shows "N pending".
4. Kill the tab, reopen the app while still offline → everything still renders; drafts restore with a toast.
5. Turn internet back on → blue "Syncing" dot, queue drains, status flips to "All synced"; the events appear in Activity Log; another user sees the changes.

## REST API (founder-configurable API key)

Set `API_KEY` env var on Vercel. Send `Authorization: Bearer <API_KEY>`.

- `GET /api/ext/leads?status=&q=&page=` — list leads
- `POST /api/ext/leads` — create lead `{ business_name, city, ... }`
- `PATCH /api/ext/leads/:id` — update `{ status?, ... }`
- `DELETE /api/ext/leads/:id` — hard delete

## Google Sheet backup — Apps Script

1. Open your Google Sheet → **Extensions → Apps Script**, paste the code below, **Deploy → New deployment → Web app** (execute as me, access: anyone), copy the URL.
2. Paste it into **Settings → Google Sheet backup webhook** (or `SHEETS_WEBHOOK_URL`).

```javascript
function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Leads') ||
              SpreadsheetApp.getActiveSpreadsheet().insertSheet('Leads');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Time', 'Type', 'Business', 'City', 'Status', 'Owner', 'Phone', 'Email', 'Website', 'Value']);
  }
  var d = JSON.parse(e.postData.contents);
  var lead = d.lead || {};
  sheet.appendRow([
    new Date(),
    d.type || '',
    lead.business_name || '',
    lead.city || '',
    lead.status || d.to || '',
    lead.owner_name || '',
    lead.owner_phone || '',
    lead.owner_email || '',
    lead.website_url || '',
    lead.monthly_value || ''
  ]);
  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

## Points & levels

| Action | Points |
|---|---|
| Touch logged | +1 |
| Lead researched (→ READY) | +2 |
| Reply received | +5 |
| Positive reply | +10 |
| Call booked | +20 |
| Client WON | +100 |

Levels: L1 Rookie <500 · L2 Scout 500–2k · L3 Hunter 2k–5k · L4 Closer 5k–15k · L5 Legend 15k+.

## Security

- RLS on every table: members see only their rows; founder sees all; enforced in Postgres, not just UI.
- `service_role` key only used in server routes/actions.
- Soft delete default; hard deletes are founder-only via service role.
- Every mutation → append-only `activity_log`.

## Daily backups

A `backups` bucket snapshot script is included: `npm run backup` exports every table to JSON and uploads to the `backups` Supabase bucket (keeps the last 30). Schedule it in Vercel Cron or run manually — see `scripts/backup.ts`.
