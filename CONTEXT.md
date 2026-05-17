# CS링고 Domain Glossary

## Core Learning Concepts

**Course (코스)** — A top-level subject area (e.g., 자료구조, 알고리즘, OS, 네트워크). Contains 1+ Chapters. Identified by a unique slug (e.g., `data-structures`).

**Chapter (챕터)** — A subdivision of a Course. Contains 2–5 Lessons. Identified by a slug unique within its Course (e.g., `stacks-and-queues`).

**Lesson (레슨)** — A single learning unit within a Chapter. Takes 5–10 minutes. Composed of Cards (read) → Problems (interact). Identified by a slug unique within its Chapter.

**Card (카드)** — A read-only content screen inside a Lesson. Users advance through all Cards before reaching Problems. Never interactable — text/code/comparison only.

**Problem (문제)** — An interactive exercise inside a Lesson. Three types: `fill_blank`, `drag_order`, `logic_flow`. Graded server-side; affects Hearts and XP.

## Gamification

**Heart (하트)** — A resource that gates wrong answers. Initial value: 5. Lost: 1 per incorrect Problem submission. Recovered: 1 per 4 hours up to max 5. **Not calculated by cron** — computed on-demand from `profiles.hearts` (last known value) and `profiles.hearts_last_refill` (timestamp of last decrement or initial creation).

**Streak (스트릭)** — Count of consecutive calendar days (KST) on which a user completed at least one Lesson. Resets to 0 if a day is skipped.

**XP** — Points awarded only for correct Problem submissions (+5 each) and Lesson completion (+15). Never awarded for incorrect attempts.

**Level** — Derived entirely from `total_xp`. Never stored separately. Thresholds: 1=0 XP, 2=100, 3=300, 4=600, then +400 per level thereafter.

**League (리그)** — A weekly (Mon–Sun) XP ranking tier: bronze → silver → gold → platinum → diamond. Advancement and demotion are based on weekly XP percentile among all users.

## Review System

**Review Queue (복습 큐)** — A per-user list of Problems to revisit, populated by Claude API analysis of `wrong_answers`. A Problem enters the queue when `wrong_count ≥ 2` for that user. Leaving the queue requires a correct submission (sets `reviewed_at`). Never deleted — soft-completed via `reviewed_at`.

**Wrong Answer (오답 기록)** — A per-user-per-problem record tracking how many times that Problem was answered incorrectly. Stored in `wrong_answers` as an upsert (incrementing `wrong_count`).

## Problem Types

**fill_blank** — A text string with `___` placeholders. User types answers. Content shape: `{ question: string, blank_count: number }`. Correct answer: array of strings, case-insensitive match.

**drag_order** — A set of items to reorder. User drags to sort. Content shape: `{ question: string, items: string[] }`. Correct answer: ordered string array.

**logic_flow** — A multi-step flow with one blank step. User picks the missing step from given options. Content shape: `{ question: string, steps: string[], blank_index: number, options: string[] }`. Correct answer: single-element array (the correct option string).
