/**
 * createVisualAgentListener - Vanilla JS listener for visual agent messages
 *
 * Use this in parent apps to receive messages from forge-inspector's
 * visual agent running in an iframe.
 */

const MESSAGE_SOURCE = 'click-to-component'
const MESSAGE_VERSION = 1

/**
 * @typedef {Object} RecordingPayload
 * @property {number} timestamp
 */

/**
 * @typedef {Object} ObservationPayload
 * @property {string} observation
 * @property {number} timestamp
 */

/**
 * @typedef {Object} QAReportPayload
 * @property {string} report
 * @property {Array<{text: string, timestamp: number, trigger?: string, confirmed?: boolean}>} observations
 * @property {number} sessionDuration
 */

/**
 * @typedef {Object} ErrorPayload
 * @property {string} error
 */

/**
 * @typedef {Object} ConfirmStepPayload
 * @property {string} confirmationId
 * @property {string} observation
 * @property {string} question
 * @property {'info' | 'warning' | 'error'} severity
 * @property {number} timestamp
 */

/**
 * @typedef {Object} VisualAgentHandlers
 * @property {(payload: RecordingPayload) => void} [onRecordingStarted]
 * @property {(payload: ObservationPayload) => void} [onRecordingObservation]
 * @property {(payload: QAReportPayload) => void} [onQAReport]
 * @property {(payload: ErrorPayload) => void} [onRecordingError]
 * @property {(payload: ConfirmStepPayload, respond: (confirmed: boolean, note?: string) => void) => void} [onConfirmStep]
 */

/**
 * Create a visual agent message listener
 * @param {VisualAgentHandlers} handlers - Event handlers for visual agent messages
 * @returns {{start: () => void, stop: () => void, respondToConfirm: (confirmationId: string, confirmed: boolean, note?: string) => void}}
 */
export function createVisualAgentListener(handlers = {}) {
  /** @type {((event: MessageEvent) => void) | null} */
  let messageListener = null

  /** @type {MessageEventSource | null} */
  let lastSource = null

  /**
   * Send confirmation response to iframe
   * @param {string} confirmationId
   * @param {boolean} confirmed
   * @param {string} [note]
   */
  function respondToConfirm(confirmationId, confirmed, note) {
    if (lastSource) {
      /** @type {Window} */ (lastSource).postMessage(
        {
          source: MESSAGE_SOURCE,
          version: MESSAGE_VERSION,
          type: 'confirm-step-response',
          payload: { confirmationId, confirmed, note }
        },
        '*'
      )
    }
  }

  /**
   * Start listening for visual agent messages
   */
  function start() {
    if (messageListener) {
      stop()
    }

    messageListener = (event) => {
      const data = event.data

      // Only handle messages from forge-inspector
      if (!data || data.source !== MESSAGE_SOURCE || data.version !== MESSAGE_VERSION) {
        return
      }

      // Store source for responding
      if (event.source) {
        lastSource = event.source
      }

      switch (data.type) {
        case 'recording-started':
          if (data.payload && handlers.onRecordingStarted) {
            handlers.onRecordingStarted(data.payload)
          }
          break

        case 'recording-observation':
          if (data.payload && handlers.onRecordingObservation) {
            handlers.onRecordingObservation(data.payload)
          }
          break

        case 'qa-report':
          if (data.payload && handlers.onQAReport) {
            handlers.onQAReport(data.payload)
          }
          break

        case 'recording-error':
          if (data.payload && handlers.onRecordingError) {
            handlers.onRecordingError(data.payload)
          }
          break

        case 'confirm-step':
          if (data.payload && handlers.onConfirmStep) {
            const payload = data.payload
            handlers.onConfirmStep(payload, (confirmed, note) => {
              respondToConfirm(payload.confirmationId, confirmed, note)
            })
          }
          break
      }
    }

    window.addEventListener('message', messageListener)
  }

  /**
   * Stop listening for messages
   */
  function stop() {
    if (messageListener) {
      window.removeEventListener('message', messageListener)
      messageListener = null
    }
    lastSource = null
  }

  return {
    start,
    stop,
    respondToConfirm
  }
}

export default createVisualAgentListener
