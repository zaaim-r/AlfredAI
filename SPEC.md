# AlfredAI — Complete Project Specification

> This document is the single source of truth for the AlfredAI project.
> It covers product spec, requirements, data models, API design, component architecture,
> technical decisions, and build progress. Claude Code should read this entire file
> before making any changes to the codebase.

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Tech Stack](#2-tech-stack)
3. [Financial Model](#3-financial-model)
4. [Requirements](#4-requirements)
5. [Data Models](#5-data-models)
6. [API Routes](#6-api-routes)
7. [Component Architecture](#7-component-architecture)
8. [Key Technical Decisions](#8-key-technical-decisions)
9. [Folder Structure](#9-folder-structure)
10. [Build Progress](#10-build-progress)
11. [Shelved for Future](#11-shelved-for-future)

---

## 1. Product Overview

**AlfredAI** is a personal finance manager for a single power user (new grad, living alone)
who wants unified visibility and control over their finances across multiple accounts.

### Who It's For
- Primary: Single user managing personal finances across credit, debit, brokerage, and P2P accounts
- Future: Multi-user support and a shared finance mode for couples/households
- Persona: New graduate, living alone, fixed income, building financial habits from scratch

### The Problem It Solves
Money is scattered across credit cards, debit accounts, investment platforms, and peer-to-peer
apps. There is no single place that shows where you stand against your own goals, warns you
before you overspend, and actively helps you course-correct. AlfredAI is that place.

### What "Done" Looks Like for v1
- Log in and see all accounts and balances in one place
- Set category limits and track spending against them in real time
- Alfred warns before overspending and suggests where to cut back
- At month-end, decide what to do with leftover budget per category
- Upload a receipt, correct the scan, split it, and log your share automatically
- Insights dashboard gives a clear visual picture of spending

---

## 2. Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Next.js (App Router) | React frontend + API routes + SSR + Vercel cron, all in one |
| UI | React + Tailwind CSS + shadcn/ui | Work stack alignment; shadcn gives owned, accessible primitives |
| Language | TypeScript | Type safety critical for financial data; Prisma generates types automatically |
| Charts | Recharts | React-native, composable, handles all required chart types |
| Server state | TanStack React Query | Caching, background refetch, optimistic updates |
| Database | PostgreSQL (Vercel Postgres) | Relational model fits data; JSON support for flexible fields |
| ORM | Prisma | Type-safe, great DX, auto-generated types from schema |
| Auth | Clerk | Handles sessions/JWTs out of the box; maps to our user model via Clerk user ID |
| Bank data | Teller.io (primary) | Free for personal use, no transaction limits, hosted OAuth connect flow |
| AI + OCR | Gemini API | Free tier; handles both Alfred chat and receipt OCR via multimodal in one API |
| Deployment | Vercel | Native Next.js support, zero-config, free tier sufficient, built-in cron |

---

## 3. Financial Model

This is the core accounting logic. Every feature that touches money must respect these rules.

### Debit Transactions
- Deduct directly from the connected debit account's `current_balance`
- Categorized and tracked against the relevant category limit

### Credit Card Transactions
- Tracked against the specific **category limit** (e.g. coffee purchase → Food/Coffee limit)
- Also accumulate into the user's total **Credit Balance** (sum of all outstanding credit card balances)
- Credit balance is a liability tracker, not a spending limit

### Net Worth
```
Net Worth = SUM(checking + savings + brokerage balances) − SUM(outstanding credit balances)
```
- Updates in real time as transactions sync
- Displayed as a top-level number on the dashboard
- Daily snapshots stored for trend visualization

### Credit Card Payment (Bill Pay)
When a transaction is categorized as `"Credit Card Payment"` (system category):
1. Find the associated credit account from `account_id`
2. Decrease the credit account's `current_balance` by `amount`
3. Decrease the source debit account's `current_balance` by `amount`
4. Recalculate and snapshot net worth
5. **Never** count this transaction against any category spending limit

### Transfer Detection
- If two transactions within 24 hours across two owned accounts have equal and opposite amounts,
  flag both as `is_transfer = true`
- Notify the user to confirm
- Transfers are excluded from category limits and net worth calculations

### Income Transactions
- Transactions matching an `IncomeSource` by amount ±2% are auto-mapped
- Categorized into the reserved `"Income"` system category
- Excluded from all spending limit calculations
- Updates `next_pay_date` on the matched IncomeSource

### Pending vs. Posted
- Only **posted** transactions count against category limits
- Pending transactions are displayed but visually distinguished
- Limits recalculate automatically when a pending transaction posts

---

## 4. Requirements

### FR-1 — Authentication & User Management
- FR-1.1: Users sign up with email and password
- FR-1.2: Users can log in and log out securely
- FR-1.3: Sessions persist across page refreshes until logout or expiry
- FR-1.4: Each user has an isolated data scope — no cross-user data access
- FR-1.5: Data model supports future multi-user shared finance view without schema rewrite
- FR-1.6: Auth handled entirely by Clerk — no custom auth logic

### FR-2 — Account Aggregation
- FR-2.1: Users connect bank accounts via Teller.io hosted OAuth connect flow
- FR-2.2: Supported account types: checking, savings, credit card, brokerage
- FR-2.3: Venmo support is API-dependent — works automatically if Teller supports it, no special handling
- FR-2.4: Teller access token stored per account, scoped to user
- FR-2.5: Account balances fetched and displayed on dashboard
- FR-2.6: Transactions synced in the background on login (non-blocking). UI renders immediately
  from cached DB data and updates in place. Manual refresh triggers foreground sync with loader.
- FR-2.7: Users can connect multiple accounts across multiple institutions
- FR-2.8: Users can disconnect an account. Disconnection does not delete historical transaction data.
  Uses soft delete (`deleted_at` timestamp).

### FR-3 — Transaction Management
- FR-3.1: Every transaction has: `id`, `account_id`, `date`, `amount`, `merchant_name`,
  `category_id`, `status` (pending/posted), `is_excluded`, `is_transfer`, `is_manual`, `created_at`
- FR-3.2: Transactions auto-categorized on import using merchant name and Teller metadata
- FR-3.3: Users can manually override any transaction's category
- FR-3.4: A transaction's category determines which spending limit it counts toward
- FR-3.5: Debit transactions reduce the debit account balance directly
- FR-3.6: Credit transactions accumulate against category limit AND total credit balance
- FR-3.7: Credit card payments auto-categorized into reserved `"Credit Card Payment"` system category.
  This category cannot be modified or deleted by the user.
- FR-3.8: Credit card payment transactions trigger the credit + debit balance adjustment logic
- FR-3.9: Users can manually add a transaction
- FR-3.10: Users can flag a transaction as excluded (`is_excluded = true`) — excluded transactions
  do not count toward category limits or net worth
- FR-3.11: All transaction syncs use `upsert` keyed on `teller_transaction_id` — safe to retry

### FR-4 — Category Spending Limits
- FR-4.1: Users create spending categories with a name and monthly soft limit (dollar amount)
- FR-4.2: Default categories seeded on signup: Food, Coffee, Transport, Entertainment, Shopping,
  Subscriptions, Utilities, Other
- FR-4.3: System categories seeded (shared, user_id = null): Credit Card Payment, Income,
  Transfer, Uncategorized
- FR-4.4: Users can add, rename, or delete personal categories
- FR-4.5: Deleting a category does not delete its transactions — they fall back to "Uncategorized"
  Uses soft delete (`deleted_at` timestamp).
- FR-4.6: Each category displays: limit, amount spent this month, amount remaining, % used
- FR-4.7: Warning notification triggered when category reaches configurable threshold (default 80%)
- FR-4.8: Alert notification triggered when category meets or exceeds 100% of limit
- FR-4.9: Notifications are persistent in-app banners/badges until dismissed
- FR-4.10: Only posted transactions count against limits

### FR-5 — End-of-Month Rollover Flow
- FR-5.1: At end of each calendar month, rollover prompt triggered for every category
  with unspent remainder
- FR-5.2: User chooses per category:
  - **Roll over** — add remainder to next month's limit for that category
  - **Save** — move remainder to savings bucket
  - **Redistribute** — apply remainder to a different category
  - **Reset** — discard remainder; next month starts at base limit
- FR-5.3: User must make a choice — no silent defaults
- FR-5.4: Rollover logic runs per user, per category, at month boundary via Vercel cron
- FR-5.5: Rollover history stored as JSON on the Category record (see data model)

### FR-6 — Net Worth Tracker
- FR-6.1: Net worth = SUM(debit/savings/brokerage) − SUM(outstanding credit balances)
- FR-6.2: Net worth displayed as top-level figure on dashboard
- FR-6.3: Net worth updates in real time as transactions sync
- FR-6.4: Daily NetWorthSnapshot records stored for trend chart

### FR-7 — Insights Dashboard
- FR-7.1: Dedicated `/insights` screen in main navigation
- FR-7.2: Required visualizations:
  - Spending by category (donut or bar chart, current month)
  - Spending over time (line chart, per category, last 6 months)
  - Limit utilization (progress bars per category)
  - Net worth over time (line chart)
- FR-7.3: Time range filter: this month / last month / last 3 months / last 6 months
- FR-7.4: Filter by account or category
- FR-7.5: Insights update automatically when new transactions sync

### FR-8 — AI Layer (Alfred / Gemini)
- FR-8.1: Conversational chat interface where users ask Alfred questions
- FR-8.2: Alfred has read access to: transactions, category limits, balances, spending history,
  income sources, subscriptions, and net worth
- FR-8.3: Proactive insights triggered by:
  - Category warning or alert threshold crossed
  - End of month (monthly spending summary)
  - Weekly digest (user-toggleable)
- FR-8.4: Proactive insights appear as notification cards on dashboard, not just in chat
- FR-8.5: Alfred responses streamed where possible
- FR-8.6: Gemini API called server-side only — API key never exposed to client
- FR-8.7: Alfred has persistent memory via `alfred_memory` JSON field on User (rolling summary)
- FR-8.8: After each conversation, Alfred updates the memory summary in a follow-up call
- FR-8.9: Alfred reads from precomputed `alfred_context_snapshot` for fast responses.
  Snapshot is invalidated and regenerated on: transaction sync, manual transaction add/edit,
  category limit change, income source update.

### FR-9 — Bill Splitting
- FR-9.1: Users initiate bill split from dedicated screen or from within a transaction
- FR-9.2: Users upload receipt image (JPEG/PNG/HEIC)
- FR-9.3: Receipt processed via Gemini multimodal — line items, subtotal, tax, tip extracted
- FR-9.4: User reviews and corrects any field from the scan before proceeding
- FR-9.5: Users assign each line item to one or more named participants
- FR-9.6: Participants do not need to be AlfredAI users — names are free-text in v1
- FR-9.7: Tax and tip distributed proportionally using the **largest remainder method**
  (ensures participant totals always sum exactly to receipt total — no rounding drift)
- FR-9.8: App calculates and displays each participant's total owed
- FR-9.9: User's own share logged as a transaction assigned to a category of their choice
- FR-9.10: Completed splits saved and viewable in split history
- FR-9.11: Each participant has an `is_settled` toggle in split history

### FR-10 — Notifications
- FR-10.1: All notifications in-app only for v1
- FR-10.2: Notification types: category_warning, category_alert, ai_insight, rollover_prompt,
  monthly_summary, new_subscription
- FR-10.3: Notifications stored in DB, persist until dismissed
- FR-10.4: Unread notification count shown in nav
- FR-10.5: Notification model structured to support push notifications later without restructuring

### FR-11 — Income & Paycheck Tracking
- FR-11.1: Users define income sources with name, amount, frequency, and next pay date
- FR-11.2: App calculates and displays spending runway — projected remaining balance by next payday
  based on current spending rate
- FR-11.3: Alfred has access to income and pay cycle data when generating insights
- FR-11.4: Multiple income sources supported
- FR-11.5: Income transactions imported from Teller auto-mapped to defined income source (±2% match)

### FR-12 — Subscription Tracker
- FR-12.1: Alfred auto-detects recurring transactions by merchant + amount (±5%) + frequency pattern
- FR-12.2: Dedicated `/subscriptions` screen lists all detected recurring charges:
  name, amount, frequency, last charged, total monthly cost
- FR-12.3: Users can confirm, dismiss, or manually add subscriptions
- FR-12.4: Total monthly subscription cost surfaced on dashboard as fixed cost line item
- FR-12.5: Newly detected subscriptions trigger a `new_subscription` notification

### FR-13 — "Can I Afford This?" Quick Check
- FR-13.1: Users ask Alfred "can I afford [X]?" from chat or a dedicated quick-prompt button
- FR-13.2: Alfred evaluates against: current category balances, monthly runway, spending rate,
  paycheck timing
- FR-13.3: Alfred returns plain-language answer with full context, not just yes/no
- FR-13.4: No additional data model required — purely an Alfred prompt with financial context

### FR-UI-1 — Financial Fun Facts on Loading Screens
- Any screen with a loading state displays a rotating financial fun fact
- Facts stored in `/lib/fun-facts.ts` as a static array of ~50 facts
- Selection seeded by current timestamp — deterministic per session, feels random
- No external API or DB needed

---

## 5. Data Models

### User
```prisma
model User {
  id                       String    @id  // Clerk user ID
  email                    String    @unique
  timezone                 String    @default("America/New_York")
  alfred_memory            Json?     // { summary, key_facts[], last_updated }
  alfred_context_snapshot  Json?     // precomputed context for fast Alfred responses
  snapshot_updated_at      DateTime?
  created_at               DateTime  @default(now())
}
```

`alfred_memory` shape:
```json
{
  "summary": "User is a new grad living alone, trying to cut food spending...",
  "key_facts": ["Pays rent on the 1st — $1,450/month", "Trying to stay under $200/month on food"],
  "last_updated": "2026-03-15"
}
```

`alfred_context_snapshot` shape:
```json
{
  "net_worth": 4200,
  "monthly_spend_by_category": { "Food": 180, "Coffee": 34 },
  "runway_days": 11,
  "confirmed_subscriptions_total": 87,
  "next_payday": "2026-04-01"
}
```

---

### Account
```prisma
model Account {
  id                   String      @id @default(cuid())
  user_id              String
  teller_account_id    String      @unique
  teller_access_token  String      // encrypted at rest
  name                 String
  institution_name     String
  type                 AccountType // checking | savings | credit | brokerage
  current_balance      Decimal     @db.Decimal(12, 2)
  last_synced_at       DateTime?
  is_active            Boolean     @default(true)
  deleted_at           DateTime?   // soft delete
  created_at           DateTime    @default(now())
}
```

---

### Transaction
```prisma
model Transaction {
  id                     String            @id @default(cuid())
  user_id                String
  account_id             String
  teller_transaction_id  String?           @unique
  date                   DateTime
  amount                 Decimal           @db.Decimal(12, 2)
  merchant_name          String
  category_id            String
  status                 TransactionStatus @default(posted) // pending | posted
  is_excluded            Boolean           @default(false)
  is_transfer            Boolean           @default(false)
  is_manual              Boolean           @default(false)
  created_at             DateTime          @default(now())

  @@index([user_id, date])
  @@index([user_id, category_id])
  @@index([account_id])
}
```

---

### Category
```prisma
model Category {
  id                String    @id @default(cuid())
  user_id           String?   // null = system category (shared across all users)
  name              String
  monthly_limit     Decimal?  @db.Decimal(12, 2)
  warning_threshold Int       @default(80)
  is_system         Boolean   @default(false)
  color             String    @default("#6366f1")
  icon              String    @default("circle")
  rollover_history  Json?     // keyed by "YYYY-MM"
  deleted_at        DateTime? // soft delete
  created_at        DateTime  @default(now())
}
```

`rollover_history` shape:
```json
{
  "2026-02": {
    "base_limit": 500,
    "unspent": 80,
    "action": "rollover",
    "redistributed_to": null
  }
}
```
Effective limit for current month = `monthly_limit` + rollover from last month's entry (if action was "rollover").

---

### NetWorthSnapshot
```prisma
model NetWorthSnapshot {
  id                String   @id @default(cuid())
  user_id           String
  date              DateTime
  total_assets      Decimal  @db.Decimal(12, 2)
  total_liabilities Decimal  @db.Decimal(12, 2)
  net_worth         Decimal  @db.Decimal(12, 2)
  created_at        DateTime @default(now())

  @@index([user_id, date])
}
```

---

### Notification
```prisma
model Notification {
  id         String           @id @default(cuid())
  user_id    String
  type       NotificationType
  title      String
  body       String
  is_read    Boolean          @default(false)
  metadata   Json?            // e.g. { category_id, amount, threshold }
  created_at DateTime         @default(now())

  @@index([user_id, is_read])
}
```

---

### IncomeSource
```prisma
model IncomeSource {
  id            String       @id @default(cuid())
  user_id       String
  name          String
  amount        Decimal      @db.Decimal(12, 2)
  frequency     PayFrequency // weekly | biweekly | semi_monthly | monthly
  schedule      Json?        // { pay_days: [1, 15] } for semi_monthly
  next_pay_date DateTime
  created_at    DateTime     @default(now())
}
```

---

### Subscription
```prisma
model Subscription {
  id              String                @id @default(cuid())
  user_id         String
  merchant_name   String
  amount          Decimal               @db.Decimal(12, 2)
  frequency       SubscriptionFrequency // weekly | monthly | annual
  last_charged_at DateTime
  status          SubscriptionStatus    @default(pending) // pending | confirmed | dismissed
  created_at      DateTime              @default(now())
}
```

---

### BillSplit
```prisma
model BillSplit {
  id                String   @id @default(cuid())
  user_id           String
  receipt_image_url String
  subtotal          Decimal  @db.Decimal(12, 2)
  tax               Decimal  @db.Decimal(12, 2)
  tip               Decimal  @db.Decimal(12, 2)
  total             Decimal  @db.Decimal(12, 2)
  split_data        Json     // all participants, items, assignments, settlement status
  transaction_id    String?
  created_at        DateTime @default(now())
}
```

`split_data` shape:
```json
{
  "items": [
    { "id": "i1", "name": "Chicken Tikka Masala", "amount": 18.00 },
    { "id": "i2", "name": "Garlic Naan", "amount": 4.50 }
  ],
  "participants": [
    {
      "id": "p1",
      "name": "Zaaim",
      "item_ids": ["i1", "i2"],
      "subtotal": 22.50,
      "tax_share": 1.93,
      "tip_share": 3.38,
      "total_owed": 27.81,
      "is_settled": true
    }
  ]
}
```

---

### SavingsBucket
```prisma
model SavingsBucket {
  id         String   @id @default(cuid())
  user_id    String   @unique
  balance    Decimal  @default(0) @db.Decimal(12, 2)
  updated_at DateTime @updatedAt
}
```

---

## 6. API Routes

| Method | Route | Description |
|---|---|---|
| POST | `/api/webhooks/clerk` | Clerk user.created webhook — seeds user, categories, savings bucket |
| POST | `/api/teller/connect` | Exchange Teller token, store account |
| POST | `/api/teller/sync` | Background sync transactions for user |
| GET | `/api/accounts` | List user accounts + balances |
| DELETE | `/api/accounts/[id]` | Soft-delete (disconnect) account |
| GET | `/api/transactions` | List transactions (paginated, filterable by account/category/date) |
| POST | `/api/transactions` | Manual transaction entry |
| PATCH | `/api/transactions/[id]` | Override category, toggle is_excluded, toggle is_transfer |
| GET | `/api/categories` | List categories + current month spend vs limit |
| POST | `/api/categories` | Create category |
| PATCH | `/api/categories/[id]` | Update name, limit, threshold, color, icon |
| DELETE | `/api/categories/[id]` | Soft-delete; transactions fall back to Uncategorized |
| GET | `/api/rollover` | Get pending rollover decisions (categories with unspent remainder) |
| POST | `/api/rollover` | Submit rollover choices; writes to category rollover_history |
| GET | `/api/net-worth` | Current net worth + historical snapshots |
| GET | `/api/insights` | Aggregated chart data (spend by category, over time, utilization) |
| GET | `/api/income` | List income sources |
| POST | `/api/income` | Add income source |
| PATCH | `/api/income/[id]` | Update income source |
| DELETE | `/api/income/[id]` | Remove income source |
| GET | `/api/subscriptions` | List detected subscriptions |
| PATCH | `/api/subscriptions/[id]` | Confirm or dismiss subscription |
| POST | `/api/subscriptions` | Manually add subscription |
| POST | `/api/alfred/chat` | Send message, get streamed Gemini response |
| POST | `/api/alfred/proactive` | Trigger proactive insight generation |
| POST | `/api/alfred/snapshot` | Regenerate alfred_context_snapshot for user |
| POST | `/api/bill-split/ocr` | Upload receipt image → Gemini parses line items |
| POST | `/api/bill-split` | Save completed split + log user's share as transaction |
| PATCH | `/api/bill-split/[id]/settle` | Toggle participant is_settled in split_data JSON |
| GET | `/api/notifications` | List notifications (unread first) |
| PATCH | `/api/notifications/[id]` | Mark as read |
| PATCH | `/api/notifications/read-all` | Mark all as read |
| POST | `/api/cron/month-end` | Vercel cron — generates rollover prompts at month boundary |
| POST | `/api/cron/weekly-digest` | Vercel cron — triggers weekly Alfred summary |
| POST | `/api/cron/sync-all` | Vercel cron — background sync for all active users |

---

## 7. Component Architecture

### Pages & Routes
```
/                    → Dashboard (home)
/transactions        → Full transaction list + filters
/insights            → Insights dashboard (charts)
/categories          → Category management + limits
/accounts            → Account connections (Teller)
/subscriptions       → Subscription tracker
/income              → Income sources + runway
/bill-split          → Bill split tool + history
/alfred              → Alfred chat interface
/notifications       → Notification center
/settings            → User preferences
/sign-in             → Clerk sign in
/sign-up             → Clerk sign up
```

### Dashboard (`/`)
```
<DashboardPage>
  <NetWorthCard />              ← assets, liabilities, net worth figure
  <SpendingRunwayCard />        ← days to payday + projected remaining balance
  <CategoryLimitGrid>
    <CategoryLimitCard />       ← per category: spent / limit / % bar + warning state
  </CategoryLimitGrid>
  <AlfredInsightCards />        ← proactive AI nudge cards
  <SubscriptionSummaryWidget /> ← total monthly confirmed subscription cost
  <RecentTransactions />        ← last 10 transactions, non-blocking load
</DashboardPage>
```

### Insights (`/insights`)
```
<InsightsDashboard>
  <TimeRangeFilter />
  <AccountCategoryFilter />
  <SpendingByCategoryChart />   ← Recharts donut or bar
  <SpendingOverTimeChart />     ← Recharts line, per category, last 6 months
  <LimitUtilizationBars />      ← shadcn Progress per category
  <NetWorthTrendChart />        ← Recharts line chart
</InsightsDashboard>
```

### Bill Split (`/bill-split`)
```
<BillSplitPage>
  <ReceiptUploader />           ← drag/drop or camera upload
  <LineItemEditor />            ← review + correct OCR output
  <ParticipantAssigner />       ← assign items to named participants
  <SplitSummary />              ← each person's total owed (largest remainder method)
  <LogTransactionPanel />       ← log user's share to a category
  <SplitHistory />              ← past splits with settle toggles per participant
</BillSplitPage>
```

### Alfred (`/alfred`)
```
<AlfredChat>
  <MessageThread />             ← streamed responses
  <AffordabilityQuickCheck />   ← pinned "Can I Afford This?" prompt button
  <ChatInput />
</AlfredChat>
```

---

## 8. Key Technical Decisions

### Teller as Sync Source, Not Live Query Target
Teller is called to sync data into PostgreSQL. The UI always reads from the database.
This means the app is never blocked on Teller's response time. Last-known data
is always available instantly.

### Background Sync on Login
On login, middleware fires a non-blocking `POST /api/teller/sync`.
UI loads immediately from DB. React Query cache invalidates and updates in place
when sync completes. No loading gate for the initial render.

### Optimistic Updates
All user-initiated mutations (category override, notification dismiss, exclude toggle,
settle toggle) use React Query's `onMutate` for optimistic updates. UI updates instantly,
rolls back only on server error.

### Alfred Context Assembly
Every `/api/alfred/chat` call assembles a context payload server-side:
```typescript
{
  current_month_spending: Record<categoryName, amount>,
  category_limits: Record<categoryName, { limit, spent, remaining }>,
  net_worth: { current: number, trend: number[] },
  income: { sources: IncomeSource[], next_payday: string, runway_days: number },
  subscriptions: { confirmed: Subscription[], total_monthly: number },
  recent_transactions: Transaction[],  // last 20 posted
  alfred_memory: user.alfred_memory    // persistent rolling summary
}
```
After each conversation, Alfred is asked to update the memory summary.

### Alfred Context Snapshot Invalidation
`alfred_context_snapshot` is regenerated on any of:
- Transaction sync completion
- Manual transaction add or edit
- Category limit change
- Income source update

### Subscription Detection Algorithm
On every sync, group transactions by `merchant_name` + `amount` (±5% tolerance).
If 2+ occurrences exist with ~7, 14, or 30-day gaps → create a `pending` Subscription
record and fire `new_subscription` notification. Pure DB query, no external service.

### Credit Card Payment Accounting
When transaction category = `"Credit Card Payment"`:
1. Decrease credit account `current_balance` by `amount`
2. Decrease source debit account `current_balance` by `amount`
3. Snapshot net worth

### Month-End Cron
Vercel cron fires at `23:59` in user's timezone on last day of month.
Calls `/api/cron/month-end` which:
1. Calculates unspent remainder per category per user
2. Creates `rollover_prompt` notifications for categories with remainder > $0
3. Rollover UI resolves these — submitting choices writes to `category.rollover_history`

### Bill Split Rounding
Largest remainder method — distribute rounding cents to participants in descending
order of fractional remainder until totals sum exactly to receipt total.
Users always see amounts that add up perfectly.

### Transaction Deduplication
All syncs use `upsert` keyed on `teller_transaction_id`. Safe to retry without
producing duplicate records.

### Soft Deletes
`Category` and `Account` use `deleted_at DateTime?`. All queries filter
`WHERE deleted_at IS NULL`. Records are never hard deleted.

### Timezone Handling
`User.timezone` (default: `"America/New_York"`). All cron logic, rollover boundaries,
and runway calculations run against the user's local time, not UTC.

### Indexes
```prisma
// Transaction
@@index([user_id, date])
@@index([user_id, category_id])
@@index([account_id])

// NetWorthSnapshot
@@index([user_id, date])

// Notification
@@index([user_id, is_read])
```

### Pending Transactions
`status: pending` transactions are displayed with visual distinction.
Only `status: posted` transactions count against category limits.
Limits recalculate when pending → posted.

### Inter-Account Transfer Detection
Two transactions within 24 hours across two owned accounts with equal and opposite
amounts → flag both `is_transfer = true` → notify user to confirm.
Transfers excluded from limits and net worth.

### Fun Facts
50 facts in `/lib/fun-facts.ts`. Selected by `Math.floor(Date.now() / 10000) % 50`.
Changes every 10 seconds. No DB, no API.

---

## 9. Folder Structure

```
alfredai/
├── app/
│   ├── (dashboard)/
│   │   └── page.tsx              ← Dashboard home
│   ├── transactions/
│   │   └── page.tsx
│   ├── insights/
│   │   └── page.tsx
│   ├── categories/
│   │   └── page.tsx
│   ├── accounts/
│   │   └── page.tsx
│   ├── subscriptions/
│   │   └── page.tsx
│   ├── income/
│   │   └── page.tsx
│   ├── bill-split/
│   │   └── page.tsx
│   ├── alfred/
│   │   └── page.tsx
│   ├── notifications/
│   │   └── page.tsx
│   ├── settings/
│   │   └── page.tsx
│   ├── sign-in/[[...sign-in]]/
│   │   └── page.tsx
│   ├── sign-up/[[...sign-up]]/
│   │   └── page.tsx
│   ├── api/
│   │   ├── webhooks/clerk/route.ts
│   │   ├── teller/
│   │   │   ├── connect/route.ts
│   │   │   └── sync/route.ts
│   │   ├── accounts/
│   │   │   ├── route.ts
│   │   │   └── [id]/route.ts
│   │   ├── transactions/
│   │   │   ├── route.ts
│   │   │   └── [id]/route.ts
│   │   ├── categories/
│   │   │   ├── route.ts
│   │   │   └── [id]/route.ts
│   │   ├── rollover/
│   │   │   └── route.ts
│   │   ├── net-worth/
│   │   │   └── route.ts
│   │   ├── insights/
│   │   │   └── route.ts
│   │   ├── income/
│   │   │   ├── route.ts
│   │   │   └── [id]/route.ts
│   │   ├── subscriptions/
│   │   │   ├── route.ts
│   │   │   └── [id]/route.ts
│   │   ├── alfred/
│   │   │   ├── chat/route.ts
│   │   │   ├── proactive/route.ts
│   │   │   └── snapshot/route.ts
│   │   ├── bill-split/
│   │   │   ├── route.ts
│   │   │   ├── ocr/route.ts
│   │   │   └── [id]/
│   │   │       └── settle/route.ts
│   │   ├── notifications/
│   │   │   ├── route.ts
│   │   │   ├── [id]/route.ts
│   │   │   └── read-all/route.ts
│   │   └── cron/
│   │       ├── month-end/route.ts
│   │       ├── weekly-digest/route.ts
│   │       └── sync-all/route.ts
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── dashboard/
│   │   ├── NetWorthCard.tsx
│   │   ├── SpendingRunwayCard.tsx
│   │   ├── CategoryLimitCard.tsx
│   │   ├── CategoryLimitGrid.tsx
│   │   ├── AlfredInsightCards.tsx
│   │   ├── SubscriptionSummaryWidget.tsx
│   │   └── RecentTransactions.tsx
│   ├── insights/
│   │   ├── SpendingByCategoryChart.tsx
│   │   ├── SpendingOverTimeChart.tsx
│   │   ├── LimitUtilizationBars.tsx
│   │   └── NetWorthTrendChart.tsx
│   ├── transactions/
│   │   ├── TransactionList.tsx
│   │   ├── TransactionRow.tsx
│   │   └── TransactionFilters.tsx
│   ├── bill-split/
│   │   ├── ReceiptUploader.tsx
│   │   ├── LineItemEditor.tsx
│   │   ├── ParticipantAssigner.tsx
│   │   ├── SplitSummary.tsx
│   │   ├── LogTransactionPanel.tsx
│   │   └── SplitHistory.tsx
│   ├── alfred/
│   │   ├── AlfredChat.tsx
│   │   ├── MessageThread.tsx
│   │   ├── AffordabilityQuickCheck.tsx
│   │   └── ChatInput.tsx
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── TopNav.tsx
│   │   └── NotificationBell.tsx
│   └── ui/                       ← shadcn/ui primitives live here
├── lib/
│   ├── prisma.ts                 ← Prisma client singleton
│   ├── teller.ts                 ← Teller API client
│   ├── gemini.ts                 ← Gemini API client
│   ├── alfred-context.ts         ← context assembly for AI calls
│   ├── subscriptions.ts          ← recurring detection logic
│   ├── rollover.ts               ← month-end rollover logic
│   ├── net-worth.ts              ← net worth calculation + snapshot
│   ├── bill-split.ts             ← largest remainder rounding logic
│   ├── fun-facts.ts              ← 50 financial fun facts array
│   └── utils.ts                  ← cn(), formatCurrency(), formatDate(), getCurrentMonth()
├── hooks/
│   ├── useTransactions.ts
│   ├── useCategories.ts
│   ├── useAccounts.ts
│   ├── useNotifications.ts
│   └── useInsights.ts
├── prisma/
│   └── schema.prisma
├── middleware.ts                  ← Clerk auth middleware
├── .env                          ← secrets (never commit)
├── SPEC.md                       ← this file
└── vercel.json                   ← cron job config
```

---

## 10. Build Progress

Track what's been completed. Claude Code should check this before starting any feature.

### ✅ Foundation (Complete)
- [x] Next.js project scaffolded with TypeScript, Tailwind, App Router
- [x] All dependencies installed
- [x] `.env` file created with all required keys
- [x] Prisma schema written and migrated (`npx prisma migrate dev --name init`)
- [x] Prisma client singleton (`lib/prisma.ts`)
- [x] Clerk middleware (`middleware.ts`)
- [x] Auth pages (`/sign-in`, `/sign-up`)
- [x] Root layout with ClerkProvider (`app/layout.tsx`)
- [x] User sync webhook (`/api/webhooks/clerk`) — seeds user, categories, savings bucket on signup
- [x] Utility helpers (`lib/utils.ts`) — cn(), formatCurrency(), formatDate(), getCurrentMonth()
- [x] Financial fun facts (`lib/fun-facts.ts`) — 50 facts + getRandomFunFact()

### 🔲 Account Aggregation (Next)
- [ ] Teller client (`lib/teller.ts`)
- [ ] Connect flow (`/api/teller/connect`)
- [ ] Sync logic (`/api/teller/sync`)
- [ ] Accounts list API (`/api/accounts`)
- [ ] Disconnect account (`/api/accounts/[id]` DELETE)
- [ ] Accounts page (`/accounts`)

### 🔲 Transactions & Categories
### 🔲 Limits & Rollover
### 🔲 Net Worth
### 🔲 Insights Dashboard
### 🔲 Alfred (Chat + Proactive)
### 🔲 Bill Splitting
### 🔲 Subscriptions
### 🔲 Income & Runway
### 🔲 Notifications
### 🔲 Layout & Navigation
### 🔲 Polish & Loading States

---

## 11. Shelved for Future

These were deliberately excluded from v1. Do not implement unless explicitly instructed.

- **Shared Finance Mode** — schema supports it (user_id foreign keys), UI does not ship in v1
- **Push Notifications** — in-app only for v1; push when mobile is added
- **Mobile App** — web-first for v1
- **Fixed vs. Discretionary Expense Separation** — deferred UX improvement
- **Emergency Fund Goal** — savings bucket exists but no goal/progress UI
- **No-Spend Streak Tracker** — gamification, post-v1
- **Plaid Integration** — Teller is primary; Plaid is a potential future addition
- **Expected/Upcoming Transactions** — lower priority, post-v1
- **Savings Goals** — savings bucket is a tracked balance only in v1

---

*Last updated: March 2026*
*Author: Zaaim*