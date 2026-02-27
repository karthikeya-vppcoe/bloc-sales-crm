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

// ── Generic CORS Headers Helper ──────────────────────────────────────────────
function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
}

export async function POST(req: NextRequest) {
    // ── 1. Secure Ingest Validation ──────────────────────────────────────────
    const authHeader = req.headers.get('X-Webhook-Secret')
    const webhookSecret = process.env.WEBHOOK_SECRET

    // Only enforce if secret is configured (standard production practice)
    if (webhookSecret && authHeader !== webhookSecret) {
        return NextResponse.json(
            { success: false, error: 'Unauthorized: Invalid Webhook Secret' },
            { status: 401, headers: corsHeaders() }
        )
    }

    // ── 2. Parse and validate request body ────────────────────────────────────
    let body: IngestPayload

    try {
        body = await req.json()
    } catch {
        return NextResponse.json(
            { success: false, error: 'Invalid JSON body.' },
            { status: 400, headers: corsHeaders() }
        )
    }

    if (!body.phone || body.phone.trim() === '') {
        return NextResponse.json(
            { success: false, error: 'Missing required field: phone' },
            { status: 400, headers: corsHeaders() }
        )
    }

    const cleanPhone = body.phone.trim()

    // ── 3. Duplicate Lead Protection (24h window) ─────────────────────────────
    // Check if this phone number was already ingested in the last 24 hours.
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { data: existingLead } = await supabaseAdmin
        .from('leads')
        .select('*')
        .eq('phone', cleanPhone)
        .gt('created_at', twentyFourHoursAgo)
        .limit(1)
        .maybeSingle()

    if (existingLead) {
        return NextResponse.json(
            {
                success: true,
                duplicate: true,
                message: 'Duplicate lead detected (24h protection)',
                lead: existingLead
            },
            { status: 200, headers: corsHeaders() }
        )
    }

    // ── 4. Insert lead into the database ──────────────────────────────────────
    const { data: lead, error: insertError } = await supabaseAdmin
        .from('leads')
        .insert({
            name: body.name ?? null,
            phone: cleanPhone,
            timestamp: body.timestamp ?? new Date().toISOString(),
            lead_source: body.lead_source ?? null,
            city: body.city ?? null,
            state: body.state ?? null,
            metadata: body.metadata ?? {},
        })
        .select()
        .single()

    if (insertError || !lead) {
        console.error('[/api/ingest] Insert error:', insertError)
        return NextResponse.json(
            { success: false, error: `Failed to insert lead: ${insertError?.message}` },
            { status: 500, headers: corsHeaders() }
        )
    }

    // ── 5. Smart Atomic Assignment ───────────────────────────────────────────
    // We now delegate the entire assignment logic to a Postgres RPC function
    // to ensure atomicity, fairness, and race-condition prevention.
    const assignmentResult = await smartAssignLead(lead)

    if (assignmentResult.error) {
        console.warn('[/api/ingest] Assignment warning:', assignmentResult.error)
    }

    // ── 6. Return full response ───────────────────────────────────────────────
    return NextResponse.json(
        {
            success: true,
            lead: {
                ...lead,
                assigned_caller_id: assignmentResult.caller_id,
                assigned_at: assignmentResult.success ? new Date().toISOString() : null,
            },
            assignmentResult,
        },
        { status: 200, headers: corsHeaders() }
    )
}

// ── OPTIONS Handler for CORS Preflight ───────────────────────────────────────
export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders() })
}

// ── Method guard ─────────────────────────────────────────────────────────────
// Return 405 for any non-POST request to this route.
export async function GET() {
    return NextResponse.json(
        { error: 'Method not allowed. Use POST.' },
        { status: 405, headers: corsHeaders() }
    )
}
