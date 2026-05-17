import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Course } from '@/lib/types/lesson'

export default async function LearnPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: courses } = await supabase
    .from('courses')
    .select('id, slug, title, description, icon, order_index')
    .order('order_index')

  return (
    <main className="max-w-lg mx-auto px-4 pt-8 pb-24">
      <h1 className="text-2xl font-bold mb-6">학습</h1>
      <div className="space-y-3">
        {(courses as Course[] ?? []).map(course => (
          <Link
            key={course.id}
            href={`/learn/${course.slug}`}
            className="flex items-center gap-4 p-4 rounded-xl border hover:bg-muted transition-colors"
          >
            <span className="text-3xl">{course.icon}</span>
            <div>
              <p className="font-semibold">{course.title}</p>
              {course.description && (
                <p className="text-sm text-muted-foreground">{course.description}</p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </main>
  )
}
