'use client'

import { type HTMLAttributes } from 'react'
import styles from './glass.module.css'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'recording' | 'cool' | 'warm'
  dot?: boolean
}

export function Badge({
  className,
  variant = 'default',
  dot = false,
  children,
  ...props
}: BadgeProps) {
  const variantClasses: Record<string, string> = {
    default: '',
    success: styles.badgeSuccess,
    warning: styles.badgeWarning,
    error: styles.badgeError,
    recording: styles.badgeRecording,
    cool: styles.badgeCool,
    warm: styles.badgeWarm,
  }

  const classes = [styles.badge, variantClasses[variant], className]
    .filter(Boolean)
    .join(' ')

  return (
    <span className={classes} {...props}>
      {dot && <span className={styles.badgeDot} />}
      {children}
    </span>
  )
}
