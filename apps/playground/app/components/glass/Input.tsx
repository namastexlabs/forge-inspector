'use client'

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import styles from './glass.module.css'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
  icon?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error = false, icon, ...props }, ref) => {
    const inputClasses = [
      styles.input,
      error && styles.inputError,
      icon && styles.inputWithIcon,
      className,
    ]
      .filter(Boolean)
      .join(' ')

    if (icon) {
      return (
        <div className={styles.inputWrapper}>
          <span className={styles.inputIcon}>{icon}</span>
          <input ref={ref} className={inputClasses} {...props} />
        </div>
      )
    }

    return <input ref={ref} className={inputClasses} {...props} />
  }
)

Input.displayName = 'Input'
