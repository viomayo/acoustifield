'use client'

import { useEffect, useState } from 'react'

export default function SplashScreen() {
  const [hiding, setHiding] = useState(false)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setHiding(true))
    const timeout = setTimeout(() => setHidden(true), 650)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(timeout)
    }
  }, [])

  if (hidden) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#f5f0eb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        opacity: hiding ? 0 : 1,
        transition: 'opacity 0.6s ease',
        pointerEvents: 'none',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        width={96}
        height={96}
        alt=""
        style={{ borderRadius: 22 }}
      />
    </div>
  )
}
