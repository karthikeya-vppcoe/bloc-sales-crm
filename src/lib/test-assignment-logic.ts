/**
 * test-assignment-logic.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * A standalone verification script to test the smart assignment algorithm
 * without requiring a live Supabase connection.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Caller } from '../types'

// Mocking the core logic for testing purposes
export function simulateAssignment(
    lead: { state?: string | null },
    callers: Caller[]
): { chosen: Caller | null; reason: string } {
    const today = new Date().toISOString().split('T')[0]

    // ── Step 1: Filter state-preferred pool ───────────────────────────────────
    let candidatePool: Caller[] = []
    if (lead.state && lead.state.trim() !== '') {
        const normalizedLeadState = lead.state.trim().toLowerCase()
        candidatePool = callers.filter((c) =>
            c.assigned_states.some((s: string) => s.trim().toLowerCase() === normalizedLeadState)
        )
    }

    let reason = ''
    if (candidatePool.length > 0) {
        reason = `Matched ${candidatePool.length} callers by state "${lead.state}"`
    } else {
        candidatePool = callers
        reason = 'No state match found. Using global pool.'
    }

    // ── Step 2: Filter by daily cap ──────────────────────────────────────────
    const eligibleCallers = candidatePool.filter(
        (c) => c.leads_assigned_today < c.daily_lead_limit
    )

    if (eligibleCallers.length > 0) {
        // ── Step 3: Round Robin (oldest last_assigned_at) ─────────────────────
        const sorted = [...eligibleCallers].sort((a, b) => {
            if (!a.last_assigned_at && !b.last_assigned_at) return 0
            if (!a.last_assigned_at) return -1
            if (!b.last_assigned_at) return 1
            return new Date(a.last_assigned_at).getTime() - new Date(b.last_assigned_at).getTime()
        })
        return { chosen: sorted[0], reason: `${reason} -> Round Robin picked ${sorted[0].name}` }
    } else {
        // ── Step 4: Overflow (least loaded today) ──────────────────────────────
        const sorted = [...candidatePool].sort(
            (a, b) => a.leads_assigned_today - b.leads_assigned_today
        )
        return { chosen: sorted[0], reason: `${reason} -> ALL AT CAP. Overflow picked least-loaded: ${sorted[0].name}` }
    }
}

// ── TEST SUITE ───────────────────────────────────────────────────────────────

const mockCallers: Caller[] = [
    {
        id: '1', name: 'Maharashtra Agent', daily_lead_limit: 10, leads_assigned_today: 5,
        assigned_states: ['Maharashtra'], last_assigned_at: '2026-02-26T10:00:00Z',
        role: 'Sales', languages: ['Hindi'], last_reset_date: '2026-02-26', created_at: ''
    },
    {
        id: '2', name: 'Global Agent 1 (Never)', daily_lead_limit: 60, leads_assigned_today: 0,
        assigned_states: [], last_assigned_at: null,
        role: 'Sales', languages: ['English'], last_reset_date: '2026-02-26', created_at: ''
    },
    {
        id: '3', name: 'Global Agent 2 (Recent)', daily_lead_limit: 60, leads_assigned_today: 2,
        assigned_states: [], last_assigned_at: '2026-02-26T12:00:00Z',
        role: 'Sales', languages: ['English'], last_reset_date: '2026-02-26', created_at: ''
    },
    {
        id: '4', name: 'Maxed Out Agent', daily_lead_limit: 2, leads_assigned_today: 2,
        assigned_states: ['Karnataka'], last_assigned_at: '2026-02-26T08:00:00Z',
        role: 'Sales', languages: ['English'], last_reset_date: '2026-02-26', created_at: ''
    }
]

console.log('--- TEST 1: State Match (Maharashtra) ---')
const t1 = simulateAssignment({ state: 'Maharashtra' }, mockCallers)
console.log(t1.reason) // Expected: Matched Maharashtra Agent

console.log('\n--- TEST 2: Round Robin (Global) ---')
const t2 = simulateAssignment({ state: 'Goa' }, mockCallers)
console.log(t2.reason) // Expected: Never assigned Agent 1 should pick up

console.log('\n--- TEST 3: Daily Cap Overflow (Karnataka) ---')
// Simulate Karnataka lead where only agent is maxed out
const t3 = simulateAssignment({ state: 'Karnataka' }, mockCallers)
console.log(t3.reason) // Expected: Maxed Agent 4 is at cap. Overflow should pick agent with fewest leads overall?
// Actually the logic says if everyone in candidate pool is at cap, pick least-loaded from candidate pool.
// Agent 4 is the only one in Karnataka pool. It will pick Agent 4.

console.log('\n--- TEST SUITE COMPLETE ---')
