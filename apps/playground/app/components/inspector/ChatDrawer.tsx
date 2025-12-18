'use client'

import { useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChatMessage, ChatMessageData, ElementContent } from './ChatMessage'
import styles from './inspector.module.css'

interface ChatDrawerProps {
  messages: ChatMessageData[]
  isOpen: boolean
  isSelecting: boolean
  isRecording: boolean
  webGpuAvailable: boolean
  onToggleSelection: () => void
  onToggleRecording: () => void
  onClose: () => void
  onCopyMessage?: (content: string) => void
  onOpenEditor?: (source: ElementContent['source']) => void
}

export function ChatDrawer({
  messages,
  isOpen,
  isSelecting,
  isRecording,
  webGpuAvailable,
  onToggleSelection,
  onToggleRecording,
  onClose,
  onCopyMessage,
  onOpenEditor,
}: ChatDrawerProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={styles.chatDrawer}
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        >
          {/* Header */}
          <div className={styles.chatDrawerHeader}>
            <div className={styles.chatDrawerTitle}>
              <span className={styles.chatDrawerIcon}>◉</span>
              <span>CONSOLE</span>
            </div>
            <div className={styles.chatDrawerControls}>
              <button
                className={styles.chatDrawerControl}
                onClick={onClose}
                aria-label="Close drawer"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M1 1L13 13M1 13L13 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className={styles.chatDrawerMessages}>
            {messages.length === 0 ? (
              <div className={styles.chatDrawerEmpty}>
                <div className={styles.chatDrawerEmptyIcon}>
                  <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                    <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4"/>
                    <circle cx="24" cy="24" r="8" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M24 4V12M24 36V44M4 24H12M36 24H44" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
                <p className={styles.chatDrawerEmptyText}>
                  Click "Pick Element" to select a component
                </p>
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <ChatMessage
                    key={msg.id}
                    message={msg}
                    onCopy={onCopyMessage}
                    onOpenEditor={onOpenEditor}
                  />
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Footer Actions */}
          <div className={styles.chatDrawerFooter}>
            <button
              className={`${styles.chatDrawerButton} ${styles.chatDrawerButtonWarm} ${isSelecting ? styles.chatDrawerButtonActive : ''}`}
              onClick={onToggleSelection}
            >
              {isSelecting ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M4 4L12 12M4 12L12 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <span>Cancel</span>
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M8 1V4M8 12V15M1 8H4M12 8H15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <span>Pick Element</span>
                </>
              )}
            </button>

            <button
              className={`${styles.chatDrawerButton} ${styles.chatDrawerButtonCool} ${isRecording ? styles.chatDrawerButtonRecording : ''}`}
              onClick={onToggleRecording}
              disabled={!webGpuAvailable && !isRecording}
              title={!webGpuAvailable ? 'WebGPU required for recording' : undefined}
            >
              {isRecording ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <rect x="4" y="4" width="8" height="8" rx="1" fill="currentColor"/>
                  </svg>
                  <span>Stop</span>
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="4" fill="currentColor"/>
                  </svg>
                  <span>Record</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
