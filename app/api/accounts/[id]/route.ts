import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const account = await prisma.account.findFirst({
    where: { id, user_id: userId },
  })

  if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.account.update({
    where: { id },
    data: { deleted_at: new Date(), is_active: false },
  })

  return NextResponse.json({ success: true })
}
