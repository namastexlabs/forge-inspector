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
        <img
          src="/forge-logo.svg"
          alt="Forge"
          className={styles.headerLogoImage}
        />
        <span className={styles.headerLogoText}>Inspector</span>
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
