export default function CategoriesLoading() {
  return (
    <div className="min-h-screen bg-void flex flex-col items-center justify-center gap-4">
      <div
        className="w-10 h-10 flex items-center justify-center animate-glow-pulse"
        style={{ transform: 'rotate(45deg)', border: '1px solid rgba(201, 168, 76, 0.4)' }}
      >
        <span className="font-display text-base text-gold" style={{ transform: 'rotate(-45deg)' }}>A</span>
      </div>
      <p className="font-display text-[9px] tracking-[0.3em] uppercase text-ash animate-pulse">
        Loading categories, sir.
      </p>
    </div>
  )
}
