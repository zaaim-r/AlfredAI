import { ClerkProvider } from '@clerk/nextjs'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'
import { SyncTrigger } from '@/components/SyncTrigger'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'AlfredAI',
  description: 'Your personal finance manager',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={inter.className}>
          <Providers>
            <SyncTrigger />
            {children}
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  )
}
