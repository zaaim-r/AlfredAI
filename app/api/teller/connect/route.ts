import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTellerAccounts, getTellerBalance, mapAccountType } from '@/lib/teller'

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { accessToken, enrollmentId, institutionName } = body

  if (!accessToken || !enrollmentId) {
    return NextResponse.json({ error: 'Missing accessToken or enrollmentId' }, { status: 400 })
  }

  // Ensure a User row exists (Clerk doesn't create one automatically)
  const clerkUser = await currentUser()
  const email = clerkUser?.emailAddresses[0]?.emailAddress ?? ''
  await prisma.user.upsert({
    where: { id: userId },
    create: { id: userId, email },
    update: {},
  })

  const tellerAccounts = await getTellerAccounts(accessToken)
  const saved = []

  for (const ta of tellerAccounts) {
    if (ta.status !== 'open') continue

    let balance = 0
    try {
      const b = await getTellerBalance(accessToken, ta.id)
      balance = Math.abs(parseFloat(b.ledger ?? '0'))
    } catch {
      // keep balance = 0 on error
    }

    const account = await prisma.account.upsert({
      where: { teller_account_id: ta.id },
      create: {
        user_id: userId,
        teller_account_id: ta.id,
        teller_access_token: accessToken,
        name: ta.name,
        institution_name: institutionName ?? ta.institution.name,
        type: mapAccountType(ta.subtype),
        current_balance: balance,
        last_synced_at: new Date(),
      },
      update: {
        teller_access_token: accessToken,
        name: ta.name,
        institution_name: institutionName ?? ta.institution.name,
        current_balance: balance,
        last_synced_at: new Date(),
        deleted_at: null,
        is_active: true,
      },
    })

    saved.push(account)
  }

  return NextResponse.json({ accounts: saved })
}
