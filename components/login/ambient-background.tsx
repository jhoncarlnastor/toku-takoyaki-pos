'use client'

import { motion, useReducedMotion } from 'framer-motion'

const orbs = [
  { className: 'left-[-10%] top-[-15%] h-[28rem] w-[28rem] bg-orange-500/25', x: 60, y: 40, d: 18 },
  { className: 'right-[-12%] bottom-[-18%] h-[32rem] w-[32rem] bg-amber-500/20', x: -50, y: -60, d: 22 },
  { className: 'left-[35%] top-[55%] h-[20rem] w-[20rem] bg-red-500/10', x: 40, y: -30, d: 26 },
]

const balls = [
  { left: '8%', top: '22%', size: 56, delay: 0, dur: 9 },
  { left: '86%', top: '18%', size: 40, delay: 1.5, dur: 11 },
  { left: '14%', top: '72%', size: 34, delay: 3, dur: 10 },
  { left: '78%', top: '66%', size: 64, delay: 0.8, dur: 12 },
  { left: '50%', top: '8%', size: 26, delay: 2.2, dur: 8 },
  { left: '92%', top: '88%', size: 30, delay: 4, dur: 9.5 },
]

const steam = [
  { left: '12%', delay: 0 },
  { left: '30%', delay: 2.4 },
  { left: '68%', delay: 1.2 },
  { left: '88%', delay: 3.6 },
]

export function AmbientBackground() {
  const reduce = useReducedMotion()

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {orbs.map((o, i) => (
        <motion.div
          key={i}
          className={`absolute rounded-full blur-[110px] ${o.className}`}
          animate={reduce ? undefined : { x: [0, o.x, 0], y: [0, o.y, 0], scale: [1, 1.15, 1] }}
          transition={{ duration: o.d, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}

      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
        }}
      />

      {balls.map((b, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            left: b.left,
            top: b.top,
            width: b.size,
            height: b.size,
            background:
              'radial-gradient(circle at 35% 30%, rgba(253,186,116,0.55), rgba(249,115,22,0.35) 50%, rgba(124,45,18,0.25))',
            filter: 'blur(1.5px)',
            opacity: 0.45,
          }}
          animate={reduce ? undefined : { y: [0, -26, 0], rotate: [0, 12, -8, 0] }}
          transition={{ duration: b.dur, delay: b.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}

      {steam.map((s, i) => (
        <motion.svg
          key={i}
          viewBox="0 0 40 160"
          className="absolute bottom-[-2rem] h-56 w-12 text-amber-200"
          style={{ left: s.left }}
          initial={{ opacity: 0, y: 0 }}
          animate={reduce ? { opacity: 0.08 } : { opacity: [0, 0.22, 0], y: [0, -220] }}
          transition={{ duration: 9, delay: s.delay, repeat: Infinity, ease: 'easeOut' }}
        >
          <path
            d="M20 160c-16-24 16-40 0-64s16-40 0-64"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            style={{ filter: 'blur(3px)' }}
          />
        </motion.svg>
      ))}
    </div>
  )
}
