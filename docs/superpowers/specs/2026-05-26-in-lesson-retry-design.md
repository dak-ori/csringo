# 레슨 내 틀린 문제 재시도 설계

**날짜:** 2026-05-26  
**상태:** 승인됨

## 목표

레슨 도중 틀린 문제를 별도 복습 탭 대신, 해당 레슨 내에서 즉시 재시도하게 한다. 마지막 문제 통과 후 틀린 문제들을 모두 맞출 때까지 반복 출제하고, 전부 클리어하면 완료 화면으로 이동한다.

## 아키텍처

### 상태 머신 (lesson-view.tsx)

**현재:** `'cards' → 'problems' → 'complete'`  
**변경:** `'cards' → 'problems' → 'retry' → 'complete'`

추가 상태:

```ts
wrongProblemIds: string[]  // 틀릴 때마다 push
retryQueue: Problem[]      // retry 진입 시 wrongProblemIds 기준으로 세팅
retryIndex: number         // retry 단계의 현재 인덱스
```

**handleNext() 흐름:**

```
마지막 문제였는가?
  ├── YES + wrongProblemIds.length > 0
  │     → phase = 'retry', retryQueue = wrongProblemIds 순서로 필터된 Problem[]
  ├── YES + wrongProblemIds 비어있음
  │     → /api/learning/complete 호출 → phase = 'complete'
  └── NO → problemIndex + 1
```

**handleRetryNext() 흐름:**

```
재시도 정답?
  ├── YES → retryQueue에서 해당 문제 제거 → 비었으면 complete
  └── NO  → retryQueue 뒤에 다시 push (같은 문제 계속 반복)
```

**retry 단계 UI:** 상단에 "틀린 문제 복습 · N개 남음" 배너 표시. 문제 컴포넌트(FillBlank/DragOrder/LogicFlow)는 기존 것 그대로 재사용.

### API

**`/api/learning/submit` 수정:**

- `body`에 `is_retry?: boolean` 추가
- `is_retry === true`이면:
  - 정답 채점만 수행
  - 하트 차감 없음
  - XP 부여 없음
  - `wrong_answers` 기록 없음
  - 반환: `{ correct: boolean }`

**`/api/learning/complete`:** 변경 없음. retry 통과 후 호출됨.

### 삭제 항목

| 파일 | 이유 |
|------|------|
| `app/(protected)/review/page.tsx` | 복습 탭 완전 제거 |
| `app/(protected)/review/review-list.tsx` | 복습 탭 완전 제거 |
| `components/review/review-item.tsx` | 복습 탭 완전 제거 |
| `app/api/review/route.ts` | 복습 API 제거 |
| `app/api/review/generate/route.ts` | 복습 큐 생성 API 제거 |
| `app/api/review/complete/route.ts` | 복습 완료 API 제거 |

**수정:**

- `components/layout/bottom-nav.tsx`: 복습 탭 제거, 3탭(홈, 학습, 프로필)으로 변경
- `lib/types/lesson.ts`: `ReviewQueueItem` 타입 삭제
- `lib/types/lesson.ts`: `WrongAnswer` 타입은 유지 (wrong_answers 테이블 기록은 첫 시도에서 유지)

## 규칙

- 재시도 중 틀려도 하트 차감 없음
- 재시도로 맞춰도 XP 없음
- 레슨 완료 XP는 `/api/learning/complete`에서 정상 처리 (변경 없음)
- `lesson-view.tsx` 내 `handleNext`에서 `/api/review/generate` fire-and-forget 호출 제거
