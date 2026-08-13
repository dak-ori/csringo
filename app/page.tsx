import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DEMO_ENABLED } from '@/lib/demo'

export default async function RootPage() {
  if (DEMO_ENABLED) redirect('/dashboard')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  } else {
    redirect('/login')
  }
}
