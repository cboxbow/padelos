import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-court-deep">
      <div className="text-center space-y-8 px-4">
        {/* Logo / Brand */}
        <div className="space-y-2">
          <h1 className="font-display text-7xl md:text-9xl text-gold-gradient tracking-widest">
            PadelOS
          </h1>
          <p className="font-body text-lg md:text-xl text-muted-foreground tracking-[0.3em] uppercase">
            Le système d&apos;exploitation du padel
          </p>
        </div>

        {/* Divider */}
        <div className="flex items-center justify-center gap-4 my-8">
          <div className="h-px w-24 bg-gradient-to-r from-transparent to-gold" />
          <div className="w-2 h-2 rounded-full bg-gold" />
          <div className="h-px w-24 bg-gradient-to-l from-transparent to-gold" />
        </div>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-md bg-gold text-black font-body font-semibold text-sm px-8 py-3 hover:bg-gold-light transition-colors"
          >
            Accéder à la plateforme
          </Link>
          <Link
            href="/t/mpl"
            className="inline-flex items-center justify-center rounded-md border border-gold/30 text-gold font-body text-sm px-8 py-3 hover:bg-gold/10 transition-colors"
          >
            Voir les tournois MPL
          </Link>
        </div>

        {/* Footer note */}
        <p className="text-xs text-muted-foreground/50 mt-12">
          Mauritius Padel League · Powered by PadelOS
        </p>
      </div>
    </main>
  )
}
