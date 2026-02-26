/**
 * /callers — Server Component
 * Lists all callers with their stats. Has a "New Caller" button
 * that links to the create form (/callers/new).
 */

import { createSupabaseServerClient } from '@/lib/supabase-server'
import type { Caller } from '@/types'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export const revalidate = 0

export default async function CallersPage() {
    const supabase = createSupabaseServerClient()

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        redirect('/auth/signin')
    }

    const { data: callers } = await supabase
        .from('callers')
        .select('*')
        .order('created_at', { ascending: true })

    const typedCallers = (callers ?? []) as Caller[]

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Sales Callers</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Manage callers, their daily limits, languages, and assigned states.
                    </p>
                </div>
                <Link
                    href="/callers/new"
                    className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
                >
                    + New Caller
                </Link>
            </div>

            {/* Callers grid */}
            {typedCallers.length === 0 ? (
                <div className="rounded-lg border border-border bg-card p-12 text-center">
                    <p className="text-muted-foreground text-sm">No callers yet.</p>
                    <Link
                        href="/callers/new"
                        className="mt-4 inline-block text-primary text-sm hover:underline"
                    >
                        Add your first caller →
                    </Link>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {typedCallers.map((caller) => {
                        const pct = Math.min(
                            100,
                            Math.round((caller.leads_assigned_today / caller.daily_lead_limit) * 100)
                        )
                        const isAtCap = caller.leads_assigned_today >= caller.daily_lead_limit
                        return (
                            <div
                                key={caller.id}
                                className="rounded-lg border border-border bg-card p-5 flex flex-col gap-3"
                            >
                                {/* Name + role */}
                                <div>
                                    <h2 className="font-semibold text-foreground">{caller.name}</h2>
                                    {caller.role && (
                                        <p className="text-xs text-muted-foreground">{caller.role}</p>
                                    )}
                                </div>

                                {/* Lead cap bar */}
                                <div>
                                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                        <span>Leads today</span>
                                        <span className={isAtCap ? 'text-red-400 font-semibold' : ''}>
                                            {caller.leads_assigned_today} / {caller.daily_lead_limit}
                                            {isAtCap && ' (AT CAP)'}
                                        </span>
                                    </div>
                                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all ${isAtCap ? 'bg-red-500' : 'bg-primary'}`}
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Languages */}
                                {caller.languages.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                        {caller.languages.map((lang) => (
                                            <span
                                                key={lang}
                                                className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground"
                                            >
                                                {lang}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Assigned states */}
                                {caller.assigned_states.length > 0 && (
                                    <p className="text-xs text-muted-foreground">
                                        <span className="font-medium text-foreground">States: </span>
                                        {caller.assigned_states.join(', ')}
                                    </p>
                                )}

                                {/* Edit link */}
                                <Link
                                    href={`/callers/${caller.id}`}
                                    className="mt-auto self-start text-xs text-primary hover:underline"
                                >
                                    Edit →
                                </Link>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
