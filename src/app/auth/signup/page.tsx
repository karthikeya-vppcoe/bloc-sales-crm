'use client'

import { useState } from 'react'
import { createSupabaseClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SignUpPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const router = useRouter()
    const supabase = createSupabaseClient()

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
        })

        if (error) {
            setError(error.message)
            setLoading(false)
        } else {
            setSuccess(true)
            setLoading(false)
            // Auto sign-in or redirect can be handled based on Supabase config (Auto confirm)
            // Here we show a success message or redirect to signin
        }
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-16rem)]">
            <div className="w-full max-w-md p-8 bg-card rounded-lg border border-border shadow-lg">
                <h1 className="text-2xl font-bold mb-6 text-center">Create Account</h1>

                {error && (
                    <div className="mb-4 p-3 bg-destructive/20 border border-destructive/50 text-red-500 rounded text-sm">
                        {error}
                    </div>
                )}

                {success ? (
                    <div className="text-center">
                        <div className="mb-4 p-3 bg-green-500/20 border border-green-500/50 text-green-500 rounded text-sm">
                            Account created successfully! Please check your email for a confirmation link (if enabled) or sign in now.
                        </div>
                        <Link
                            href="/auth/signin"
                            className="inline-block py-2 px-4 bg-primary text-primary-foreground font-semibold rounded hover:opacity-90 transition-opacity"
                        >
                            Go to Sign In
                        </Link>
                    </div>
                ) : (
                    <>
                        <form onSubmit={handleSignUp} className="space-y-4">
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
                                {loading ? 'Creating Account...' : 'Sign Up'}
                            </button>
                        </form>

                        <p className="mt-6 text-center text-sm text-muted-foreground">
                            Already have an account?{' '}
                            <Link href="/auth/signin" className="text-primary hover:underline">
                                Sign In
                            </Link>
                        </p>
                    </>
                )}
            </div>
        </div>
    )
}
