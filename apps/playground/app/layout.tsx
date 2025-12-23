import type { Metadata } from 'next'
import './globals.css'

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
    <html lang="en">
      <body>
        <div className="void" aria-hidden="true" />
        {children}
      </body>
    </html>
  )
}
