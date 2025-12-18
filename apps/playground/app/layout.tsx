import type { Metadata } from 'next'
import { Outfit, Inter_Tight, Geist_Mono } from 'next/font/google'
import './globals.css'

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

const interTight = Inter_Tight({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Forge Inspector Playground',
  description: 'Interactive playground for testing forge-inspector features',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${interTight.variable} ${geistMono.variable}`}
    >
      <body>
        <div className="void" aria-hidden="true" />
        {children}
      </body>
    </html>
  )
}
