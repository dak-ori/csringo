import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'

export async function POST() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  const headersList = await headers()
  const host = headersList.get('host') ?? 'localhost:3000'
  const proto = headersList.get('x-forwarded-proto') ?? 'http'
  return NextResponse.redirect(`${proto}://${host}/login`, { status: 302 })
}
