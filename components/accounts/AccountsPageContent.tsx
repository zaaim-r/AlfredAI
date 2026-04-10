'use client'

import { useCallback, useState } from 'react'
import Script from 'next/script'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import {
  Building2,
  CreditCard,
  PiggyBank,
  TrendingUp,
  RefreshCw,
  Trash2,
  Plus,
  Loader2,
  WifiOff,
  Eye,
  EyeOff,
} from 'lucide-react'
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
  checking: { label: 'Checking', icon: Building2, color: 'bg-blue-100 text-blue-700' },
  savings: { label: 'Savings', icon: PiggyBank, color: 'bg-green-100 text-green-700' },
  credit: { label: 'Credit Card', icon: CreditCard, color: 'bg-orange-100 text-orange-700' },
  brokerage: { label: 'Brokerage', icon: TrendingUp, color: 'bg-purple-100 text-purple-700' },
}

function AccountCard({
  account,
  onDisconnect,
  disconnecting,
}: {
  account: Account
  onDisconnect: (id: string) => void
  disconnecting: boolean
}) {
  const [balanceVisible, setBalanceVisible] = useState(true)
  const meta = TYPE_META[account.type]
  const Icon = meta.icon
  const balance = parseFloat(account.current_balance)
  const isCredit = account.type === 'credit'

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-gray-100 p-2">
            <Icon className="h-5 w-5 text-gray-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">{account.institution_name}</p>
            <p className="text-gray-500 text-xs mt-0.5">{account.name}</p>
          </div>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${meta.color}`}>
          {meta.label}
        </span>
      </div>

      <div>
        <div className="flex items-center gap-2">
          <p className="text-2xl font-bold text-gray-900">
            {balanceVisible ? formatCurrency(balance) : '••••••'}
          </p>
          <button
            onClick={() => setBalanceVisible((v) => !v)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label={balanceVisible ? 'Hide balance' : 'Show balance'}
          >
            {balanceVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-0.5">
          {isCredit ? 'outstanding balance' : 'available balance'}
        </p>
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-gray-100">
        <p className="text-xs text-gray-400">
          {account.last_synced_at
            ? `Synced ${formatDistanceToNow(new Date(account.last_synced_at), { addSuffix: true })}`
            : 'Never synced'}
        </p>
        <button
          onClick={() => {
            if (confirm(`Disconnect ${account.institution_name} — ${account.name}? Historical transactions will be preserved.`)) {
              onDisconnect(account.id)
            }
          }}
          disabled={disconnecting}
          className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
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
              accessToken: enrollment.accessToken,
              enrollmentId: enrollment.enrollment.id,
              institutionName: enrollment.enrollment.institution.name,
            }),
          })
          if (!res.ok) throw new Error('Connect failed')
          await qc.invalidateQueries({ queryKey: ['accounts'] })
          // Trigger a sync for the newly connected accounts
          await fetch('/api/teller/sync', { method: 'POST' })
          await qc.invalidateQueries({ queryKey: ['accounts'] })
        } catch (err) {
          console.error('Teller connect error:', err)
        } finally {
          setConnecting(false)
        }
      },
      onExit: () => {},
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

      <div className="min-h-screen bg-gray-50 p-6 md:p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Connected Accounts</h1>
              <p className="text-sm text-gray-500 mt-1">
                Manage your linked bank accounts and cards
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSync}
                disabled={syncing || accounts.length === 0}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing…' : 'Refresh'}
              </button>
              <button
                onClick={handleConnect}
                disabled={!scriptLoaded || connecting}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {connecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {connecting ? 'Connecting…' : 'Connect Account'}
              </button>
            </div>
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <WifiOff className="h-10 w-10 text-gray-300 mb-3" />
              <p className="text-gray-500">Failed to load accounts. Please refresh.</p>
            </div>
          ) : accounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="rounded-full bg-gray-100 p-5 mb-4">
                <Building2 className="h-8 w-8 text-gray-400" />
              </div>
              <h2 className="text-lg font-semibold text-gray-700 mb-1">No accounts connected</h2>
              <p className="text-sm text-gray-400 mb-6 max-w-xs">
                Connect your bank accounts to start tracking your finances.
              </p>
              <button
                onClick={handleConnect}
                disabled={!scriptLoaded || connecting}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {connecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Connect your first account
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {accounts.map((account) => (
                <AccountCard
                  key={account.id}
                  account={account}
                  onDisconnect={(id) => disconnect.mutate(id)}
                  disconnecting={disconnect.isPending}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
