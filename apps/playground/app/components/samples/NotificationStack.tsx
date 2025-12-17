'use client'

import styles from './samples.module.css'

interface NotificationProps {
  type: 'success' | 'warning' | 'error'
  title: string
  message: string
}

function Notification({ type, title, message }: NotificationProps) {
  const typeClasses = {
    success: styles.notificationSuccess,
    warning: styles.notificationWarning,
    error: styles.notificationError,
  }

  const icons = {
    success: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
    warning: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
    error: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    ),
  }

  return (
    <div className={`${styles.notification} ${typeClasses[type]}`}>
      <span className={styles.notificationIcon}>{icons[type]}</span>
      <div className={styles.notificationContent}>
        <div className={styles.notificationTitle}>{title}</div>
        <div className={styles.notificationMessage}>{message}</div>
      </div>
    </div>
  )
}

export function NotificationStack() {
  return (
    <div className={styles.notificationStack}>
      <Notification
        type="success"
        title="Success"
        message="Your changes have been saved successfully."
      />
      <Notification
        type="warning"
        title="Warning"
        message="Please review your input before proceeding."
      />
      <Notification
        type="error"
        title="Error"
        message="An error occurred while processing your request."
      />
    </div>
  )
}
