'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Script from 'next/script'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import {
  RefreshCw,
  Plus,
  Loader2,
  Eye,
  EyeOff,
  Unplug,
  WifiOff,
  LogOut,
  ChevronDown,
} from 'lucide-react'
import { useUser, useClerk } from '@clerk/nextjs'
import { formatCurrency } from '@/lib/utils'

// ── Teller Connect global type ──────────────────────────────────────────────

interface TellerEnrollment {
  accessToken: string
  user: { id: string }
  enrollment: { id: string; institution: { name: string } }
}

declare global {
  interface Window {
    TellerConnect: {
      setup: (config: {
        applicationId: string
        environment?: string
        products?: string[]
        onSuccess: (enrollment: TellerEnrollment) => void
        onExit?: () => void
        onFailure?: (failure: unknown) => void
      }) => { open: () => void }
    }
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

interface Account {
  id: string
  name: string
  institution_name: string
  type: 'checking' | 'savings' | 'credit' | 'brokerage'
  current_balance: string
  last_synced_at: string | null
  is_active: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_META = {
  checking:  { label: 'Checking' },
  savings:   { label: 'Savings' },
  credit:    { label: 'Credit' },
  brokerage: { label: 'Brokerage' },
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 5)  return 'Still awake, sir?'
  if (h < 12) return 'Good morning, sir.'
  if (h < 17) return 'Good afternoon, sir.'
  if (h < 21) return 'Good evening, sir.'
  return 'Good night, sir.'
}

// ── Reusable button styles ────────────────────────────────────────────────────

const btnGold = [
  'inline-flex items-center gap-2',
  'bg-gold hover:bg-gold-light text-void',
  'font-display text-[0.65rem] tracking-[0.15em] font-semibold',
  'px-5 py-2.5',
  'transition-colors duration-200',
  'disabled:opacity-40 disabled:cursor-not-allowed',
  'cursor-pointer',
].join(' ')

const btnOutline = [
  'inline-flex items-center gap-2',
  'border border-gold/50 hover:border-gold text-parchment hover:text-gold',
  'font-display text-[0.6rem] tracking-[0.12em]',
  'px-4 py-2.5',
  'transition-colors duration-200',
  'disabled:opacity-40 disabled:cursor-not-allowed',
  'cursor-pointer',
  'bg-transparent',
].join(' ')

// ── User Menu ─────────────────────────────────────────────────────────────────

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

  const initials = user
    ? (user.firstName?.[0] ?? '') + (user.lastName?.[0] ?? '')
    : '?'
  const displayName = user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? ''
  const email = user?.primaryEmailAddress?.emailAddress ?? ''

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2.5 cursor-pointer bg-transparent border-0 p-0"
        aria-label="Account menu"
      >
        {/* Avatar circle */}
        <div
          className="w-8 h-8 flex items-center justify-center font-display text-[10px] tracking-widest"
          style={{
            background: 'rgba(201, 168, 76, 0.12)',
            border: '1px solid rgba(201, 168, 76, 0.4)',
            color: '#c9a84c',
          }}
        >
          {initials || '?'}
        </div>
        <div className="hidden sm:flex flex-col items-start">
          <span className="font-display text-[9px] tracking-[0.15em] uppercase text-ivory leading-none">
            {displayName}
          </span>
          {email && displayName !== email && (
            <span className="text-ash text-[8px] tracking-wide mt-0.5">{email}</span>
          )}
        </div>
        <ChevronDown
          className="h-3 w-3 text-ash transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-52 z-50"
          style={{
            background: '#0f0e0d',
            border: '1px solid rgba(201, 168, 76, 0.2)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.8)',
          }}
        >
          {/* Email header */}
          <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="font-display text-[9px] tracking-[0.15em] uppercase text-ivory truncate">
              {displayName}
            </p>
            {email && displayName !== email && (
              <p className="text-ash text-[8px] tracking-wide mt-0.5 truncate">{email}</p>
            )}
          </div>

          {/* Actions */}
          <div className="py-1">
            <button
              onClick={() => { setOpen(false); signOut({ redirectUrl: '/' }) }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-ash hover:text-red-400 hover:bg-white/5 transition-colors duration-150 cursor-pointer bg-transparent border-0"
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

// ── Account Card ──────────────────────────────────────────────────────────────

function AccountCard({
  account,
  onDisconnect,
  disconnecting,
  animationDelay = '0s',
}: {
  account: Account
  onDisconnect: (id: string) => void
  disconnecting: boolean
  animationDelay?: string
}) {
  const [balanceVisible, setBalanceVisible] = useState(true)
  const meta = TYPE_META[account.type]
  const balance = parseFloat(account.current_balance)
  const isCredit = account.type === 'credit'

  return (
    <div
      className="animate-fade-up flex flex-col"
      style={{
        animationDelay,
        background: '#0f0e0d',
        border: '1px solid rgba(201, 168, 76, 0.25)',
        position: 'relative',
      }}
    >
      {/* Gold top-line accent */}
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: '1px',
          background: 'linear-gradient(90deg, transparent 0%, #c9a84c 50%, transparent 100%)',
        }}
      />

      {/* Card body */}
      <div className="px-5 pt-6 pb-4 flex flex-col gap-5">

        {/* Institution + badge */}
        <div className="flex items-start justify-between">
          <div>
            <p className="font-display text-[11px] tracking-[0.18em] text-ivory uppercase">
              {account.institution_name}
            </p>
            <p className="text-ash text-[10px] tracking-wide mt-1">{account.name}</p>
          </div>
          <span
            className="font-display text-[9px] tracking-[0.12em] uppercase"
            style={{
              color: '#c9a84c',
              border: '1px solid rgba(201, 168, 76, 0.4)',
              padding: '2px 8px',
            }}
          >
            {meta.label}
          </span>
        </div>

        {/* Balance */}
        <div>
          <div className="flex items-center gap-2.5">
            <span className="font-data text-3xl font-semibold text-ivory tracking-wide">
              {balanceVisible ? formatCurrency(balance) : '•••••'}
            </span>
            <button
              onClick={() => setBalanceVisible((v) => !v)}
              className="text-ash hover:text-gold transition-colors duration-200 cursor-pointer bg-transparent border-0 p-0"
              aria-label={balanceVisible ? 'Hide balance' : 'Show balance'}
            >
              {balanceVisible
                ? <EyeOff className="h-3.5 w-3.5" />
                : <Eye    className="h-3.5 w-3.5" />}
            </button>
          </div>
          <p className="text-ash text-[9px] tracking-[0.2em] uppercase mt-1">
            {isCredit ? 'outstanding balance' : 'available balance'}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-between px-5 py-3 mt-auto"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
      >
        <p className="text-ash text-[9px] tracking-wide">
          {account.last_synced_at
            ? `synced ${formatDistanceToNow(new Date(account.last_synced_at), { addSuffix: true })}`
            : 'never synced'}
        </p>
        <button
          onClick={() => {
            if (confirm(`Disconnect ${account.institution_name} — ${account.name}?\n\nHistorical transactions will be preserved.`)) {
              onDisconnect(account.id)
            }
          }}
          disabled={disconnecting}
          className="inline-flex items-center gap-1.5 text-[9px] tracking-[0.15em] uppercase text-ash hover:text-red-400 disabled:opacity-40 transition-colors duration-200 cursor-pointer bg-transparent border-0"
        >
          <Unplug className="h-3 w-3" />
          Disconnect
        </button>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export function AccountsPageContent({
  appId,
  environment,
}: {
  appId: string
  environment: string
}) {
  const qc = useQueryClient()
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const greeting = getGreeting()

  const { data: accounts = [], isLoading, error } = useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn: () => fetch('/api/accounts').then((r) => r.json()),
  })

  const disconnect = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/accounts/${id}`, { method: 'DELETE' }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  })

  const handleSync = async () => {
    setSyncing(true)
    try {
      await fetch('/api/teller/sync', { method: 'POST' })
      await qc.invalidateQueries({ queryKey: ['accounts'] })
    } finally {
      setSyncing(false)
    }
  }

  const handleConnect = useCallback(() => {
    if (!scriptLoaded || !window.TellerConnect) return

    const tc = window.TellerConnect.setup({
      applicationId: appId,
      environment,
      products: ['transactions', 'balance'],
      onSuccess: async (enrollment) => {
        setConnecting(true)
        try {
          const res = await fetch('/api/teller/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              accessToken:     enrollment.accessToken,
              enrollmentId:    enrollment.enrollment.id,
              institutionName: enrollment.enrollment.institution.name,
            }),
          })
          if (!res.ok) throw new Error('Connect failed')
          await qc.invalidateQueries({ queryKey: ['accounts'] })
          await fetch('/api/teller/sync', { method: 'POST' })
          await qc.invalidateQueries({ queryKey: ['accounts'] })
        } catch (err) {
          console.error('Teller connect error:', err)
        } finally {
          setConnecting(false)
        }
      },
      onExit:    () => {},
      onFailure: (f) => console.error('Teller connect failure:', f),
    })

    tc.open()
  }, [scriptLoaded, appId, environment, qc])

  return (
    <>
      <Script
        src="https://cdn.teller.io/connect/connect.js"
        onLoad={() => setScriptLoaded(true)}
        strategy="afterInteractive"
      />

      <div className="min-h-screen bg-void px-6 md:px-10 py-10">
        <div className="max-w-5xl mx-auto">

          {/* ── Header ── */}
          <div className="flex items-start justify-between mb-12">
            <div className="flex items-center gap-4">
              <div
                className="w-9 h-9 flex-shrink-0 flex items-center justify-center"
                style={{
                  transform: 'rotate(45deg)',
                  border: '1px solid rgba(201, 168, 76, 0.5)',
                }}
              >
                <span
                  className="font-display text-sm text-gold"
                  style={{ transform: 'rotate(-45deg)' }}
                >
                  A
                </span>
              </div>
              <div>
                <h1 className="font-display text-lg tracking-[0.25em] text-ivory">ALFRED</h1>
                <p className="text-ash text-[10px] tracking-[0.15em] mt-0.5 italic">{greeting}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSync}
                disabled={syncing || accounts.length === 0}
                className={btnOutline}
              >
                <RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing…' : 'Refresh'}
              </button>
              <button
                onClick={handleConnect}
                disabled={!scriptLoaded || connecting}
                className={btnGold}
              >
                {connecting
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Plus    className="h-3.5 w-3.5" />}
                {connecting ? 'Connecting…' : 'Connect Account'}
              </button>
              <div
                className="w-px h-6 self-center"
                style={{ background: 'rgba(201,168,76,0.2)' }}
              />
              <UserMenu />
            </div>
          </div>

          {/* ── Section label ── */}
          {accounts.length > 0 && (
            <div
              className="flex items-center gap-3 mb-6"
              style={{ borderBottom: '1px solid rgba(201, 168, 76, 0.12)', paddingBottom: '12px' }}
            >
              <p className="font-display text-[9px] tracking-[0.3em] uppercase" style={{ color: '#c9a84c' }}>
                Connected Accounts
              </p>
              <span
                className="font-data text-[10px] font-semibold"
                style={{
                  color: '#c9a84c',
                  border: '1px solid rgba(201, 168, 76, 0.3)',
                  padding: '0 6px',
                  lineHeight: '1.6',
                }}
              >
                {accounts.length}
              </span>
            </div>
          )}

          {/* ── Content ── */}
          {isLoading ? (
            <div className="flex items-center justify-center py-32">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-5 w-5 animate-spin text-gold" />
                <p className="text-ash text-[10px] tracking-widest uppercase">One moment, sir.</p>
              </div>
            </div>

          ) : error ? (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <WifiOff className="h-8 w-8 text-ash mb-4" />
              <p className="font-display text-xs tracking-[0.15em] text-parchment mb-1 uppercase">Connection Failed</p>
              <p className="text-ash text-[10px]">Please refresh the page, sir.</p>
            </div>

          ) : accounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <div
                className="w-16 h-16 flex items-center justify-center mb-10"
                style={{ transform: 'rotate(45deg)', border: '1px solid rgba(201, 168, 76, 0.2)' }}
              >
                <span className="font-display text-xl" style={{ transform: 'rotate(-45deg)', color: 'rgba(201,168,76,0.25)' }}>
                  A
                </span>
              </div>
              <p className="font-display text-sm tracking-[0.25em] text-parchment mb-3 uppercase">
                No Accounts
              </p>
              <p className="text-ash text-xs max-w-xs leading-relaxed mb-10">
                Connect your bank accounts and Alfred will keep a precise watch over your finances.
              </p>
              <button
                onClick={handleConnect}
                disabled={!scriptLoaded || connecting}
                className={btnGold}
              >
                {connecting
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Plus    className="h-3.5 w-3.5" />}
                {connecting ? 'Connecting…' : 'Connect First Account'}
              </button>
            </div>

          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {accounts.map((account, i) => (
                <AccountCard
                  key={account.id}
                  account={account}
                  onDisconnect={(id) => disconnect.mutate(id)}
                  disconnecting={disconnect.isPending}
                  animationDelay={`${i * 0.07}s`}
                />
              ))}
            </div>
          )}

        </div>
      </div>
    </>
  )
}
