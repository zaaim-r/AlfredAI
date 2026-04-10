import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Never cache — spend totals must always be fresh
export const dynamic = 'force-dynamic'

const HIDDEN_CATEGORIES = ['Transfer', 'Credit Card Payment']

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Accept ?month=2026-03 or default to current month
  const monthParam = req.nextUrl.searchParams.get('month')
  const month      = monthParam && /^\d{4}-\d{2}$/.test(monthParam)
    ? monthParam
    : new Date().toISOString().slice(0, 7)

  const monthStart = new Date(`${month}-01T00:00:00.000Z`)
  const monthEnd   = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1))

  const [categories, expenseTxs] = await Promise.all([
    prisma.category.findMany({
      where: {
        deleted_at: null,
        name:       { notIn: HIDDEN_CATEGORIES },
        OR: [{ user_id: userId }, { user_id: null }],
      },
      orderBy: [{ is_system: 'asc' }, { name: 'asc' }],
    }),
    prisma.transaction.findMany({
      where: {
        user_id:     userId,
        status:      'posted',
        is_excluded: false,
        date:        { gte: monthStart, lt: monthEnd },
      },
      select: {
        category_id: true,
        amount:      true,
        account:     { select: { type: true } },
      },
    }),
  ])

  const spendAccum = new Map<string, number>()
  for (const tx of expenseTxs) {
    const amt       = Number(tx.amount)
    const isExpense = tx.account.type === 'credit' ? amt > 0 : amt < 0
    if (!isExpense) continue
    spendAccum.set(tx.category_id, (spendAccum.get(tx.category_id) ?? 0) + Math.abs(amt))
  }

  const result = categories.map((cat) => ({
    ...cat,
    monthly_limit:    cat.monthly_limit ? Number(cat.monthly_limit) : null,
    warning_threshold: Number(cat.warning_threshold),
    spent_this_month: spendAccum.get(cat.id) ?? 0,
  }))

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    name: string
    monthly_limit?: number
    color?: string
    icon?: string
    warning_threshold?: number
    warning_threshold_type?: 'percent' | 'amount'
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  const category = await prisma.category.create({
    data: {
      user_id:                userId,
      name:                   body.name.trim(),
      monthly_limit:          body.monthly_limit ?? null,
      color:                  body.color ?? '#c9a84c',
      icon:                   body.icon ?? 'circle',
      warning_threshold:      body.warning_threshold ?? 80,
      warning_threshold_type: body.warning_threshold_type ?? 'percent',
    },
  })

  return NextResponse.json(category, { status: 201 })
}
