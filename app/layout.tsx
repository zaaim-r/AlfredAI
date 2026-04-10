import { ClerkProvider } from '@clerk/nextjs'
import { Cinzel, Outfit, Rajdhani } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'
import { SyncTrigger } from '@/components/SyncTrigger'

const cinzel = Cinzel({
  subsets: ['latin'],
  variable: '--font-cinzel',
  weight: ['400', '600', '700'],
  display: 'swap',
})

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
})

const rajdhani = Rajdhani({
  subsets: ['latin'],
  variable: '--font-rajdhani',
  weight: ['500', '600', '700'],
  display: 'swap',
})

export const metadata = {
  title: 'Alfred — Your finances, in service.',
  description: 'Personal finance management, with the precision of a butler.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary:        '#c9a84c',
          colorBackground:     '#0f0e0d',
          colorInputBackground:'#181710',
          colorInputText:      '#f0ebe0',
          colorText:           '#f0ebe0',
          colorTextSecondary:  '#c8bfa8',
          colorNeutral:        '#9c9178',
          colorDanger:         '#e07070',
          borderRadius:        '0px',
          fontFamily:          '"Outfit", system-ui, sans-serif',
        },
        elements: {
          card:              { boxShadow: '0 0 80px rgba(0,0,0,0.9)', border: '1px solid rgba(201,168,76,0.15)' },
          headerTitle:       { fontFamily: '"Cinzel", Georgia, serif', letterSpacing: '0.15em' },
          formButtonPrimary: { fontFamily: '"Cinzel", Georgia, serif', letterSpacing: '0.12em', fontSize: '0.7rem' },
          formFieldInput: {
            backgroundColor: '#181710',
            color: '#f0ebe0',
            borderColor: 'rgba(201, 168, 76, 0.2)',
          },
        },
      }}
    >
      <html
        lang="en"
        className={`${cinzel.variable} ${outfit.variable} ${rajdhani.variable}`}
      >
        <body>
          <Providers>
            <SyncTrigger />
            {children}
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  )
}
