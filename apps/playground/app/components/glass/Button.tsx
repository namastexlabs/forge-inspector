'use client'

import { forwardRef, type ButtonHTMLAttributes } from 'react'
import styles from './glass.module.css'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'warm' | 'cool' | 'recording'
  size?: 'sm' | 'md' | 'lg'
  iconOnly?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'default',
      size = 'md',
      iconOnly = false,
      children,
      ...props
    },
    ref
  ) => {
    const variantClasses: Record<string, string> = {
      default: '',
      warm: styles.buttonWarm,
      cool: styles.buttonCool,
      recording: styles.buttonRecording,
    }

    const sizeClasses: Record<string, string> = {
      sm: iconOnly ? styles.buttonIconSm : styles.buttonSm,
      md: iconOnly ? styles.buttonIcon : '',
      lg: iconOnly ? styles.buttonIconLg : styles.buttonLg,
    }

    const classes = [
      styles.button,
      variantClasses[variant],
      sizeClasses[size],
      className,
    ]
      .filter(Boolean)
      .join(' ')

    return (
      <button ref={ref} className={classes} {...props}>
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
