'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Badge } from '../glass'
import styles from './layout.module.css'

interface HeaderProps {
  webGpuAvailable?: boolean
}

export function Header({ webGpuAvailable = false }: HeaderProps) {
  const pathname = usePathname()

  return (
    <header className={`${styles.header} animate-emerge`}>
      <div className={styles.headerLogo}>
        <div className={styles.headerLogoIcon}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3l9 4.5v9L12 21l-9-4.5v-9L12 3z" />
            <path d="M12 12l9-4.5" />
            <path d="M12 12v9" />
            <path d="M12 12L3 7.5" />
          </svg>
        </div>
        <span className={styles.headerLogoText}>Forge Inspector</span>
      </div>

      <nav className={styles.headerNav}>
        <Link
          href="/"
          className={`${styles.headerNavLink} ${
            pathname === '/' ? styles.headerNavLinkActive : ''
          }`}
        >
          Playground
        </Link>
      </nav>

      <div className={styles.headerStatus}>
        <Badge
          variant={webGpuAvailable ? 'success' : 'warning'}
          dot
        >
          {webGpuAvailable ? 'WebGPU Ready' : 'WebGPU Unavailable'}
        </Badge>
      </div>
    </header>
  )
}
