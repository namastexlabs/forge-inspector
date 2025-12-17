'use client'

import { useState, useEffect } from 'react'
import styles from './external.module.css'

interface UrlInputProps {
  onLoad: (url: string) => void
  isLoading?: boolean
}

const HISTORY_KEY = 'forge-inspector-url-history'
const MAX_HISTORY = 5

export function UrlInput({ onLoad, isLoading = false }: UrlInputProps) {
  const [url, setUrl] = useState('')
  const [history, setHistory] = useState<string[]>([])

  // Load history from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY)
      if (stored) {
        setHistory(JSON.parse(stored))
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!url.trim()) return

    // Normalize URL
    let normalizedUrl = url.trim()
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = `https://${normalizedUrl}`
    }

    // Update history
    const newHistory = [
      normalizedUrl,
      ...history.filter((h) => h !== normalizedUrl),
    ].slice(0, MAX_HISTORY)

    setHistory(newHistory)
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory))
    } catch {
      // Ignore localStorage errors
    }

    onLoad(normalizedUrl)
  }

  const handleHistoryClick = (historyUrl: string) => {
    setUrl(historyUrl)
    onLoad(historyUrl)
  }

  return (
    <div className={`${styles.urlInput} animate-emerge delay-1`}>
      <form onSubmit={handleSubmit} className={styles.urlInputRow}>
        <input
          type="text"
          className={styles.urlInputField}
          placeholder="Enter URL (e.g., localhost:3000)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={isLoading}
        />
        <button
          type="submit"
          className={styles.urlInputButton}
          disabled={!url.trim() || isLoading}
        >
          {isLoading ? 'Loading...' : 'Load'}
        </button>
      </form>

      {history.length > 0 && (
        <div className={styles.urlHistory}>
          <span className={styles.urlHistoryLabel}>Recent:</span>
          {history.map((historyUrl) => (
            <button
              key={historyUrl}
              className={styles.urlHistoryItem}
              onClick={() => handleHistoryClick(historyUrl)}
              disabled={isLoading}
            >
              {historyUrl.replace(/^https?:\/\//, '')}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
