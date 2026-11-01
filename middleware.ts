import { NextRequest, NextResponse } from 'next/server'
import { parseSession, SESSION_COOKIE } from './lib/auth'

/**
 * Role-based access control & Route Protection:
 * - Public routes: /login, /customer-view
 * - Admin routes (/admin/*): Requires active session AND role === 'Admin'
 * - POS routes (/pos/*): Requires active session
 * - Direct URL access without session redirects to /login
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const session = parseSession(req.cookies.get(SESSION_COOKIE)?.value)

  // Allow public routes explicitly
  if (pathname === '/login') {
    if (session) {
      return NextResponse.redirect(new URL(session.role === 'Admin' ? '/admin' : '/pos', req.url))
    }
    return NextResponse.next()
  }

  if (pathname === '/customer-view' || pathname.startsWith('/customer-view/')) {
    return NextResponse.next()
  }

  // Check active session for all other matched routes (/admin, /pos, etc.)
  if (!session) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    return NextResponse.redirect(url)
  }

  // Admin route protection: require role === 'Admin'
  const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/')
  if (isAdminRoute && session.role !== 'Admin') {
    const url = req.nextUrl.clone()
    url.pathname = '/pos'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin', '/admin/:path*', '/pos', '/pos/:path*', '/login', '/customer-view', '/customer-view/:path*'],
}
