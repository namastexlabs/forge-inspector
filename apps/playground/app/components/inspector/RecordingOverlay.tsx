'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import styles from './inspector.module.css'

interface RecordingOverlayProps {
  isRecording: boolean
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function RecordingOverlay({ isRecording }: RecordingOverlayProps) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!isRecording) {
      setElapsed(0)
      return
    }

    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [isRecording])

  return (
    <AnimatePresence>
      {isRecording && (
        <>
          {/* Border overlay */}
          <motion.div
            className={`${styles.recordingOverlay} ${styles.recordingOverlayActive}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          />

          {/* Recording indicator */}
          <motion.div
            className={styles.recordingIndicator}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className={styles.recordingDot} />
            <span className={styles.recordingText}>Recording</span>
            <span className={styles.recordingTime}>{formatTime(elapsed)}</span>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
