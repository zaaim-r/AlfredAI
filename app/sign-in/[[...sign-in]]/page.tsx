import { SignIn } from '@clerk/nextjs'
import Link from 'next/link'

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-void flex flex-col items-center justify-center relative overflow-hidden px-4">

      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px]"
          style={{ background: 'radial-gradient(ellipse, rgba(201,168,76,0.05) 0%, transparent 70%)' }}
        />
      </div>

      {/* Monogram header */}
      <Link href="/" className="flex flex-col items-center gap-4 mb-10 group">
        <div
          className="w-10 h-10 border border-gold/30 group-hover:border-gold/60 flex items-center justify-center transition-colors duration-300"
          style={{ transform: 'rotate(45deg)' }}
        >
          <span
            className="font-display text-base text-gold/70 group-hover:text-gold transition-colors duration-300"
            style={{ transform: 'rotate(-45deg)' }}
          >
            A
          </span>
        </div>
        <span className="font-display text-sm tracking-[0.3em] text-parchment group-hover:text-ivory transition-colors duration-300">
          ALFRED
        </span>
      </Link>

      <SignIn forceRedirectUrl="/accounts" />

    </div>
  )
}
