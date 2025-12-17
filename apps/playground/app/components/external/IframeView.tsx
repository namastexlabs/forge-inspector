'use client'

import { forwardRef } from 'react'
import styles from './external.module.css'

interface IframeViewProps {
  url: string | null
  onLoad: () => void
}

export const IframeView = forwardRef<HTMLIFrameElement, IframeViewProps>(
  function IframeView({ url, onLoad }, ref) {
    if (!url) {
      return (
        <div className={`${styles.iframeContainer} animate-emerge delay-2`}>
          <div className={styles.iframePlaceholder}>
            <svg
              className={styles.iframePlaceholderIcon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18" />
              <path d="M9 21V9" />
            </svg>
            <h3 className={styles.iframePlaceholderTitle}>No URL Loaded</h3>
            <p className={styles.iframePlaceholderText}>
              Enter a URL above to load an external page with forge-inspector installed,
              or click &quot;Test Sample Components&quot; to try the built-in demo.
            </p>
          </div>
        </div>
      )
    }

    return (
      <div className={`${styles.iframeContainer} animate-emerge delay-2`}>
        <iframe
          ref={ref}
          src={url}
          className={styles.iframe}
          onLoad={onLoad}
          title="Forge Inspector Target"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </div>
    )
  }
)
