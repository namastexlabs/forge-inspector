'use client'

import { forwardRef, type HTMLAttributes } from 'react'
import styles from './glass.module.css'

export interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  glow?: 'warm' | 'cool' | 'none'
  shimmer?: boolean
}

export const Panel = forwardRef<HTMLDivElement, PanelProps>(
  ({ className, glow = 'none', shimmer = false, children, ...props }, ref) => {
    const classes = [
      styles.panel,
      shimmer && styles.panelShimmer,
      className,
    ]
      .filter(Boolean)
      .join(' ')

    return (
      <div
        ref={ref}
        className={classes}
        data-glow={glow !== 'none' ? glow : undefined}
        {...props}
      >
        {children}
      </div>
    )
  }
)

Panel.displayName = 'Panel'
