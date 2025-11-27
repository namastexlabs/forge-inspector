/**
 * Visual Agent - eyes() API
 *
 * Reusable visual observation capability for forge-inspector.
 * Wraps VisualAgentOrchestrator with a simple, ergonomic API.
 */

import { VisualAgentOrchestrator } from './VisualAgentOrchestrator.js'
import { ScreenCaptureService } from './ScreenCaptureService.js'

/**
 * @typedef {'live' | 'file' | 'url'} EyesSource
 *
 * @typedef {Object} EyesOptions
 * @property {(text: string) => void} [onObservation] - Called with each observation chunk
 * @property {(report: string) => void} [onComplete] - Called when session completes with final report
 * @property {(error: Error) => void} [onError] - Called on errors
 * @property {(status: string) => void} [onStatusChange] - Called when status changes
 * @property {EyesSource} [source='live'] - Input source type
 * @property {File} [file] - File to analyze (when source='file')
 * @property {string} [url] - URL to analyze (when source='url')
 * @property {string} [systemPrompt] - Override default system prompt
 * @property {number} [maxContextTurns=5] - Max conversation turns to keep
 *
 * @typedef {Object} EyesAgent
 * @property {() => Promise<void>} start - Start the visual agent session
 * @property {(context?: string) => Promise<string>} trigger - Trigger observation of current screen
 * @property {() => Promise<string>} stop - Stop session and get final report
 * @property {() => void} terminate - Force terminate and cleanup
 * @property {boolean} isActive - Whether session is active
 * @property {Array} observations - List of recorded observations
 * @property {number} sessionDuration - Duration of current session in ms
 * @property {ScreenCaptureService} capture - Access to capture service for video controls
 */

/**
 * Create a visual agent instance
 *
 * @example
 * ```javascript
 * const agent = eyes({
 *   onObservation: (text) => console.log('Saw:', text),
 *   onComplete: (report) => console.log('Report:', report)
 * })
 *
 * await agent.start()
 * await agent.trigger('clicked submit button')
 * await agent.trigger('form submitted')
 * const report = await agent.stop()
 * ```
 *
 * @param {EyesOptions} options
 * @returns {EyesAgent}
 */
export function eyes(options = {}) {
  const {
    onObservation,
    onComplete,
    onError,
    onStatusChange,
    source = 'live',
    file,
    url,
    systemPrompt,
    maxContextTurns = 5
  } = options

  const orchestrator = new VisualAgentOrchestrator({
    onObservation,
    onComplete,
    onError,
    onStatusChange,
    systemPrompt,
    maxContextTurns
  })

  /** @type {EyesAgent} */
  const agent = {
    /**
     * Start the visual agent session
     */
    async start() {
      switch (source) {
        case 'file':
          if (!file) {
            throw new Error('File required when source is "file"')
          }
          await orchestrator.startFromFile(file)
          break

        case 'url':
          if (!url) {
            throw new Error('URL required when source is "url"')
          }
          await orchestrator.startFromURL(url)
          break

        case 'live':
        default:
          await orchestrator.startLive()
          break
      }
    },

    /**
     * Trigger observation of current screen
     * @param {string} [context] - Optional context about what triggered this
     * @returns {Promise<string>} The observation text
     */
    async trigger(context) {
      return orchestrator.trigger(context)
    },

    /**
     * Stop session and get final report
     * @returns {Promise<string>} Final QA report
     */
    async stop() {
      return orchestrator.stop()
    },

    /**
     * Force terminate and cleanup all resources
     */
    terminate() {
      orchestrator.terminate()
    },

    /**
     * Whether session is currently active
     */
    get isActive() {
      return orchestrator.isActive
    },

    /**
     * List of recorded observations
     */
    get observations() {
      return orchestrator.observations
    },

    /**
     * Duration of current session in milliseconds
     */
    get sessionDuration() {
      return orchestrator.sessionDuration
    },

    /**
     * Access to capture service for video controls (seek, play, pause)
     */
    get capture() {
      return orchestrator.capture
    }
  }

  return agent
}

/**
 * Check if visual agent capabilities are available
 * @returns {{ webgpu: boolean, displayMedia: boolean, available: boolean }}
 */
export function checkCapabilities() {
  const webgpu = ScreenCaptureService.hasWebGPU()
  const displayMedia = ScreenCaptureService.hasDisplayMedia()

  return {
    webgpu,
    displayMedia,
    available: webgpu // WebGPU is required for acceptable performance
  }
}

// Re-export components for advanced usage
export { VisualAgentOrchestrator } from './VisualAgentOrchestrator.js'
export { ScreenCaptureService } from './ScreenCaptureService.js'
export { createFastVLMProvider } from './FastVLMProvider.js'
export { createConfirmStepTool, confirmStep } from './tools/confirmStep.js'

export default eyes
