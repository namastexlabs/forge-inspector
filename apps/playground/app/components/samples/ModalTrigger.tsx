'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import styles from './samples.module.css'

export function ModalTrigger() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        className={`${styles.sampleButton} ${styles.sampleButtonPrimary} ${styles.modalTrigger}`}
        onClick={() => setIsOpen(true)}
      >
        Open Modal Dialog
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className={styles.modalBackdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              className={styles.modal}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>Modal Dialog</h3>
                <button
                  className={styles.modalClose}
                  onClick={() => setIsOpen(false)}
                  aria-label="Close modal"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 6L6 18" />
                    <path d="M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className={styles.modalBody}>
                <p>
                  This is a sample modal dialog component. Modal dialogs are used to
                  display important information or request user input without
                  navigating away from the current page.
                </p>
              </div>
              <div className={styles.modalFooter}>
                <button
                  className={styles.sampleButton}
                  onClick={() => setIsOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className={`${styles.sampleButton} ${styles.sampleButtonPrimary}`}
                  onClick={() => setIsOpen(false)}
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
