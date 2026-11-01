import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { SESSION_COOKIE, type Session } from '@/lib/auth'

/**
 * Verifies a Supabase Auth access token (from signInWithPassword) and sets the
 * httpOnly role cookie consumed by the middleware. Role comes from staff_users.
 */
export async function POST(req: Request) {
  let body: { access_token?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const accessToken = body.access_token
  if (!accessToken) {
    return NextResponse.json({ error: 'Missing access token.' }, { status: 400 })
  }

  const { data: authData, error: authError } = await supabase.auth.getUser(accessToken)
  if (authError || !authData.user?.email) {
    return NextResponse.json({ error: 'Supabase Auth session is invalid or expired.' }, { status: 401 })
  }

  const { data: staff, error: staffError } = await supabase
    .from('staff_users')
    .select('full_name, email, role')
    .eq('email', authData.user.email.toLowerCase())
    .maybeSingle()

  if (staffError) {
    return NextResponse.json(
      { error: `Unable to load your role. Run sql/setup_staff_users.sql first. (${staffError.message})` },
      { status: 500 }
    )
  }
  if (!staff) {
    return NextResponse.json(
      { error: 'This account is not provisioned in staff_users. Ask an admin to add it under Staff & Roles.' },
      { status: 403 }
    )
  }

  const session: Session = {
    full_name: staff.full_name,
    email: staff.email,
    role: staff.role === 'Admin' ? 'Admin' : 'Staff',
  }

  const res = NextResponse.json({ session })
  res.cookies.set(SESSION_COOKIE, encodeURIComponent(JSON.stringify(session)), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })
  return res
}
