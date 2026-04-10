'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
  ChevronLeft,
  ChevronRight,
  LayoutList,
  Layers,
  Filter,
  X,
  Check,
  ChevronDown,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface TxAccount  { id: string; name: string; institution_name: string; type: string }
interface TxCategory { id: string; name: string; color: string; icon: string }

interface Transaction {
  id:           string
  date:         string
  amount:       string
  merchant_name: string
  status:       'pending' | 'posted'
  is_excluded:  boolean
  is_transfer:  boolean
  account:      TxAccount
  category:     TxCategory
}

interface Account {
  id: string
  name: string
  institution_name: string
  type: string
}

interface Category {
  id:    string
  name:  string
  color: string
}

interface Pagination {
  page: number; limit: number; total: number; pages: number
}

// ── Button styles ─────────────────────────────────────────────────────────────

const btnOutline = [
  'inline-flex items-center gap-1.5 cursor-pointer bg-transparent border-0',
  'font-display text-[9px] tracking-[0.15em] uppercase',
  'px-3 py-2 transition-colors duration-200',
].join(' ')

// ── Category picker popover ───────────────────────────────────────────────────

function CategoryPicker({
  categories,
  currentId,
  onSelect,
  onClose,
}: {
  categories: Category[]
  currentId:  string
  onSelect:   (id: string) => void
  onClose:    () => void
}) {
  return (
    <div
      className="absolute right-0 top-full mt-1 w-48 z-50 py-1"
      style={{ background: '#0f0e0d', border: '1px solid rgba(201,168,76,0.2)', boxShadow: '0 8px 40px rgba(0,0,0,0.8)' }}
    >
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => { onSelect(cat.id); onClose() }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-white/5 transition-colors cursor-pointer bg-transparent border-0"
        >
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cat.color }} />
          <span
            className="font-body text-[11px]"
            style={{ color: cat.id === currentId ? '#c9a84c' : '#9c9178' }}
          >
            {cat.name}
          </span>
          {cat.id === currentId && <Check className="h-3 w-3 ml-auto text-gold flex-shrink-0" style={{ color: '#c9a84c' }} />}
        </button>
      ))}
    </div>
  )
}

// ── Transaction row ───────────────────────────────────────────────────────────

function TransactionRow({
  tx,
  categories,
  grouped,
  onCategoryChange,
  onExcludeToggle,
}: {
  tx:               Transaction
  categories:       Category[]
  grouped:          boolean
  onCategoryChange: (id: string, categoryId: string) => void
  onExcludeToggle:  (id: string, val: boolean) => void
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const amount = Number(tx.amount)
  // Credit card: positive = purchase (expense). Debit/checking: negative = withdrawal (expense)
  const isExpense = tx.account.type === 'credit' ? amount > 0 : amount < 0

  return (
    <div
      className="relative flex items-center gap-4 px-5 py-3.5 transition-colors duration-150 hover:bg-white/[0.02]"
      style={{
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        opacity: tx.is_excluded ? 0.45 : 1,
      }}
    >
      {/* Date */}
      <div className="w-16 flex-shrink-0">
        <p className="font-data text-[11px] text-parchment">{format(new Date(tx.date), 'MMM d')}</p>
        {tx.status === 'pending' && (
          <p className="font-display text-[8px] tracking-widest uppercase mt-0.5" style={{ color: '#e8c76e' }}>Pending</p>
        )}
      </div>

      {/* Account badge (only in combined view) */}
      {!grouped && (
        <div className="w-28 flex-shrink-0 hidden md:block">
          <p className="font-body text-[10px] text-ash truncate">{tx.account.institution_name}</p>
          <p className="font-body text-[9px] text-ash/60 truncate capitalize">{tx.account.type}</p>
        </div>
      )}

      {/* Merchant */}
      <div className="flex-1 min-w-0">
        <p className="font-body text-[13px] text-ivory truncate">{tx.merchant_name}</p>
        {tx.is_transfer && (
          <p className="font-display text-[8px] tracking-widest uppercase mt-0.5 text-parchment">Transfer</p>
        )}
      </div>

      {/* Category pill */}
      <div className="relative w-32 flex-shrink-0">
        <button
          onClick={() => setPickerOpen((v) => !v)}
          className="flex items-center gap-1.5 px-2.5 py-1 cursor-pointer bg-transparent border-0 hover:opacity-80 transition-opacity"
          style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2 }}
        >
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: tx.category.color }} />
          <span className="font-display text-[8px] tracking-[0.1em] uppercase text-parchment">{tx.category.name}</span>
          <ChevronDown className="h-2.5 w-2.5 text-ash" />
        </button>
        {pickerOpen && (
          <CategoryPicker
            categories={categories}
            currentId={tx.category.id}
            onSelect={(catId) => onCategoryChange(tx.id, catId)}
            onClose={() => setPickerOpen(false)}
          />
        )}
      </div>

      {/* Amount */}
      <div className="w-20 text-right flex-shrink-0">
        <p
          className="font-data text-[13px] font-semibold"
          style={{ color: isExpense ? '#c97a6b' : '#6db87a' }}
        >
          {isExpense ? '-' : '+'}{formatCurrency(Math.abs(amount))}
        </p>
      </div>

      {/* Exclude toggle */}
      <button
        onClick={() => onExcludeToggle(tx.id, !tx.is_excluded)}
        className="flex-shrink-0 w-5 h-5 flex items-center justify-center cursor-pointer bg-transparent border-0 opacity-40 hover:opacity-100 transition-opacity"
        title={tx.is_excluded ? 'Include transaction' : 'Exclude transaction'}
      >
        <X className="h-3 w-3 text-parchment" />
      </button>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function TransactionsPageContent() {
  const queryClient = useQueryClient()

  // Filters
  const [accountId,  setAccountId]  = useState<string>('')
  const [categoryId, setCategoryId] = useState<string>('')
  const [status,     setStatus]     = useState<string>('')
  const [from,       setFrom]       = useState<string>('')
  const [to,         setTo]         = useState<string>('')
  const [page,       setPage]       = useState(1)
  const [grouped,    setGrouped]    = useState(false)   // false = combined, true = by account

  // ── Data fetching ────────────────────────────────────────────────────────────

  const txParams = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), limit: '50' })
    if (accountId)  p.set('account_id',  accountId)
    if (categoryId) p.set('category_id', categoryId)
    if (status)     p.set('status',      status)
    if (from)       p.set('from',        from)
    if (to)         p.set('to',          to)
    return p.toString()
  }, [page, accountId, categoryId, status, from, to])

  const { data: txData, isLoading: txLoading } = useQuery<{
    transactions: Transaction[]
    pagination: Pagination
  }>({
    queryKey: ['transactions', txParams],
    queryFn:  () => fetch(`/api/transactions?${txParams}`).then((r) => r.json()),
  })

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn:  () => fetch('/api/accounts').then((r) => r.json()),
  })

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories-picker'],
    queryFn:  () => fetch('/api/categories').then((r) => r.json()),
  })

  // ── Mutations ────────────────────────────────────────────────────────────────

  const patchTx = useMutation({
    mutationFn: ({ id, ...body }: { id: string; category_id?: string; is_excluded?: boolean }) =>
      fetch(`/api/transactions/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['categories'] }) // invalidates all ['categories', month] keys
      queryClient.invalidateQueries({ queryKey: ['categories-picker'] })
    },
  })

  // ── Grouping ─────────────────────────────────────────────────────────────────

  const transactions = txData?.transactions ?? []
  const pagination   = txData?.pagination

  const grouped_data = useMemo(() => {
    if (!grouped) return null
    const map = new Map<string, { account: TxAccount; txs: Transaction[] }>()
    for (const tx of transactions) {
      if (!map.has(tx.account.id)) map.set(tx.account.id, { account: tx.account, txs: [] })
      map.get(tx.account.id)!.txs.push(tx)
    }
    return [...map.values()]
  }, [grouped, transactions])

  // ── Filter reset ─────────────────────────────────────────────────────────────

  const hasFilters = accountId || categoryId || status || from || to
  function clearFilters() {
    setAccountId(''); setCategoryId(''); setStatus(''); setFrom(''); setTo('')
    setPage(1)
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-void pt-12">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-[11px] tracking-[0.3em] uppercase text-gold">
              Transactions
            </h1>
            {pagination && (
              <p className="text-ash text-[10px] mt-1">
                {pagination.total.toLocaleString()} record{pagination.total !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          {/* View toggle */}
          <div className="flex items-center" style={{ border: '1px solid rgba(201,168,76,0.15)' }}>
            <button
              onClick={() => setGrouped(false)}
              className={`${btnOutline} gap-1`}
              style={{ color: !grouped ? '#c9a84c' : '#5c5648', borderRight: '1px solid rgba(201,168,76,0.15)' }}
            >
              <LayoutList className="h-3 w-3" /> Combined
            </button>
            <button
              onClick={() => setGrouped(true)}
              className={`${btnOutline} gap-1`}
              style={{ color: grouped ? '#c9a84c' : '#5c5648' }}
            >
              <Layers className="h-3 w-3" /> By Account
            </button>
          </div>
        </div>

        {/* Filters */}
        <div
          className="flex flex-wrap items-end gap-3 mb-5 p-4"
          style={{ background: '#0f0e0d', border: '1px solid rgba(201,168,76,0.1)' }}
        >
          <Filter className="h-3 w-3 text-ash flex-shrink-0 mb-2" />

          <div className="flex flex-col gap-1">
            <label className="font-display text-[8px] tracking-[0.15em] uppercase text-ash">Account</label>
            <select
              value={accountId}
              onChange={(e) => { setAccountId(e.target.value); setPage(1) }}
              className="font-body text-[11px] px-2.5 py-1.5 cursor-pointer"
              style={{ background: '#181710', color: '#9c9178', border: '1px solid rgba(201,168,76,0.15)', outline: 'none' }}
            >
              <option value="">All accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.institution_name} — {a.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-display text-[8px] tracking-[0.15em] uppercase text-ash">Category</label>
            <select
              value={categoryId}
              onChange={(e) => { setCategoryId(e.target.value); setPage(1) }}
              className="font-body text-[11px] px-2.5 py-1.5 cursor-pointer"
              style={{ background: '#181710', color: '#9c9178', border: '1px solid rgba(201,168,76,0.15)', outline: 'none' }}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-display text-[8px] tracking-[0.15em] uppercase text-ash">Status</label>
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1) }}
              className="font-body text-[11px] px-2.5 py-1.5 cursor-pointer"
              style={{ background: '#181710', color: '#9c9178', border: '1px solid rgba(201,168,76,0.15)', outline: 'none' }}
            >
              <option value="">All</option>
              <option value="posted">Posted</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-display text-[8px] tracking-[0.15em] uppercase text-ash">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => { setFrom(e.target.value); setPage(1) }}
              className="font-body text-[11px] px-2.5 py-1.5"
              style={{ background: '#181710', color: '#9c9178', border: '1px solid rgba(201,168,76,0.15)', outline: 'none', colorScheme: 'dark' }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-display text-[8px] tracking-[0.15em] uppercase text-ash">To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => { setTo(e.target.value); setPage(1) }}
              className="font-body text-[11px] px-2.5 py-1.5"
              style={{ background: '#181710', color: '#9c9178', border: '1px solid rgba(201,168,76,0.15)', outline: 'none', colorScheme: 'dark' }}
            />
          </div>

          {hasFilters && (
            <button onClick={clearFilters} className={`${btnOutline} mb-0.5`} style={{ color: '#c9a84c' }}>
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>

        {/* Table */}
        <div style={{ background: '#0f0e0d', border: '1px solid rgba(201,168,76,0.1)' }}>
          {/* Column headers */}
          <div
            className="flex items-center gap-4 px-5 py-2.5"
            style={{ borderBottom: '1px solid rgba(201,168,76,0.12)' }}
          >
            <div className="w-16 flex-shrink-0">
              <span className="font-display text-[8px] tracking-[0.15em] uppercase text-ash">Date</span>
            </div>
            {!grouped && (
              <div className="w-28 flex-shrink-0 hidden md:block">
                <span className="font-display text-[8px] tracking-[0.15em] uppercase text-ash">Account</span>
              </div>
            )}
            <div className="flex-1">
              <span className="font-display text-[8px] tracking-[0.15em] uppercase text-ash">Merchant</span>
            </div>
            <div className="w-32 flex-shrink-0">
              <span className="font-display text-[8px] tracking-[0.15em] uppercase text-ash">Category</span>
            </div>
            <div className="w-20 text-right flex-shrink-0">
              <span className="font-display text-[8px] tracking-[0.15em] uppercase text-ash">Amount</span>
            </div>
            <div className="w-5 flex-shrink-0" />
          </div>

          {/* Rows */}
          {txLoading ? (
            <div className="flex items-center justify-center py-16">
              <p className="font-display text-[9px] tracking-[0.3em] uppercase text-ash animate-pulse">Loading…</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <p className="font-display text-[10px] tracking-[0.2em] uppercase text-ash">No transactions found</p>
              {hasFilters && (
                <button onClick={clearFilters} className="font-display text-[9px] tracking-[0.15em] uppercase cursor-pointer bg-transparent border-0" style={{ color: '#c9a84c' }}>
                  Clear filters
                </button>
              )}
            </div>
          ) : grouped && grouped_data ? (
            grouped_data.map(({ account, txs }) => (
              <div key={account.id}>
                <div
                  className="px-5 py-2 flex items-center gap-2"
                  style={{ background: 'rgba(201,168,76,0.04)', borderBottom: '1px solid rgba(201,168,76,0.12)' }}
                >
                  <span className="font-display text-[9px] tracking-[0.2em] uppercase text-gold">{account.institution_name}</span>
                  <span className="font-body text-[10px] text-ash">— {account.name}</span>
                </div>
                {txs.map((tx) => (
                  <TransactionRow
                    key={tx.id}
                    tx={tx}
                    categories={categories}
                    grouped={true}
                    onCategoryChange={(id, catId) => patchTx.mutate({ id, category_id: catId })}
                    onExcludeToggle={(id, val) => patchTx.mutate({ id, is_excluded: val })}
                  />
                ))}
              </div>
            ))
          ) : (
            transactions.map((tx) => (
              <TransactionRow
                key={tx.id}
                tx={tx}
                categories={categories}
                grouped={false}
                onCategoryChange={(id, catId) => patchTx.mutate({ id, category_id: catId })}
                onExcludeToggle={(id, val) => patchTx.mutate({ id, is_excluded: val })}
              />
            ))
          )}
        </div>

        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="font-display text-[8px] tracking-[0.15em] uppercase text-ash">
              Page {pagination.page} of {pagination.pages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => p - 1)}
                disabled={page <= 1}
                className={btnOutline}
                style={{ color: page <= 1 ? '#3a3628' : '#9c9178', border: '1px solid rgba(201,168,76,0.15)' }}
              >
                <ChevronLeft className="h-3 w-3" />
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= pagination.pages}
                className={btnOutline}
                style={{ color: page >= pagination.pages ? '#3a3628' : '#9c9178', border: '1px solid rgba(201,168,76,0.15)' }}
              >
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
