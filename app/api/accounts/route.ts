import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const accounts = await prisma.account.findMany({
    where: { user_id: userId, deleted_at: null },
    orderBy: { created_at: 'asc' },
  })

  return NextResponse.json(accounts)
}
