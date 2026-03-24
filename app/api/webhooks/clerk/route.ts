import { Webhook } from "svix"
import { headers } from "next/headers"
import { WebhookEvent } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

const SYSTEM_CATEGORIES = [
  { name: "Credit Card Payment", is_system: true, color: "#ef4444", icon: "credit-card" },
  { name: "Income",              is_system: true, color: "#22c55e", icon: "trending-up" },
  { name: "Transfer",            is_system: true, color: "#f59e0b", icon: "arrow-left-right" },
  { name: "Uncategorized",       is_system: true, color: "#6b7280", icon: "circle" },
]

const USER_CATEGORIES = [
  { name: "Food",           color: "#f97316", icon: "utensils",        monthly_limit: 400 },
  { name: "Coffee",         color: "#92400e", icon: "coffee",          monthly_limit: 60  },
  { name: "Transport",      color: "#3b82f6", icon: "car",             monthly_limit: 150 },
  { name: "Entertainment",  color: "#8b5cf6", icon: "tv",              monthly_limit: 100 },
  { name: "Shopping",       color: "#ec4899", icon: "shopping-bag",    monthly_limit: 200 },
  { name: "Subscriptions",  color: "#06b6d4", icon: "repeat",          monthly_limit: 100 },
  { name: "Utilities",      color: "#84cc16", icon: "zap",             monthly_limit: 150 },
  { name: "Other",          color: "#6b7280", icon: "more-horizontal", monthly_limit: 100 },
]

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET

  if (!WEBHOOK_SECRET) {
    throw new Error("Missing CLERK_WEBHOOK_SECRET")
  }

  const headerPayload = await headers()
  const svix_id        = headerPayload.get("svix-id")
  const svix_timestamp = headerPayload.get("svix-timestamp")
  const svix_signature = headerPayload.get("svix-signature")

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Missing svix headers", { status: 400 })
  }

  const payload = await req.json()
  const body    = JSON.stringify(payload)
  const wh      = new Webhook(WEBHOOK_SECRET)

  let evt: WebhookEvent

  try {
    evt = wh.verify(body, {
      "svix-id":        svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent
  } catch {
    return new Response("Invalid signature", { status: 400 })
  }

  if (evt.type === "user.created") {
    const { id, email_addresses } = evt.data
    const email = email_addresses[0]?.email_address

    await prisma.$transaction(async (tx) => {
      // Create user
      await tx.user.create({
        data: { id, email },
      })

      // Seed system categories (shared, user_id = null)
      for (const cat of SYSTEM_CATEGORIES) {
        await tx.category.upsert({
          where:  { id: `system_${cat.name.toLowerCase().replace(/ /g, "_")}` },
          update: {},
          create: {
            id:        `system_${cat.name.toLowerCase().replace(/ /g, "_")}`,
            user_id:   null,
            ...cat,
          },
        })
      }

      // Seed personal default categories
      for (const cat of USER_CATEGORIES) {
        await tx.category.create({
          data: { user_id: id, ...cat },
        })
      }

      // Create savings bucket
      await tx.savingsBucket.create({
        data: { user_id: id },
      })
    })
  }

  return new Response("OK", { status: 200 })
}
