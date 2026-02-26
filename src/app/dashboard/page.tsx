/**
 * dashboard/page.tsx — Server Component
 * ─────────────────────────────────────────────────────────────────────────────
 * Loads initial data server-side (no loading flash), then hands off to the
 * client-side LeadsTable component which opens a Realtime subscription and
 * keeps the table updated without page refreshes.
 */

import { createSupabaseServerClient } from '@/lib/supabase-server'
import LeadsTable from '@/components/LeadsTable'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Lead, Caller } from '@/types'

export const revalidate = 0  // Always fetch fresh data (disable Next.js cache)

export default async function DashboardPage() {
    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/auth/signin')
    }

    // ── Fetch leads (with joined caller name) ─────────────────────────────────
    const { data: leads } = await supabase
        .from('leads')
        .select('*, callers(id, name)')
        .order('created_at', { ascending: false })
        .limit(200)

    // ── Fetch callers for summary stats ──────────────────────────────────────
    const { data: callers } = await supabase
        .from('callers')
        .select('*')
        .order('created_at', { ascending: true })

    const typedLeads = (leads ?? []) as Lead[]
    const typedCallers = (callers ?? []) as Caller[]

    // Compute today's date for "leads today" stat
    const todayStr = new Date().toISOString().split('T')[0]
    const leadsToday = typedLeads.filter(
        (l) => l.created_at?.startsWith(todayStr)
    ).length

    const unassigned = typedLeads.filter((l) => !l.assigned_caller_id).length

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-8">

            {/* Page header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Live lead feed — auto-updates when new leads arrive via Make.com
                    </p>
                </div>
                <Link
                    href="/callers"
                    className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
                >
                    Manage Callers
                </Link>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatCard label="Total Leads" value={typedLeads.length} />
                <StatCard label="Leads Today" value={leadsToday} highlight />
                <StatCard label="Active Callers" value={typedCallers.length} />
                <StatCard
                    label="Unassigned"
                    value={unassigned}
                    warn={unassigned > 0}
                />
            </div>

            {/* Callers quick-glance strip */}
            {typedCallers.length > 0 && (
                <div>
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                        Caller Load Today
                    </h2>
                    <div className="flex flex-wrap gap-3">
                        {typedCallers.map((caller) => {
                            const pct = Math.min(
                                100,
                                Math.round((caller.leads_assigned_today / caller.daily_lead_limit) * 100)
                            )
                            const isAtCap = caller.leads_assigned_today >= caller.daily_lead_limit
                            return (
                                <Link
                                    key={caller.id}
                                    href={`/callers/${caller.id}`}
                                    className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 hover:bg-accent transition-colors min-w-[200px]"
                                >
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-foreground truncate">{caller.name}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all ${isAtCap ? 'bg-red-500' : 'bg-primary'}`}
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                                                {caller.leads_assigned_today}/{caller.daily_lead_limit}
                                            </span>
                                        </div>
                                    </div>
                                </Link>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Realtime leads table */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        All Leads
                    </h2>
                    <span className="flex items-center gap-1.5 text-xs text-green-400">
                        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                        Live
                    </span>
                </div>
                {/* Client component — handles realtime subscription */}
                <LeadsTable initialLeads={typedLeads} />
            </div>
        </div>
    )
}

// ── Stat card sub-component ──────────────────────────────────────────────────
function StatCard({
    label,
    value,
    highlight = false,
    warn = false,
}: {
    label: string
    value: number
    highlight?: boolean
    warn?: boolean
}) {
    return (
        <div className={`
            rounded-xl border p-5 transition-all duration-200 hover:shadow-lg hover:-translate-y-1
            ${warn
                ? 'border-orange-500/30 bg-orange-500/5 shadow-orange-500/5'
                : 'border-border bg-card shadow-sm'
            }
            ${highlight ? 'ring-1 ring-primary/20' : ''}
        `}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className={`mt-2 text-4xl font-extrabold tracking-tight ${highlight ? 'text-primary' : warn ? 'text-orange-400' : 'text-foreground'}`}>
                {value}
            </p>
        </div>
    )
}
