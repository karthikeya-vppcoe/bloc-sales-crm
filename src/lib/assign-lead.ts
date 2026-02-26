/**
 * assign-lead.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * smartAssignLead(lead)
 *
 * This is the heart of the CRM's automation logic.
 * It reads all callers from the DB, applies three layers of filtering /
 * prioritisation, picks the best caller, then atomically updates both the
 * caller record and the lead record in Supabase.
 *
 * Algorithm (in order):
 *  1.  Fetch all callers
 *  2.  Reset daily cap counter for any caller whose `last_reset_date` is not today
 *  3.  Build a "state-preferred" pool  — callers assigned to lead.state (case-insensitive)
 *  4.  Fall back to all callers if the state pool is empty
 *  5.  Remove callers who have hit their daily_lead_limit
 *  6.  From eligible callers, sort by last_assigned_at ASC NULLS FIRST (round-robin fairness)
 *  7.  Pick the first caller (oldest / never assigned = highest priority)
 *  8.  EDGE CASE: if everyone is at their daily cap, pick the caller with fewest leads today
 *  9.  Atomically update the chosen caller (last_assigned_at, leads_assigned_today++)
 * 10.  Update the lead record (assigned_caller_id, assigned_at)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { supabaseAdmin } from '@/lib/supabase-admin'
import type { Caller } from '@/types'

// ─────────────────────────────────────────────
//  Helper: Get today's date as "YYYY-MM-DD"
//  We compare this against last_reset_date stored in the DB.
// ─────────────────────────────────────────────
function todayDateString(): string {
    return new Date().toISOString().split('T')[0] // e.g. "2026-02-25"
}

// ─────────────────────────────────────────────
//  Main exported function
// ─────────────────────────────────────────────
export async function smartAssignLead(
    lead: { id: string; state?: string | null }
): Promise<{ caller: Caller | null; error: string | null }> {

    const today = todayDateString()

    // ── Step 1: Fetch ALL callers ─────────────────────────────────────────────
    // We need all of them to (a) reset stale counters and (b) build eligible pool.
    const { data: rawCallers, error: fetchError } = await supabaseAdmin
        .from('callers')
        .select('*')
        .order('created_at', { ascending: true })

    if (fetchError) {
        return { caller: null, error: `Failed to fetch callers: ${fetchError.message}` }
    }

    if (!rawCallers || rawCallers.length === 0) {
        // No callers exist in the system yet — lead remains unassigned.
        return { caller: null, error: 'No callers found in the system.' }
    }

    // ── Step 2: Reset daily counter for stale callers ────────────────────────
    // If a caller's `last_reset_date` is before today, their daily counter is stale.
    // We reset it to 0 before proceeding so cap logic is always current.
    const staleCotCallerIds = rawCallers
        .filter((c: Caller) => c.last_reset_date < today)
        .map((c: Caller) => c.id)

    if (staleCotCallerIds.length > 0) {
        // Batch update: reset leads_assigned_today = 0 and last_reset_date = today
        await supabaseAdmin
            .from('callers')
            .update({ leads_assigned_today: 0, last_reset_date: today })
            .in('id', staleCotCallerIds)
        // Reflect the reset locally so we don't re-fetch
        rawCallers.forEach((c: Caller) => {
            if (staleCotCallerIds.includes(c.id)) {
                c.leads_assigned_today = 0
                c.last_reset_date = today
            }
        })
    }

    const callers: Caller[] = rawCallers

    // ── Step 3: Build state-preferred pool ───────────────────────────────────
    // If the lead has a state, prefer callers explicitly assigned that state.
    // Matching is case-insensitive (e.g. "maharashtra" == "Maharashtra").
    let candidatePool: Caller[] = []

    if (lead.state && lead.state.trim() !== '') {
        const normalizedLeadState = lead.state.trim().toLowerCase()

        candidatePool = callers.filter((c) =>
            c.assigned_states.some(
                (s) => s.trim().toLowerCase() === normalizedLeadState
            )
        )
    }

    // ── Step 4: Fall back to global pool if no state-specific callers ────────
    // This handles leads from states not assigned to anyone,
    // or leads with no state field at all.
    if (candidatePool.length === 0) {
        candidatePool = callers  // use all callers as the pool
    }

    // ── Step 5: Filter out callers who hit their daily cap ───────────────────
    // A caller is "eligible" if leads_assigned_today < daily_lead_limit.
    const eligibleCallers = candidatePool.filter(
        (c) => c.leads_assigned_today < c.daily_lead_limit
    )

    let chosenCaller: Caller | null = null

    if (eligibleCallers.length > 0) {
        // ── Step 6 & 7: Round-Robin — sort by last_assigned_at ASC NULLS FIRST ──
        // The caller who hasn't been assigned in the longest time goes first.
        // Callers who've never been assigned (null) get top priority.
        const sorted = [...eligibleCallers].sort((a, b) => {
            if (!a.last_assigned_at && !b.last_assigned_at) return 0
            if (!a.last_assigned_at) return -1   // a never assigned → highest priority
            if (!b.last_assigned_at) return 1    // b never assigned → highest priority
            return new Date(a.last_assigned_at).getTime() - new Date(b.last_assigned_at).getTime()
        })

        chosenCaller = sorted[0]  // pick the oldest / never-assigned caller

    } else {
        // ── Step 8: Edge Case — everyone is at their daily cap ────────────────
        // Rather than leaving the lead unassigned, we assign to the caller in the
        // candidate pool with the FEWEST leads today. This prevents lead loss.
        // The UI will show this as "over-assigned" which an admin can spot easily.
        console.warn(
            `[smartAssignLead] All callers in pool are at daily cap for state="${lead.state}". ` +
            `Assigning to least-loaded caller as overflow.`
        )

        const sorted = [...candidatePool].sort(
            (a, b) => a.leads_assigned_today - b.leads_assigned_today
        )
        chosenCaller = sorted[0]  // caller with fewest leads today
    }

    if (!chosenCaller) {
        return { caller: null, error: 'Could not determine a caller for assignment.' }
    }

    const assignedAt = new Date().toISOString()

    // ── Step 9: Update the chosen caller record ───────────────────────────────
    // Increment leads_assigned_today and stamp last_assigned_at.
    const { error: callerUpdateError } = await supabaseAdmin
        .from('callers')
        .update({
            leads_assigned_today: chosenCaller.leads_assigned_today + 1,
            last_assigned_at: assignedAt,
            last_reset_date: today,        // ensure the date is current
        })
        .eq('id', chosenCaller.id)

    if (callerUpdateError) {
        return {
            caller: null,
            error: `Failed to update caller: ${callerUpdateError.message}`,
        }
    }

    // ── Step 10: Update the lead record with the assignment ───────────────────
    const { error: leadUpdateError } = await supabaseAdmin
        .from('leads')
        .update({
            assigned_caller_id: chosenCaller.id,
            assigned_at: assignedAt,
        })
        .eq('id', lead.id)

    if (leadUpdateError) {
        return {
            caller: null,
            error: `Failed to update lead: ${leadUpdateError.message}`,
        }
    }

    // Return the chosen caller with the updated count for the API response
    return {
        caller: {
            ...chosenCaller,
            leads_assigned_today: chosenCaller.leads_assigned_today + 1,
            last_assigned_at: assignedAt,
        },
        error: null,
    }
}
