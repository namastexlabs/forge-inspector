'use client'

import { Component, ErrorInfo, ReactNode } from 'react'
import styles from './inspector.module.css'

interface ChatErrorBoundaryProps {
  children: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface ChatErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ChatErrorBoundary extends Component<ChatErrorBoundaryProps, ChatErrorBoundaryState> {
  constructor(props: ChatErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ChatErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ChatErrorBoundary] Error caught:', error, errorInfo)
    this.props.onError?.(error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className={styles.chatError}>
          <div className={styles.chatErrorIcon}>!</div>
          <div className={styles.chatErrorContent}>
            <p className={styles.chatErrorTitle}>Something went wrong</p>
            <p className={styles.chatErrorMessage}>
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
          </div>
          <button
            className={styles.chatErrorRetry}
            onClick={this.handleRetry}
          >
            Retry
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
