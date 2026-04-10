# Alfred AI

> *"At your service, sir."*

Alfred is a personal finance assistant with a Batman/Alfred theme. It connects to your bank accounts, tracks spending by category, and gives you a clean view of where your money goes — with an AI assistant you can ask anything.

---

## Features

- **Account Aggregation** — Connect bank accounts and credit cards via Teller.io (mTLS, auto-sync)
- **Transactions** — Browse, filter, and recategorize all transactions across accounts
- **Categories** — Set monthly budgets with % or $ warning thresholds; track spend by month
- **Net Worth Dashboard** *(coming soon)* — Assets vs liabilities, spending trends
- **Alfred AI Chat** *(coming soon)* — Ask your finances anything

---

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router) |
| Auth | Clerk v7 |
| Database | PostgreSQL + Prisma v7 |
| Banking Data | Teller.io (mTLS) |
| UI | Tailwind CSS v4, Radix UI, Lucide |
| State | TanStack React Query v5 |
| Charts | Recharts |
| Deployment | Vercel |

---

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- [Teller.io](https://teller.io) account + mTLS certificate
- [Clerk](https://clerk.com) account

### Environment Variables

Create a `.env.local` file:

```env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=

# Database
DATABASE_URL=

# Teller
NEXT_PUBLIC_TELLER_APP_ID=
TELLER_CERT_PATH=./certs/certificate.pem
TELLER_KEY_PATH=./certs/private_key.pem
```

### Setup

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
app/
  api/           # API routes (categories, transactions, teller, webhooks)
  accounts/      # Connected accounts page
  categories/    # Budget categories page
  transactions/  # Transactions page
components/
  Nav.tsx        # Global nav bar
  accounts/
  categories/
  transactions/
lib/
  prisma.ts      # Prisma client
  teller.ts      # Teller API wrapper (mTLS + retry logic)
prisma/
  schema.prisma
  migrations/
```
