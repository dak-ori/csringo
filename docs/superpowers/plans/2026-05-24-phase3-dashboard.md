# Phase 3: 대시보드 + 게임화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 오늘의 레슨, 복습 배너, 하트/XP/스트릭 게임화 상태를 표시하는 대시보드를 완성한다.

**Architecture:** 서버 컴포넌트가 Supabase에서 profile, user_progress, review_queue를 동시에 fetch. calculateCurrentHearts/calculateLevel을 서버에서 계산해 클라이언트에 전달.

**Tech Stack:** Next.js 15 App Router, Supabase, lib/hearts.ts, lib/xp.ts

**전제조건:** Phase 1 + Phase 2 완료

---

## Task 22: 대시보드 페이지 완전 재작성

**Files:**
- Modify: `app/(protected)/dashboard/page.tsx`

현재 파일은 `profile.level`을 select하는 오래된 코드. 완전히 교체.

- [ ] **Step 1: dashboard/page.tsx 재작성**

```typescript
// app/(protected)/dashboard/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { calculateCurrentHearts } from '@/lib/hearts'
import { calculateLevel } from '@/lib/xp'

interface LessonWithChapter {
  id: string
  slug: string
  title: string
  estimated_minutes: number
  order_index: number
  chapter: {
    id: string
    slug: string
    order_index: number
    course: {
      id: string
      slug: string
      order_index: number
    }
  } | null
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 병렬 fetch
  const [profileRes, progressRes, reviewRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('username, hearts, hearts_last_refill, streak, total_xp, league')
      .eq('id', user.id)
      .single(),
    supabase
      .from('user_progress')
      .select('lesson_id')
      .eq('user_id', user.id)
      .eq('status', 'completed'),
    supabase
      .from('review_queue')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('reviewed_at', null),
  ])

  const profile = profileRes.data
  if (!profile) redirect('/login')

  const completedIds = new Set(progressRes.data?.map(p => p.lesson_id) ?? [])
  const reviewCount = reviewRes.count ?? 0

  // 다음 레슨 찾기: 챕터/코스 order_index 기준 정렬
  const { data: allLessons } = await supabase
    .from('lessons')
    .select(`
      id, slug, title, estimated_minutes, order_index,
      chapter:chapters(id, slug, order_index, course:courses(id, slug, order_index))
    `)
    .order('order_index')

  const sortedLessons = ((allLessons ?? []) as LessonWithChapter[]).sort((a, b) => {
    const ca = a.chapter?.course?.order_index ?? 0
    const cb = b.chapter?.course?.order_index ?? 0
    if (ca !== cb) return ca - cb
    const cha = a.chapter?.order_index ?? 0
    const chb = b.chapter?.order_index ?? 0
    if (cha !== chb) return cha - chb
    return a.order_index - b.order_index
  })

  const nextLesson = sortedLessons.find(l => !completedIds.has(l.id))

  const currentHearts = calculateCurrentHearts(
    profile.hearts,
    new Date(profile.hearts_last_refill)
  )
  const level = calculateLevel(profile.total_xp)

  // 다음 레벨까지 XP 계산
  const levelThresholds = [0, 100, 300, 600, 1000]
  function getNextLevelXp(lv: number): number {
    if (lv <= 4) return levelThresholds[lv] ?? 1000 + (lv - 4) * 400
    return 1000 + (lv - 4) * 400
  }
  function getCurrentLevelXp(lv: number): number {
    if (lv <= 1) return 0
    if (lv <= 4) return levelThresholds[lv - 1]
    return 1000 + (lv - 5) * 400
  }
  const currentLevelXp = getCurrentLevelXp(level)
  const nextLevelXp = getNextLevelXp(level)
  const xpProgress = ((profile.total_xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100

  return (
    <main className="max-w-lg mx-auto px-4 pt-8 pb-24 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">안녕하세요, {profile.username}님!</h1>
        <span className="text-sm text-muted-foreground">Lv.{level}</span>
      </div>

      {/* 게임화 상태바 */}
      <div className="rounded-2xl border p-4 space-y-3">
        <div className="flex justify-between text-sm">
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <span key={i} className="text-lg">{i < currentHearts ? '❤️' : '🖤'}</span>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">🔥 <strong>{profile.streak}일</strong></span>
            <span className="flex items-center gap-1">⭐ <strong>{profile.total_xp} XP</strong></span>
          </div>
        </div>
        {/* XP 진행 바 */}
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Lv.{level}</span>
            <span>{profile.total_xp} / {nextLevelXp} XP</span>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${Math.min(100, xpProgress)}%` }}
            />
          </div>
        </div>
      </div>

      {/* 복습 배너 */}
      {reviewCount > 0 && (
        <Link
          href="/review"
          className="flex items-center justify-between p-4 rounded-2xl bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800"
        >
          <div>
            <p className="font-semibold text-orange-700 dark:text-orange-300">
              복습할 문제가 {reviewCount}개 있어요
            </p>
            <p className="text-sm text-orange-600 dark:text-orange-400">틀린 개념을 다시 확인하세요</p>
          </div>
          <span className="text-2xl">📚</span>
        </Link>
      )}

      {/* 오늘의 레슨 */}
      <div>
        <h2 className="text-lg font-bold mb-3">오늘의 레슨</h2>
        {nextLesson ? (
          <Link
            href={`/learn/${nextLesson.chapter?.course?.slug}/${nextLesson.chapter?.slug}/${nextLesson.slug}`}
            className="flex items-center justify-between p-5 rounded-2xl bg-primary text-primary-foreground"
          >
            <div>
              <p className="font-bold text-lg">{nextLesson.title}</p>
              <p className="text-sm opacity-80 mt-1">⏱ {nextLesson.estimated_minutes}분</p>
            </div>
            <span className="text-3xl">→</span>
          </Link>
        ) : (
          <div className="p-5 rounded-2xl border text-center text-muted-foreground">
            <p className="text-2xl mb-2">🎊</p>
            <p className="font-medium">모든 레슨을 완료했어요!</p>
          </div>
        )}
      </div>
    </main>
  )
}
```

- [ ] **Step 2: 개발 서버에서 대시보드 확인**

```bash
npm run dev
```

- `/dashboard` 접속 시 하트, 스트릭, XP, 레벨 표시
- 오늘의 레슨 카드에 다음 레슨 표시
- 복습 배너 (review_queue에 미완료 항목이 있을 때만)

- [ ] **Step 3: 커밋**

```bash
git add "app/(protected)/dashboard/page.tsx"
git commit -m "feat: complete dashboard with gamification state and today's lesson"
```

---

## Task 23: BottomNav — 현재 경로 활성화 확인

**Files:**
- Read: `components/layout/bottom-nav.tsx` (이미 올바른 탭 구조 있음 — 변경 불필요)

- [ ] **Step 1: BottomNav 동작 확인**

`components/layout/bottom-nav.tsx`는 이미 홈/학습/복습/프로필 4탭을 갖추고 `/learn/*` 경로를 올바르게 active 처리함. 변경 불필요.

`/learn`, `/learn/data-structures` 등에서 "학습" 탭이 활성화되는지 확인.

- [ ] **Step 2: Phase 3 완료 커밋**

```bash
git add -A
git commit -m "feat: complete phase 3 - dashboard with gamification"
```
