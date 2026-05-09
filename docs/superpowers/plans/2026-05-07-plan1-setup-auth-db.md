# Plan 1: 프로젝트 셋업 + DB 스키마 + 인증 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Next.js 15 프로젝트를 초기화하고 Supabase DB 스키마(9개 테이블 + RLS)를 구축한 뒤 Google OAuth 로그인까지 동작하는 기반을 완성한다.

**Architecture:** Next.js 15 App Router 단일 레포 구조. Supabase SSR 패키지(`@supabase/ssr`)로 서버 컴포넌트/Route Handler/미들웨어에서 각각 별도 클라이언트를 생성한다. 인증은 Supabase Auth의 Google OAuth PKCE 플로우를 사용하며, `middleware.ts`에서 보호 라우트를 게이트한다.

**Tech Stack:** Next.js 15 (App Router), TypeScript 5, TailwindCSS 4, shadcn/ui, Supabase (PostgreSQL + Auth + RLS), `@supabase/ssr`, Vitest + @testing-library/react

---

## 파일 구조

```
csringo/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx          # 로그인 페이지
│   │   └── login/
│   │       ├── page.tsx            # 로그인 페이지
│   │       └── login-button.tsx    # Google OAuth 버튼 (클라이언트 컴포넌트)
│   ├── auth/
│   │   └── callback/
│   │       └── route.ts            # OAuth 콜백 핸들러
│   ├── (protected)/
│   │   ├── layout.tsx              # 인증 필요 레이아웃 (하단 탭바 포함)
│   │   └── dashboard/page.tsx      # 대시보드 (플레이스홀더)
│   ├── layout.tsx                  # 루트 레이아웃
│   ├── page.tsx                    # 랜딩 페이지 (로그인으로 리다이렉트)
│   └── globals.css
├── components/
│   ├── ui/                         # shadcn/ui 컴포넌트 (CLI로 추가)
│   └── layout/
│       └── bottom-nav.tsx          # 하단 탭바
├── lib/
│   └── supabase/
│       ├── client.ts               # 브라우저 클라이언트
│       ├── server.ts               # 서버 컴포넌트 클라이언트
│       └── middleware.ts           # 미들웨어 클라이언트
├── middleware.ts                   # 보호 라우트 게이트
├── supabase/
│   └── migrations/
│       ├── 20260507000001_initial_schema.sql   # 9개 테이블
│       └── 20260507000002_rls_policies.sql     # RLS 정책
├── __tests__/
│   ├── lib/supabase.test.ts
│   └── components/bottom-nav.test.tsx
├── .env.local.example
├── vitest.config.ts
└── vitest.setup.ts
```

---

## Task 1: Next.js 15 프로젝트 초기화

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `app/globals.css`, `app/layout.tsx`, `app/page.tsx`

- [ ] **Step 1: Next.js 프로젝트 생성**

현재 디렉토리(`csringo/`)에서 실행. 모든 프롬프트에 아래 선택지로 답한다.

```bash
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --app \
  --src-dir=false \
  --import-alias="@/*" \
  --no-turbopack
```

프롬프트 답변:
- Would you like to use ESLint? → Yes
- Would you like to use Tailwind CSS? → Yes
- Would you like to use `src/` directory? → No
- Would you like to use App Router? → Yes
- Would you like to customize the import alias? → No (기본 `@/*` 사용)

- [ ] **Step 2: 의존성 설치**

```bash
npm install @supabase/ssr @supabase/supabase-js
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 3: shadcn/ui 초기화**

```bash
npx shadcn@latest init
```

프롬프트 답변:
- Which style would you like to use? → Default
- Which color would you like to use as the base color? → Zinc
- Would you like to use CSS variables? → Yes

필요한 컴포넌트 추가:
```bash
npx shadcn@latest add button card badge separator avatar
```

- [ ] **Step 4: vitest 설정 파일 작성**

`vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
```

`vitest.setup.ts`:
```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 5: package.json에 test 스크립트 추가**

`package.json`의 `scripts` 섹션에 추가:
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 6: .env.local.example 작성**

```bash
# .env.local.example
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

실제 값을 담은 `.env.local`은 `.gitignore`에 포함되어 있는지 확인:
```bash
grep ".env.local" .gitignore
```

`.env.local`이 없으면 추가:
```bash
echo ".env.local" >> .gitignore
```

- [ ] **Step 7: 빌드 확인**

```bash
npm run build
```

Expected: 오류 없이 빌드 성공

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: initialize Next.js 15 project with Tailwind, shadcn, Vitest"
```

---

## Task 2: Supabase 클라이언트 설정

**Files:**
- Create: `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/middleware.ts`
- Create: `__tests__/lib/supabase.test.ts`

- [ ] **Step 1: Supabase 프로젝트 생성 및 환경 변수 설정**

1. [supabase.com](https://supabase.com) → New Project 생성
2. Project URL과 anon key 복사
3. `.env.local` 파일 생성:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

- [ ] **Step 2: 브라우저 클라이언트 작성**

`lib/supabase/client.ts`:
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 3: 서버 컴포넌트 클라이언트 작성**

`lib/supabase/server.ts`:
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component에서 set 호출 시 무시 (읽기 전용)
          }
        },
      },
    }
  )
}
```

- [ ] **Step 4: 미들웨어 클라이언트 작성**

`lib/supabase/middleware.ts`:
```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isAuthPage = request.nextUrl.pathname.startsWith('/login')
  const isProtectedPage =
    request.nextUrl.pathname.startsWith('/dashboard') ||
    request.nextUrl.pathname.startsWith('/learn') ||
    request.nextUrl.pathname.startsWith('/review') ||
    request.nextUrl.pathname.startsWith('/profile') ||
    request.nextUrl.pathname.startsWith('/settings')

  if (!user && isProtectedPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
```

- [ ] **Step 5: 테스트 작성**

`__tests__/lib/supabase.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest'

vi.mock('@supabase/ssr', () => ({
  createBrowserClient: vi.fn(() => ({ auth: { getUser: vi.fn() } })),
  createServerClient: vi.fn(() => ({ auth: { getUser: vi.fn() } })),
}))

describe('Supabase client factories', () => {
  it('createClient (browser) returns a supabase client', async () => {
    const { createClient } = await import('@/lib/supabase/client')
    const client = createClient()
    expect(client).toBeDefined()
    expect(client.auth).toBeDefined()
  })
})
```

- [ ] **Step 6: 테스트 실행**

```bash
npm test __tests__/lib/supabase.test.ts
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add lib/supabase/ __tests__/lib/supabase.test.ts
git commit -m "feat: add Supabase SSR client factories"
```

---

## Task 3: Next.js 미들웨어 작성

**Files:**
- Create: `middleware.ts`

- [ ] **Step 1: 미들웨어 작성**

`middleware.ts`:
```typescript
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

- [ ] **Step 2: 루트 페이지 리다이렉트 설정**

`app/page.tsx`:
```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function RootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  } else {
    redirect('/login')
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add middleware.ts app/page.tsx
git commit -m "feat: add auth middleware and root redirect"
```

---

## Task 4: DB 스키마 마이그레이션

**Files:**
- Create: `supabase/migrations/20260507000001_initial_schema.sql`
- Create: `supabase/migrations/20260507000002_rls_policies.sql`

- [ ] **Step 1: 스키마 마이그레이션 파일 작성**

`supabase/migrations/20260507000001_initial_schema.sql`:
```sql
-- profiles (auth.users 확장)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique not null,
  hearts int not null default 5 check (hearts >= 0 and hearts <= 5),
  hearts_last_refill timestamptz not null default now(),
  streak int not null default 0,
  last_lesson_date date,
  total_xp int not null default 0,
  level int not null default 1,
  league text not null default 'bronze',
  created_at timestamptz not null default now()
);

-- courses
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text,
  icon text,
  order_index int not null
);

-- chapters
create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete cascade not null,
  title text not null,
  order_index int not null
);

-- lessons
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid references public.chapters(id) on delete cascade not null,
  title text not null,
  cards jsonb not null default '[]',
  concept_tags text[] not null default '{}',
  order_index int not null,
  xp_reward int not null default 15,
  estimated_minutes int not null default 7
);

-- problems
create table public.problems (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid references public.lessons(id) on delete cascade not null,
  type text not null check (type in ('fill_blank', 'drag_order', 'logic_flow')),
  content jsonb not null,
  correct_answer jsonb not null,
  hint text,
  concept_tags text[] not null default '{}',
  order_index int not null,
  xp_reward int not null default 5
);

-- user_progress
create table public.user_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  lesson_id uuid references public.lessons(id) on delete cascade not null,
  status text not null check (status in ('started', 'completed')),
  last_card_index int not null default 0,
  completed_at timestamptz,
  unique (user_id, lesson_id)
);

-- wrong_answers
create table public.wrong_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  problem_id uuid references public.problems(id) on delete cascade not null,
  user_answer jsonb,
  wrong_count int not null default 1,
  last_wrong_at timestamptz not null default now(),
  unique (user_id, problem_id)
);

-- review_queue
create table public.review_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  problem_id uuid references public.problems(id) on delete cascade not null,
  priority int not null default 1,
  added_at timestamptz not null default now(),
  reviewed_at timestamptz
);

-- xp_logs
create table public.xp_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  amount int not null,
  reason text not null,
  reference_id uuid,
  created_at timestamptz not null default now()
);

-- 인덱스
create index on public.user_progress (user_id);
create index on public.user_progress (lesson_id, user_id);
create index on public.wrong_answers (user_id, last_wrong_at desc);
create index on public.review_queue (user_id, reviewed_at);
create index on public.xp_logs (user_id, created_at desc);
create index on public.problems (lesson_id);
create index on public.chapters (course_id);

-- 신규 사용자 가입 시 profile 자동 생성 트리거
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

- [ ] **Step 2: RLS 정책 파일 작성**

`supabase/migrations/20260507000002_rls_policies.sql`:
```sql
-- RLS 활성화
alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.chapters enable row level security;
alter table public.lessons enable row level security;
alter table public.problems enable row level security;
alter table public.user_progress enable row level security;
alter table public.wrong_answers enable row level security;
alter table public.review_queue enable row level security;
alter table public.xp_logs enable row level security;

-- profiles: 본인만 읽기/수정
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- courses, chapters, lessons, problems: 로그인 사용자 전체 읽기
create policy "courses_select_authenticated" on public.courses
  for select using (auth.role() = 'authenticated');

create policy "chapters_select_authenticated" on public.chapters
  for select using (auth.role() = 'authenticated');

create policy "lessons_select_authenticated" on public.lessons
  for select using (auth.role() = 'authenticated');

create policy "problems_select_authenticated" on public.problems
  for select using (auth.role() = 'authenticated');

-- user_progress: 본인만 전체 접근
create policy "user_progress_all_own" on public.user_progress
  for all using (auth.uid() = user_id);

-- wrong_answers: 본인만 전체 접근
create policy "wrong_answers_all_own" on public.wrong_answers
  for all using (auth.uid() = user_id);

-- review_queue: 본인만 전체 접근
create policy "review_queue_all_own" on public.review_queue
  for all using (auth.uid() = user_id);

-- xp_logs: 본인만 읽기/삽입
create policy "xp_logs_select_own" on public.xp_logs
  for select using (auth.uid() = user_id);

create policy "xp_logs_insert_own" on public.xp_logs
  for insert with check (auth.uid() = user_id);
```

- [ ] **Step 3: Supabase SQL Editor에서 마이그레이션 실행**

Supabase 대시보드 → SQL Editor에서 순서대로 실행:
1. `20260507000001_initial_schema.sql` 전체 내용 붙여넣기 → Run
2. `20260507000002_rls_policies.sql` 전체 내용 붙여넣기 → Run

- [ ] **Step 4: 테이블 생성 확인**

Supabase 대시보드 → Table Editor에서 아래 테이블이 모두 생성됐는지 확인:
- profiles, courses, chapters, lessons, problems
- user_progress, wrong_answers, review_queue, xp_logs

- [ ] **Step 5: Commit**

```bash
git add supabase/
git commit -m "feat: add initial DB schema and RLS policies"
```

---

## Task 5: Google OAuth 인증 설정

**Files:**
- Create: `app/(auth)/login/page.tsx`
- Create: `app/(auth)/login/login-button.tsx`
- Create: `app/auth/callback/route.ts`

- [ ] **Step 1: Supabase 대시보드에서 Google OAuth 설정**

1. Supabase 대시보드 → Authentication → Providers → Google → Enable
2. Google Cloud Console → 새 OAuth 2.0 클라이언트 생성
   - 승인된 리디렉션 URI: `https://[project-ref].supabase.co/auth/v1/callback`
3. Client ID, Client Secret을 Supabase에 입력 후 Save

- [ ] **Step 2: Site URL 설정**

Supabase 대시보드 → Authentication → URL Configuration:
- Site URL: `http://localhost:3000` (개발), `https://[your-domain]` (프로덕션)
- Redirect URLs에 `http://localhost:3000/auth/callback` 추가

- [ ] **Step 3: 로그인 페이지 작성**

`app/(auth)/login/page.tsx`:
```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LoginButton } from './login-button'

export default async function LoginPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) redirect('/dashboard')

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">CS링고</h1>
          <p className="text-muted-foreground text-lg">
            CS 기초, 이제 5분씩 쌓는다
          </p>
        </div>
        <LoginButton />
      </div>
    </div>
  )
}
```

`app/(auth)/login/login-button.tsx`:
```typescript
'use client'

import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

export function LoginButton() {
  async function handleGoogleLogin() {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  return (
    <Button
      onClick={handleGoogleLogin}
      className="w-full"
      size="lg"
    >
      Google로 시작하기
    </Button>
  )
}
```

- [ ] **Step 4: OAuth 콜백 Route Handler 작성**

`app/auth/callback/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
```

- [ ] **Step 5: Commit**

```bash
git add app/
git commit -m "feat: add Google OAuth login page and callback handler"
```

---

## Task 6: 보호 라우트 레이아웃 & 기본 대시보드

**Files:**
- Create: `app/(protected)/layout.tsx`
- Create: `app/(protected)/dashboard/page.tsx`
- Create: `components/layout/bottom-nav.tsx`
- Create: `__tests__/components/bottom-nav.test.tsx`

- [ ] **Step 1: BottomNav 컴포넌트 테스트 작성**

`__tests__/components/bottom-nav.test.tsx`:
```typescript
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { BottomNav } from '@/components/layout/bottom-nav'

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}))

describe('BottomNav', () => {
  it('renders all 4 navigation tabs', () => {
    render(<BottomNav />)
    expect(screen.getByText('홈')).toBeInTheDocument()
    expect(screen.getByText('학습')).toBeInTheDocument()
    expect(screen.getByText('복습')).toBeInTheDocument()
    expect(screen.getByText('프로필')).toBeInTheDocument()
  })

  it('highlights the active tab based on current path', () => {
    render(<BottomNav />)
    const homeLink = screen.getByRole('link', { name: /홈/i })
    expect(homeLink).toHaveClass('text-primary')
  })
})
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

```bash
npm test __tests__/components/bottom-nav.test.tsx
```

Expected: FAIL — `BottomNav` not found

- [ ] **Step 3: BottomNav 컴포넌트 구현**

`components/layout/bottom-nav.tsx`:
```typescript
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, BookOpen, RotateCcw, User } from 'lucide-react'
import { cn } from '@/lib/utils'

const tabs = [
  { href: '/dashboard', label: '홈', icon: Home },
  { href: '/learn', label: '학습', icon: BookOpen },
  { href: '/review', label: '복습', icon: RotateCcw },
  { href: '/profile', label: '프로필', icon: User },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background">
      <div className="flex h-16 max-w-lg mx-auto">
        {tabs.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 text-xs transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
```

- [ ] **Step 4: lucide-react 설치**

```bash
npm install lucide-react
```

- [ ] **Step 5: 테스트 재실행 (성공 확인)**

```bash
npm test __tests__/components/bottom-nav.test.tsx
```

Expected: PASS

- [ ] **Step 6: 보호 라우트 레이아웃 작성**

`app/(protected)/layout.tsx`:
```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BottomNav } from '@/components/layout/bottom-nav'

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="min-h-screen pb-16">
      {children}
      <BottomNav />
    </div>
  )
}
```

- [ ] **Step 7: 대시보드 플레이스홀더 페이지 작성**

`app/(protected)/dashboard/page.tsx`:
```typescript
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, hearts, streak, total_xp, level')
    .eq('id', user!.id)
    .single()

  return (
    <main className="max-w-lg mx-auto px-4 pt-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">안녕하세요, {profile?.username}님!</h1>
      </div>

      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-1">
          <span>❤️</span>
          <span className="font-semibold">{profile?.hearts}</span>
        </div>
        <div className="flex items-center gap-1">
          <span>🔥</span>
          <span className="font-semibold">{profile?.streak}일</span>
        </div>
        <div className="flex items-center gap-1">
          <span>⭐</span>
          <span className="font-semibold">{profile?.total_xp} XP</span>
        </div>
      </div>

      <div className="rounded-lg border p-6 text-center text-muted-foreground">
        오늘의 레슨 — 곧 업데이트됩니다
      </div>
    </main>
  )
}
```

- [ ] **Step 8: 전체 테스트 실행**

```bash
npm test
```

Expected: 모든 테스트 PASS

- [ ] **Step 9: 개발 서버 실행 및 동작 확인**

```bash
npm run dev
```

확인 항목:
1. `http://localhost:3000` → `/login`으로 리다이렉트
2. "Google로 시작하기" 버튼 클릭 → Google OAuth 화면 이동
3. 로그인 완료 → `/dashboard`로 리다이렉트
4. username, hearts, streak, XP 표시
5. 하단 탭바 4개 탭 표시
6. `/dashboard`에서 탭바 "홈" 강조 표시

- [ ] **Step 10: Commit**

```bash
git add app/(protected)/ components/layout/ __tests__/components/
git commit -m "feat: add protected layout with BottomNav and dashboard placeholder"
```

---

## Task 7: 루트 레이아웃 & 글로벌 스타일 정리

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: 루트 레이아웃 업데이트**

`app/layout.tsx`:
```typescript
import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'CS링고 | CS 기초, 5분씩 쌓는다',
  description: '매일 5~10분 마이크로 레슨으로 CS 기초를 습관으로 만드는 웹 서비스',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className={geist.className}>{children}</body>
    </html>
  )
}
```

- [ ] **Step 2: 빌드 최종 확인**

```bash
npm run build
```

Expected: 오류 없이 빌드 성공

- [ ] **Step 3: 최종 Commit**

```bash
git add app/layout.tsx app/globals.css
git commit -m "feat: finalize root layout and global styles"
```

---

## 완료 기준 (Definition of Done)

- [ ] `npm run build` 오류 없음
- [ ] `npm test` 전체 PASS
- [ ] `http://localhost:3000` 접속 시 `/login` 리다이렉트
- [ ] Google OAuth 로그인 완료 후 `/dashboard` 진입
- [ ] 대시보드에서 username, hearts, streak, XP 정상 표시
- [ ] 하단 탭바 4개 탭 렌더링 + 현재 경로 강조
- [ ] Supabase Table Editor에서 9개 테이블 확인
- [ ] RLS 정책 적용 확인 (다른 user_id로 조회 시 데이터 반환 안 됨)
