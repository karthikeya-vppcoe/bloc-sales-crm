/**
 * /api/ingest — POST endpoint
 * ─────────────────────────────────────────────────────────────────────────────
 * Receives a new lead payload (from Make.com, n8n, Zapier, or manual test),
 * inserts it into the leads table, then immediately calls smartAssignLead()
 * to auto-assign it to the best available sales caller.
 *
 * Expected JSON body:
 * {
 *   "name":        "Rahul Sharma",          // optional
 *   "phone":       "9876543210",            // REQUIRED
 *   "timestamp":   "2026-02-25T10:00:00Z", // optional — defaults to now()
 *   "lead_source": "Reels",                 // optional
 *   "city":        "Mumbai",                // optional
 *   "state":       "Maharashtra",           // optional — used for smart assignment
 *   "metadata":    { "campaign": "feb25" }  // optional extra fields
 * }
 *
 * Response 200:
 * {
 *   "success": true,
 *   "lead": { ...leadRow },
 *   "assignedCaller": { ...callerRow } | null
 * }
 *
 * Response 400: validation error (missing phone)
 * Response 500: DB / assignment error
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { smartAssignLead } from '@/lib/assign-lead'
import type { IngestPayload } from '@/types'

export async function POST(req: NextRequest) {
    // ── Parse and validate request body ──────────────────────────────────────
    let body: IngestPayload

    try {
        body = await req.json()
    } catch {
        return NextResponse.json(
            { success: false, error: 'Invalid JSON body.' },
            { status: 400 }
        )
    }

    // `phone` is the only required field — it uniquely identifies a WhatsApp lead
    if (!body.phone || body.phone.trim() === '') {
        return NextResponse.json(
            { success: false, error: 'Missing required field: phone' },
            { status: 400 }
        )
    }

    // ── Insert lead into the database ─────────────────────────────────────────
    // We use supabaseAdmin (service_role) so this bypasses RLS.
    // The lead starts unassigned — smartAssignLead() fills in assigned_caller_id.
    const { data: lead, error: insertError } = await supabaseAdmin
        .from('leads')
        .insert({
            name: body.name ?? null,
            phone: body.phone.trim(),
            timestamp: body.timestamp ?? new Date().toISOString(),
            lead_source: body.lead_source ?? null,
            city: body.city ?? null,
            state: body.state ?? null,
            metadata: body.metadata ?? {},
        })
        .select()   // return the inserted row (including its generated uuid)
        .single()

    if (insertError || !lead) {
        console.error('[/api/ingest] Insert error:', insertError)
        return NextResponse.json(
            { success: false, error: `Failed to insert lead: ${insertError?.message}` },
            { status: 500 }
        )
    }

    // ── Smart assignment ────────────────────────────────────────────────────
    // Pass the lead's id and state into the assignment engine.
    // This function handles all round-robin, cap, and fallback logic internally.
    const { caller: assignedCaller, error: assignError } = await smartAssignLead(lead)

    if (assignError) {
        // Non-fatal: lead is already persisted, just not assigned yet.
        // Log it but return success so Make.com doesn't retry the webhook.
        console.warn('[/api/ingest] Assignment warning:', assignError)
    }

    // ── Return full response ──────────────────────────────────────────────────
    return NextResponse.json(
        {
            success: true,
            lead: {
                ...lead,
                assigned_caller_id: assignedCaller?.id ?? null,
                assigned_at: assignedCaller ? new Date().toISOString() : null,
            },
            assignedCaller: assignedCaller ?? null,
            assignmentWarning: assignError ?? undefined,
        },
        { status: 200 }
    )
}

// ── Method guard ─────────────────────────────────────────────────────────────
// Return 405 for any non-POST request to this route.
export async function GET() {
    return NextResponse.json(
        { error: 'Method not allowed. Use POST.' },
        { status: 405 }
    )
}
