import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getTellerBalance, getTellerTransactions } from '@/lib/teller'
import { snapshotNetWorth } from '@/lib/net-worth'

// Map Teller's transaction category strings to our category names
const TELLER_CATEGORY_MAP: Record<string, string> = {
  accommodation: 'Other',
  advertising: 'Other',
  bar: 'Food',
  charity: 'Other',
  clothing: 'Shopping',
  coffee_shop: 'Coffee',
  education: 'Other',
  electronics: 'Shopping',
  entertainment: 'Entertainment',
  fast_food: 'Food',
  food_and_drink: 'Food',
  fuel: 'Transport',
  gas: 'Transport',
  general: 'Other',
  groceries: 'Food',
  grocery: 'Food',
  health: 'Other',
  home: 'Other',
  income: 'Income',
  insurance: 'Subscriptions',
  investment: 'Other',
  loan: 'Other',
  office: 'Other',
  payroll: 'Income',
  phone: 'Utilities',
  recreation: 'Entertainment',
  restaurant: 'Food',
  shopping: 'Shopping',
  software: 'Subscriptions',
  sport: 'Entertainment',
  subscription: 'Subscriptions',
  tax: 'Other',
  transfer: 'Transfer',
  transport: 'Transport',
  transportation: 'Transport',
  travel: 'Transport',
  utilities: 'Utilities',
}

export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const accounts = await prisma.account.findMany({
    where: { user_id: userId, is_active: true, deleted_at: null },
  })

  if (accounts.length === 0) return NextResponse.json({ synced: 0 })

  // Load all categories for this user (user-owned + system)
  let categories = await prisma.category.findMany({
    where: {
      deleted_at: null,
      OR: [{ user_id: userId }, { user_id: null }],
    },
  })

  // Seed default categories if none exist yet (Clerk webhook may not have fired)
  if (categories.length === 0) {
    // is_system = true only for internal categories the sync logic depends on (never shown in UI)
    const internalNames = ['Income', 'Credit Card Payment', 'Transfer']
    const userNames     = ['Uncategorized', 'Food', 'Coffee', 'Transport', 'Shopping', 'Entertainment', 'Utilities', 'Subscriptions', 'Other']
    await prisma.category.createMany({
      data: [
        ...internalNames.map((name) => ({ name, user_id: userId, is_system: true })),
        ...userNames.map((name)     => ({ name, user_id: userId, is_system: false })),
      ],
      skipDuplicates: true,
    })
    categories = await prisma.category.findMany({
      where: { deleted_at: null, user_id: userId },
    })
  }

  const catByName = new Map(categories.map((c) => [c.name.toLowerCase(), c]))

  // Ensure Uncategorized always exists as a fallback
  if (!catByName.get('uncategorized')) {
    const uc = await prisma.category.create({
      data: { name: 'Uncategorized', user_id: userId, is_system: false },
    })
    catByName.set('uncategorized', uc)
  }

  const getCategory = (name: string) =>
    catByName.get(name.toLowerCase()) ?? catByName.get('uncategorized')!

  let totalSynced = 0

  // Fetch all accounts in parallel, then batch-write
  const accountResults = await Promise.allSettled(
    accounts.map(async (account) => {
      const [balance, txns] = await Promise.all([
        getTellerBalance(account.teller_access_token, account.teller_account_id),
        getTellerTransactions(account.teller_access_token, account.teller_account_id),
      ])
      return { account, balance, txns }
    })
  )

  for (const result of accountResults) {
    if (result.status === 'rejected') {
      const msg = String(result.reason)
      console.error('Teller fetch failed:', msg)
      continue
    }

    const { account, balance, txns } = result.value
    try {
      const newBalance = Math.abs(parseFloat(balance.ledger ?? '0'))

      // Build rows for all transactions from this account
      const rows = txns.map((t: Record<string, unknown>) => {
        const amount       = parseFloat(t.amount as string)
        const merchantName = (t.details as Record<string, unknown>)?.counterparty
          ? ((t.details as Record<string, unknown>).counterparty as Record<string, unknown>)?.name as string
          : t.description as string
        const tellerCat    = (((t.details as Record<string, unknown>)?.category as string) ?? '').toLowerCase()

        let categoryName: string
        if (account.type === 'credit' && amount < 0) {
          categoryName = 'Credit Card Payment'
        } else if (account.type !== 'credit' && amount > 0) {
          categoryName = 'Income'
        } else {
          categoryName = TELLER_CATEGORY_MAP[tellerCat] ?? 'Uncategorized'
        }

        const category = getCategory(categoryName)
        return {
          teller_transaction_id: t.id as string,
          user_id:     userId,
          account_id:  account.id,
          date:        new Date(t.date as string),
          amount,
          merchant_name: merchantName,
          category_id:   category.id,
          status:        (t.status as string) === 'posted' ? 'posted' as const : 'pending' as const,
        }
      })

      // Load existing teller IDs for this account to diff new vs existing
      const existingIds = new Set(
        (await prisma.transaction.findMany({
          where:  { account_id: account.id },
          select: { teller_transaction_id: true },
        })).map((r) => r.teller_transaction_id)
      )

      const newRows      = rows.filter((r) => !existingIds.has(r.teller_transaction_id))
      const existingRows = rows.filter((r) =>  existingIds.has(r.teller_transaction_id))

      // Insert new transactions in one batch
      if (newRows.length > 0) {
        await prisma.transaction.createMany({ data: newRows, skipDuplicates: true })
      }

      // Update all existing transactions in one query (status + merchant only, preserve categories)
      if (existingRows.length > 0) {
        // Group by status so we can use two updateMany calls at most
        const postedIds  = existingRows.filter((r) => r.status === 'posted').map((r) => r.teller_transaction_id)
        const pendingIds = existingRows.filter((r) => r.status === 'pending').map((r) => r.teller_transaction_id)
        await Promise.all([
          postedIds.length > 0 && prisma.transaction.updateMany({
            where: { teller_transaction_id: { in: postedIds } },
            data:  { status: 'posted' },
          }),
          pendingIds.length > 0 && prisma.transaction.updateMany({
            where: { teller_transaction_id: { in: pendingIds } },
            data:  { status: 'pending' },
          }),
        ])
      }

      // Update account balance
      await prisma.account.update({
        where: { id: account.id },
        data:  { current_balance: newBalance, last_synced_at: new Date() },
      })

      totalSynced += rows.length
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('401') || msg.includes('403')) {
        await prisma.account.update({
          where: { id: account.id },
          data:  { is_active: false },
        })
      }
      console.error(`Sync failed for account ${account.id}:`, msg)
    }
  }

  await detectTransfers(userId)
  await snapshotNetWorth(userId)

  // Invalidate Alfred context snapshot so it regenerates fresh
  await prisma.user.update({
    where: { id: userId },
    data: { alfred_context_snapshot: Prisma.DbNull, snapshot_updated_at: null },
  })

  return NextResponse.json({ synced: totalSynced })
}

async function detectTransfers(userId: string) {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000)

  const recent = await prisma.transaction.findMany({
    where: { user_id: userId, created_at: { gte: cutoff }, is_transfer: false },
    orderBy: { date: 'asc' },
  })

  // Group by absolute amount
  const byAmount = new Map<string, typeof recent>()
  for (const t of recent) {
    const key = Math.abs(Number(t.amount)).toFixed(2)
    const group = byAmount.get(key) ?? []
    group.push(t)
    byAmount.set(key, group)
  }

  for (const [, group] of byAmount) {
    if (group.length < 2) continue

    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i]
        const b = group[j]
        if (a.account_id === b.account_id) continue

        const amtA = Number(a.amount)
        const amtB = Number(b.amount)
        if (Math.sign(amtA) === Math.sign(amtB)) continue

        const diffMs = Math.abs(a.date.getTime() - b.date.getTime())
        if (diffMs > 24 * 60 * 60 * 1000) continue

        await prisma.transaction.updateMany({
          where: { id: { in: [a.id, b.id] } },
          data: { is_transfer: true },
        })
      }
    }
  }
}
