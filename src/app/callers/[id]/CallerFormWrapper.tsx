'use client'
/**
 * CallerFormWrapper.tsx (collocated in /callers/[id]/)
 * Bridges the server-fetched Caller data into the client CallerForm component.
 * This pattern is needed because CallerForm is a client component but the
 * parent page is a server component.
 */
import CallerForm from '@/components/CallerForm'
import type { Caller } from '@/types'

export default function CallerFormWrapper({ caller }: { caller: Caller }) {
    return <CallerForm existing={caller} />
}
