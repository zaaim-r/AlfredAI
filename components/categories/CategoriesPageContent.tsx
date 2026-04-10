'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Category {
  id:                     string
  user_id:                string | null
  name:                   string
  monthly_limit:          number | null
  warning_threshold:      number
  warning_threshold_type: 'percent' | 'amount'
  is_system:              boolean
  color:                  string
  icon:                   string
  spent_this_month:       number
  deleted_at:             string | null
}

// ── Colour palette ────────────────────────────────────────────────────────────

const PRESET_COLORS = [
  '#c9a84c', '#e8c76e', '#a07830',
  '#6db87a', '#4a9e5c', '#2d7a46',
  '#6b9fd4', '#4a7fbf', '#2d5fa0',
  '#c97a6b', '#b05a4a', '#8c3d2e',
  '#9b7ec8', '#7a5faa', '#5c408c',
  '#9c9178', '#5c5648', '#3a3628',
]

// ── Button styles ─────────────────────────────────────────────────────────────

const btnGold = [
  'inline-flex items-center gap-1.5 cursor-pointer',
  'font-display text-[9px] tracking-[0.15em] uppercase',
  'px-4 py-2 transition-colors duration-200',
].join(' ')

// ── Color Picker ──────────────────────────────────────────────────────────────

function ColorPicker({
  value,
  onChange,
}: {
  value:    string
  onChange: (color: string) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => onChange(c)}
            className="w-6 h-6 cursor-pointer border-0 transition-transform duration-150 hover:scale-110"
            style={{
              background:  c,
              outline:     value === c ? '2px solid #f0ebe0' : '2px solid transparent',
              outlineOffset: '2px',
            }}
          />
        ))}
      </div>
      {/* Free-text hex input */}
      <div className="flex items-center gap-2 mt-1">
        <div className="w-5 h-5 flex-shrink-0" style={{ background: value, border: '1px solid rgba(255,255,255,0.2)' }} />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#c9a84c"
          maxLength={7}
          className="font-data text-[11px] px-2 py-1 w-28"
          style={{ background: '#181710', color: '#9c9178', border: '1px solid rgba(201,168,76,0.15)', outline: 'none' }}
        />
      </div>
    </div>
  )
}

// ── Category form (create / edit) ─────────────────────────────────────────────

function CategoryForm({
  initial,
  onSubmit,
  onCancel,
  loading,
}: {
  initial?: Partial<Category>
  onSubmit: (data: { name: string; monthly_limit: number | null; color: string; warning_threshold: number; warning_threshold_type: 'percent' | 'amount' }) => void
  onCancel: () => void
  loading:  boolean
}) {
  const [name,          setName]          = useState(initial?.name  ?? '')
  const [limit,         setLimit]         = useState(initial?.monthly_limit != null ? String(initial.monthly_limit) : '')
  const [color,         setColor]         = useState(initial?.color ?? '#c9a84c')
  const [threshold,     setThreshold]     = useState(initial?.warning_threshold ?? 80)
  const [thresholdType, setThresholdType] = useState<'percent' | 'amount'>(initial?.warning_threshold_type ?? 'percent')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    onSubmit({
      name:                   name.trim(),
      monthly_limit:          limit ? Number(limit) : null,
      color,
      warning_threshold:      threshold,
      warning_threshold_type: thresholdType,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label className="font-display text-[8px] tracking-[0.15em] uppercase text-ash">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Groceries"
          autoFocus
          className="font-body text-[13px] px-3 py-2"
          style={{ background: '#181710', color: '#f0ebe0', border: '1px solid rgba(201,168,76,0.2)', outline: 'none' }}
        />
      </div>

      <div className="flex gap-4">
        <div className="flex flex-col gap-1 flex-1">
          <label className="font-display text-[8px] tracking-[0.15em] uppercase text-ash">Monthly Limit ($)</label>
          <input
            type="number"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            placeholder="No limit"
            min={0}
            step={1}
            className="font-data text-[13px] px-3 py-2"
            style={{ background: '#181710', color: '#f0ebe0', border: '1px solid rgba(201,168,76,0.2)', outline: 'none' }}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-display text-[8px] tracking-[0.15em] uppercase text-ash">Warn at</label>
          <div className="flex items-stretch gap-0">
            {/* Type toggle */}
            <div className="flex" style={{ border: '1px solid rgba(201,168,76,0.2)' }}>
              <button
                type="button"
                onClick={() => setThresholdType('percent')}
                className="px-2.5 font-display text-[8px] tracking-widest cursor-pointer border-0 transition-colors duration-150"
                style={{
                  background: thresholdType === 'percent' ? 'rgba(201,168,76,0.15)' : 'transparent',
                  color:      thresholdType === 'percent' ? '#c9a84c' : '#5c5648',
                  borderRight: '1px solid rgba(201,168,76,0.2)',
                }}
              >
                %
              </button>
              <button
                type="button"
                onClick={() => setThresholdType('amount')}
                className="px-2.5 font-display text-[8px] tracking-widest cursor-pointer border-0 transition-colors duration-150"
                style={{
                  background: thresholdType === 'amount' ? 'rgba(201,168,76,0.15)' : 'transparent',
                  color:      thresholdType === 'amount' ? '#c9a84c' : '#5c5648',
                }}
              >
                $
              </button>
            </div>
            <input
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              min={1}
              max={thresholdType === 'percent' ? 100 : undefined}
              step={1}
              placeholder={thresholdType === 'percent' ? '80' : '500'}
              className="font-data text-[13px] px-3 py-2 w-24"
              style={{ background: '#181710', color: '#f0ebe0', border: '1px solid rgba(201,168,76,0.2)', borderLeft: 'none', outline: 'none' }}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="font-display text-[8px] tracking-[0.15em] uppercase text-ash">Color</label>
        <ColorPicker value={color} onChange={setColor} />
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={loading || !name.trim()}
          className={btnGold}
          style={{ background: '#c9a84c', color: '#070706' }}
        >
          <Check className="h-3 w-3" />
          {loading ? 'Saving…' : initial?.id ? 'Save Changes' : 'Create Category'}
        </button>
        <button type="button" onClick={onCancel} className="font-display text-[9px] tracking-[0.15em] uppercase text-ash hover:text-ivory transition-colors cursor-pointer bg-transparent border-0 px-3 py-2">
          Cancel
        </button>
      </div>
    </form>
  )
}

// ── Category card ─────────────────────────────────────────────────────────────

function CategoryCard({
  category,
  onEdit,
  onDelete,
}: {
  category: Category
  onEdit:   (cat: Category) => void
  onDelete: (cat: Category) => void
}) {
  const pct = category.monthly_limit
    ? Math.min(100, (category.spent_this_month / category.monthly_limit) * 100)
    : null

  const warnTriggered = category.monthly_limit
    ? category.warning_threshold_type === 'amount'
      ? category.spent_this_month >= category.warning_threshold
      : pct !== null && pct >= category.warning_threshold
    : false

  const overBudget  = pct !== null && pct >= 100
  const nearWarning = warnTriggered && !overBudget

  const barColor = overBudget ? '#c97a6b' : nearWarning ? '#e8c76e' : category.color

  return (
    <div
      className="relative p-5 flex flex-col gap-3"
      style={{ background: '#0f0e0d', border: '1px solid rgba(201,168,76,0.1)' }}
    >
      {/* Top accent line in category color */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent 0%, ${category.color} 50%, transparent 100%)` }}
      />

      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: category.color }} />
          <span className="font-display text-[10px] tracking-[0.15em] uppercase text-ivory truncate">
            {category.name}
          </span>
          {category.is_system && (
            <span
              className="font-display text-[7px] tracking-widest uppercase px-1.5 py-0.5 flex-shrink-0"
              style={{ color: '#5c5648', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              System
            </span>
          )}
        </div>

        {!category.is_system && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => onEdit(category)}
              className="w-6 h-6 flex items-center justify-center cursor-pointer bg-transparent border-0 text-ash hover:text-gold transition-colors"
              style={{ color: '#5c5648' }}
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              onClick={() => onDelete(category)}
              className="w-6 h-6 flex items-center justify-center cursor-pointer bg-transparent border-0 hover:text-red-400 transition-colors"
              style={{ color: '#5c5648' }}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* Spend vs limit */}
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-data text-[18px] font-semibold text-ivory">
          {formatCurrency(category.spent_this_month)}
        </span>
        {category.monthly_limit != null ? (
          <span className="font-data text-[11px] text-ash">
            of {formatCurrency(category.monthly_limit)}
          </span>
        ) : (
          <span className="font-display text-[8px] tracking-widest uppercase text-ash">No limit</span>
        )}
      </div>

      {/* Progress bar */}
      {pct !== null && (
        <div>
          <div className="h-0.5 w-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div
              className="h-full transition-all duration-500"
              style={{ width: `${pct}%`, background: barColor }}
            />
          </div>
          <div className="flex items-center justify-between mt-1">
            <span
              className="font-display text-[8px] tracking-[0.1em] uppercase"
              style={{ color: overBudget ? '#c97a6b' : nearWarning ? '#e8c76e' : '#5c5648' }}
            >
              {overBudget ? 'Over budget' : nearWarning ? 'Near limit' : `${Math.round(pct!)}% used`}
            </span>
            {!overBudget && category.monthly_limit != null && (
              <span className="font-data text-[9px] text-ash">
                {formatCurrency(category.monthly_limit - category.spent_this_month)} left
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

function getMonthOptions() {
  const options = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    const value = d.toISOString().slice(0, 7)
    const label = d.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    options.push({ value, label })
  }
  return options
}

export function CategoriesPageContent() {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [editing,    setEditing]    = useState<Category | null>(null)
  const [deleting,   setDeleting]   = useState<Category | null>(null)
  const [month,      setMonth]      = useState(() => new Date().toISOString().slice(0, 7))

  const monthOptions = getMonthOptions()
  const isCurrentMonth = month === new Date().toISOString().slice(0, 7)

  const { data: categories = [], isLoading } = useQuery<Category[]>({
    queryKey:       ['categories', month],
    queryFn:        () => fetch(`/api/categories?month=${month}`).then((r) => r.json()),
    refetchOnMount: 'always',
  })

  const createMutation = useMutation({
    mutationFn: (body: object) =>
      fetch('/api/categories', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['categories', month] }); setShowCreate(false) },
  })

  const editMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string } & object) =>
      fetch(`/api/categories/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['categories', month] }); setEditing(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/categories/${id}`, { method: 'DELETE' }).then((r) => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['categories', month] }); setDeleting(null) },
  })

  const userCategories   = categories.filter((c) => !c.is_system)
  const systemCategories = categories.filter((c) => c.is_system)

  return (
    <div className="min-h-screen bg-void pt-12">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-[11px] tracking-[0.3em] uppercase text-gold">Categories</h1>
            <p className="text-ash text-[10px] mt-1">Spending limits</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Month picker */}
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="font-display text-[9px] tracking-[0.12em] uppercase px-3 py-2 cursor-pointer"
              style={{ background: '#0f0e0d', color: isCurrentMonth ? '#c9a84c' : '#9c9178', border: '1px solid rgba(201,168,76,0.2)', outline: 'none' }}
            >
              {monthOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <button
              onClick={() => setShowCreate(true)}
              className={btnGold}
              style={{ background: '#c9a84c', color: '#070706' }}
            >
              <Plus className="h-3.5 w-3.5" /> New Category
            </button>
          </div>
        </div>

        {/* Create form */}
        {showCreate && (
          <div
            className="mb-6 p-5"
            style={{ background: '#0f0e0d', border: '1px solid rgba(201,168,76,0.25)' }}
          >
            <p className="font-display text-[9px] tracking-[0.2em] uppercase text-gold mb-4">New Category</p>
            <CategoryForm
              onSubmit={(data) => createMutation.mutate(data)}
              onCancel={() => setShowCreate(false)}
              loading={createMutation.isPending}
            />
          </div>
        )}

        {/* Edit modal */}
        {editing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }}>
            <div className="w-full max-w-md p-6" style={{ background: '#0f0e0d', border: '1px solid rgba(201,168,76,0.25)' }}>
              <div className="flex items-center justify-between mb-4">
                <p className="font-display text-[9px] tracking-[0.2em] uppercase text-gold">Edit Category</p>
                <button onClick={() => setEditing(null)} className="cursor-pointer bg-transparent border-0 text-ash hover:text-ivory transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <CategoryForm
                initial={editing}
                onSubmit={(data) => editMutation.mutate({ id: editing.id, ...data })}
                onCancel={() => setEditing(null)}
                loading={editMutation.isPending}
              />
            </div>
          </div>
        )}

        {/* Delete confirmation */}
        {deleting && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }}>
            <div className="w-full max-w-sm p-6" style={{ background: '#0f0e0d', border: '1px solid rgba(201,168,76,0.25)' }}>
              <p className="font-display text-[9px] tracking-[0.2em] uppercase text-gold mb-3">Confirm Delete</p>
              <p className="font-body text-[13px] text-parchment mb-1">
                Delete <span className="text-ivory">"{deleting.name}"</span>?
              </p>
              <p className="font-body text-[11px] text-ash mb-5">
                All transactions in this category will move to Uncategorized.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => deleteMutation.mutate(deleting.id)}
                  disabled={deleteMutation.isPending}
                  className={btnGold}
                  style={{ background: '#c97a6b', color: '#f0ebe0' }}
                >
                  {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
                </button>
                <button onClick={() => setDeleting(null)} className="font-display text-[9px] tracking-[0.15em] uppercase text-ash hover:text-ivory transition-colors cursor-pointer bg-transparent border-0 px-3 py-2">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Loading */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <p className="font-display text-[9px] tracking-[0.3em] uppercase text-ash animate-pulse">Loading…</p>
          </div>
        ) : (
          <>
            {/* User categories */}
            {userCategories.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {userCategories.map((cat) => (
                  <CategoryCard
                    key={cat.id}
                    category={cat}
                    onEdit={setEditing}
                    onDelete={setDeleting}
                  />
                ))}
              </div>
            )}

            {/* System categories */}
            {systemCategories.length > 0 && (
              <>
                <p className="font-display text-[8px] tracking-[0.2em] uppercase text-ash mb-3">System Categories</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {systemCategories.map((cat) => (
                    <CategoryCard
                      key={cat.id}
                      category={cat}
                      onEdit={setEditing}
                      onDelete={setDeleting}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
