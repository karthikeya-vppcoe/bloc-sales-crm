-- ═══════════════════════════════════════════════════════════════════
--  Bloc Sales CRM — Updated RLS Policies for Authentication
--  Run this in: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Callers Table Policies ───────────────────────────────────────

-- Keep public read (needed for dashboard glance)
-- (Assuming policy "Allow anon reads on callers" already exists as:
-- ALTER TABLE public.callers ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow anon reads on callers" ON public.callers FOR SELECT USING (true);
-- )

-- Drop current any-insert/any-update if you added them experiments
DROP POLICY IF EXISTS "Authenticated can insert callers" ON public.callers;
DROP POLICY IF EXISTS "Authenticated can update callers" ON public.callers;

-- Allow ONLY authenticated users to create/edit callers
CREATE POLICY "Authenticated can insert callers"
  ON public.callers FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update callers"
  ON public.callers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ── 2. Leads Table Policies ──────────────────────────────────────────

-- Leads also need to be manageable by staff
DROP POLICY IF EXISTS "Authenticated can update leads" ON public.leads;

CREATE POLICY "Authenticated can update leads"
  ON public.leads FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Note: The /api/ingest route uses supabaseAdmin (service_role) 
-- which bypasses these policies, so leads will still be created via webhook.
