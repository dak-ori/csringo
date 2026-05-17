import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('review_queue')
    .select(`
      id, priority, added_at,
      problem:problems(id, type, content, correct_answer, hint, concept_tags, xp_reward)
    `)
    .eq('user_id', user.id)
    .is('reviewed_at', null)
    .order('priority', { ascending: false })
    .order('added_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ items: data ?? [] })
}
