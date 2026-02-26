'use client'

/**
 * CallerForm.tsx
 * ─────────────────────────────────────────────
 * Reusable form for Creating or Editing a Sales Caller.
 * Used in:
 *   - /callers  (Create new caller button opens this)
 *   - /callers/[id]  (Edit existing caller)
 *
 * Handles: Name, Role, Languages (multi-checkbox), Daily Lead Limit, Assigned States (multi-checkbox)
 */

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Caller } from '@/types'
import { useRouter } from 'next/navigation'

// ── Available options ─────────────────────────────────────────────────────
const ALL_LANGUAGES = [
    'Hindi', 'English', 'Kannada', 'Marathi', 'Tamil',
    'Telugu', 'Bengali', 'Gujarati', 'Punjabi', 'Malayalam',
]

const ALL_STATES = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
    'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
    'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
    'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
    'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
    'Delhi', 'Chandigarh', 'Jammu & Kashmir', 'Ladakh',
]

// ── Props ─────────────────────────────────────────────────────────────────
interface CallerFormProps {
    /** Pass existing caller data when editing. Omit / pass null when creating. */
    existing?: Caller | null
    onSuccess?: () => void
}

export default function CallerForm({ existing, onSuccess }: CallerFormProps) {
    const router = useRouter()
    const isEditing = !!existing

    // Form state — initialise with existing data when editing
    const [name, setName] = useState(existing?.name ?? '')
    const [role, setRole] = useState(existing?.role ?? '')
    const [languages, setLanguages] = useState<string[]>(existing?.languages ?? [])
    const [dailyLimit, setDailyLimit] = useState(existing?.daily_lead_limit ?? 60)
    const [assignedStates, setAssignedStates] = useState<string[]>(existing?.assigned_states ?? [])

    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // ── Toggle helper for multi-checkbox arrays ─────────────────────────────
    function toggle(arr: string[], item: string): string[] {
        return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item]
    }

    // ── Form submission ──────────────────────────────────────────────────────
    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)

        if (!name.trim()) {
            setError('Caller name is required.')
            return
        }

        setSaving(true)

        const payload = {
            name: name.trim(),
            role: role.trim() || null,
            languages,
            daily_lead_limit: dailyLimit,
            assigned_states: assignedStates,
        }

        let dbError

        if (isEditing) {
            const { error: e } = await supabase
                .from('callers')
                .update(payload)
                .eq('id', existing!.id)
            dbError = e
        } else {
            const { error: e } = await supabase
                .from('callers')
                .insert(payload)
            dbError = e
        }

        setSaving(false)

        if (dbError) {
            setError(dbError.message)
            return
        }

        onSuccess?.()
        router.push('/callers')
        router.refresh()
    }

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <form onSubmit={handleSubmit} className="space-y-6">

            {/* Error banner */}
            {error && (
                <div className="rounded-md bg-destructive/20 border border-destructive/50 px-4 py-3 text-sm text-red-400">
                    {error}
                </div>
            )}

            {/* Name */}
            <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                    Full Name <span className="text-red-400">*</span>
                </label>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Priya Sharma"
                    className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                />
            </div>

            {/* Role */}
            <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                    Role
                </label>
                <input
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="e.g. Senior Sales Caller"
                    className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
            </div>

            {/* Daily Lead Limit */}
            <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                    Daily Lead Limit
                </label>
                <input
                    type="number"
                    value={dailyLimit}
                    onChange={(e) => setDailyLimit(Number(e.target.value))}
                    min={1}
                    max={500}
                    className="w-32 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="mt-1 text-xs text-muted-foreground">Max leads this caller handles per day.</p>
            </div>

            {/* Languages */}
            <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Languages Known
                </label>
                <div className="flex flex-wrap gap-2">
                    {ALL_LANGUAGES.map((lang) => (
                        <label key={lang} className="flex items-center gap-1.5 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={languages.includes(lang)}
                                onChange={() => setLanguages(toggle(languages, lang))}
                                className="accent-primary h-4 w-4 rounded"
                            />
                            <span className="text-sm text-foreground">{lang}</span>
                        </label>
                    ))}
                </div>
            </div>

            {/* Assigned States */}
            <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                    Assigned States
                </label>
                <p className="text-xs text-muted-foreground mb-2">
                    Leads from these states will be preferentially routed to this caller.
                </p>
                <div className="border border-border rounded-md p-3 max-h-48 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-y-1.5 gap-x-4">
                    {ALL_STATES.map((state) => (
                        <label key={state} className="flex items-center gap-1.5 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={assignedStates.includes(state)}
                                onChange={() => setAssignedStates(toggle(assignedStates, state))}
                                className="accent-primary h-4 w-4 rounded"
                            />
                            <span className="text-sm text-foreground">{state}</span>
                        </label>
                    ))}
                </div>
                {assignedStates.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                        Selected: {assignedStates.join(', ')}
                    </p>
                )}
            </div>

            {/* Submit */}
            <div className="flex gap-3 pt-2">
                <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                    {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Caller'}
                </button>
                <button
                    type="button"
                    onClick={() => router.back()}
                    className="rounded-md border border-border px-5 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                    Cancel
                </button>
            </div>
        </form>
    )
}
