import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

// Node 20 has no native WebSocket; suppress realtime init
// @ts-ignore
if (!globalThis.WebSocket) globalThis.WebSocket = class {}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('환경변수 필요: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

interface CourseJson {
  slug: string
  title: string
  description: string
  icon: string
  order_index: number
}

interface ProblemJson {
  type: 'fill_blank' | 'drag_order' | 'logic_flow'
  content: unknown
  correct_answer: string[]
  hint?: string | null
  concept_tags: string[]
  order_index: number
  xp_reward: number
}

interface LessonJson {
  slug: string
  title: string
  order_index: number
  estimated_minutes: number
  xp_reward: number
  concept_tags: string[]
  cards: Array<{ title: string; content: string }>
  problems: ProblemJson[]
}

interface ChapterJson {
  course_slug: string
  slug: string
  title: string
  order_index: number
  lessons: LessonJson[]
}

async function seedCourses(courses: CourseJson[]) {
  console.log('📚 코스 시딩...')
  const { error } = await supabase
    .from('courses')
    .upsert(courses, { onConflict: 'slug' })
  if (error) throw error
  console.log(`  ✓ ${courses.length}개 코스`)
}

async function seedChapter(chapter: ChapterJson) {
  const { data: course, error: ce } = await supabase
    .from('courses')
    .select('id')
    .eq('slug', chapter.course_slug)
    .single()
  if (ce || !course) throw new Error(`코스 없음: ${chapter.course_slug}`)

  const { data: ch, error: che } = await supabase
    .from('chapters')
    .upsert(
      { course_id: course.id, slug: chapter.slug, title: chapter.title, order_index: chapter.order_index },
      { onConflict: 'slug' }
    )
    .select('id')
    .single()
  if (che || !ch) throw che ?? new Error('chapter upsert failed')

  for (const lesson of chapter.lessons) {
    const { data: ls, error: le } = await supabase
      .from('lessons')
      .upsert(
        {
          chapter_id: ch.id,
          slug: lesson.slug,
          title: lesson.title,
          cards: lesson.cards,
          concept_tags: lesson.concept_tags,
          order_index: lesson.order_index,
          xp_reward: lesson.xp_reward,
          estimated_minutes: lesson.estimated_minutes,
        },
        { onConflict: 'slug' }
      )
      .select('id')
      .single()
    if (le || !ls) throw le ?? new Error('lesson upsert failed')

    for (const problem of lesson.problems) {
      const { error: pe } = await supabase
        .from('problems')
        .upsert(
          {
            lesson_id: ls.id,
            type: problem.type,
            content: problem.content,
            correct_answer: problem.correct_answer,
            hint: problem.hint ?? null,
            concept_tags: problem.concept_tags,
            order_index: problem.order_index,
            xp_reward: problem.xp_reward,
          },
          { onConflict: 'lesson_id,order_index' }
        )
      if (pe) throw pe
    }
    console.log(`  ✓ ${lesson.slug} (문제 ${lesson.problems.length}개)`)
  }
}

async function main() {
  const dataDir = join(process.cwd(), 'data')

  const courses: CourseJson[] = JSON.parse(
    readFileSync(join(dataDir, 'courses.json'), 'utf8')
  )
  await seedCourses(courses)

  const subdirs = readdirSync(dataDir)
    .filter(f => statSync(join(dataDir, f)).isDirectory())
    .sort()

  for (const dir of subdirs) {
    const files = readdirSync(join(dataDir, dir))
      .filter(f => f.endsWith('.json'))
      .sort()

    for (const file of files) {
      const chapter: ChapterJson = JSON.parse(
        readFileSync(join(dataDir, dir, file), 'utf8')
      )
      console.log(`\n📖 챕터: ${chapter.slug}`)
      await seedChapter(chapter)
    }
  }

  console.log('\n✅ 시드 완료!')
}

main().catch(err => {
  console.error('시드 실패:', err)
  process.exit(1)
})
