'use client'

/**
 * LeadsTable.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Client component that:
 *  1. Renders the initial leads passed from the server (dashboard/page.tsx)
 *  2. Opens a Supabase Realtime subscription on the `leads` table
 *  3. On INSERT events, prepends the new lead to the top AND flashes the row
 *     with a CSS animation so the user immediately notices new activity.
 *
 * The subscription deliberately re-fetches the full lead row (with the joined
 * caller name) because the realtime payload only contains raw lead columns,
 * not the joined callers data.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { Lead } from '@/types'

interface LeadsTableProps {
    initialLeads: Lead[]
}

export default function LeadsTable({ initialLeads }: LeadsTableProps) {
    const [leads, setLeads] = useState<Lead[]>(initialLeads)
    // Track which lead IDs are "new" (should have flash animation)
    const newLeadIds = useRef<Set<string>>(new Set())

    useEffect(() => {
        // ── Supabase Realtime subscription ────────────────────────────────────
        // Listen for INSERT events on the `leads` table.
        // When a new lead arrives (via /api/ingest), the browser is notified
        // instantly — no polling needed.
        const channel = supabase
            .channel('leads_realtime')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'leads',
                },
                async (payload) => {
                    const newLeadId = payload.new.id as string

                    // Re-fetch the row so we include the caller name (via join)
                    const { data } = await supabase
                        .from('leads')
                        .select('*, callers(id, name)')
                        .eq('id', newLeadId)
                        .single()

                    if (data) {
                        // Mark this lead for flash animation
                        newLeadIds.current.add(data.id)
                        // Prepend to the top of the list
                        setLeads((prev) => [data as Lead, ...prev])
                        // Remove flash class after 2.5s so it doesn't re-animate on re-render
                        setTimeout(() => {
                            newLeadIds.current.delete(data.id)
                        }, 2500)
                    }
                }
            )
            .subscribe()

        // Cleanup on unmount — unsubscribe to avoid memory leaks
        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    // ── Format helpers ────────────────────────────────────────────────────────
    function formatDate(ts: string | null) {
        if (!ts) return '—'
        return new Date(ts).toLocaleString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        })
    }

    function getSourceBadgeColor(source: string | null) {
        if (!source) return 'bg-muted text-muted-foreground'
        const s = source.toLowerCase()
        if (s.includes('reel')) return 'bg-purple-500/20 text-purple-300'
        if (s.includes('meta') || s.includes('form')) return 'bg-blue-500/20 text-blue-300'
        if (s.includes('whatsapp')) return 'bg-green-500/20 text-green-300'
        return 'bg-muted text-muted-foreground'
    }

    // ── Render ────────────────────────────────────────────────────────────────
    if (leads.length === 0) {
        return (
            <div className="rounded-lg border border-border bg-card p-12 text-center">
                <p className="text-muted-foreground text-sm">
                    No leads yet. Send a POST to <code className="text-primary">/api/ingest</code> to add the first one.
                </p>
            </div>
        )
    }

    return (
        <div className="rounded-xl border border-border bg-card/50 backdrop-blur-sm shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border bg-muted/20">
                            <th className="text-left px-6 py-4 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Name</th>
                            <th className="text-left px-6 py-4 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Phone</th>
                            <th className="text-left px-6 py-4 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">City</th>
                            <th className="text-left px-6 py-4 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">State</th>
                            <th className="text-left px-6 py-4 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Source</th>
                            <th className="text-left px-6 py-4 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Assigned To</th>
                            <th className="text-left px-6 py-4 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Received At</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                        {leads.map((lead) => {
                            const isNew = newLeadIds.current.has(lead.id)
                            return (
                                <tr
                                    key={lead.id}
                                    className={`hover:bg-primary/5 transition-colors duration-150 group ${isNew ? 'row-new' : ''}`}
                                >
                                    <td className="px-6 py-4 font-medium text-foreground">
                                        {lead.name ?? <span className="text-muted-foreground italic opacity-50">Unknown</span>}
                                    </td>
                                    <td className="px-6 py-4 text-muted-foreground font-mono text-[11px] group-hover:text-foreground/80 transition-colors">
                                        {lead.phone}
                                    </td>
                                    <td className="px-6 py-4 text-muted-foreground group-hover:text-foreground/80">
                                        {lead.city ?? '—'}
                                    </td>
                                    <td className="px-6 py-4 text-muted-foreground group-hover:text-foreground/80">
                                        {lead.state ?? '—'}
                                    </td>
                                    <td className="px-6 py-4">
                                        {lead.lead_source ? (
                                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-tight shadow-sm ${getSourceBadgeColor(lead.lead_source)}`}>
                                                {lead.lead_source}
                                            </span>
                                        ) : (
                                            <span className="text-muted-foreground opacity-30">—</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {lead.callers ? (
                                            <span className="inline-flex items-center gap-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                                                <span className="text-foreground font-semibold text-xs">{lead.callers.name}</span>
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 text-orange-400 text-[10px] font-bold bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/20">
                                                ⚠ UNASSIGNED
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-muted-foreground text-[11px] whitespace-nowrap opacity-70 group-hover:opacity-100 transition-opacity">
                                        {formatDate(lead.timestamp ?? lead.created_at)}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
