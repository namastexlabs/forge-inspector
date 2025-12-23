/**
 * Visual Agent - eyes() API
 *
 * Reusable visual observation capability for forge-inspector.
 * Wraps VisualAgentOrchestrator with a simple, ergonomic API.
 *
 * NOTE: Heavy imports (AI SDK, transformers.js) are lazy-loaded
 * to avoid "illegal path" errors during capability checks.
 */

// Lightweight import - no AI SDK dependency
import { ScreenCaptureService } from './ScreenCaptureService.js'

/**
 * Available models for visual agent
 * @type {Array<{id: string, name: string, type: 'local'|'cloud', modelId?: string, providerId?: string, dtype?: string, device?: string, description: string, size: string, requiresApiKey?: boolean}>}
 */
export const AVAILABLE_MODELS = [
  {
    id: 'florence-2-large',
    name: 'Florence-2 Large',
    type: 'local',
    modelId: 'onnx-community/Florence-2-large-ft',
    modelClass: 'AutoModelForImageTextToText',
    dtype: {
      vision_encoder: 'fp16',
      encoder_model: 'q4',
      decoder_model_merged: 'q4'
    },
    device: 'webgpu',
    description: 'Microsoft vision model. Great for UI understanding.',
    size: '~770MB'
  },
  {
    id: 'ministral-3b',
    name: 'Ministral 3B',
    type: 'local',
    modelId: 'mistralai/Ministral-3-3B-Instruct-2512-ONNX',
    modelClass: 'AutoModelForImageTextToText',
    dtype: 'q4',
    device: 'webgpu',
    description: 'Mistral vision model. 3.4B LM + 0.4B Vision Encoder.',
    size: '~2GB'
  },
  {
    id: 'gemini-flash',
    name: 'Gemini 3 Flash',
    type: 'cloud',
    providerId: 'gemini-3-flash-preview',
    description: "Google's SOTA vision model (Dec 2025). Requires API key.",
    size: 'Cloud',
    requiresApiKey: true
  }
]

/** localStorage key for Gemini API key */
export const GEMINI_KEY_STORAGE = 'forge-inspector-gemini-key'

/**
 * Get model config by ID
 * @param {string} modelId
 * @returns {typeof AVAILABLE_MODELS[0] | undefined}
 */
export function getModelById(modelId) {
  return AVAILABLE_MODELS.find(m => m.id === modelId)
}

// Lazy-loaded module cache
let orchestratorModule = null

/**
 * Get the VisualAgentOrchestrator class (lazy-loaded)
 * Using dynamic path construction to prevent browser prefetching
 * @returns {Promise<typeof import('./VisualAgentOrchestrator.js').VisualAgentOrchestrator>}
 */
async function getOrchestrator() {
  if (!orchestratorModule) {
    // Construct path dynamically to prevent static analysis/prefetching
    const modulePath = './Visual' + 'AgentOrchestrator.js'
    orchestratorModule = await import(/* @vite-ignore */ modulePath)
  }
  return orchestratorModule.VisualAgentOrchestrator
}

/**
 * @typedef {'live' | 'file' | 'url'} EyesSource
 *
 * @typedef {Object} EyesOptions
 * @property {(text: string) => void} [onObservation] - Called with each observation chunk
 * @property {(report: string) => void} [onComplete] - Called when session completes with final report
 * @property {(error: Error) => void} [onError] - Called on errors
 * @property {(status: string) => void} [onStatusChange] - Called when status changes
 * @property {(data: {modelId: string, progress: number, status: string}) => void} [onLoadingProgress] - Called during model loading
 * @property {EyesSource} [source='live'] - Input source type
 * @property {File} [file] - File to analyze (when source='file')
 * @property {string} [url] - URL to analyze (when source='url')
 * @property {string} [systemPrompt] - Override default system prompt
 * @property {number} [maxContextTurns=5] - Max conversation turns to keep
 * @property {typeof AVAILABLE_MODELS[0]} [modelConfig] - Model configuration to use
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
    onLoadingProgress,
    source = 'live',
    file,
    url,
    systemPrompt,
    maxContextTurns = 5,
    modelConfig = AVAILABLE_MODELS[0] // Default to Florence-2
  } = options

  // Orchestrator will be lazily created on first start()
  let orchestrator = null

  /**
   * Ensure orchestrator is initialized (lazy load)
   */
  async function ensureOrchestrator() {
    if (!orchestrator) {
      const VisualAgentOrchestrator = await getOrchestrator()
      orchestrator = new VisualAgentOrchestrator({
        onObservation,
        onComplete,
        onError,
        onStatusChange,
        onLoadingProgress,
        systemPrompt,
        maxContextTurns,
        modelConfig
      })
    }
    return orchestrator
  }

  /** @type {EyesAgent} */
  const agent = {
    /**
     * Start the visual agent session
     */
    async start() {
      const orch = await ensureOrchestrator()
      switch (source) {
        case 'file':
          if (!file) {
            throw new Error('File required when source is "file"')
          }
          await orch.startFromFile(file)
          break

        case 'url':
          if (!url) {
            throw new Error('URL required when source is "url"')
          }
          await orch.startFromURL(url)
          break

        case 'live':
        default:
          await orch.startLive()
          break
      }
    },

    /**
     * Trigger observation of current screen
     * @param {string} [context] - Optional context about what triggered this
     * @returns {Promise<string>} The observation text
     */
    async trigger(context) {
      const orch = await ensureOrchestrator()
      return orch.trigger(context)
    },

    /**
     * Stop session and get final report
     * @returns {Promise<string>} Final QA report
     */
    async stop() {
      const orch = await ensureOrchestrator()
      return orch.stop()
    },

    /**
     * Force terminate and cleanup all resources
     */
    terminate() {
      if (orchestrator) {
        orchestrator.terminate()
        orchestrator = null
      }
    },

    /**
     * Whether session is currently active
     */
    get isActive() {
      return orchestrator ? orchestrator.isActive : false
    },

    /**
     * List of recorded observations
     */
    get observations() {
      return orchestrator ? orchestrator.observations : []
    },

    /**
     * Duration of current session in milliseconds
     */
    get sessionDuration() {
      return orchestrator ? orchestrator.sessionDuration : 0
    },

    /**
     * Access to capture service for video controls (seek, play, pause)
     */
    get capture() {
      return orchestrator ? orchestrator.capture : null
    }
  }

  return agent
}

// Re-export lightweight checkCapabilities
export { checkCapabilities } from './capabilities.js'

// Re-export lightweight components
export { ScreenCaptureService } from './ScreenCaptureService.js'

// Heavy components are lazy-loaded via async getters to avoid "illegal path" errors
// Use these instead of direct imports:
//   const { VisualAgentOrchestrator } = await import('./VisualAgentOrchestrator.js')
//   const { createConfirmStepTool } = await import('./tools/confirmStep.js')

export default eyes
