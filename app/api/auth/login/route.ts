import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { hashPassword, SESSION_COOKIE, type Session } from '@/lib/auth'

export async function POST(req: Request) {
  let body: { email?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase()
  const password = body.password ?? ''

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })
  }

  const passwordHash = await hashPassword(password)

  const { data, error } = await supabase
    .from('staff_users')
    .select('*')
    .eq('email', email)
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json(
      {
        error: `Unable to sign in. If this is a fresh setup, run sql/setup_staff_users.sql in the Supabase SQL Editor. (${error?.message ?? 'User not found'})`,
      },
      { status: error ? 500 : 401 }
    )
  }

  const storedPassword = data.password ?? data.password_hash
  const matches = storedPassword === passwordHash || storedPassword === password

  if (!matches) {
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
  }

  const session: Session = {
    full_name: data.full_name,
    email: data.email,
    role: data.role === 'Admin' ? 'Admin' : 'Staff',
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
