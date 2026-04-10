import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const accountId  = searchParams.get('account_id') ?? undefined
  const categoryId = searchParams.get('category_id') ?? undefined
  const status     = searchParams.get('status') ?? undefined          // 'pending' | 'posted'
  const from       = searchParams.get('from') ?? undefined            // ISO date
  const to         = searchParams.get('to') ?? undefined              // ISO date
  const page       = Math.max(1, Number(searchParams.get('page') ?? '1'))
  const limit      = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? '50')))

  const where = {
    user_id:    userId,
    is_excluded: false,
    ...(accountId  && { account_id:  accountId }),
    ...(categoryId && { category_id: categoryId }),
    ...(status     && { status:      status as 'pending' | 'posted' }),
    ...(from || to ? {
      date: {
        ...(from && { gte: new Date(from) }),
        ...(to   && { lte: new Date(to)   }),
      },
    } : {}),
  }

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { date: 'desc' },
      skip:    (page - 1) * limit,
      take:    limit,
      include: {
        account:  { select: { id: true, name: true, institution_name: true, type: true } },
        category: { select: { id: true, name: true, color: true, icon: true } },
      },
    }),
    prisma.transaction.count({ where }),
  ])

  return NextResponse.json({
    transactions,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  })
}
