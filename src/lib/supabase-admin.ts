/**
 * supabase-admin.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Server-only Supabase client using the service_role key.
 * This client BYPASSES Row Level Security (RLS).
 *
 * IMPORTANT: This file must ONLY be imported in:
 *  - API Routes
 *  - Server Actions
 *  - Server Components (that don't lead to client-side imports)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseServiceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing in env variables')
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
    },
})
