'use client'

import { useState } from 'react'
import { Wand2, CheckCircle2, XCircle, RotateCcw, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type Topic = 'data_structure' | 'algorithm' | 'os' | 'network'
type Difficulty = 'easy' | 'medium' | 'hard'
type ProblemType = 'fill_blank' | 'drag_order' | 'logic_flow'

const TOPICS: { value: Topic; label: string }[] = [
  { value: 'data_structure', label: '자료구조' },
  { value: 'algorithm', label: '알고리즘' },
  { value: 'os', label: '운영체제' },
  { value: 'network', label: '네트워크' },
]

const DIFFICULTIES: { value: Difficulty; label: string; color: string }[] = [
  { value: 'easy', label: '초급', color: 'bg-green-100 text-green-800' },
  { value: 'medium', label: '중급', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'hard', label: '고급', color: 'bg-red-100 text-red-800' },
]

const TYPES: { value: ProblemType; label: string; desc: string }[] = [
  { value: 'fill_blank', label: '빈칸 채우기', desc: '개념어를 직접 입력' },
  { value: 'drag_order', label: '순서 배열', desc: '항목을 올바른 순서로 정렬' },
  { value: 'logic_flow', label: '논리 흐름', desc: '빈 단계의 보기를 선택' },
]

interface GeneratedProblem {
  id: string
  type: ProblemType
  topic: string
  difficulty: string
  content: Record<string, unknown>
  correct_answer: string[]
  hint: string | null
  concept_tags: string[]
  validation_attempts: number
}

export default function GeneratePage() {
  const [topic, setTopic] = useState<Topic>('data_structure')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [type, setType] = useState<ProblemType>('fill_blank')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ problem: GeneratedProblem; attempts: number } | null>(null)
  const [error, setError] = useState<{ message: string; attempts: number; reasons: string[] } | null>(null)

  async function handleGenerate() {
    setLoading(true)
    setResult(null)
    setError(null)

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, difficulty, type }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError({ message: data.error ?? '생성 실패', attempts: data.attempts ?? 0, reasons: data.reasons ?? [] })
      } else {
        setResult({ problem: data.problem, attempts: data.attempts })
      }
    } catch {
      setError({ message: '네트워크 오류', attempts: 0, reasons: [] })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-lg mx-auto px-4 pt-8 space-y-6">
        <div className="flex items-center gap-2">
          <Wand2 className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold">AI 문제 생성</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          주제·난이도·유형을 선택하면 Claude가 문제를 자동 생성하고 검증합니다.
        </p>

        {/* 주제 선택 */}
        <section>
          <p className="text-sm font-medium mb-2">과목</p>
          <div className="grid grid-cols-2 gap-2">
            {TOPICS.map(t => (
              <button
                key={t.value}
                onClick={() => setTopic(t.value)}
                className={`rounded-lg border p-3 text-sm font-medium transition-colors ${
                  topic === t.value ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </section>

        {/* 난이도 선택 */}
        <section>
          <p className="text-sm font-medium mb-2">난이도</p>
          <div className="flex gap-2">
            {DIFFICULTIES.map(d => (
              <button
                key={d.value}
                onClick={() => setDifficulty(d.value)}
                className={`flex-1 rounded-lg border p-3 text-sm font-medium transition-colors ${
                  difficulty === d.value ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </section>

        {/* 문항 유형 선택 */}
        <section>
          <p className="text-sm font-medium mb-2">문항 유형</p>
          <div className="space-y-2">
            {TYPES.map(pt => (
              <button
                key={pt.value}
                onClick={() => setType(pt.value)}
                className={`w-full rounded-lg border p-3 text-left transition-colors ${
                  type === pt.value ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'
                }`}
              >
                <p className={`text-sm font-medium ${type === pt.value ? 'text-primary' : ''}`}>{pt.label}</p>
                <p className="text-xs text-muted-foreground">{pt.desc}</p>
              </button>
            ))}
          </div>
        </section>

        {/* 생성 버튼 */}
        <Button onClick={handleGenerate} disabled={loading} className="w-full" size="lg">
          {loading ? (
            <>
              <RotateCcw className="mr-2 h-4 w-4 animate-spin" />
              생성 중 (검증·재생성 포함)…
            </>
          ) : (
            <>
              <Wand2 className="mr-2 h-4 w-4" />
              문제 생성
            </>
          )}
        </Button>

        {/* 결과 */}
        {result && (
          <Card className="border-green-200">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  검증 통과
                </CardTitle>
                <Badge variant="secondary">시도 {result.attempts}회</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-1">
                {result.problem.concept_tags.map(tag => (
                  <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                ))}
              </div>

              <div className="rounded-md bg-muted p-3 text-sm">
                <p className="font-medium mb-1">문제 내용</p>
                <pre className="whitespace-pre-wrap text-xs text-muted-foreground">
                  {JSON.stringify(result.problem.content, null, 2)}
                </pre>
              </div>

              <div className="rounded-md bg-green-50 p-3 text-sm">
                <p className="font-medium text-green-800 mb-1">정답</p>
                <p className="text-green-700">{result.problem.correct_answer.join(' → ')}</p>
              </div>

              {result.problem.hint && (
                <div className="rounded-md bg-blue-50 p-3 text-sm">
                  <p className="font-medium text-blue-800 mb-1">힌트</p>
                  <p className="text-blue-700">{result.problem.hint}</p>
                </div>
              )}

              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Save className="h-3 w-3" />
                DB에 저장 완료 (ID: {result.problem.id.slice(0, 8)}…)
              </div>
            </CardContent>
          </Card>
        )}

        {error && (
          <Card className="border-red-200">
            <CardContent className="pt-4">
              <div className="flex items-start gap-2">
                <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-700">{error.message}</p>
                  {error.attempts > 0 && (
                    <p className="text-xs text-muted-foreground">{error.attempts}회 시도 후 실패</p>
                  )}
                  {error.reasons.length > 0 && (
                    <ul className="mt-1 text-xs text-red-600 list-disc list-inside">
                      {error.reasons.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
