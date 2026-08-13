import { redirect } from 'next/navigation'
import { BottomNav } from '@/components/layout/bottom-nav'
import { DEMO_ENABLED } from '@/lib/demo'

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  if (!DEMO_ENABLED) {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')
  }

  return (
    <div className="min-h-screen pb-16">
      {children}
      <BottomNav />
    </div>
  )
}
