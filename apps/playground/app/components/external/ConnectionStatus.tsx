'use client'

import styles from './external.module.css'

export type ConnectionState = 'idle' | 'loading' | 'waiting' | 'connected' | 'not-installed'

interface ConnectionStatusProps {
  state: ConnectionState
}

const stateLabels: Record<ConnectionState, string> = {
  idle: 'Enter a URL to start',
  loading: 'Loading page...',
  waiting: 'Detecting ForgeInspector...',
  connected: 'Connected',
  'not-installed': 'ForgeInspector not detected',
}

const stateDotClasses: Record<ConnectionState, string> = {
  idle: '',
  loading: styles.connectionStatusDotLoading,
  waiting: styles.connectionStatusDotWaiting,
  connected: styles.connectionStatusDotConnected,
  'not-installed': styles.connectionStatusDotNotInstalled,
}

export function ConnectionStatus({ state }: ConnectionStatusProps) {
  if (state === 'idle') return null

  return (
    <div className={styles.connectionStatus}>
      <span className={`${styles.connectionStatusDot} ${stateDotClasses[state]}`} />
      <span>{stateLabels[state]}</span>
    </div>
  )
}
