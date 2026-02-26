'use client'

import { createSupabaseClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LogoutButton() {
    const router = useRouter()
    const supabase = createSupabaseClient()

    const handleSignOut = async () => {
        await supabase.auth.signOut()
        router.push('/auth/signin')
        router.refresh()
    }

    return (
        <button
            onClick={handleSignOut}
            className="px-4 py-2 rounded-md text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
        >
            Logout
        </button>
    )
}
