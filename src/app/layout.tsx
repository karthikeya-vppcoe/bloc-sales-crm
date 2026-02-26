import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Link from 'next/link'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
    title: 'Bloc Sales CRM',
    description: 'Smart lead management & auto-assignment CRM for Bloc',
}

import { createSupabaseServerClient } from '@/lib/supabase-server'
import LogoutButton from '@/components/LogoutButton'

export default async function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    return (
        <html lang="en" className="dark">
            <body className={inter.className}>
                {/* ── Top navigation bar ────────────────────────────── */}
                <header className="border-b border-border sticky top-0 z-50 bg-background/80 backdrop-blur-sm">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex items-center justify-between h-16">
                            {/* Brand */}
                            <Link href="/dashboard" className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                                    <span className="text-primary-foreground font-bold text-sm">B</span>
                                </div>
                                <span className="font-semibold text-lg text-foreground">Bloc CRM</span>
                            </Link>

                            {/* Nav links */}
                            <nav className="flex items-center gap-1">
                                <Link
                                    href="/dashboard"
                                    className="px-4 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                                >
                                    Dashboard
                                </Link>
                                <Link
                                    href="/callers"
                                    className="px-4 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                                >
                                    Callers
                                </Link>
                                {user ? (
                                    <LogoutButton />
                                ) : (
                                    <Link
                                        href="/auth/signin"
                                        className="px-4 py-2 rounded-md text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
                                    >
                                        Sign In
                                    </Link>
                                )}
                            </nav>
                        </div>
                    </div>
                </header>

                {/* ── Page content ──────────────────────────────────── */}
                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {children}
                </main>
            </body>
        </html>
    )
}
