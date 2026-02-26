import { redirect } from 'next/navigation'

// Root "/" redirects straight to the dashboard
export default function Home() {
    redirect('/dashboard')
}
