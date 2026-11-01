'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'

export function SuccessToast({ message, detail }: { message: string | null; detail: string }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-6 z-50 flex justify-center px-4">
      <AnimatePresence>
        {message && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: -24, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="flex items-center gap-3 rounded-2xl border border-emerald-400/25 bg-[#0f1117]/90 py-3 pl-3 pr-5 shadow-[0_12px_40px_-8px_rgba(16,185,129,0.35)] backdrop-blur-xl"
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/15">
              <CheckCircle2 className="size-5 text-emerald-400" aria-hidden />
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-sm font-medium text-slate-100">{message}</span>
              <span className="text-xs text-slate-400">{detail}</span>
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
