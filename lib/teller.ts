import https from 'https'
import fs from 'fs'
import path from 'path'

const BASE_URL = 'https://api.teller.io'

// ── mTLS options (development / production only) ──────────────────────────────
// Lazily read cert + key once and reuse for every request.

let _tlsOptions: { cert: string; key: string } | null = null

function getTLSOptions(): { cert: string; key: string } | null {
  if (_tlsOptions !== null) return _tlsOptions

  const certPath = process.env.TELLER_CERT_PATH
  const keyPath = process.env.TELLER_KEY_PATH

  if (!certPath || !keyPath) return null

  _tlsOptions = {
    cert: fs.readFileSync(path.resolve(certPath), 'utf8'),
    key: fs.readFileSync(path.resolve(keyPath), 'utf8'),
  }
  return _tlsOptions
}

// ── Fetch wrapper ─────────────────────────────────────────────────────────────

interface FetchLike {
  ok: boolean
  status: number
  text(): Promise<string>
  json(): Promise<unknown>
}

function tellerFetchOnce(url: string, accessToken: string): Promise<FetchLike> {
  const headers: Record<string, string> = {
    Authorization: 'Basic ' + Buffer.from(`${accessToken}:`).toString('base64'),
    'Teller-Version': '2020-10-12',
  }

  const tls = getTLSOptions()
  const parsed = new URL(url)

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: 'GET',
        headers,
        timeout: 15000,
        ...(tls ?? {}),
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8')
          resolve({
            ok: (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300,
            status: res.statusCode ?? 0,
            text: () => Promise.resolve(body),
            json: () => Promise.resolve(JSON.parse(body)),
          })
        })
      },
    )
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')) })
    req.on('error', reject)
    req.end()
  })
}

async function tellerFetch(url: string, accessToken: string, retries = 3): Promise<FetchLike> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await tellerFetchOnce(url, accessToken)
    } catch (err) {
      const isLast = attempt === retries
      const msg = err instanceof Error ? err.message : String(err)
      const retryable = msg.includes('socket hang up') || msg.includes('ECONNRESET') || msg.includes('timed out')
      if (isLast || !retryable) throw err
      // Brief backoff before retry
      await new Promise((r) => setTimeout(r, attempt * 500))
    }
  }
  throw new Error('tellerFetch: exhausted retries')
}

// ── Teller API types ──────────────────────────────────────────────────────────

export interface TellerAccount {
  id: string
  enrollment_id: string
  institution: { id: string; name: string }
  name: string
  type: 'depository' | 'credit'
  subtype: string
  status: 'open' | 'closed'
  currency: string
  last_four: string
  links: { self: string; balances: string; transactions: string }
}

export interface TellerBalance {
  account_id: string
  available: string | null
  ledger: string
  links: { self: string; account: string }
}

export interface TellerTransaction {
  id: string
  account_id: string
  date: string // YYYY-MM-DD
  amount: string // negative = expense, positive = income / payment
  description: string
  details: {
    processing_status: string
    category: string | null
    counterparty: { name: string; type: string } | null
  }
  status: 'posted' | 'pending'
  type: string
  running_balance: string | null
}

// ── API helpers ───────────────────────────────────────────────────────────────

export async function getTellerAccounts(accessToken: string): Promise<TellerAccount[]> {
  const res = await tellerFetch(`${BASE_URL}/accounts`, accessToken)
  if (!res.ok) throw new Error(`Teller /accounts ${res.status}: ${await res.text()}`)
  return res.json() as Promise<TellerAccount[]>
}

export async function getTellerBalance(
  accessToken: string,
  accountId: string,
): Promise<TellerBalance> {
  const res = await tellerFetch(`${BASE_URL}/accounts/${accountId}/balances`, accessToken)
  if (!res.ok) throw new Error(`Teller balance ${res.status}: ${await res.text()}`)
  return res.json() as Promise<TellerBalance>
}

export async function getTellerTransactions(
  accessToken: string,
  accountId: string,
): Promise<TellerTransaction[]> {
  const res = await tellerFetch(`${BASE_URL}/accounts/${accountId}/transactions`, accessToken)
  if (!res.ok) throw new Error(`Teller transactions ${res.status}: ${await res.text()}`)
  return res.json() as Promise<TellerTransaction[]>
}

export function mapAccountType(
  subtype: string,
): 'checking' | 'savings' | 'credit' | 'brokerage' {
  switch (subtype) {
    case 'checking':
      return 'checking'
    case 'savings':
    case 'money_market':
    case 'certificate_of_deposit':
    case 'sweep':
    case 'treasury':
      return 'savings'
    case 'credit_card':
      return 'credit'
    case 'brokerage':
    case 'mutual_fund':
    case 'investment':
      return 'brokerage'
    default:
      return 'checking'
  }
}
