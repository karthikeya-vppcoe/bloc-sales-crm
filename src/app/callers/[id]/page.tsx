import { createSupabaseServerClient } from '@/lib/supabase-server'
import type { Caller } from '@/types'
import CallerFormWrapper from './CallerFormWrapper'
import { notFound, redirect } from 'next/navigation'

export const revalidate = 0

interface Props {
    params: { id: string }
}

export default async function EditCallerPage({ params }: Props) {
    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/auth/signin')
    }

    const { data: caller, error } = await supabase
        .from('callers')
        .select('*')
        .eq('id', params.id)
        .single()

    if (error || !caller) {
        notFound()
    }

    return (
        <div className="max-w-2xl">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-foreground">Edit Caller</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Update details for <span className="text-foreground font-semibold">{caller.name}</span>
                </p>
            </div>
            {/* Wrap in a client component so CallerForm (client) gets the data */}
            <CallerFormWrapper caller={caller as Caller} />
        </div>
    )
}
