# CS링고 전체 재설계 스펙

**작성일:** 2026-05-18  
**상태:** 승인됨  
**목적:** 졸업논문 제출용 PRD 기반 전체 구현 (5/31 데드라인)

---

## 1. 핵심 결정 사항 요약

| 항목 | 결정 |
|------|------|
| 콘텐츠 시딩 | JSON 파일 → `scripts/seed.ts` 스크립트 |
| logic_flow 문제 UX | 선택지 클릭형 (fill_blank와 유사, 보기에서 선택) |
| 하트 회복 | 즉석 계산 (`hearts_last_refill` 기준, 크론 없음) |
| URL 구조 | 전부 슬러그 `/learn/[course]/[chapter]/[lesson]` |
| 레슨 상태 저장 | 문제 제출 + 레슨 완료 시만 (카드 인덱스 저장 X) |
| Level | DB 컬럼 없음, `calculateLevel(total_xp)` 즉석 계산 |
| Claude API 타이밍 | 레슨 완료 후 클라이언트에서 fire-and-forget |
| 읽기 API | 없음 — 서버 컴포넌트에서 Supabase 직접 쿼리 |

---

## 2. 아키텍처

```
Browser
  └── Next.js 15 App Router
        ├── Server Components  → Supabase에서 데이터 fetch (페이지 렌더)
        ├── Client Components  → 레슨 상호작용, 문제 풀기, 게임화 UI
        └── Route Handlers     → /api/* (채점, 완료, 복습 생성, 로그아웃)
                                      └── Claude API (복습 큐 생성)
```

---

## 3. DB 스키마 변경 (PRD 대비)

### 추가
- `chapters.slug text UNIQUE NOT NULL` — URL 라우팅용
- `lessons.slug text UNIQUE NOT NULL` — URL 라우팅용
- `review_queue` 테이블에 `UNIQUE(user_id, problem_id)` 제약 추가

### 제거
- `profiles.level` 컬럼 — `calculateLevel(total_xp)`로 즉석 계산

### 수정
- `profiles.hearts` — 저장은 하되, API 응답 시 `hearts_last_refill`로 보정한 현재값 반환

### logic_flow 문제 content 구조 (신규 정의)
```json
{
  "question": "TCP 연결 수립 순서",
  "steps": ["SYN", "___", "ACK"],
  "blank_index": 1,
  "options": ["SYN-ACK", "FIN", "RST"]
}
```

---

## 4. 파일 구조

```
app/
  (auth)/login/
  (protected)/
    dashboard/page.tsx             ← 오늘의 레슨 + 복습 배너 + 게임화 상태
    learn/
      page.tsx                     ← 코스 목록
      [course]/page.tsx            ← 챕터 + 레슨 목록
      [course]/[chapter]/[lesson]/
        page.tsx                   ← 레슨 서버 컴포넌트
    review/page.tsx                ← 복습 큐 목록
    profile/page.tsx               ← 프로필 + 통계 + 리그
  api/
    learning/submit/route.ts
    learning/complete/route.ts
    review/route.ts                ← GET: 복습 큐 조회
    review/generate/route.ts       ← POST: Claude 분석 트리거
    review/complete/route.ts       ← POST: 복습 완료 처리
    auth/signout/route.ts

components/
  lesson/
    lesson-view.tsx                ← 상태 머신 (cards → problems → complete)
    card-carousel.tsx
    lesson-complete.tsx
    problems/
      fill-blank-problem.tsx
      drag-order-problem.tsx
      logic-flow-problem.tsx       ← 선택지 클릭형
      problem-feedback.tsx
  layout/
    bottom-nav.tsx
  ui/                              ← shadcn 컴포넌트

lib/
  supabase/client.ts | server.ts | middleware.ts
  hearts.ts                        ← calculateCurrentHearts() 유틸
  xp.ts                            ← calculateLevel() 유틸
  types/lesson.ts

data/
  courses.json
  data-structures/
    chapter-01-arrays.json
    chapter-02-stacks.json
    chapter-03-hash-tables.json
  algorithms/ ...
  os/ ...

scripts/seed.ts

supabase/migrations/
  001_initial_schema.sql
  002_rls_policies.sql

docs/
  adr/
    0001-level-derived-not-stored.md
    0002-review-generate-client-trigger.md
```

---

## 5. Route Handlers (쓰기 전용)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | /api/learning/submit | 문제 채점 (하트 감소, XP 지급, 오답 기록) |
| POST | /api/learning/complete | 레슨 완료 (XP+15, 스트릭 업데이트) |
| GET | /api/review | 미완료 복습 큐 조회 |
| POST | /api/review/generate | Claude API로 취약 개념 분석 → 복습 큐 삽입 |
| POST | /api/review/complete | 복습 문제 완료 처리 (reviewed_at 업데이트) |
| POST | /api/auth/signout | 로그아웃 |

---

## 6. 레슨 플로우

```
Phase 1: cards
  └── CardCarousel — 카드 한 장씩 표시
  └── "문제 풀기" 버튼 → Phase 2

Phase 2: problems
  └── 문제 순서대로 → POST /api/learning/submit
  └── 정답/오답 피드백 → 다음 문제
  └── 마지막 문제 완료 → POST /api/learning/complete → Phase 3
  └── 하트 0 → 학습 중단

Phase 3: complete
  └── LessonComplete 오버레이 (XP/스트릭 표시)
  └── 백그라운드: fetch POST /api/review/generate (fire-and-forget)
  └── "다음 레슨" or "대시보드로"
```

---

## 7. 하트 계산 로직

```typescript
// lib/hearts.ts
export function calculateCurrentHearts(
  storedHearts: number,
  lastRefill: Date
): number {
  const hoursElapsed = (Date.now() - lastRefill.getTime()) / 3_600_000
  const recovered = Math.floor(hoursElapsed / 4)
  return Math.min(5, storedHearts + recovered)
}

// 오답 처리 시:
// 1. currentHearts = calculateCurrentHearts(profile.hearts, profile.hearts_last_refill)
// 2. newHearts = Math.max(0, currentHearts - 1)
// 3. DB update: hearts = newHearts, hearts_last_refill = now()
```

---

## 8. 수정 필요한 PRD 설계 갭

| 이슈 | 해결책 |
|------|--------|
| Username 중복 (Google 동명이인) | DB 트리거에서 중복 시 `name_1`, `name_2` 형태로 suffix 추가 |
| 리그 페이지 RLS 충돌 | Supabase RPC `get_league_rankings()` 함수로 집계 데이터만 노출 |
| review_queue 중복 삽입 | `UNIQUE(user_id, problem_id)` + upsert로 처리 |

---

## 9. 구현 순서

```
Phase 1 (5/18~5/20): 셋업 + 인증 + DB + 시드
Phase 2 (5/21~5/23): 레슨 플로우 (카드 + 3종 문제)
Phase 3 (5/24~5/25): 대시보드 + 게임화 UI
Phase 4 (5/26~5/27): 복습 화면 + Claude API
Phase 5 (5/28~5/31): 프로필 + 콘텐츠 + QA + 배포
```
