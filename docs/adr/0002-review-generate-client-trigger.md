# ADR 0002: Claude 복습 큐 생성은 클라이언트에서 별도 트리거

**Status:** Accepted  
**Date:** 2026-05-18

## Context

레슨 완료 후 Claude API를 호출해 복습 큐를 생성해야 한다. Vercel serverless 함수는 응답을 보낸 이후 백그라운드 작업을 실행하는 `waitUntil` 없이는 진정한 fire-and-forget이 불가능하다.

선택지:
A. 클라이언트가 lesson complete 응답을 받은 후 `/api/review/generate`를 별도로 호출
B. lesson complete 핸들러 안에서 Claude API를 await (5초 지연)
C. Vercel Cron으로 배치 처리

## Decision

**A안 선택**: 클라이언트(`LessonView`)가 lesson complete 응답을 받으면, 사용자에게 완료 화면을 즉시 보여주면서 백그라운드에서 `/api/review/generate`를 별도 fetch()로 호출한다. 응답은 무시해도 무방 (fire-and-forget).

## Rationale

- B안은 레슨 완료 응답이 5초씩 지연 → UX 최악
- C안(Cron)은 Vercel 무료 티어 제한 있고 별도 관리 필요
- A안은 구현 가장 단순, 완료 UX에 영향 없음
- Claude API 실패 시 복습 큐 미생성은 치명적이지 않음 (오답 기록은 이미 DB에 저장됨)

## Consequences

- `LessonView`에서 lesson complete 후 `fetch('/api/review/generate', { method: 'POST' })` 추가
- 응답 처리 없음 (fire-and-forget)
- Claude API 실패 시 복습 큐 미생성 — 다음 레슨 완료 때 재시도됨
