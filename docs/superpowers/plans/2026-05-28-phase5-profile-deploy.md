# Phase 5: 프로필 + 추가 콘텐츠 + QA + 배포 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 프로필/통계/리그 페이지 구현, 알고리즘/OS/네트워크 콘텐츠 추가, Vercel 배포 완료.

**Architecture:** 프로필 페이지는 `get_league_rankings()` Supabase RPC 함수로 리그 순위 조회. 콘텐츠는 JSON 파일 추가 후 `npm run seed`로 시딩.

**Tech Stack:** Next.js 15, Supabase RPC, Vercel

**전제조건:** Phase 1~4 완료

---

## Task 28: 프로필 페이지

**Files:**
- Create: `app/(protected)/profile/page.tsx`

- [ ] **Step 1: 파일 생성**

```typescript
// app/(protected)/profile/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { calculateLevel } from '@/lib/xp'
import { calculateCurrentHearts } from '@/lib/hearts'

interface LeagueRankRow {
  user_id: string
  username: string
  total_xp: number
  league: string
  rank: number
}

const LEAGUE_LABELS: Record<string, string> = {
  bronze: '🥉 브론즈',
  silver: '🥈 실버',
  gold: '🥇 골드',
  platinum: '💎 플래티넘',
  diamond: '💠 다이아몬드',
}

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [profileRes, progressRes, xpLogsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('username, hearts, hearts_last_refill, streak, total_xp, league, created_at')
      .eq('id', user.id)
      .single(),
    supabase
      .from('user_progress')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'completed'),
    supabase
      .from('xp_logs')
      .select('amount, reason, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const profile = profileRes.data
  if (!profile) redirect('/login')

  const level = calculateLevel(profile.total_xp)
  const currentHearts = calculateCurrentHearts(
    profile.hearts,
    new Date(profile.hearts_last_refill)
  )
  const completedLessons = progressRes.count ?? 0

  // 리그 순위 조회 (RPC — RLS 우회)
  const { data: leagueRows } = await supabase.rpc('get_league_rankings', {
    p_league: profile.league,
    p_limit: 10,
  })

  const myRank = (leagueRows as LeagueRankRow[] ?? []).find(r => r.user_id === user.id)

  return (
    <main className="max-w-lg mx-auto px-4 pt-8 pb-24 space-y-6">
      {/* 프로필 헤더 */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-2xl font-bold text-primary">
          {profile.username[0].toUpperCase()}
        </div>
        <div>
          <h1 className="text-xl font-bold">{profile.username}</h1>
          <p className="text-sm text-muted-foreground">{LEAGUE_LABELS[profile.league] ?? profile.league}</p>
        </div>
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: '레벨', value: `Lv.${level}` },
          { label: '총 XP', value: profile.total_xp },
          { label: '완료 레슨', value: completedLessons },
          { label: '현재 하트', value: `${'❤️'.repeat(currentHearts)}` },
          { label: '스트릭', value: `${profile.streak}일` },
          { label: '리그 순위', value: myRank ? `#${myRank.rank}` : '-' },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl border p-3 text-center">
            <p className="text-xl font-bold">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* 리그 순위표 */}
      <div>
        <h2 className="text-lg font-bold mb-3">{LEAGUE_LABELS[profile.league]} 순위</h2>
        <div className="space-y-2">
          {(leagueRows as LeagueRankRow[] ?? []).map(row => (
            <div
              key={row.user_id}
              className={`flex items-center justify-between p-3 rounded-xl border ${
                row.user_id === user.id ? 'bg-primary/10 border-primary' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold w-6 text-center text-muted-foreground">
                  #{row.rank}
                </span>
                <span className="font-medium">{row.username}</span>
                {row.user_id === user.id && (
                  <span className="text-xs text-primary">(나)</span>
                )}
              </div>
              <span className="text-sm text-muted-foreground">{row.total_xp} XP</span>
            </div>
          ))}
        </div>
      </div>

      {/* 로그아웃 */}
      <form action="/api/auth/signout" method="POST">
        <button
          type="submit"
          className="w-full py-3 rounded-xl border text-muted-foreground hover:bg-muted transition-colors"
        >
          로그아웃
        </button>
      </form>
    </main>
  )
}
```

- [ ] **Step 2: 프로필 페이지 확인**

`/profile` 접속 → 통계, 리그 순위표, 로그아웃 버튼 확인.

- [ ] **Step 3: 커밋**

```bash
git add "app/(protected)/profile/page.tsx"
git commit -m "feat: add profile page with league rankings"
```

---

## Task 29: 알고리즘 콘텐츠 (2챕터)

**Files:**
- Create: `data/algorithms/chapter-01-sorting.json`
- Create: `data/algorithms/chapter-02-search.json`

- [ ] **Step 1: chapter-01-sorting.json 생성**

```json
{
  "course_slug": "algorithms",
  "slug": "sorting",
  "title": "정렬 알고리즘",
  "order_index": 1,
  "lessons": [
    {
      "slug": "bubble-sort",
      "title": "버블 정렬 (Bubble Sort)",
      "order_index": 1,
      "estimated_minutes": 7,
      "xp_reward": 15,
      "concept_tags": ["sorting", "bubble-sort", "time-complexity"],
      "cards": [
        {
          "title": "버블 정렬이란",
          "content": "버블 정렬은 인접한 두 원소를 비교해 순서가 잘못됐으면 교환하는 방식을 반복합니다.\n\n```\n[5, 3, 1, 4, 2]\n→ [3, 5, 1, 4, 2]  (5와 3 교환)\n→ [3, 1, 5, 4, 2]  (5와 1 교환)\n→ [3, 1, 4, 5, 2]  (5와 4 교환)\n→ [3, 1, 4, 2, 5]  (5와 2 교환, 1라운드 완료)\n```\n\n1라운드마다 가장 큰 값이 맨 뒤로 이동합니다."
        },
        {
          "title": "버블 정렬 시간 복잡도",
          "content": "| 케이스 | 시간 복잡도 |\n|--------|-------------|\n| 최선 | O(n) — 이미 정렬된 경우 |\n| 평균 | O(n²) |\n| 최악 | O(n²) |\n\n공간 복잡도: O(1) (제자리 정렬)\n\n**단점:** 실무에서는 거의 사용하지 않음. 개념 학습용."
        }
      ],
      "problems": [
        {
          "type": "fill_blank",
          "content": {
            "question": "버블 정렬의 평균/최악 시간 복잡도는 ___이고, 공간 복잡도는 ___입니다.",
            "blank_count": 2
          },
          "correct_answer": ["O(n²)", "O(1)"],
          "hint": "인접 비교를 n²번 수행, 추가 공간 불필요.",
          "concept_tags": ["sorting", "time-complexity"],
          "order_index": 1,
          "xp_reward": 5
        },
        {
          "type": "logic_flow",
          "content": {
            "question": "버블 정렬 1라운드 동작 흐름",
            "steps": ["첫 번째 원소부터 순서대로", "___", "교환이 없었으면 정렬 완료"],
            "blank_index": 1,
            "options": ["인접 원소 비교 후 순서 잘못되면 교환", "최솟값 찾아 맨 앞으로 이동", "절반씩 나눠 각각 정렬"]
          },
          "correct_answer": ["인접 원소 비교 후 순서 잘못되면 교환"],
          "hint": null,
          "concept_tags": ["sorting", "bubble-sort"],
          "order_index": 2,
          "xp_reward": 5
        }
      ]
    },
    {
      "slug": "merge-sort",
      "title": "병합 정렬 (Merge Sort)",
      "order_index": 2,
      "estimated_minutes": 8,
      "xp_reward": 15,
      "concept_tags": ["sorting", "merge-sort", "divide-conquer"],
      "cards": [
        {
          "title": "병합 정렬이란",
          "content": "병합 정렬은 **분할 정복(Divide & Conquer)** 방식의 정렬입니다.\n\n1. **분할:** 배열을 절반씩 재귀적으로 분할\n2. **정복:** 길이 1 배열은 이미 정렬됨\n3. **병합:** 두 정렬된 배열을 하나로 합침\n\n항상 O(n log n)을 보장합니다."
        },
        {
          "title": "병합 정렬 특징",
          "content": "| 항목 | 값 |\n|------|----|\n| 시간 복잡도 | O(n log n) (항상) |\n| 공간 복잡도 | O(n) (추가 배열 필요) |\n| 안정 정렬 | ✓ (같은 값의 순서 유지) |\n\n퀵 정렬보다 느리지만 최악 케이스에서도 O(n log n)."
        }
      ],
      "problems": [
        {
          "type": "fill_blank",
          "content": {
            "question": "병합 정렬의 시간 복잡도는 ___이고, 추가 공간이 ___만큼 필요합니다.",
            "blank_count": 2
          },
          "correct_answer": ["O(n log n)", "O(n)"],
          "hint": "분할 횟수(log n) × 병합 비용(n)",
          "concept_tags": ["merge-sort", "time-complexity"],
          "order_index": 1,
          "xp_reward": 5
        },
        {
          "type": "drag_order",
          "content": {
            "question": "병합 정렬의 단계를 순서대로 정렬하세요.",
            "items": ["배열을 절반으로 분할", "각 절반을 재귀적으로 정렬", "두 정렬된 절반을 병합"]
          },
          "correct_answer": ["배열을 절반으로 분할", "각 절반을 재귀적으로 정렬", "두 정렬된 절반을 병합"],
          "hint": null,
          "concept_tags": ["merge-sort", "divide-conquer"],
          "order_index": 2,
          "xp_reward": 5
        }
      ]
    }
  ]
}
```

- [ ] **Step 2: chapter-02-search.json 생성**

```json
{
  "course_slug": "algorithms",
  "slug": "search-algorithms",
  "title": "탐색 알고리즘",
  "order_index": 2,
  "lessons": [
    {
      "slug": "linear-binary-search",
      "title": "선형 탐색 vs 이진 탐색",
      "order_index": 1,
      "estimated_minutes": 7,
      "xp_reward": 15,
      "concept_tags": ["search", "linear-search", "binary-search"],
      "cards": [
        {
          "title": "선형 탐색 (Linear Search)",
          "content": "처음부터 끝까지 순서대로 탐색합니다.\n\n- 시간 복잡도: O(n)\n- **정렬 불필요**\n- 소규모 데이터나 정렬되지 않은 데이터에 적합"
        },
        {
          "title": "이진 탐색 (Binary Search)",
          "content": "**정렬된 배열**에서만 사용. 매 단계마다 탐색 범위를 절반으로 줄입니다.\n\n- 시간 복잡도: O(log n)\n- **반드시 정렬된 배열** 필요\n- 대규모 데이터에서 압도적으로 빠름\n\n예: n=1,000,000일 때 최대 20번만 비교!"
        }
      ],
      "problems": [
        {
          "type": "fill_blank",
          "content": {
            "question": "이진 탐색의 시간 복잡도는 ___이며, 사용하려면 배열이 ___되어 있어야 합니다.",
            "blank_count": 2
          },
          "correct_answer": ["O(log n)", "정렬"],
          "hint": "매 단계마다 절반씩 줄어듭니다.",
          "concept_tags": ["binary-search"],
          "order_index": 1,
          "xp_reward": 5
        },
        {
          "type": "logic_flow",
          "content": {
            "question": "이진 탐색에서 mid 값이 목표보다 작을 때",
            "steps": ["mid = (left + right) / 2 계산", "mid 값과 목표 값 비교", "___"],
            "blank_index": 2,
            "options": ["left = mid + 1 (오른쪽 절반 탐색)", "right = mid - 1 (왼쪽 절반 탐색)", "탐색 실패 반환"]
          },
          "correct_answer": ["left = mid + 1 (오른쪽 절반 탐색)"],
          "hint": "mid 값이 목표보다 작으면 목표는 오른쪽에 있습니다.",
          "concept_tags": ["binary-search"],
          "order_index": 2,
          "xp_reward": 5
        }
      ]
    }
  ]
}
```

- [ ] **Step 3: 시드 재실행**

```bash
npm run seed
```

Expected: 알고리즘 챕터 2개, 레슨 3개 추가됨.

- [ ] **Step 4: 커밋**

```bash
git add data/algorithms/
git commit -m "feat: add algorithms content (sorting, search)"
```

---

## Task 30: OS + 네트워크 콘텐츠 (각 2챕터)

**Files:**
- Create: `data/os/chapter-01-process.json`
- Create: `data/os/chapter-02-memory.json`
- Create: `data/network/chapter-01-tcp-ip.json`
- Create: `data/network/chapter-02-http.json`

- [ ] **Step 1: OS chapter-01-process.json 생성**

```json
{
  "course_slug": "os",
  "slug": "process-thread",
  "title": "프로세스와 스레드",
  "order_index": 1,
  "lessons": [
    {
      "slug": "process-vs-thread",
      "title": "프로세스 vs 스레드",
      "order_index": 1,
      "estimated_minutes": 8,
      "xp_reward": 15,
      "concept_tags": ["process", "thread", "context-switch"],
      "cards": [
        {
          "title": "프로세스란",
          "content": "프로세스(Process)는 **실행 중인 프로그램**입니다.\n\n각 프로세스는 독립된 메모리 공간을 가집니다:\n- **코드 영역:** 실행할 명령어\n- **데이터 영역:** 전역 변수\n- **힙(Heap):** 동적 할당 메모리\n- **스택(Stack):** 지역 변수, 함수 호출"
        },
        {
          "title": "스레드란",
          "content": "스레드(Thread)는 프로세스 내에서 실행되는 **실행 단위**입니다.\n\n| | 프로세스 | 스레드 |\n|--|---------|--------|\n| 메모리 | 독립적 | 공유 (힙/데이터) |\n| 생성 비용 | 높음 | 낮음 |\n| 통신 | IPC 필요 | 메모리 공유 |\n| 안정성 | 높음 | 낮음 (하나 죽으면 전체) |"
        }
      ],
      "problems": [
        {
          "type": "fill_blank",
          "content": {
            "question": "스레드는 같은 프로세스 내에서 ___ 영역과 ___ 영역을 공유합니다.",
            "blank_count": 2
          },
          "correct_answer": ["힙", "데이터"],
          "hint": "스택은 각 스레드가 독립적으로 가집니다.",
          "concept_tags": ["thread"],
          "order_index": 1,
          "xp_reward": 5
        },
        {
          "type": "drag_order",
          "content": {
            "question": "컨텍스트 스위칭(Context Switching) 단계를 순서대로 정렬하세요.",
            "items": ["현재 프로세스 상태(레지스터 등) 저장", "다음 실행할 프로세스 결정", "저장된 다음 프로세스 상태 복원"]
          },
          "correct_answer": ["현재 프로세스 상태(레지스터 등) 저장", "다음 실행할 프로세스 결정", "저장된 다음 프로세스 상태 복원"],
          "hint": null,
          "concept_tags": ["context-switch"],
          "order_index": 2,
          "xp_reward": 5
        }
      ]
    }
  ]
}
```

- [ ] **Step 2: OS chapter-02-memory.json 생성**

```json
{
  "course_slug": "os",
  "slug": "memory-management",
  "title": "메모리 관리",
  "order_index": 2,
  "lessons": [
    {
      "slug": "virtual-memory",
      "title": "가상 메모리 (Virtual Memory)",
      "order_index": 1,
      "estimated_minutes": 8,
      "xp_reward": 15,
      "concept_tags": ["virtual-memory", "paging", "page-fault"],
      "cards": [
        {
          "title": "가상 메모리란",
          "content": "가상 메모리는 물리 메모리(RAM)보다 더 큰 주소 공간을 프로세스에 제공하는 기법입니다.\n\n- 각 프로세스는 연속된 메모리를 가진 것처럼 동작\n- 실제로는 디스크(스왑 영역)를 RAM처럼 사용\n- **페이지(Page):** 가상 메모리의 고정 크기 블록"
        },
        {
          "title": "페이지 폴트 (Page Fault)",
          "content": "접근하려는 페이지가 RAM에 없을 때 발생합니다.\n\n**처리 과정:**\n1. CPU가 페이지 폴트 인터럽트 발생\n2. OS가 디스크에서 해당 페이지를 RAM으로 로드\n3. 프로세스 실행 재개\n\n페이지 폴트가 많으면 **스래싱(Thrashing)** 발생 → 성능 급락."
        }
      ],
      "problems": [
        {
          "type": "fill_blank",
          "content": {
            "question": "가상 메모리에서 물리 RAM에 없는 페이지에 접근할 때 ___ 가 발생합니다.",
            "blank_count": 1
          },
          "correct_answer": ["페이지 폴트"],
          "hint": "OS가 디스크에서 해당 페이지를 RAM으로 불러옵니다.",
          "concept_tags": ["page-fault"],
          "order_index": 1,
          "xp_reward": 5
        },
        {
          "type": "logic_flow",
          "content": {
            "question": "페이지 폴트 처리 흐름",
            "steps": ["CPU가 가상 주소 접근 시도", "___", "OS가 디스크에서 페이지를 RAM으로 로드 후 재실행"],
            "blank_index": 1,
            "options": ["페이지가 RAM에 없으므로 페이지 폴트 인터럽트 발생", "페이지가 RAM에 있으므로 즉시 접근", "프로세스를 강제 종료"]
          },
          "correct_answer": ["페이지가 RAM에 없으므로 페이지 폴트 인터럽트 발생"],
          "hint": null,
          "concept_tags": ["page-fault", "virtual-memory"],
          "order_index": 2,
          "xp_reward": 5
        }
      ]
    }
  ]
}
```

- [ ] **Step 3: 네트워크 chapter-01-tcp-ip.json 생성**

```json
{
  "course_slug": "network",
  "slug": "tcp-ip",
  "title": "TCP/IP",
  "order_index": 1,
  "lessons": [
    {
      "slug": "tcp-handshake",
      "title": "TCP 3-way Handshake",
      "order_index": 1,
      "estimated_minutes": 7,
      "xp_reward": 15,
      "concept_tags": ["tcp", "handshake", "connection"],
      "cards": [
        {
          "title": "TCP란",
          "content": "TCP(Transmission Control Protocol)는 **연결 지향**, **신뢰성 있는** 전송 프로토콜입니다.\n\n| | TCP | UDP |\n|--|-----|-----|\n| 연결 | 필요 | 불필요 |\n| 신뢰성 | 보장 | 미보장 |\n| 속도 | 느림 | 빠름 |\n| 예시 | HTTP, 파일 전송 | 스트리밍, 게임 |"
        },
        {
          "title": "3-way Handshake",
          "content": "TCP 연결 수립 과정:\n\n```\n클라이언트           서버\n    |-- SYN --------->|\n    |<-- SYN-ACK -----|\n    |-- ACK --------->|\n    (연결 수립 완료)\n```\n\n1. **SYN:** 클라이언트가 연결 요청\n2. **SYN-ACK:** 서버가 수락 + 자신의 연결 요청\n3. **ACK:** 클라이언트가 수락 확인"
        }
      ],
      "problems": [
        {
          "type": "drag_order",
          "content": {
            "question": "TCP 3-way Handshake 순서를 맞추세요.",
            "items": ["클라이언트 → 서버: SYN", "서버 → 클라이언트: SYN-ACK", "클라이언트 → 서버: ACK"]
          },
          "correct_answer": ["클라이언트 → 서버: SYN", "서버 → 클라이언트: SYN-ACK", "클라이언트 → 서버: ACK"],
          "hint": null,
          "concept_tags": ["tcp", "handshake"],
          "order_index": 1,
          "xp_reward": 5
        },
        {
          "type": "logic_flow",
          "content": {
            "question": "TCP 연결 종료 (4-way Handshake) 흐름",
            "steps": ["클라이언트 → FIN 전송", "___", "서버 → FIN 전송 후 클라이언트 ACK로 종료"],
            "blank_index": 1,
            "options": ["서버 → ACK 전송 (데이터 전송 완료까지 대기)", "서버 → RST 전송 (즉시 강제 종료)", "클라이언트 → FIN 재전송"]
          },
          "correct_answer": ["서버 → ACK 전송 (데이터 전송 완료까지 대기)"],
          "hint": "TCP 종료는 4단계: FIN → ACK → FIN → ACK",
          "concept_tags": ["tcp"],
          "order_index": 2,
          "xp_reward": 5
        }
      ]
    }
  ]
}
```

- [ ] **Step 4: 네트워크 chapter-02-http.json 생성**

```json
{
  "course_slug": "network",
  "slug": "http",
  "title": "HTTP",
  "order_index": 2,
  "lessons": [
    {
      "slug": "http-basics",
      "title": "HTTP 기초",
      "order_index": 1,
      "estimated_minutes": 7,
      "xp_reward": 15,
      "concept_tags": ["http", "request", "response", "status-code"],
      "cards": [
        {
          "title": "HTTP란",
          "content": "HTTP(HyperText Transfer Protocol)는 웹에서 데이터를 주고받는 프로토콜입니다.\n\n**요청 메서드:**\n- `GET` — 리소스 조회\n- `POST` — 리소스 생성\n- `PUT/PATCH` — 리소스 수정\n- `DELETE` — 리소스 삭제"
        },
        {
          "title": "HTTP 상태 코드",
          "content": "| 범위 | 의미 | 예시 |\n|------|------|------|\n| 2xx | 성공 | 200 OK, 201 Created |\n| 3xx | 리다이렉션 | 301 Moved, 304 Not Modified |\n| 4xx | 클라이언트 오류 | 400 Bad Request, 401 Unauthorized, 404 Not Found |\n| 5xx | 서버 오류 | 500 Internal Server Error |"
        }
      ],
      "problems": [
        {
          "type": "fill_blank",
          "content": {
            "question": "HTTP에서 리소스를 조회할 때는 ___ 메서드를, 생성할 때는 ___ 메서드를 사용합니다.",
            "blank_count": 2
          },
          "correct_answer": ["GET", "POST"],
          "hint": "CRUD에서 R=GET, C=POST입니다.",
          "concept_tags": ["http", "request"],
          "order_index": 1,
          "xp_reward": 5
        },
        {
          "type": "logic_flow",
          "content": {
            "question": "브라우저가 웹 페이지를 요청하는 흐름",
            "steps": ["URL 입력 → DNS로 IP 주소 조회", "___", "서버가 HTTP 응답(HTML) 반환"],
            "blank_index": 1,
            "options": ["TCP 연결 수립 후 HTTP GET 요청 전송", "UDP로 바로 HTTP 요청 전송", "IP 주소로 바로 HTML 파일 요청"]
          },
          "correct_answer": ["TCP 연결 수립 후 HTTP GET 요청 전송"],
          "hint": "HTTP는 TCP 위에서 동작합니다.",
          "concept_tags": ["http", "tcp"],
          "order_index": 2,
          "xp_reward": 5
        }
      ]
    }
  ]
}
```

- [ ] **Step 5: 모든 콘텐츠 시드**

```bash
npm run seed
```

Expected: 4개 코스 모두 챕터/레슨 시딩 완료.

- [ ] **Step 6: 커밋**

```bash
git add data/os/ data/network/
git commit -m "feat: add OS and network content"
```

---

## Task 31: QA — 전체 기능 수동 테스트

- [ ] **Step 1: 자동화 테스트 전체 실행**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 2: 수동 E2E 체크리스트**

```
[ ] 로그인 (Google OAuth)
[ ] 대시보드: 하트/스트릭/XP/레벨 표시
[ ] 대시보드: 오늘의 레슨 카드 클릭
[ ] 레슨: 카드 넘기기 (이전/다음)
[ ] 레슨: fill_blank 문제 — 정답/오답
[ ] 레슨: drag_order 문제 — 드래그하여 순서 변경 후 제출
[ ] 레슨: logic_flow 문제 — 보기 선택 후 제출
[ ] 레슨: 하트 0개 시 중단 화면
[ ] 레슨 완료: 완료 오버레이 (XP/스트릭/레벨 표시)
[ ] 레슨 완료: 복습 큐 생성 확인 (review_queue 테이블)
[ ] 복습 페이지: 복습 문제 목록
[ ] 복습: 정답 제출 시 목록에서 제거
[ ] 학습 페이지: 코스/챕터/레슨 목록
[ ] 완료된 레슨 체크 표시
[ ] 프로필: 통계 표시
[ ] 프로필: 리그 순위표
[ ] 프로필: 로그아웃
```

- [ ] **Step 3: TypeScript 빌드 오류 확인**

```bash
npm run build
```

Expected: Build success (0 errors).

---

## Task 32: Vercel 배포

- [ ] **Step 1: Vercel에 환경변수 설정**

Vercel 대시보드 → Project Settings → Environment Variables:
```
NEXT_PUBLIC_SUPABASE_URL=https://tdtyragtxikafpwtfyxq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-...
```

- [ ] **Step 2: Supabase → Auth → URL Configuration 설정**

Supabase 대시보드 → Authentication → URL Configuration:
- Site URL: `https://your-project.vercel.app`
- Redirect URLs에 `https://your-project.vercel.app/auth/callback` 추가

- [ ] **Step 3: Vercel 배포**

```bash
git push origin feat/plan1-setup-auth-db
```

Vercel이 자동으로 빌드/배포.  
OR: `vercel --prod` (Vercel CLI 설치된 경우)

- [ ] **Step 4: 프로덕션 E2E 확인**

배포된 URL에서 Task 31의 E2E 체크리스트 재확인.

- [ ] **Step 5: 최종 커밋 + 태그**

```bash
git add -A
git commit -m "feat: complete phase 5 - profile, content, QA, deploy"
git tag v1.0.0
git push origin feat/plan1-setup-auth-db --tags
```
