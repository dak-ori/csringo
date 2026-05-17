import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'

interface Props {
  params: Promise<{ course: string }>
}

export default async function CoursePage({ params }: Props) {
  const { course: courseSlug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: course } = await supabase
    .from('courses')
    .select('id, slug, title, icon')
    .eq('slug', courseSlug)
    .single()

  if (!course) notFound()

  const { data: chapters } = await supabase
    .from('chapters')
    .select(`
      id, slug, title, order_index,
      lessons (id, slug, title, estimated_minutes, order_index)
    `)
    .eq('course_id', course.id)
    .order('order_index')

  const { data: progress } = await supabase
    .from('user_progress')
    .select('lesson_id')
    .eq('user_id', user.id)
    .eq('status', 'completed')

  const completedIds = new Set(progress?.map(p => p.lesson_id) ?? [])

  return (
    <main className="max-w-lg mx-auto px-4 pt-8 pb-24">
      <div className="flex items-center gap-2 mb-6">
        <span className="text-2xl">{course.icon}</span>
        <h1 className="text-2xl font-bold">{course.title}</h1>
      </div>

      <div className="space-y-6">
        {(chapters ?? []).map(chapter => {
          const lessons = (chapter.lessons as Array<{
            id: string; slug: string; title: string; estimated_minutes: number; order_index: number
          }>).sort((a, b) => a.order_index - b.order_index)

          return (
            <div key={chapter.id}>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                {chapter.title}
              </h2>
              <div className="space-y-2">
                {lessons.map(lesson => {
                  const done = completedIds.has(lesson.id)
                  return (
                    <Link
                      key={lesson.id}
                      href={`/learn/${courseSlug}/${chapter.slug}/${lesson.slug}`}
                      className="flex items-center justify-between p-4 rounded-xl border hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{done ? '✅' : '📖'}</span>
                        <div>
                          <p className="font-medium">{lesson.title}</p>
                          <p className="text-xs text-muted-foreground">{lesson.estimated_minutes}분</p>
                        </div>
                      </div>
                      <span className="text-muted-foreground">›</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </main>
  )
}
