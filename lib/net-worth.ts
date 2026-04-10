import { prisma } from './prisma'

export async function snapshotNetWorth(userId: string) {
  const accounts = await prisma.account.findMany({
    where: { user_id: userId, is_active: true, deleted_at: null },
    select: { type: true, current_balance: true },
  })

  let assets = 0
  let liabilities = 0

  for (const acc of accounts) {
    const balance = Number(acc.current_balance)
    if (acc.type === 'credit') {
      liabilities += balance
    } else {
      assets += balance
    }
  }

  const netWorth = assets - liabilities

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const existing = await prisma.netWorthSnapshot.findFirst({
    where: { user_id: userId, date: today },
  })

  if (existing) {
    await prisma.netWorthSnapshot.update({
      where: { id: existing.id },
      data: { total_assets: assets, total_liabilities: liabilities, net_worth: netWorth },
    })
  } else {
    await prisma.netWorthSnapshot.create({
      data: {
        user_id: userId,
        date: today,
        total_assets: assets,
        total_liabilities: liabilities,
        net_worth: netWorth,
      },
    })
  }

  return { assets, liabilities, netWorth }
}
