export const DEMO_ENABLED = process.env.SKIP_AUTH === 'true'

export const DEMO_USER = {
  id: 'demo-user-00000000-0000-0000-0000-000000000000',
  email: 'demo@csringo.dev',
}

export const DEMO_PROFILE = {
  username: '데모',
  hearts: 5,
  hearts_last_refill: new Date().toISOString(),
  streak: 7,
  total_xp: 350,
  league: 'silver',
  created_at: new Date().toISOString(),
}
