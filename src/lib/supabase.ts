/**
 * supabase.ts (Client)
 * ─────────────────────────────────────────────────────────────────────────────
 * Supabase client for Client Components.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const createSupabaseClient = () =>
    createBrowserClient(supabaseUrl, supabaseAnonKey)

// For backward compatibility with existing client components
export const supabase = createSupabaseClient()
