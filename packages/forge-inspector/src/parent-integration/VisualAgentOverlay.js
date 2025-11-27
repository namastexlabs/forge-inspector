/**
 * VisualAgentOverlay - Drop-in React component for visual agent UI
 *
 * Renders recording indicator, observations panel, and confirmation dialog.
 * Uses useVisualAgentListener internally for state management.
 */

import { useState, useCallback } from 'react'
import { html } from 'htm/react'
import { useVisualAgentListener } from './useVisualAgentListener.js'

/**
 * @typedef {Object} VisualAgentOverlayProps
 * @property {'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'} [position='bottom-right']
 * @property {boolean} [showRecordingIndicator=true]
 * @property {boolean} [showObservationsPanel=true]
 * @property {(report: import('./createVisualAgentListener.js').QAReportPayload) => void} [onReport]
 */

/**
 * Drop-in overlay component for visual agent integration
 * @param {VisualAgentOverlayProps} props
 */
export function VisualAgentOverlay({
  position = 'bottom-right',
  showRecordingIndicator = true,
  showObservationsPanel = true,
  onReport
}) {
  const [showPanel, setShowPanel] = useState(true)

  const {
    isRecording,
    observations,
    report,
    pendingConfirm,
    confirmResponse
  } = useVisualAgentListener({
    onQAReport: (payload) => {
      onReport?.(payload)
    }
  })

  const togglePanel = useCallback(() => {
    setShowPanel((v) => !v)
  }, [])

  const handleConfirm = useCallback(
    /** @param {boolean} confirmed */
    (confirmed) => {
      confirmResponse(confirmed)
    },
    [confirmResponse]
  )

  // Position styles
  const positionStyles = {
    'top-left': { top: '1rem', left: '1rem' },
    'top-right': { top: '1rem', right: '1rem' },
    'bottom-left': { bottom: '1rem', left: '1rem' },
    'bottom-right': { bottom: '1rem', right: '1rem' }
  }

  const indicatorPosition = position.includes('top')
    ? { top: '0.5rem', right: '0.5rem' }
    : { top: '0.5rem', right: '0.5rem' }

  // Don't render anything if nothing to show
  if (!isRecording && !report && observations.length === 0 && !pendingConfirm) {
    return null
  }

  return html`
    <style>
      .va-overlay {
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 14px;
        z-index: 9999;
      }
      .va-recording-indicator {
        position: fixed;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        background: #dc2626;
        color: white;
        padding: 0.25rem 0.75rem;
        border-radius: 9999px;
        font-size: 0.875rem;
        font-weight: 500;
        animation: va-pulse 2s infinite;
        z-index: 10000;
      }
      @keyframes va-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }
      .va-recording-dot {
        width: 0.5rem;
        height: 0.5rem;
        background: white;
        border-radius: 50%;
      }
      .va-panel {
        position: fixed;
        width: 20rem;
        max-height: 24rem;
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 0.5rem;
        box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
        overflow: hidden;
        z-index: 9999;
      }
      .va-panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.5rem 0.75rem;
        background: #f9fafb;
        border-bottom: 1px solid #e5e7eb;
      }
      .va-panel-title {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-weight: 500;
        font-size: 0.875rem;
      }
      .va-panel-close {
        background: none;
        border: none;
        cursor: pointer;
        padding: 0.25rem;
        color: #6b7280;
        font-size: 1.25rem;
        line-height: 1;
      }
      .va-panel-close:hover {
        color: #374151;
      }
      .va-panel-content {
        padding: 0.75rem;
        overflow-y: auto;
        max-height: 18rem;
        font-size: 0.875rem;
      }
      .va-observation {
        padding: 0.5rem;
        background: #f3f4f6;
        border-radius: 0.25rem;
        margin-bottom: 0.5rem;
        font-size: 0.75rem;
      }
      .va-observation-time {
        color: #9ca3af;
        font-size: 0.625rem;
        margin-bottom: 0.25rem;
      }
      .va-report {
        white-space: pre-wrap;
        font-family: monospace;
        font-size: 0.75rem;
      }
      .va-report-meta {
        font-size: 0.75rem;
        color: #6b7280;
        margin-top: 0.5rem;
      }
      .va-confirm-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
      }
      .va-confirm-dialog {
        background: white;
        border-radius: 0.5rem;
        box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
        max-width: 28rem;
        width: calc(100% - 2rem);
        padding: 1rem;
      }
      .va-confirm-severity {
        font-size: 0.875rem;
        font-weight: 500;
        margin-bottom: 0.5rem;
      }
      .va-confirm-severity.info { color: #3b82f6; }
      .va-confirm-severity.warning { color: #f59e0b; }
      .va-confirm-severity.error { color: #ef4444; }
      .va-confirm-observation {
        font-size: 0.875rem;
        margin-bottom: 0.5rem;
      }
      .va-confirm-question {
        font-size: 0.875rem;
        font-weight: 500;
        margin-bottom: 0.75rem;
      }
      .va-confirm-buttons {
        display: flex;
        gap: 0.5rem;
        justify-content: flex-end;
      }
      .va-btn {
        padding: 0.375rem 0.75rem;
        border-radius: 0.375rem;
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        border: none;
      }
      .va-btn-outline {
        background: white;
        border: 1px solid #d1d5db;
        color: #374151;
      }
      .va-btn-outline:hover {
        background: #f9fafb;
      }
      .va-btn-primary {
        background: #3b82f6;
        color: white;
      }
      .va-btn-primary:hover {
        background: #2563eb;
      }
      @media (prefers-color-scheme: dark) {
        .va-panel {
          background: #1f2937;
          border-color: #374151;
        }
        .va-panel-header {
          background: #111827;
          border-color: #374151;
        }
        .va-panel-title {
          color: #f9fafb;
        }
        .va-observation {
          background: #374151;
          color: #f9fafb;
        }
        .va-report {
          color: #f9fafb;
        }
        .va-confirm-dialog {
          background: #1f2937;
          color: #f9fafb;
        }
        .va-btn-outline {
          background: #374151;
          border-color: #4b5563;
          color: #f9fafb;
        }
      }
    </style>

    <div class="va-overlay">
      ${showRecordingIndicator && isRecording && html`
        <div class="va-recording-indicator" style=${indicatorPosition}>
          <span class="va-recording-dot"></span>
          Recording
        </div>
      `}

      ${showObservationsPanel && showPanel && (observations.length > 0 || report) && html`
        <div class="va-panel" style=${positionStyles[position]}>
          <div class="va-panel-header">
            <div class="va-panel-title">
              <span>${report ? 'QA Report' : 'Observations'}</span>
            </div>
            <button class="va-panel-close" onClick=${togglePanel}>×</button>
          </div>
          <div class="va-panel-content">
            ${report ? html`
              <div>
                <pre class="va-report">${report.report}</pre>
                <div class="va-report-meta">
                  Duration: ${Math.round(report.sessionDuration / 1000)}s •
                  ${report.observations.length} observations
                </div>
              </div>
            ` : html`
              <div>
                ${observations.map((obs, i) => html`
                  <div class="va-observation" key=${i}>
                    <div class="va-observation-time">
                      ${new Date(obs.timestamp).toLocaleTimeString()}
                    </div>
                    ${obs.observation}
                  </div>
                `)}
              </div>
            `}
          </div>
        </div>
      `}

      ${pendingConfirm && html`
        <div class="va-confirm-overlay">
          <div class="va-confirm-dialog">
            <div class="va-confirm-severity ${pendingConfirm.payload.severity}">
              Visual Agent Observation
            </div>
            <p class="va-confirm-observation">${pendingConfirm.payload.observation}</p>
            <p class="va-confirm-question">${pendingConfirm.payload.question}</p>
            <div class="va-confirm-buttons">
              <button class="va-btn va-btn-outline" onClick=${() => handleConfirm(false)}>
                No
              </button>
              <button class="va-btn va-btn-primary" onClick=${() => handleConfirm(true)}>
                Yes, Confirm
              </button>
            </div>
          </div>
        </div>
      `}
    </div>
  `
}

export default VisualAgentOverlay
