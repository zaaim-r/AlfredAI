import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { Decimal } from "decimal.js"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | Decimal): string {
  const num = amount instanceof Decimal ? amount.toNumber() : amount
  return new Intl.NumberFormat("en-US", {
    style:    "currency",
    currency: "USD",
  }).format(num)
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day:   "numeric",
    year:  "numeric",
  }).format(new Date(date))
}

export function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7) // "2026-03"
}