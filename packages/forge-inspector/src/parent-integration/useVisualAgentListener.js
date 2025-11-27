/**
 * useVisualAgentListener - React hook for visual agent messages
 *
 * Provides state management for visual agent observations and confirmations.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { createVisualAgentListener } from './createVisualAgentListener.js'

/**
 * @typedef {import('./createVisualAgentListener.js').ObservationPayload} ObservationPayload
 * @typedef {import('./createVisualAgentListener.js').QAReportPayload} QAReportPayload
 * @typedef {import('./createVisualAgentListener.js').ConfirmStepPayload} ConfirmStepPayload
 */

/**
 * @typedef {Object} PendingConfirm
 * @property {ConfirmStepPayload} payload
 * @property {(confirmed: boolean, note?: string) => void} respond
 */

/**
 * @typedef {Object} UseVisualAgentListenerOptions
 * @property {(payload: import('./createVisualAgentListener.js').RecordingPayload) => void} [onRecordingStarted]
 * @property {(payload: ObservationPayload) => void} [onRecordingObservation]
 * @property {(payload: QAReportPayload) => void} [onQAReport]
 * @property {(payload: import('./createVisualAgentListener.js').ErrorPayload) => void} [onRecordingError]
 * @property {(payload: ConfirmStepPayload, respond: (confirmed: boolean, note?: string) => void) => void} [onConfirmStep]
 * @property {boolean} [autoStart=true] - Whether to start listening automatically
 */

/**
 * React hook for listening to visual agent messages
 * @param {UseVisualAgentListenerOptions} options
 * @returns {{
 *   isRecording: boolean,
 *   observations: ObservationPayload[],
 *   report: QAReportPayload | null,
 *   pendingConfirm: PendingConfirm | null,
 *   confirmResponse: (confirmed: boolean, note?: string) => void,
 *   clearObservations: () => void,
 *   clearReport: () => void
 * }}
 */
export function useVisualAgentListener(options = {}) {
  const { autoStart = true, ...handlers } = options

  const [isRecording, setIsRecording] = useState(false)
  const [observations, setObservations] = useState(/** @type {ObservationPayload[]} */ ([]))
  const [report, setReport] = useState(/** @type {QAReportPayload | null} */ (null))
  const [pendingConfirm, setPendingConfirm] = useState(/** @type {PendingConfirm | null} */ (null))

  const listenerRef = useRef(/** @type {ReturnType<typeof createVisualAgentListener> | null} */ (null))

  // Create stable callback refs
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    const listener = createVisualAgentListener({
      onRecordingStarted: (payload) => {
        setIsRecording(true)
        setObservations([])
        setReport(null)
        handlersRef.current.onRecordingStarted?.(payload)
      },
      onRecordingObservation: (payload) => {
        setObservations((prev) => [...prev, payload])
        handlersRef.current.onRecordingObservation?.(payload)
      },
      onQAReport: (payload) => {
        setReport(payload)
        setIsRecording(false)
        handlersRef.current.onQAReport?.(payload)
      },
      onRecordingError: (payload) => {
        setIsRecording(false)
        handlersRef.current.onRecordingError?.(payload)
      },
      onConfirmStep: (payload, respond) => {
        setPendingConfirm({ payload, respond })
        handlersRef.current.onConfirmStep?.(payload, respond)
      }
    })

    listenerRef.current = listener

    if (autoStart) {
      listener.start()
    }

    return () => {
      listener.stop()
      listenerRef.current = null
    }
  }, [autoStart])

  /**
   * Respond to pending confirmation
   */
  const confirmResponse = useCallback(
    /**
     * @param {boolean} confirmed
     * @param {string} [note]
     */
    (confirmed, note) => {
      if (pendingConfirm) {
        pendingConfirm.respond(confirmed, note)
        setPendingConfirm(null)
      }
    },
    [pendingConfirm]
  )

  /**
   * Clear observations
   */
  const clearObservations = useCallback(() => {
    setObservations([])
  }, [])

  /**
   * Clear report
   */
  const clearReport = useCallback(() => {
    setReport(null)
  }, [])

  return {
    isRecording,
    observations,
    report,
    pendingConfirm,
    confirmResponse,
    clearObservations,
    clearReport
  }
}

export default useVisualAgentListener
