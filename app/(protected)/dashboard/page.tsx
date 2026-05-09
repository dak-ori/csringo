import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, hearts, streak, total_xp, level')
    .eq('id', user.id)
    .single()

  if (!profile) return (
    <div className="max-w-lg mx-auto px-4 pt-8 text-center text-muted-foreground">
      프로필을 불러올 수 없습니다.
    </div>
  )

  return (
    <main className="max-w-lg mx-auto px-4 pt-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">안녕하세요, {profile.username}님!</h1>
      </div>

      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-1">
          <span>❤️</span>
          <span className="font-semibold">{profile.hearts}</span>
        </div>
        <div className="flex items-center gap-1">
          <span>🔥</span>
          <span className="font-semibold">{profile.streak}일</span>
        </div>
        <div className="flex items-center gap-1">
          <span>⭐</span>
          <span className="font-semibold">{profile.total_xp} XP</span>
        </div>
      </div>

      <div className="rounded-lg border p-6 text-center text-muted-foreground">
        오늘의 레슨 — 곧 업데이트됩니다
      </div>
    </main>
  )
}
