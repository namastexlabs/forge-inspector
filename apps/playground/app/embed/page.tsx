'use client'

import dynamic from 'next/dynamic'
import { Showcase } from '../components/samples'
import styles from '../components/layout/layout.module.css'

// Dynamic import to avoid SSR issues with ForgeInspector
const ForgeInspector = dynamic(
  () => import('forge-inspector').then((mod) => mod.ForgeInspector),
  { ssr: false }
)

export default function EmbedPage() {
  return (
    <>
      {/* ForgeInspector - handles click-to-component in iframe context */}
      <ForgeInspector />

      <div className={styles.embedContainer}>
        <div className={styles.embedContent}>
          <h2 className={styles.embedTitle}>Sample Components</h2>
          <p className={styles.embedSubtitle}>
            Alt+Click or Right-Click any component to inspect it
          </p>
          <Showcase />
        </div>
      </div>
    </>
  )
}
