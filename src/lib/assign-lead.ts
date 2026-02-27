/**
 * assign-lead.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Refactored to use the public.assign_lead_atomic() RPC.
 * This ensures that lead assignment is a single atomic transaction on the DB,
 * preventing race conditions in high-concurrency scenarios (10k+ leads/day).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { supabaseAdmin } from '@/lib/supabase-admin'

export interface AssignmentResult {
    success: boolean
    caller_id: string | null
    caller_name: string | null
    reason: string | null
    error: string | null
}

export async function smartAssignLead(
    lead: { id: string; state?: string | null }
): Promise<AssignmentResult> {

    // ── Atomic RPC Call ──────────────────────────────────────────────────────
    // We call the Postgres function via Supabase RPC.
    // This handles fairness, caps, and resets internally in one SQL transaction.
    const { data, error } = await supabaseAdmin.rpc('assign_lead_atomic', {
        p_lead_id: lead.id,
        p_state: lead.state || ''
    })

    if (error) {
        return {
            success: false,
            caller_id: null,
            caller_name: null,
            reason: null,
            error: error.message
        }
    }

    const result = data as any

    // Return the result matching the expectations of the ingest API and dashboard
    return {
        success: result?.success ?? false,
        caller_id: result?.caller_id ?? null,
        caller_name: result?.caller_name ?? null,
        reason: result?.reason ?? null,
        error: result?.success ? null : (result?.error || 'Unknown assignment failure')
    }
}
