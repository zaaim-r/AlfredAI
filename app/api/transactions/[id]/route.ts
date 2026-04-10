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
    category_id?: string
    is_excluded?: boolean
    is_transfer?: boolean
  }

  // Verify ownership
  const tx = await prisma.transaction.findFirst({ where: { id, user_id: userId } })
  if (!tx) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updated = await prisma.transaction.update({
    where: { id },
    data: {
      ...(body.category_id !== undefined && { category_id: body.category_id }),
      ...(body.is_excluded !== undefined && { is_excluded: body.is_excluded }),
      ...(body.is_transfer !== undefined && { is_transfer: body.is_transfer }),
      // Manual category override clears transfer flag so it counts toward spending
      ...(body.category_id !== undefined && { is_transfer: false }),
    },
    include: {
      account:  { select: { id: true, name: true, institution_name: true, type: true } },
      category: { select: { id: true, name: true, color: true, icon: true } },
    },
  })

  // Invalidate Alfred context snapshot so it reflects the category change
  await prisma.user.update({
    where: { id: userId },
    data:  { alfred_context_snapshot: undefined, snapshot_updated_at: null },
  })

  return NextResponse.json(updated)
}
