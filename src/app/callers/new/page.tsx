import CallerForm from '@/components/CallerForm'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'

export default async function NewCallerPage() {
    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/auth/signin')
    }

    return (
        <div className="max-w-2xl">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-foreground">Add New Caller</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Create a new sales caller who will receive auto-assigned leads.
                </p>
            </div>
            <CallerForm existing={null} />
        </div>
    )
}
