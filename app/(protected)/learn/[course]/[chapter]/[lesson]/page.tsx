import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import LessonView from '@/components/lesson/lesson-view'
import type { Card, Problem } from '@/lib/types/lesson'

interface Props {
  params: Promise<{ course: string; chapter: string; lesson: string }>
}

export default async function LessonPage({ params }: Props) {
  const { lesson: lessonSlug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: lesson } = await supabase
    .from('lessons')
    .select('id, title, cards')
    .eq('slug', lessonSlug)
    .single()

  if (!lesson) notFound()

  const { data: problems } = await supabase
    .from('problems')
    .select('id, type, content, correct_answer, hint, concept_tags, order_index, xp_reward')
    .eq('lesson_id', lesson.id)
    .order('order_index')

  return (
    <main className="min-h-screen">
      <div className="max-w-lg mx-auto px-4 pt-4">
        <h1 className="text-lg font-semibold mb-4">{lesson.title}</h1>
      </div>
      <LessonView
        lessonId={lesson.id}
        cards={lesson.cards as Card[]}
        problems={(problems ?? []) as Problem[]}
      />
    </main>
  )
}
