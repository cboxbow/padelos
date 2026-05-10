import type { Metadata } from 'next'
import { Bebas_Neue, Rajdhani, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const bebasNeue = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

const rajdhani = Rajdhani({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'PadelOS',
    template: '%s | PadelOS',
  },
  description: "Le système d'exploitation digital pour les compétitions padel.",
  keywords: ['padel', 'tournoi', 'classement', 'MPL', 'Mauritius Padel League'],
  robots: { index: true, follow: true },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="fr"
      className={`dark ${bebasNeue.variable} ${rajdhani.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen bg-court text-foreground font-body antialiased">
        {children}
      </body>
    </html>
  )
}
