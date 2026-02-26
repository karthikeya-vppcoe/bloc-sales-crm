# Bloc Sales CRM

A smart Sales CRM built with **Next.js 14**, **Supabase**, and **Make.com** for auto-assigning WhatsApp leads from Google Sheets to sales callers.

---

## 🚀 Live Demo

> Deploy to Vercel (see Setup section) and paste your URL here.

---

## ⚙️ Setup Instructions

### 1. Clone & install

```bash
git clone <repo-url> bloc-sales-crm
cd bloc-sales-crm
npm install
```

### 2. Supabase Setup

1. Create a free project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor → New Query** and paste the entire contents of `supabase_schema.sql`
3. Run it — this creates the `callers` and `leads` tables and enables Realtime.
4. Paste the contents of `auth_policies.sql` and run it to enable secure access for authenticated users.

### 3. Environment Variables

Copy `.env.local` and fill in your project credentials (from Supabase → Project Settings → API):

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### 4. Run locally

```bash
npm run dev
# Open http://localhost:3000
```

### 5. Deploy to Vercel

```bash
npx vercel --prod
```

Set the 3 env vars above in **Vercel → Project → Settings → Environment Variables**.

---

## 🔒 Security & Authentication

This CRM uses **Supabase Auth** with the **Next.js SSR** pattern (`@supabase/ssr`).

### Client Architecture:
- `src/lib/supabase.ts`: Clean browser client for Client Components.
- `src/lib/supabase-server.ts`: Server-side client for Server Components/Actions (handles cookies).
- `src/lib/supabase-admin.ts`: Service Role client for bypassing RLS (used in `/api/ingest`).

### Protected Routes:
- `/dashboard`, `/callers`, and `/callers/*` are protected server-side.
- Unauthenticated users are automatically redirected to `/auth/signin`.
- Use `/auth/signup` to create your initial admin account.

---

## 🗄️ Database Structure

### `callers` table

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | Auto-generated |
| `name` | text | Caller's full name |
| `role` | text | e.g. "Senior Sales Caller" |
| `languages` | text[] | e.g. `{Hindi, Marathi}` |
| `daily_lead_limit` | int | Max leads/day (default 60) |
| `assigned_states` | text[] | States routed to this caller |
| `leads_assigned_today` | int | Resets at midnight |
| `last_reset_date` | date | Tracks when counter was last reset |
| `last_assigned_at` | timestamptz | Drives round-robin fairness |

**Indexes:** GIN on `assigned_states` (fast array containment queries)

### `leads` table

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | Auto-generated |
| `name` | text | Lead's name |
| `phone` | text | WhatsApp number |
| `timestamp` | timestamptz | Defaults to CURRENT_TIMESTAMP |
| `lead_source` | text | e.g. "Meta Forms", "Reels" |
| `city` / `state` | text | Used for state-based routing |
| `metadata` | jsonb | Extra Google Sheet columns |
| `assigned_caller_id` | uuid FK | → callers.id |
| `assigned_at` | timestamptz | When assignment happened |

**Indexes:** B-Tree on `state`, `assigned_caller_id`, `created_at DESC`

---

## 🤖 Smart Lead Assignment Logic (`src/lib/assign-lead.ts`)

`smartAssignLead(leadId, state)` runs on every new lead:

1. **Fetch all callers**
2. **Reset daily counters** — any caller whose `last_reset_date < today` gets `leads_assigned_today = 0`
3. **State-preferred pool** — callers with `lead.state` in their `assigned_states` (case-insensitive match)
4. **Global fallback** — if no state-specific callers exist, use all callers
5. **Apply daily cap** — remove callers who hit their `daily_lead_limit`
6. **Round-Robin** — sort eligible callers by `last_assigned_at ASC NULLS FIRST` → pick #0
7. **Edge case** — if everyone is at cap, assign to the caller with fewest leads today (prevent lead loss)
8. **Atomic update** — increment caller's counter + stamp `assigned_caller_id` on the lead

---

## 🔄 Automation Workflow (Make.com)

### How it works

```
Google Sheets (new row) → Make.com → POST /api/ingest → Supabase → Realtime → Dashboard
```

### Make.com Setup

1. Create a **new Scenario** in Make.com
2. Add trigger: **Google Sheets → Watch Rows** (set sheet + check every 15 minutes)
3. Add action: **HTTP → Make a Request**
   - URL: `https://your-vercel-url.app/api/ingest`
   - Method: `POST`
   - Body type: `Application/JSON`
   - Body:
     ```json
     {
       "name": "{{1.Name}}",
       "phone": "{{1.Phone}}",
       "timestamp": "{{1.Timestamp}}",
       "lead_source": "{{1.Lead Source}}",
       "city": "{{1.City}}",
       "state": "{{1.State}}"
     }
     ```
4. Turn the scenario **ON**

![Make.com Workflow](./docs/make_workflow.png)
*(Screenshot of Make.com automation — see /docs/make_workflow.png)*

---

## 📸 Screenshots

| Dashboard | Callers |
|---|---|
| ![Dashboard](./docs/screenshot_dashboard.png) | ![Callers](./docs/screenshot_callers.png) |

---

## 🧪 Testing the Ingest Endpoint

```bash
# Test state-based assignment (should prefer Maharashtra callers)
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Rahul Sharma",
    "phone": "9876543210",
    "state": "Maharashtra",
    "city": "Mumbai",
    "lead_source": "Reels"
  }'

# Test fallback (Goa — state not assigned to anyone)
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Lead", "phone": "9000000001", "state": "Goa"}'

# Test cap overflow (set daily_lead_limit=1, leads_assigned_today=1 for all callers first)
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{"name": "Overflow Lead", "phone": "9000000002", "state": "Karnataka"}'
```

---

## 🗂️ Google Sheets (Test Leads)

[📊 View Test Google Sheet](https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID)

Columns: `Name | Phone | Timestamp | Lead Source | City | State`

---

## 🎥 Demo Video

[▶️ Watch on Google Drive](https://drive.google.com/drive/YOUR_VIDEO_ID)

---

## 🛠️ What I'd Improve With More Time

1. **Webhook signature verification** — Add a `X-Webhook-Secret` header check on `/api/ingest` so only Make.com can call it
2. **Lead re-assignment UI** — Allow drag-and-drop re-assignment on the dashboard
3. **Caller working hours** — Don't assign leads outside 9am–7pm in the caller's timezone
4. **Export to CSV** — Add a download button for filtered lead data
5. **Daily digest email** — Cron job at 8am summarising each caller's pipeline for the day
6. **Duplicate detection** — Deduplicate by phone number before inserting a new lead
7. **Supabase Edge Functions** — Move `smartAssignLead` into an Edge Function triggered by a DB webhook for true serverless scalability

---

## 📁 Project Structure

```
src/
├── app/
│   ├── api/ingest/route.ts        ← POST webhook (Make.com → DB)
│   ├── dashboard/page.tsx         ← Live leads + caller load
│   └── callers/
│       ├── page.tsx               ← All callers
│       ├── new/page.tsx           ← Create caller
│       └── [id]/page.tsx          ← Edit caller
├── lib/
│   ├── supabase.ts                ← Browser + admin clients
│   └── assign-lead.ts             ← smartAssignLead()
├── components/
│   ├── CallerForm.tsx             ← Create/edit form
│   └── LeadsTable.tsx             ← Realtime leads table
└── types.ts                       ← Shared TS interfaces
```
