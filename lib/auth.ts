export type StaffRole = 'Admin' | 'Staff'

export type StaffUser = {
  id: string
  full_name: string
  email: string
  role: StaffRole
  created_at: string
}

export type Session = {
  full_name: string
  email: string
  role: StaffRole
}

export const SESSION_COOKIE = 'toku_session'

export function parseSession(raw?: string | null): Session | null {
  if (!raw) return null
  const candidates = [raw]
  try {
    candidates.push(decodeURIComponent(raw))
  } catch {
    // raw value is not percent-encoded — JSON.parse attempt below will decide
  }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as Session
      if (
        parsed &&
        typeof parsed.email === 'string' &&
        typeof parsed.full_name === 'string' &&
        (parsed.role === 'Admin' || parsed.role === 'Staff')
      ) {
        return parsed
      }
    } catch {
      // try the next candidate
    }
  }
  return null
}

export async function hashPassword(password: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password))
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}
