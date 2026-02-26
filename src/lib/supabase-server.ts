/**
 * supabase-server.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Supabase client for Server Components, Actions, and API Routes.
 * Uses next/headers to handle session cookies automatically.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const createSupabaseServerClient = () => {
    const cookieStore = cookies()

    return createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
            get(name: string) {
                return cookieStore.get(name)?.value
            },
            set(name: string, value: string, options: any) {
                try {
                    cookieStore.set({ name, value, ...options })
                } catch (error) {
                    // This can be ignored if called from a Server Component
                }
            },
            remove(name: string, options: any) {
                try {
                    cookieStore.set({ name, value: '', ...options })
                } catch (error) {
                    // This can be ignored if called from a Server Component
                }
            },
        },
    })
}
