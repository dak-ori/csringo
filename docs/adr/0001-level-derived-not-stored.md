# ADR 0001: Level은 DB에 저장하지 않고 XP에서 즉석 계산

**Status:** Accepted  
**Date:** 2026-05-18

## Context

PRD와 초기 DB 스키마에는 `profiles.level int` 컬럼이 있었다. Level은 total_xp에서 완전히 결정론적으로 계산 가능하다 (레벨 1=0 XP, 2=100, 3=300, 4=600, 이후 +400씩).

## Decision

`profiles.level` 컬럼을 DB에 저장하지 않는다. Level은 `calculateLevel(total_xp)` 함수로 필요한 시점에 계산한다.

레벨업 감지는 lesson complete API에서 `calculateLevel(old_xp) !== calculateLevel(new_xp)` 비교로 처리한다.

## Rationale

- total_xp에서 완전히 결정론적 → 저장 시 중복(redundancy)
- 저장하면 XP 업데이트마다 level도 함께 업데이트해야 해 두 곳이 일관성을 맞춰야 함
- 즉석 계산이 항상 정확하며 마이그레이션 없이 레벨 공식 변경 가능

## Consequences

- DB 스키마에서 `profiles.level` 컬럼 제거
- `lib/xp.ts`에 `calculateLevel(xp: number): number` 유틸 함수 추가
- 리그 순위 등에서 level이 필요하면 XP에서 계산
