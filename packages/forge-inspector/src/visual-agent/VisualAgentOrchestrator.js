/**
 * VisualAgentOrchestrator - Manages the visual agent loop
 *
 * Uses vlm.worker.js for local vision models (Florence-2, etc.)
 * and AI SDK with @ai-sdk/google for cloud models (Gemini).
 * Handles context pruning, step tracking, and report generation.
 */

// CDN imports for cloud models only
import { streamText, generateText } from 'https://cdn.jsdelivr.net/npm/ai@6/+esm'
import { createGoogleGenerativeAI } from 'https://cdn.jsdelivr.net/npm/@ai-sdk/google@3/+esm'
import { createConfirmStepTool } from './tools/confirmStep.js'
import ScreenCaptureService from './ScreenCaptureService.js'

/** localStorage key for Gemini API key */
const GEMINI_KEY_STORAGE = 'forge-inspector-gemini-key'

/**
 * @typedef {Object} Observation
 * @property {string} text - The observation text
 * @property {number} timestamp - When the observation was made
 * @property {string|Object} [trigger] - What triggered this observation
 * @property {boolean} [confirmed] - Whether user confirmed this observation
 * @property {number} stepNumber - The step number
 */

/**
 * @typedef {Object} OrchestratorOptions
 * @property {(text: string) => void} [onObservation] - Callback for each observation
 * @property {(report: string) => void} [onComplete] - Callback when session completes
 * @property {(error: Error) => void} [onError] - Callback for errors
 * @property {(status: string) => void} [onStatusChange] - Callback for status changes
 * @property {(data: {modelId: string, progress: number, status: string}) => void} [onLoadingProgress] - Callback during model loading
 * @property {number} [maxContextTurns=5] - Max conversation turns to keep
 * @property {string} [systemPrompt] - Override default system prompt
 * @property {Object} [modelConfig] - Model configuration
 */

const DEFAULT_SYSTEM_PROMPT = `You are a QA engineer recording bug reproduction steps.

OUTPUT FORMAT:
STEP [N]: [Action] → [Result/State Change]

RULES:
1. Number steps sequentially
2. Describe the USER ACTION from context
3. Describe what CHANGED on screen
4. Note errors, validation messages, unexpected behavior
5. Use actual button text, field names, error messages

EXAMPLE:
STEP 1: Page loaded → Login form with Email and Password fields
STEP 2: Clicked "Sign In" → Error: "Email is required"
STEP 3: Entered email → Field populated, error cleared`

export class VisualAgentOrchestrator {
  /** @type {any} */
  #cloudModel = null

  /** @type {Worker | null} */
  #worker = null

  /** @type {ScreenCaptureService} */
  #capture

  /** @type {ReturnType<typeof createConfirmStepTool>} */
  #confirmTool

  /** @type {Array<{ role: string, content: any }>} */
  #messages = []

  /** @type {Observation[]} */
  #observations = []

  /** @type {number} */
  #sessionStart = 0

  /** @type {boolean} */
  #isActive = false

  /** @type {boolean} */
  #modelReady = false

  /** @type {number} */
  #stepCount = 0

  /** @type {OrchestratorOptions} */
  #options

  /** @type {Object} */
  #modelConfig

  /** @type {Map<string, { resolve: Function, reject: Function, text: string }>} */
  #pendingInferences = new Map()

  /**
   * @param {OrchestratorOptions} options
   */
  constructor(options = {}) {
    this.#options = {
      maxContextTurns: 5,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      ...options
    }

    // Default to SmolVLM 256M if no model config provided
    this.#modelConfig = options.modelConfig || {
      id: 'smolvlm-256m',
      name: 'SmolVLM 256M',
      type: 'local',
      modelId: 'HuggingFaceTB/SmolVLM-256M-Instruct',
      dtype: 'q4',
      device: 'webgpu'
    }

    this.#capture = new ScreenCaptureService()
    this.#confirmTool = createConfirmStepTool({
      onConfirmRequest: (observation, question, severity) => {
        console.log('[VisualAgent] Confirmation request:', { observation, question, severity })
      }
    })
  }

  /**
   * Create worker for local models
   * @returns {Promise<Worker>}
   */
  async #createWorker() {
    return new Promise((resolve, reject) => {
      // Get the base path for the worker
      const scriptUrl = import.meta.url
      const basePath = scriptUrl.substring(0, scriptUrl.lastIndexOf('/'))
      const workerUrl = `${basePath}/vlm.worker.js`

      console.log('[VisualAgent] Creating worker from:', workerUrl)
      const worker = new Worker(workerUrl, { type: 'module' })

      const onMessage = (event) => {
        const { type, data } = event.data

        switch (type) {
          case 'worker-ready':
            console.log('[VisualAgent] Worker ready')
            worker.removeEventListener('message', onMessage)
            resolve(worker)
            break

          case 'error':
            console.error('[VisualAgent] Worker error:', data)
            worker.removeEventListener('message', onMessage)
            reject(new Error(data))
            break
        }
      }

      worker.addEventListener('message', onMessage)
      worker.addEventListener('error', (err) => {
        console.error('[VisualAgent] Worker load error:', err)
        reject(err)
      })
    })
  }

  /**
   * Initialize local model via worker
   */
  async #initLocalModel() {
    const config = this.#modelConfig

    // Create worker
    this.#worker = await this.#createWorker()

    // Set up message handler for model loading
    return new Promise((resolve, reject) => {
      const onMessage = (event) => {
        const { type, data, requestId } = event.data

        switch (type) {
          case 'loading':
            console.log('[VisualAgent] Loading progress:', data)
            if (this.#options.onLoadingProgress) {
              this.#options.onLoadingProgress({
                modelId: data.modelId || config.modelId,
                progress: data.progress || 0,
                status: data.status || 'Loading...'
              })
            }
            break

          case 'ready':
            console.log('[VisualAgent] Model ready:', data)
            this.#worker.removeEventListener('message', onMessage)
            // Set up permanent message handler
            this.#setupWorkerHandler()
            resolve()
            break

          case 'error':
            console.error('[VisualAgent] Model init error:', data)
            this.#worker.removeEventListener('message', onMessage)
            reject(new Error(data))
            break

          case 'log':
            console.log('[VisualAgent Worker]', data)
            break
        }
      }

      this.#worker.addEventListener('message', onMessage)

      // Send init message
      console.log('[VisualAgent] Sending init message:', {
        modelId: config.modelId,
        modelClass: config.modelClass,
        dtype: config.dtype,
        device: config.device
      })

      this.#worker.postMessage({
        type: 'init',
        modelId: config.modelId,
        modelClass: config.modelClass || 'AutoModelForVision2Seq',
        dtype: config.dtype || 'q4',
        device: config.device || 'webgpu'
      })
    })
  }

  /**
   * Set up permanent worker message handler for inference
   */
  #setupWorkerHandler() {
    this.#worker.addEventListener('message', (event) => {
      const { type, requestId, data } = event.data

      const pending = requestId ? this.#pendingInferences.get(requestId) : null

      switch (type) {
        case 'stream-start':
          console.log('[VisualAgent] Inference started:', requestId)
          break

        case 'token':
          if (pending) {
            pending.text += data
            if (this.#options.onObservation) {
              this.#options.onObservation(data)
            }
          }
          break

        case 'stream-end':
          if (pending) {
            console.log('[VisualAgent] Inference complete:', requestId, 'tokens:', data?.tokenCount)
            this.#pendingInferences.delete(requestId)
            pending.resolve(pending.text)
          }
          break

        case 'error':
          console.error('[VisualAgent] Inference error:', data)
          if (pending) {
            this.#pendingInferences.delete(requestId)
            pending.reject(new Error(data))
          }
          break

        case 'aborted':
          if (pending) {
            this.#pendingInferences.delete(requestId)
            pending.resolve(pending.text) // Return partial text
          }
          break
      }
    })
  }

  /**
   * Create cloud model (Gemini)
   * @returns {any}
   */
  #createCloudModel() {
    const apiKey = localStorage.getItem(GEMINI_KEY_STORAGE)
    if (!apiKey) {
      throw new Error('Gemini API key not found. Please set it in the model selection modal.')
    }
    const google = createGoogleGenerativeAI({ apiKey })
    return google(this.#modelConfig.providerId || 'gemini-2.0-flash')
  }

  /**
   * Initialize the orchestrator (preload model)
   */
  async initialize() {
    this.#setStatus('initializing')

    if (this.#modelConfig.type === 'cloud') {
      this.#cloudModel = this.#createCloudModel()
    } else {
      await this.#initLocalModel()
    }

    this.#modelReady = true
    this.#setStatus('ready')
  }

  /**
   * Check if model is ready
   * @returns {boolean}
   */
  isReady() {
    return this.#modelReady
  }

  /**
   * Start a recording session with live screen capture
   */
  async startLive() {
    await this.#startSession()
    await this.#capture.startLive()
    this.#setStatus('recording')
  }

  /**
   * Start a session with a pre-recorded file
   * @param {File} file - Video or image file
   */
  async startFromFile(file) {
    await this.#startSession()
    await this.#capture.fromFile(file)
    this.#setStatus('recording')
  }

  /**
   * Start a session with a URL
   * @param {string} url - URL to video or image
   */
  async startFromURL(url) {
    await this.#startSession()
    await this.#capture.fromURL(url)
    this.#setStatus('recording')
  }

  /**
   * Initialize session state
   */
  async #startSession() {
    if (this.#isActive) {
      await this.stop()
    }

    // Ensure model is loaded
    if (!this.#modelReady) {
      await this.initialize()
    }

    this.#messages = []
    this.#observations = []
    this.#sessionStart = Date.now()
    this.#isActive = true
    this.#stepCount = 0

    // Add system message with defensive fallback
    const systemPrompt = this.#options.systemPrompt || DEFAULT_SYSTEM_PROMPT
    if (!systemPrompt || typeof systemPrompt !== 'string') {
      throw new Error('[VisualAgent] System prompt must be a non-empty string')
    }

    console.log('[VisualAgent] Adding system message, prompt length:', systemPrompt.length)
    this.#messages.push({
      role: 'system',
      content: systemPrompt
    })
  }

  /**
   * Run inference with local worker
   * @param {Uint8Array} imageData
   * @param {string} prompt
   * @returns {Promise<string>}
   */
  async #runLocalInference(imageData, prompt) {
    const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

    return new Promise((resolve, reject) => {
      this.#pendingInferences.set(requestId, { resolve, reject, text: '' })

      this.#worker.postMessage({
        type: 'inference',
        requestId,
        imageData,
        prompt,
        maxTokens: 256
      })
    })
  }

  /**
   * Run inference with cloud model (Gemini)
   * @param {Uint8Array} imageData
   * @param {string} prompt
   * @returns {Promise<string>}
   */
  async #runCloudInference(imageData, prompt) {
    const contextMessages = this.#getContextMessages()

    // Add the new user message with image
    const userMessage = {
      role: 'user',
      content: [
        {
          type: 'image',
          image: imageData
        },
        {
          type: 'text',
          text: prompt
        }
      ]
    }

    let observationText = ''

    const result = await streamText({
      model: this.#cloudModel,
      messages: [...contextMessages, userMessage],
      tools: {
        confirmStep: this.#confirmTool
      },
      maxSteps: 3,
      onStepFinish: async ({ text }) => {
        if (text) {
          observationText += text
        }
      }
    })

    // Consume the stream
    for await (const chunk of result.textStream) {
      observationText += chunk
      if (this.#options.onObservation) {
        this.#options.onObservation(chunk)
      }
    }

    return observationText
  }

  /**
   * Trigger analysis of current screen
   * @param {string|Object} [triggerContext] - Optional context about what triggered this
   * @returns {Promise<string>} The observation text
   */
  async trigger(triggerContext = '') {
    if (!this.#isActive) {
      throw new Error('Session not active')
    }

    this.#setStatus('processing')
    this.#stepCount++

    try {
      // Capture current frame
      const frame = await this.#capture.captureFrame()

      // Format trigger context
      let contextText = ''
      if (typeof triggerContext === 'object' && triggerContext !== null) {
        // Rich element context
        const ctx = triggerContext
        contextText = `Action: ${ctx.action || 'interaction'}
Element: ${ctx.element?.tag || 'unknown'}${ctx.element?.text ? ` with text "${ctx.element.text}"` : ''}${ctx.element?.id ? ` (id: ${ctx.element.id})` : ''}
${ctx.component ? `Component: ${ctx.component}` : ''}`
      } else if (triggerContext) {
        contextText = triggerContext
      }

      // Build prompt
      let prompt
      if (contextText) {
        prompt = `STEP ${this.#stepCount} context:\n${contextText}\n\nDescribe what you observe for this step.`
      } else {
        prompt = `STEP ${this.#stepCount}: Describe the current screen state.`
      }

      // Run inference based on model type
      let observationText
      if (this.#modelConfig.type === 'cloud') {
        observationText = await this.#runCloudInference(frame.data, prompt)
      } else {
        observationText = await this.#runLocalInference(frame.data, prompt)
      }

      // Build user message for context
      const userContent = [
        { type: 'image', image: frame.data },
        { type: 'text', text: prompt }
      ]
      this.#addMessage({ role: 'user', content: userContent })

      // Record observation with step number
      const observation = {
        text: observationText,
        timestamp: Date.now(),
        trigger: triggerContext,
        confirmed: false,
        stepNumber: this.#stepCount
      }
      this.#observations.push(observation)

      // Add assistant response to context
      this.#addMessage({ role: 'assistant', content: observationText })

      this.#setStatus('recording')
      return observationText
    } catch (err) {
      this.#setStatus('error')
      if (this.#options.onError) {
        this.#options.onError(err)
      }
      throw err
    }
  }

  /**
   * Generate final QA report
   * @returns {Promise<string>}
   */
  async generateReport() {
    if (this.#observations.length === 0) {
      return 'No observations recorded.'
    }

    const sessionDuration = Date.now() - this.#sessionStart

    // Build report from observations
    const report = `# Session Report

**Duration:** ${Math.round(sessionDuration / 1000)}s
**Total Steps:** ${this.#stepCount}

## Recorded Steps

${this.#observations.map((o) => `### STEP ${o.stepNumber}${typeof o.trigger === 'object' ? `: ${o.trigger.action || 'Action'}` : (o.trigger ? `: ${o.trigger}` : '')}
- **Timestamp:** ${new Date(o.timestamp).toISOString()}
- **Details:** ${o.text}
`).join('\n')}`

    if (this.#options.onComplete) {
      this.#options.onComplete(report)
    }

    return report
  }

  /**
   * Stop the session and cleanup
   * @returns {Promise<string>} Final report
   */
  async stop() {
    const report = this.#isActive ? await this.generateReport() : ''

    await this.#capture.stop()
    this.#isActive = false
    this.#setStatus('idle')

    return report
  }

  /**
   * Terminate and cleanup all resources
   */
  terminate() {
    this.#capture.stop()

    // Terminate worker if exists
    if (this.#worker) {
      this.#worker.postMessage({ type: 'terminate' })
      this.#worker = null
    }

    this.#cloudModel = null
    this.#modelReady = false
    this.#isActive = false
    this.#messages = []
    this.#observations = []
    this.#stepCount = 0
    this.#pendingInferences.clear()
  }

  /**
   * Add message to context with pruning
   * @param {{ role: string, content: any }} message
   */
  #addMessage(message) {
    this.#messages.push(message)

    // Prune old messages (keep system + last N turns)
    const maxMessages = 1 + (this.#options.maxContextTurns * 2) // system + user/assistant pairs
    while (this.#messages.length > maxMessages) {
      // Remove oldest user/assistant pair (keep system)
      this.#messages.splice(1, 2)
    }
  }

  /**
   * Get messages for current context (without image data for old messages)
   * @returns {Array}
   */
  #getContextMessages() {
    // Only include image in the most recent user message
    return this.#messages.map((msg, idx) => {
      if (
        msg.role === 'user' &&
        Array.isArray(msg.content) &&
        idx < this.#messages.length - 1
      ) {
        // Strip image from older user messages to save context
        return {
          ...msg,
          content: msg.content
            .filter((part) => part.type !== 'image')
            .map((part) => (part.type === 'text' ? part.text : ''))
            .join(' ')
        }
      }
      return msg
    })
  }

  /**
   * Set status and notify callback
   * @param {string} status
   */
  #setStatus(status) {
    if (this.#options.onStatusChange) {
      this.#options.onStatusChange(status)
    }
  }

  /**
   * Get current session state
   */
  get isActive() {
    return this.#isActive
  }

  /**
   * Get observations
   */
  get observations() {
    return [...this.#observations]
  }

  /**
   * Get session duration in ms
   */
  get sessionDuration() {
    return this.#isActive ? Date.now() - this.#sessionStart : 0
  }

  /**
   * Get capture source type
   */
  get source() {
    return this.#capture.source
  }

  /**
   * Access to capture service for video controls
   */
  get capture() {
    return this.#capture
  }

  /**
   * Get current step count
   */
  get stepCount() {
    return this.#stepCount
  }

  /**
   * Get current model config
   */
  get modelConfig() {
    return this.#modelConfig
  }
}

export default VisualAgentOrchestrator
