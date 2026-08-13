import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { calculateLevel } from '@/lib/xp'
import { calculateCurrentHearts } from '@/lib/hearts'
import { DEMO_ENABLED, DEMO_USER, DEMO_PROFILE } from '@/lib/demo'

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

const DEMO_LEAGUE_ROWS: LeagueRankRow[] = [
  { user_id: DEMO_USER.id, username: '데모', total_xp: 350, league: 'silver', rank: 1 },
  { user_id: 'other-1', username: '철수', total_xp: 280, league: 'silver', rank: 2 },
  { user_id: 'other-2', username: '영희', total_xp: 210, league: 'silver', rank: 3 },
]

export default async function ProfilePage() {
  const supabase = await createClient()

  const userId = DEMO_ENABLED ? DEMO_USER.id : (await supabase.auth.getUser()).data.user?.id
  if (!userId) redirect('/login')

  let profile: typeof DEMO_PROFILE | null = null
  let completedLessons = 0
  let leagueRows: LeagueRankRow[] = []

  if (DEMO_ENABLED) {
    profile = DEMO_PROFILE
    completedLessons = 3
    leagueRows = DEMO_LEAGUE_ROWS
  } else {
    const [profileRes, progressRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('username, hearts, hearts_last_refill, streak, total_xp, league, created_at')
        .eq('id', userId)
        .single(),
      supabase
        .from('user_progress')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'completed'),
    ])
    profile = profileRes.data
    if (!profile) redirect('/login')
    completedLessons = progressRes.count ?? 0
    const { data } = await supabase.rpc('get_league_rankings', {
      p_league: profile.league,
      p_limit: 10,
    })
    leagueRows = (data as LeagueRankRow[]) ?? []
  }

  const level = calculateLevel(profile.total_xp)
  const currentHearts = calculateCurrentHearts(
    profile.hearts,
    new Date(profile.hearts_last_refill)
  )

  const myRank = leagueRows.find(r => r.user_id === userId)

  return (
    <main className="max-w-lg mx-auto px-4 pt-8 pb-24 space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-2xl font-bold text-primary">
          {profile.username[0].toUpperCase()}
        </div>
        <div>
          <h1 className="text-xl font-bold">{profile.username}</h1>
          <p className="text-sm text-muted-foreground">{LEAGUE_LABELS[profile.league] ?? profile.league}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: '레벨', value: `Lv.${level}` },
          { label: '총 XP', value: profile.total_xp },
          { label: '완료 레슨', value: completedLessons },
          { label: '현재 하트', value: '❤️'.repeat(currentHearts) || '🖤🖤🖤🖤🖤' },
          { label: '스트릭', value: `${profile.streak}일` },
          { label: '리그 순위', value: myRank ? `#${myRank.rank}` : '-' },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl border p-3 text-center">
            <p className="text-xl font-bold">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-lg font-bold mb-3">{LEAGUE_LABELS[profile.league]} 순위</h2>
        <div className="space-y-2">
          {(leagueRows as LeagueRankRow[] ?? []).map(row => (
            <div
              key={row.user_id}
              className={`flex items-center justify-between p-3 rounded-xl border ${
                row.user_id === userId ? 'bg-primary/10 border-primary' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold w-6 text-center text-muted-foreground">
                  #{row.rank}
                </span>
                <span className="font-medium">{row.username}</span>
                {row.user_id === userId && (
                  <span className="text-xs text-primary">(나)</span>
                )}
              </div>
              <span className="text-sm text-muted-foreground">{row.total_xp} XP</span>
            </div>
          ))}
        </div>
      </div>

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
