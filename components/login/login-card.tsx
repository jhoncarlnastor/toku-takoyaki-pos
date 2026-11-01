'use client'

import { useState, type FormEvent } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, ArrowRight, Loader2, Lock, Mail } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { RoleSelector, type Role } from './role-selector'
import { TextField } from './text-field'
import { SuccessToast } from './success-toast'

type Status = 'idle' | 'loading' | 'success'

export function LoginCard() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('staff')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const busy = status !== 'idle'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setError(null)

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError('Please enter a valid email address.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setStatus('loading')
    const normalizedEmail = email.trim().toLowerCase()
    let authenticated = false

    // 1. Supabase Auth
    const { data: authData } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    })

    if (authData?.session) {
      // Prove the Supabase Auth session to our server so it can set the role cookie
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: authData.session.access_token }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setStatus('idle')
        setError(data.error ?? 'Unable to start your session. Please try again.')
        return
      }
      authenticated = true
    }

    // 2. Fetch the signed-in user's role from staff_users
    const { data: staff, error: staffError } = await supabase
      .from('staff_users')
      .select('full_name, email, role')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (staffError || !staff) {
      setStatus('idle')
      setError(
        staffError?.message ??
          'This email is not provisioned yet. Run sql/setup_staff_users.sql, then add the member under Staff & Roles.'
      )
      return
    }

    // Fallback for accounts that exist in staff_users but not yet in Supabase Auth
    if (!authenticated) {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setStatus('idle')
        setError(data.error ?? 'Invalid email or password. Please try again.')
        return
      }
    }

    // 3. Role-based redirect
    const destination = staff.role === 'Admin' ? '/admin' : '/pos'
    setRole(staff.role === 'Admin' ? 'admin' : 'staff')
    setStatus('success')
    setToast(`Welcome back, ${staff.full_name}!`)
    setTimeout(() => {
      setToast(null)
      router.push(destination)
      router.refresh()
    }, 1100)
  }

  const destination = role === 'admin' ? 'Opening Admin Console…' : 'Opening POS terminal…'

  return (
    <>
      <SuccessToast message={toast} detail={destination} />
      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[30rem]"
      >
        <div className="rounded-[2rem] bg-gradient-to-b from-orange-400/50 via-white/10 to-white/5 p-px shadow-[0_30px_80px_-20px_rgba(249,115,22,0.35)]">
          <div className="rounded-[calc(2rem-1px)] bg-[#14161e]/85 px-6 py-10 backdrop-blur-2xl sm:px-10 sm:py-12">
            <motion.header
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.1, delayChildren: 0.25 } } }}
              className="flex flex-col items-center text-center"
            >
              <motion.div
                variants={{ hidden: { opacity: 0, scale: 0.7 }, show: { opacity: 1, scale: 1 } }}
                transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                className="relative mb-3 flex justify-center"
              >
                <div className="absolute inset-0 rounded-full bg-orange-500/40 blur-2xl" aria-hidden />
                <div className="relative h-14 w-14 overflow-hidden rounded-full border-2 border-orange-500/40 shadow-md mx-auto">
                  <Image
                    src="/toku-logo.png"
                    alt="Toku Takoyaki logo"
                    width={56}
                    height={56}
                    priority
                    className="h-full w-full object-cover"
                  />
                </div>
              </motion.div>
              <motion.h1
                variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                className="text-3xl font-semibold tracking-wide text-slate-50"
              >
                Toku Takoyaki
              </motion.h1>
              <motion.p
                variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                className="mt-2.5 text-pretty text-sm text-slate-400"
              >
                Sign in to access POS &amp; Admin Console
              </motion.p>
            </motion.header>

            <form onSubmit={handleSubmit} noValidate className="mt-10 space-y-6">
              <AnimatePresence initial={false}>
                {error && (
                  <motion.div
                    key="error"
                    role="alert"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto', x: [0, -8, 8, -5, 5, 0] }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.45 }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3.5 text-sm text-red-200">
                      <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-400" aria-hidden />
                      <span>{error}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-2.5">
                <span className="text-sm font-medium text-slate-300">Sign in as</span>
                <RoleSelector value={role} onChange={setRole} disabled={busy} />
              </div>

              <TextField
                label="Email Address"
                type="email"
                icon={<Mail className="size-[18px]" />}
                value={email}
                onChange={setEmail}
                placeholder="you@toku.local"
                autoComplete="email"
                invalid={!!error}
                disabled={busy}
              />

              <TextField
                label="Password"
                type="password"
                icon={<Lock className="size-[18px]" />}
                value={password}
                onChange={setPassword}
                placeholder="Enter your password"
                autoComplete="current-password"
                invalid={!!error}
                disabled={busy}
              />

              <motion.button
                type="submit"
                disabled={busy}
                whileTap={{ scale: 0.97 }}
                className="group relative flex h-14 w-full items-center justify-center gap-2.5 overflow-hidden rounded-xl bg-gradient-to-b from-orange-400 to-orange-600 text-[15px] font-semibold text-white shadow-[0_8px_24px_-8px_rgba(249,115,22,0.7)] outline-none transition-shadow duration-300 hover:shadow-[0_0_44px_-4px_rgba(251,146,60,0.85)] focus-visible:ring-4 focus-visible:ring-orange-400/40 disabled:cursor-not-allowed disabled:opacity-90"
              >
                <span
                  aria-hidden
                  className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full"
                />
                {status === 'loading' ? (
                  <>
                    <Loader2 className="size-5 animate-spin" aria-hidden />
                    <span className="relative">Signing in…</span>
                  </>
                ) : status === 'success' ? (
                  <span className="relative">Signed in</span>
                ) : (
                  <>
                    <span className="relative">Sign In</span>
                    <ArrowRight
                      className="relative size-4 transition-transform duration-300 group-hover:translate-x-1"
                      aria-hidden
                    />
                  </>
                )}
              </motion.button>
            </form>

            <footer className="mt-8 border-t border-white/5 pt-5 text-center text-[11px] text-slate-600">
              Toku Takoyaki POS v1.0 &bull; Powered by Supabase
            </footer>
          </div>
        </div>
      </motion.div>
    </>
  )
}
