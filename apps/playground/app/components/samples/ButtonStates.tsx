'use client'

import { useState } from 'react'
import styles from './samples.module.css'

export function ButtonStates() {
  const [isLoading, setIsLoading] = useState(false)

  const handleLoadingClick = () => {
    setIsLoading(true)
    setTimeout(() => setIsLoading(false), 2000)
  }

  return (
    <div className={styles.buttonGrid}>
      <button className={styles.sampleButton}>
        Default
      </button>
      <button className={`${styles.sampleButton} ${styles.sampleButtonPrimary}`}>
        Primary
      </button>
      <button className={`${styles.sampleButton} ${styles.sampleButtonDanger}`}>
        Danger
      </button>
      <button className={styles.sampleButton} disabled>
        Disabled
      </button>
      <button
        className={`${styles.sampleButton} ${styles.sampleButtonPrimary} ${isLoading ? styles.sampleButtonLoading : ''}`}
        onClick={handleLoadingClick}
        disabled={isLoading}
      >
        {isLoading ? 'Loading...' : 'Click to Load'}
      </button>
    </div>
  )
}
