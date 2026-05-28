import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const MAX_ATTEMPTS = 3

type ProblemType = 'fill_blank' | 'drag_order' | 'logic_flow'
type Difficulty = 'easy' | 'medium' | 'hard'

interface GeneratedProblem {
  type: ProblemType
  content: unknown
  correct_answer: string[]
  hint: string
  concept_tags: string[]
}

interface ValidationResult {
  passed: boolean
  reasons: string[]
}

const TOPIC_LABELS: Record<string, string> = {
  data_structure: '자료구조',
  algorithm: '알고리즘',
  os: '운영체제',
  network: '네트워크',
}

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: '초급',
  medium: '중급',
  hard: '고급',
}

const TYPE_LABELS: Record<ProblemType, string> = {
  fill_blank: '빈칸 채우기',
  drag_order: '순서 배열',
  logic_flow: '논리 흐름',
}

function buildGenerationPrompt(topic: string, difficulty: Difficulty, type: ProblemType, failureReasons?: string[]): string {
  const topicLabel = TOPIC_LABELS[topic] ?? topic
  const diffLabel = DIFFICULTY_LABELS[difficulty]
  const typeLabel = TYPE_LABELS[type]

  const retryNote = failureReasons?.length
    ? `\n\n이전 생성 실패 사유:\n${failureReasons.map(r => `- ${r}`).join('\n')}\n위 문제를 반드시 수정하여 재생성하세요.`
    : ''

  const typeGuide =
    type === 'fill_blank'
      ? `{ "question": "___에 들어갈 단어를 입력하세요. 예: 스택은 ___ 방식의 자료구조다.", "blank_count": 1 }`
      : type === 'drag_order'
      ? `{ "question": "다음 항목을 올바른 순서로 배열하세요.", "items": ["항목A", "항목B", "항목C", "항목D"] }`
      : `{ "question": "다음 흐름에서 빈 단계를 고르세요.", "steps": ["단계1", "___", "단계3"], "blank_index": 1, "options": ["정답", "오답1", "오답2", "오답3"] }`

  return `한국어로 ${topicLabel} ${diffLabel} 난이도 ${typeLabel} 문제를 1개 생성하세요.${retryNote}

content 형식 (${type}):
${typeGuide}

correct_answer 형식:
- fill_blank: 빈칸 정답 문자열 배열 (빈칸 순서대로)
- drag_order: 올바른 순서의 items 배열
- logic_flow: 정답 옵션 문자열 1개짜리 배열

반드시 아래 JSON만 반환하세요 (설명 없이):
{
  "type": "${type}",
  "content": ${typeGuide},
  "correct_answer": ["정답"],
  "hint": "힌트 한 줄",
  "concept_tags": ["태그1", "태그2"]
}`
}

function buildValidationPrompt(problem: GeneratedProblem, difficulty: Difficulty): string {
  return `아래 CS 학습 문제를 검증하세요. 다음 4가지 기준을 평가합니다:
1. 정답 정확성: correct_answer가 content의 문제에 대해 올바른가?
2. 명확성: 문제 지문이 모호하지 않은가?
3. 난이도 적합성: ${DIFFICULTY_LABELS[difficulty]} 수준에 맞는가?
4. 보기 중복: options/items에 중복된 항목이 없는가?

문제:
${JSON.stringify(problem, null, 2)}

반드시 아래 JSON만 반환하세요:
{ "passed": true/false, "reasons": ["실패 사유1", "실패 사유2"] }
passed가 true면 reasons는 빈 배열.`
}

async function generateProblem(topic: string, difficulty: Difficulty, type: ProblemType, failureReasons?: string[]): Promise<GeneratedProblem> {
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{ role: 'user', content: buildGenerationPrompt(topic, difficulty, type, failureReasons) }],
  })
  const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('생성 파싱 실패')
  return JSON.parse(jsonMatch[0]) as GeneratedProblem
}

async function validateProblem(problem: GeneratedProblem, difficulty: Difficulty): Promise<ValidationResult> {
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    messages: [{ role: 'user', content: buildValidationPrompt(problem, difficulty) }],
  })
  const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return { passed: false, reasons: ['검증 파싱 실패'] }
  return JSON.parse(jsonMatch[0]) as ValidationResult
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const { topic, difficulty, type } = body ?? {}
  if (!topic || !difficulty || !type) {
    return NextResponse.json({ error: 'topic, difficulty, type 필요' }, { status: 400 })
  }

  let problem: GeneratedProblem | null = null
  let validation: ValidationResult = { passed: false, reasons: [] }
  let attempts = 0
  let failureReasons: string[] = []

  // 생성 → 검증 → 재생성 루프 (최대 MAX_ATTEMPTS회)
  while (attempts < MAX_ATTEMPTS) {
    attempts++
    try {
      problem = await generateProblem(topic, difficulty as Difficulty, type as ProblemType, failureReasons.length ? failureReasons : undefined)
      validation = await validateProblem(problem, difficulty as Difficulty)
      if (validation.passed) break
      failureReasons = validation.reasons
    } catch {
      failureReasons = ['생성 오류']
    }
  }

  if (!problem || !validation.passed) {
    return NextResponse.json({
      error: '검증 통과 실패',
      attempts,
      reasons: failureReasons,
    }, { status: 422 })
  }

  // 저장 단계: 통과한 문제만 DB에 저장
  const { data: saved, error: saveErr } = await supabase
    .from('generated_problems')
    .insert({
      user_id: user.id,
      type: problem.type,
      topic,
      difficulty,
      content: problem.content,
      correct_answer: problem.correct_answer,
      hint: problem.hint,
      concept_tags: problem.concept_tags,
      validation_attempts: attempts,
    })
    .select()
    .single()

  if (saveErr) {
    return NextResponse.json({ error: '저장 실패', detail: saveErr.message }, { status: 500 })
  }

  return NextResponse.json({ problem: saved, attempts, validation_passed: true })
}
