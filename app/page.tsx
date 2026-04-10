import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function Home() {
  const { userId } = await auth()
  if (userId) redirect('/accounts')

  return (
    <div className="min-h-screen bg-void flex flex-col items-center justify-center relative overflow-hidden select-none">

      {/* Atmospheric glow — bat-signal style */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full"
          style={{ background: 'radial-gradient(ellipse, rgba(201,168,76,0.06) 0%, transparent 70%)' }}
        />
        {/* Subtle grain */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")', backgroundSize: '150px 150px' }}
        />
      </div>

      {/* Monogram */}
      <div
        className="relative mb-10 animate-glow-pulse"
        style={{ animationDelay: '0s' }}
      >
        <div
          className="w-20 h-20 border border-gold/40 flex items-center justify-center"
          style={{ transform: 'rotate(45deg)' }}
        >
          <span
            className="font-display text-3xl font-semibold text-gold"
            style={{ transform: 'rotate(-45deg)' }}
          >
            A
          </span>
        </div>
      </div>

      {/* Wordmark */}
      <h1
        className="font-display text-5xl md:text-6xl tracking-[0.4em] text-ivory mb-4 animate-fade-up"
        style={{ animationDelay: '0.1s' }}
      >
        ALFRED
      </h1>

      {/* Tagline */}
      <p
        className="text-parchment text-xs tracking-[0.25em] uppercase mb-14 animate-fade-up"
        style={{ animationDelay: '0.2s' }}
      >
        Your finances, in service.
      </p>

      {/* CTA */}
      <div
        className="flex flex-col items-center gap-4 animate-fade-up"
        style={{ animationDelay: '0.35s' }}
      >
        <Link href="/sign-in" className="btn-gold">
          ENTER THE MANOR
        </Link>
        <Link
          href="/sign-up"
          className="text-ash text-[10px] tracking-[0.2em] uppercase hover:text-parchment transition-colors"
        >
          First visit? Create account
        </Link>
      </div>

      {/* Footer quote */}
      <p
        className="absolute bottom-8 text-ash text-[10px] tracking-widest italic animate-fade-in"
        style={{ animationDelay: '0.7s' }}
      >
        &ldquo;I took the liberty of preparing everything, sir.&rdquo;
      </p>

    </div>
  )
}
