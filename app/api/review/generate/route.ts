import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: wrongAnswers } = await supabase
    .from('wrong_answers')
    .select(`
      problem_id, wrong_count,
      problem:problems(id, type, content, concept_tags, lesson_id)
    `)
    .eq('user_id', user.id)
    .gte('wrong_count', 2)
    .order('wrong_count', { ascending: false })
    .limit(20)

  if (!wrongAnswers || wrongAnswers.length === 0) {
    return NextResponse.json({ message: 'No weak concepts found' })
  }

  const conceptSummary = wrongAnswers
    .map(wa => {
      const problem = wa.problem as unknown as { concept_tags: string[]; type: string } | null
      return `- 문제 ID: ${wa.problem_id}, 틀린 횟수: ${wa.wrong_count}, 개념: ${problem?.concept_tags?.join(', ') ?? '알 수 없음'}`
    })
    .join('\n')

  let prioritized: Array<{ problem_id: string; priority: number }> = []
  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: `다음은 학생이 자주 틀린 CS 문제 목록입니다:\n${conceptSummary}\n\n틀린 횟수가 많은 순서로 최대 5개 문제 ID를 선택해 복습 우선순위(1-5, 5가 최고)를 JSON 배열로만 반환하세요. 형식: [{"problem_id":"...","priority":5},...]`,
        },
      ],
    })

    const content = message.content[0]
    if (content.type === 'text') {
      const jsonMatch = content.text.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        prioritized = JSON.parse(jsonMatch[0])
      }
    }
  } catch {
    prioritized = wrongAnswers.slice(0, 5).map((wa, i) => ({
      problem_id: wa.problem_id,
      priority: 5 - i,
    }))
  }

  if (prioritized.length > 0) {
    const upsertData = prioritized.map(item => ({
      user_id: user.id,
      problem_id: item.problem_id,
      priority: item.priority,
      added_at: new Date().toISOString(),
      reviewed_at: null,
    }))

    await supabase
      .from('review_queue')
      .upsert(upsertData, { onConflict: 'user_id,problem_id' })
  }

  return NextResponse.json({ added: prioritized.length })
}
