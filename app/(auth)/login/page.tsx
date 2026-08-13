import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LoginButton } from './login-button'
import { DEMO_ENABLED } from '@/lib/demo'

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  if (DEMO_ENABLED) redirect('/dashboard')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) redirect('/dashboard')

  const params = await searchParams
  const authError = params.error === 'auth_failed'

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">CS링고</h1>
          <p className="text-muted-foreground text-lg">
            CS 기초, 이제 5분씩 쌓는다
          </p>
        </div>
        {authError && (
          <p className="text-sm text-destructive text-center">
            로그인에 실패했습니다. 다시 시도해주세요.
          </p>
        )}
        <LoginButton />
      </div>
    </div>
  )
}
