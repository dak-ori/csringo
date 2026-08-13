import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

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
    ? `\n\n이전 생성 실패 사유:\n${failureReasons.map(r => `- ${r}`).join('\n')}\n위 사유를 반드시 수정하여 새로운 문제를 재생성하세요.`
    : ''

  // 유형별 content 스키마 설명 (예시와 스키마를 분리)
  const contentSchema =
    type === 'fill_blank'
      ? `{ "question": "빈칸(___) 포함 문제 지문", "blank_count": 빈칸_개수(정수) }`
      : type === 'drag_order'
      ? `{ "question": "문제 지문", "items": ["정렬 대상 항목1", "항목2", "항목3", "항목4"] }`
      : `{ "question": "문제 지문", "steps": ["단계1", "___", "단계3", ...], "blank_index": 빈_단계의_인덱스(정수), "options": ["정답", "오답1", "오답2", "오답3"] }`

  const correctAnswerGuide =
    type === 'fill_blank'
      ? '빈칸 정답 문자열 배열 — 빈칸 순서대로 (예: ["스택", "LIFO"])'
      : type === 'drag_order'
      ? 'items를 올바른 순서로 나열한 문자열 배열'
      : '정답 옵션 문자열 1개짜리 배열 (예: ["페이지 교체"])'

  return `당신은 한국어 컴퓨터과학 교육 문제 출제자입니다.
아래 조건에 맞는 ${topicLabel} ${typeLabel} 문제 1개를 새로 창작하세요.${retryNote}

[조건]
- 과목: ${topicLabel}
- 난이도: ${diffLabel}
- 문항 유형: ${typeLabel}

[content 필드 스키마]
${contentSchema}

[correct_answer 필드]1
${correctAnswerGuide}

반드시 아래 형식의 JSON 객체 하나만 출력하세요. 다른 텍스트는 절대 포함하지 마세요.
{
  "type": "${type}",
  "content": { /* 위 스키마에 맞게 실제 문제 내용 */ },
  "correct_answer": [ /* 위 안내에 맞는 정답 */ ],
  "hint": "문제 풀이에 도움이 되는 힌트 한 줄",
  "concept_tags": ["관련 개념 키워드1", "키워드2"]
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

function extractJson<T>(text: string): T | null {
  // 가장 바깥의 { } 블록을 추출 (중첩 JSON 안전 파싱)
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  try {
    return JSON.parse(text.slice(start, end + 1)) as T
  } catch {
    return null
  }
}

async function generateProblem(topic: string, difficulty: Difficulty, type: ProblemType, failureReasons?: string[]): Promise<GeneratedProblem> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash', generationConfig: { maxOutputTokens: 512 } })
  const result = await model.generateContent(buildGenerationPrompt(topic, difficulty, type, failureReasons))
  const text = result.response.text()
  const parsed = extractJson<GeneratedProblem>(text)
  if (!parsed) throw new Error('생성 파싱 실패')
  return parsed
}

async function validateProblem(problem: GeneratedProblem, difficulty: Difficulty): Promise<ValidationResult> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash', generationConfig: { maxOutputTokens: 256 } })
  const result = await model.generateContent(buildValidationPrompt(problem, difficulty))
  const text = result.response.text()
  const parsed = extractJson<ValidationResult>(text)
  if (!parsed) return { passed: false, reasons: ['검증 파싱 실패'] }
  return parsed
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
