import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateCurrentHearts } from '@/lib/hearts'

function gradeAnswer(userAnswer: string[], correctAnswer: string[]): boolean {
  if (userAnswer.length !== correctAnswer.length) return false
  return userAnswer.every(
    (ans, i) => ans.trim().toLowerCase() === correctAnswer[i].trim().toLowerCase()
  )
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body?.problem_id || !Array.isArray(body?.user_answer)) {
    return NextResponse.json({ error: 'problem_id and user_answer required' }, { status: 400 })
  }

  const { problem_id, user_answer } = body as { problem_id: string; user_answer: string[] }

  const { data: problem } = await supabase
    .from('problems')
    .select('id, correct_answer, xp_reward, hint')
    .eq('id', problem_id)
    .single()

  if (!problem) return NextResponse.json({ error: 'Problem not found' }, { status: 404 })

  const isCorrect = gradeAnswer(user_answer, problem.correct_answer as string[])

  if (isCorrect) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('total_xp')
      .eq('id', user.id)
      .single()

    const newXp = (profile?.total_xp ?? 0) + problem.xp_reward

    await Promise.all([
      supabase.from('profiles').update({ total_xp: newXp }).eq('id', user.id),
      supabase.from('xp_logs').insert({
        user_id: user.id,
        amount: problem.xp_reward,
        reason: 'correct_answer',
        reference_id: problem_id,
      }),
    ])

    return NextResponse.json({ correct: true, xp_earned: problem.xp_reward })
  }

  // 오답 처리
  const { data: profile } = await supabase
    .from('profiles')
    .select('hearts, hearts_last_refill')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const currentHearts = calculateCurrentHearts(
    profile.hearts,
    new Date(profile.hearts_last_refill)
  )
  const newHearts = Math.max(0, currentHearts - 1)

  const { data: existing } = await supabase
    .from('wrong_answers')
    .select('wrong_count')
    .eq('user_id', user.id)
    .eq('problem_id', problem_id)
    .maybeSingle()

  await Promise.all([
    supabase
      .from('profiles')
      .update({ hearts: newHearts, hearts_last_refill: new Date().toISOString() })
      .eq('id', user.id),
    supabase.from('wrong_answers').upsert(
      {
        user_id: user.id,
        problem_id,
        user_answer,
        wrong_count: (existing?.wrong_count ?? 0) + 1,
        last_wrong_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,problem_id' }
    ),
  ])

  return NextResponse.json({ correct: false, hearts_remaining: newHearts })
}
