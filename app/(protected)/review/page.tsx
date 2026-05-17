import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ReviewList from './review-list'
import type { ReviewQueueItem } from '@/lib/types/lesson'

export default async function ReviewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: items } = await supabase
    .from('review_queue')
    .select(`
      id, priority, added_at,
      problem:problems(id, type, content, correct_answer, hint, concept_tags, xp_reward, lesson_id)
    `)
    .eq('user_id', user.id)
    .is('reviewed_at', null)
    .order('priority', { ascending: false })
    .order('added_at')

  return (
    <main className="max-w-lg mx-auto px-4 pt-8 pb-24">
      <h1 className="text-2xl font-bold mb-6">복습</h1>
      <ReviewList items={(items ?? []) as unknown as ReviewQueueItem[]} />
    </main>
  )
}
