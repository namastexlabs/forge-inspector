'use client'

import { useState, useEffect } from 'react'
import styles from './samples.module.css'

export function LoadingPatterns() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) return 0
        return prev + 10
      })
    }, 500)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className={styles.loadingGrid}>
      {/* Skeleton Loading */}
      <div>
        <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
          <div className={`${styles.skeleton} ${styles.skeletonCircle}`} />
          <div style={{ flex: 1 }}>
            <div className={`${styles.skeleton} ${styles.skeletonLine}`} style={{ marginBottom: 'var(--space-2)' }} />
            <div className={`${styles.skeleton} ${styles.skeletonLine} ${styles.skeletonLineShort}`} />
          </div>
        </div>
      </div>

      {/* Spinner */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <div className={styles.spinner} />
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          Loading data...
        </span>
      </div>

      {/* Progress Bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
            Uploading files
          </span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
            {progress}%
          </span>
        </div>
        <div className={styles.progressBar}>
          <div
            className={styles.progressBarFill}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}
