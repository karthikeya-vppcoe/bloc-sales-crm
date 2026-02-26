-- ═══════════════════════════════════════════════════════════════════
--  Bloc Sales CRM — Supabase Schema
--  Run this entire file in: Supabase Dashboard → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────
--  TABLE: callers
--  Stores sales agents who receive lead assignments.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.callers (
  id                   uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 text         NOT NULL,
  role                 text,
  -- Array of languages the caller speaks, e.g. {'Hindi','Marathi','English'}
  languages            text[]       NOT NULL DEFAULT '{}',
  -- Max leads this caller can handle per day (configurable from UI)
  daily_lead_limit     int          NOT NULL DEFAULT 60,
  -- States this caller is responsible for, e.g. {'Maharashtra','Karnataka'}
  -- An empty array means the caller is in the global pool only.
  assigned_states      text[]       NOT NULL DEFAULT '{}',
  -- Tracks how many leads were assigned today (resets at midnight)
  leads_assigned_today int          NOT NULL DEFAULT 0,
  -- Date of the last reset — used to detect a new day and reset the counter
  last_reset_date      date         NOT NULL DEFAULT CURRENT_DATE,
  -- Timestamp of the most recent lead assignment — drives round-robin fairness
  last_assigned_at     timestamptz,
  created_at           timestamptz  NOT NULL DEFAULT now()
);

-- GIN index — fast containment queries like: assigned_states @> ARRAY['Maharashtra']
CREATE INDEX IF NOT EXISTS idx_callers_assigned_states
  ON public.callers USING GIN (assigned_states);

-- ─────────────────────────────────────────────
--  TABLE: leads
--  Stores every inbound lead from Google Sheets / WhatsApp.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.leads (
  id                  uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text,
  phone               text         NOT NULL,
  -- When the lead originally came in (from Google Sheet timestamp column)
  -- Defaults to now() if not provided by the source
  timestamp           timestamptz  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lead_source         text,        -- e.g. 'Meta Forms', 'Reels', 'WhatsApp'
  city                text,
  state               text,
  -- Flexible bag for any extra fields from the Google Sheet
  metadata            jsonb        NOT NULL DEFAULT '{}',
  -- FK to callers — null until smartAssignLead() runs
  assigned_caller_id  uuid         REFERENCES public.callers(id) ON DELETE SET NULL,
  -- When the assignment happened
  assigned_at         timestamptz,
  created_at          timestamptz  NOT NULL DEFAULT now()
);

-- B-Tree index on state — used in WHERE state ILIKE ... queries
CREATE INDEX IF NOT EXISTS idx_leads_state
  ON public.leads (state);

-- B-Tree index on assigned_caller_id — speeds up "all leads for caller X" queries
CREATE INDEX IF NOT EXISTS idx_leads_assigned_caller_id
  ON public.leads (assigned_caller_id);

-- Index for time-ordered listing on the dashboard
CREATE INDEX IF NOT EXISTS idx_leads_created_at
  ON public.leads (created_at DESC);

-- ─────────────────────────────────────────────
--  REALTIME
--  Enables Supabase Realtime CDC for both tables so the frontend
--  receives INSERT/UPDATE events without polling.
-- ─────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.callers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;

-- ─────────────────────────────────────────────
--  ROW LEVEL SECURITY
--  Enable RLS on both tables (best practice).
--  The /api/ingest route uses the service_role key which bypasses RLS.
--  The browser uses the anon key — grant read access for the dashboard.
-- ─────────────────────────────────────────────
ALTER TABLE public.callers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads   ENABLE ROW LEVEL SECURITY;

-- Allow all reads from the browser (anon role) — dashboard needs this
CREATE POLICY "Allow anon reads on callers"
  ON public.callers FOR SELECT USING (true);

CREATE POLICY "Allow anon reads on leads"
  ON public.leads FOR SELECT USING (true);

-- Writes (INSERT / UPDATE) are done server-side via service_role → no browser policy needed.
