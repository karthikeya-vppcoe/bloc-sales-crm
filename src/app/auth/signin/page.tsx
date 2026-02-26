'use client'

import { useState } from 'react'
import { createSupabaseClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SignInPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const router = useRouter()
    const supabase = createSupabaseClient()

    const handleSignIn = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (error) {
            setError(error.message)
            setLoading(false)
        } else {
            router.push('/dashboard')
            router.refresh()
        }
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-16rem)]">
            <div className="w-full max-w-md p-8 bg-card rounded-lg border border-border shadow-lg">
                <h1 className="text-2xl font-bold mb-6 text-center">Sign In to Bloc CRM</h1>

                {error && (
                    <div className="mb-4 p-3 bg-destructive/20 border border-destructive/50 text-red-500 rounded text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSignIn} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1 text-muted-foreground">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full p-2 bg-background border border-border rounded focus:ring-2 focus:ring-primary outline-none"
                            placeholder="you@example.com"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1 text-muted-foreground">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full p-2 bg-background border border-border rounded focus:ring-2 focus:ring-primary outline-none"
                            placeholder="••••••••"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-2 bg-primary text-primary-foreground font-semibold rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                        {loading ? 'Signing In...' : 'Sign In'}
                    </button>
                </form>

                <p className="mt-6 text-center text-sm text-muted-foreground">
                    Don't have an account?{' '}
                    <Link href="/auth/signup" className="text-primary hover:underline">
                        Sign Up
                    </Link>
                </p>
            </div>
        </div>
    )
}
