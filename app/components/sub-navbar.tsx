'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ClipboardList, PlusCircle } from 'lucide-react'

const tabs = [
  { label: 'Nouvelle fiche', href: '/', Icon: PlusCircle },
  { label: 'Récapitulatif', href: '/recapitulatif', Icon: ClipboardList },
]

export default function SubNavbar() {
  const pathname = usePathname()

  return (
    <>
      {/* Desktop: top tab bar */}
      <div className="hidden lg:block border-b border-foreground/10 px-4 sm:px-6 bg-white/60">
        <nav className="max-w-5xl mx-auto flex justify-evenly items-center gap-1">
          {tabs.map(({ label, href, Icon }) => {
            const isActive = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={`relative flex items-center gap-2 px-3 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'text-foreground font-medium'
                    : 'text-foreground/50 hover:text-foreground/80'
                }`}
              >
                <Icon size={15} />
                {label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
                )}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Mobile/tablet: bottom thumb bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 px-6 border-t border-foreground/10 bg-white/95 backdrop-blur-sm">
        <div className="flex items-stretch">
          {tabs.map(({ label, href, Icon }) => {
            const isActive = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={`relative flex flex-1 flex-col items-center justify-center gap-1 py-3 text-xs transition-colors ${
                  isActive
                    ? 'text-foreground font-medium'
                    : 'text-foreground/45 hover:text-foreground/70'
                }`}
              >
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-accent" />
                )}
                <Icon size={20} strokeWidth={isActive ? 2 : 1.5} />
                <span>{label}</span>
              </Link>
            )
          })}
        </div>
        {/* Safe area spacer for iOS */}
        <div className="h-safe-area-inset-bottom" />
      </nav>

    </>
  )
}
