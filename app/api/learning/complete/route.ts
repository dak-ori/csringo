import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateLevel } from '@/lib/xp'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body?.lesson_id) {
    return NextResponse.json({ error: 'lesson_id required' }, { status: 400 })
  }

  const { lesson_id } = body as { lesson_id: string }

  const { data: lesson } = await supabase
    .from('lessons')
    .select('xp_reward')
    .eq('id', lesson_id)
    .single()

  if (!lesson) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('total_xp, streak, last_lesson_date')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  // KST 기준 날짜 계산
  const todayKST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
  const yesterdayKST = new Date(Date.now() - 86_400_000).toLocaleDateString('en-CA', {
    timeZone: 'Asia/Seoul',
  })

  let newStreak = profile.streak
  if (profile.last_lesson_date === todayKST) {
    // 오늘 이미 완료 → 스트릭 변화 없음
  } else if (profile.last_lesson_date === yesterdayKST) {
    newStreak += 1
  } else {
    newStreak = 1
  }

  const oldXp = profile.total_xp
  const newXp = oldXp + lesson.xp_reward
  const oldLevel = calculateLevel(oldXp)
  const newLevel = calculateLevel(newXp)

  await Promise.all([
    supabase
      .from('profiles')
      .update({ total_xp: newXp, streak: newStreak, last_lesson_date: todayKST })
      .eq('id', user.id),
    supabase.from('user_progress').upsert(
      {
        user_id: user.id,
        lesson_id,
        status: 'completed',
        completed_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,lesson_id' }
    ),
    supabase.from('xp_logs').insert({
      user_id: user.id,
      amount: lesson.xp_reward,
      reason: 'lesson_complete',
      reference_id: lesson_id,
    }),
  ])

  return NextResponse.json({
    xp_earned: lesson.xp_reward,
    total_xp: newXp,
    streak: newStreak,
    leveled_up: newLevel > oldLevel,
    new_level: newLevel,
  })
}
