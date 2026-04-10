import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json() as {
    name?: string
    monthly_limit?: number | null
    color?: string
    icon?: string
    warning_threshold?: number
    warning_threshold_type?: 'percent' | 'amount'
  }

  const category = await prisma.category.findFirst({
    where: { id, user_id: userId, deleted_at: null },
  })
  if (!category) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // Internal-only categories are never editable
  const PROTECTED = ['Transfer', 'Credit Card Payment']
  if (PROTECTED.includes(category.name)) return NextResponse.json({ error: 'Cannot modify system category' }, { status: 403 })

  const updated = await prisma.category.update({
    where: { id },
    data: {
      ...(body.name              !== undefined && { name:              body.name.trim() }),
      ...(body.monthly_limit     !== undefined && { monthly_limit:     body.monthly_limit }),
      ...(body.color             !== undefined && { color:             body.color }),
      ...(body.icon              !== undefined && { icon:              body.icon }),
      ...(body.warning_threshold      !== undefined && { warning_threshold:      body.warning_threshold }),
      ...(body.warning_threshold_type !== undefined && { warning_threshold_type: body.warning_threshold_type }),
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const category = await prisma.category.findFirst({
    where: { id, user_id: userId, deleted_at: null },
  })
  if (!category) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // These can never be deleted — sync logic depends on them
  const UNDELETABLE = ['Uncategorized', 'Transfer', 'Credit Card Payment', 'Income']
  if (UNDELETABLE.includes(category.name)) return NextResponse.json({ error: 'Cannot delete this category' }, { status: 403 })

  // Fall back its transactions to Uncategorized
  const uncategorized = await prisma.category.findFirst({
    where: { name: 'Uncategorized', deleted_at: null, user_id: userId },
  })

  await prisma.$transaction([
    ...(uncategorized
      ? [prisma.transaction.updateMany({
          where: { category_id: id, user_id: userId },
          data:  { category_id: uncategorized.id },
        })]
      : []),
    prisma.category.update({
      where: { id },
      data:  { deleted_at: new Date() },
    }),
  ])

  return NextResponse.json({ ok: true })
}
