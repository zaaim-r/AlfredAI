'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useUser, useClerk } from '@clerk/nextjs'
import { LayoutDashboard, ArrowLeftRight, Tag, Landmark, LogOut, ChevronDown } from 'lucide-react'

const LINKS = [
  { href: '/',             label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { href: '/categories',   label: 'Categories',   icon: Tag },
  { href: '/accounts',     label: 'Accounts',     icon: Landmark },
]

function UserMenu() {
  const { user } = useUser()
  const { signOut } = useClerk()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  if (!user) return null

  const initials     = (user.firstName?.[0] ?? '') + (user.lastName?.[0] ?? '')
  const displayName  = user.fullName ?? user.primaryEmailAddress?.emailAddress ?? ''
  const email        = user.primaryEmailAddress?.emailAddress ?? ''

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 cursor-pointer bg-transparent border-0 p-0"
        aria-label="Account menu"
      >
        <div
          className="w-6 h-6 flex items-center justify-center font-display text-[9px] tracking-widest"
          style={{
            background: 'rgba(201,168,76,0.1)',
            border: '1px solid rgba(201,168,76,0.35)',
            color: '#c9a84c',
          }}
        >
          {initials || '?'}
        </div>
        <span className="hidden sm:block font-display text-[9px] tracking-[0.12em] uppercase text-ivory max-w-[120px] truncate">
          {displayName}
        </span>
        <ChevronDown
          className="h-2.5 w-2.5 text-ash transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-52 z-50"
          style={{
            background: '#0f0e0d',
            border: '1px solid rgba(201,168,76,0.2)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.8)',
          }}
        >
          <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="font-display text-[9px] tracking-[0.15em] uppercase text-ivory truncate">{displayName}</p>
            {email && displayName !== email && (
              <p className="text-ash text-[8px] tracking-wide mt-0.5 truncate">{email}</p>
            )}
          </div>
          <div className="py-1">
            <button
              onClick={() => { setOpen(false); signOut({ redirectUrl: '/' }) }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/5 transition-colors duration-150 cursor-pointer bg-transparent border-0"
              style={{ color: '#5c5648' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#f87171')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#5c5648')}
            >
              <LogOut className="h-3 w-3 flex-shrink-0" />
              <span className="font-display text-[9px] tracking-[0.15em] uppercase">Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function Nav() {
  const pathname = usePathname()

  // Don't render nav on auth pages or landing
  const hide = ['/', '/sign-in', '/sign-up'].includes(pathname)
    || pathname.startsWith('/sign-in')
    || pathname.startsWith('/sign-up')
  if (hide) return null

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-6 h-12"
      style={{
        background: 'rgba(7,7,6,0.92)',
        borderBottom: '1px solid rgba(201,168,76,0.12)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Wordmark */}
      <Link
        href="/accounts"
        className="font-display text-[11px] tracking-[0.3em] uppercase text-ivory hover:text-gold transition-colors duration-200 flex-shrink-0"
      >
        Alfred
      </Link>

      {/* Links */}
      <div className="flex items-center gap-1">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-1.5 px-3 py-1.5 font-display text-[9px] tracking-[0.15em] uppercase transition-colors duration-200"
              style={{
                color: active ? '#c9a84c' : '#5c5648',
                borderBottom: active ? '1px solid rgba(201,168,76,0.6)' : '1px solid transparent',
              }}
            >
              <Icon className="h-3 w-3" />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          )
        })}
      </div>

      {/* User */}
      <UserMenu />
    </nav>
  )
}
