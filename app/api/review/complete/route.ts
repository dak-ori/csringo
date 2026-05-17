import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body?.review_queue_id) {
    return NextResponse.json({ error: 'review_queue_id required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('review_queue')
    .update({ reviewed_at: new Date().toISOString() })
    .eq('id', body.review_queue_id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
