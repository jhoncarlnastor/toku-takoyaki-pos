import { AmbientBackground } from '@/components/login/ambient-background'
import { LoginCard } from '@/components/login/login-card'

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-8 overflow-hidden bg-[#0f1117] px-4 py-10 sm:px-6">
      <AmbientBackground />
      <div className="relative z-10 flex w-full justify-center">
        <LoginCard />
      </div>
      <p className="relative z-10 text-center text-xs tracking-[0.3em] text-slate-600">
        たこ焼き · TOKU TAKOYAKI
      </p>
    </main>
  )
}
