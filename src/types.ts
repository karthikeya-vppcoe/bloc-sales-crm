// ─────────────────────────────────────────────
//  Shared TypeScript types for Bloc Sales CRM
// ─────────────────────────────────────────────

export interface Caller {
    id: string
    name: string
    role: string | null
    languages: string[]
    daily_lead_limit: number
    assigned_states: string[]
    leads_assigned_today: number
    last_reset_date: string        // ISO date string  e.g. "2026-02-25"
    last_assigned_at: string | null // ISO timestamp or null
    created_at: string
}

export interface Lead {
    id: string
    name: string | null
    phone: string
    timestamp: string | null
    lead_source: string | null
    city: string | null
    state: string | null
    metadata: Record<string, unknown>
    assigned_caller_id: string | null
    assigned_at: string | null
    created_at: string
    // Joined field — populated when we JOIN callers on the dashboard
    callers?: Pick<Caller, 'id' | 'name'> | null
}

// Payload accepted by POST /api/ingest
export interface IngestPayload {
    name?: string
    phone: string
    timestamp?: string
    lead_source?: string
    city?: string
    state?: string
    metadata?: Record<string, unknown>
}
