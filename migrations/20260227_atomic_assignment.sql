-- ═══════════════════════════════════════════════════════════════════
--  Migration: Atomic Lead Assignment & Activity Logs
--  Run this in: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- 1. Create assignment_logs table
CREATE TABLE IF NOT EXISTS public.assignment_logs (
  id                uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id           uuid         NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  caller_id         uuid         NOT NULL REFERENCES public.callers(id) ON DELETE CASCADE,
  assignment_reason text         NOT NULL,
  created_at        timestamptz  NOT NULL DEFAULT now()
);

-- Enable RLS (Security First)
ALTER TABLE public.assignment_logs ENABLE ROW LEVEL SECURITY;

-- Allow anon reads for debugging/dashboard if needed (matching existing pattern)
CREATE POLICY "Allow anon reads on assignment_logs"
  ON public.assignment_logs FOR SELECT USING (true);

-- 2. Atomic Assignment Function (RPC)
-- Handles concurrency, daily resets, state priority, and overflow fallback.
CREATE OR REPLACE FUNCTION public.assign_lead_atomic(p_lead_id uuid, p_state text)
RETURNS jsonb
SECURITY DEFINER -- Runs with elevated privileges to update tables
SET search_path = public
AS $$
DECLARE
  v_chosen_caller_id uuid;
  v_reason           text;
  v_today            date := CURRENT_DATE;
  v_caller_name      text;
BEGIN
  -- A. RESET STALE COUNTERS (Atomic Reset)
  -- This ensures daily limits are fresh within the same transaction scope as assignment.
  UPDATE public.callers 
  SET leads_assigned_today = 0, 
      last_reset_date = v_today 
  WHERE last_reset_date < v_today;

  -- B. FIND BEST CALLER (with priority & strict consistency locking)
  -- Using FOR UPDATE (no SKIP LOCKED) ensures that concurrent requests wait for eligibility
  -- re-evaluation, guaranteeing the MOST eligible (oldest last_assigned_at) is picked first.
  
  -- Layer 1: Specific State Match (Case-insensitive)
  SELECT id, name INTO v_chosen_caller_id, v_caller_name
  FROM public.callers
  WHERE (p_state IS NOT NULL AND p_state <> '' AND EXISTS (
      SELECT 1 FROM unnest(assigned_states) AS s 
      WHERE lower(s) = lower(p_state)
    ))
    AND leads_assigned_today < daily_lead_limit
  ORDER BY last_assigned_at ASC NULLS FIRST
  LIMIT 1
  FOR UPDATE;

  v_reason := 'state_match_round_robin';

  -- Layer 2: Global Fallback (Any available caller)
  IF v_chosen_caller_id IS NULL THEN
    SELECT id, name INTO v_chosen_caller_id, v_caller_name
    FROM public.callers
    WHERE leads_assigned_today < daily_lead_limit
    ORDER BY last_assigned_at ASC NULLS FIRST
    LIMIT 1
    FOR UPDATE;
    
    v_reason := 'global_round_robin';
  END IF;

  -- Layer 3: Overflow Fallback (Everyone at capacity)
  -- We pick the least-loaded caller overall to prevent lead loss.
  IF v_chosen_caller_id IS NULL THEN
    SELECT id, name INTO v_chosen_caller_id, v_caller_name
    FROM public.callers
    ORDER BY leads_assigned_today ASC, last_assigned_at ASC NULLS FIRST
    LIMIT 1
    FOR UPDATE;
    
    v_reason := 'cap_overflow_fallback';
  END IF;

  -- C. EXECUTE ASSIGNMENT
  IF v_chosen_caller_id IS NOT NULL THEN
    -- Update Caller stats
    UPDATE public.callers
    SET leads_assigned_today = leads_assigned_today + 1,
        last_assigned_at = now()
    WHERE id = v_chosen_caller_id;

    -- Update Lead record
    UPDATE public.leads
    SET assigned_caller_id = v_chosen_caller_id,
        assigned_at = now()
    WHERE id = p_lead_id;

    -- Log Activity
    INSERT INTO public.assignment_logs (lead_id, caller_id, assignment_reason)
    VALUES (p_lead_id, v_chosen_caller_id, v_reason);

    RETURN jsonb_build_object(
      'success', true,
      'caller_id', v_chosen_caller_id,
      'caller_name', v_caller_name,
      'reason', v_reason
    );
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No callers available for assignment'
    );
  END IF;
END;
$$ LANGUAGE plpgsql;
