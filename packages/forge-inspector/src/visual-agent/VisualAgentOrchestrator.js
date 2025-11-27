/**
 * VisualAgentOrchestrator - Manages the visual agent loop
 *
 * Uses Vercel AI SDK streamText with FastVLM provider and tools.
 * Handles context pruning and report generation.
 */

import { streamText, generateText } from 'ai'
import { createFastVLMProvider } from './FastVLMProvider.js'
import { createConfirmStepTool } from './tools/confirmStep.js'
import ScreenCaptureService from './ScreenCaptureService.js'

/**
 * @typedef {Object} Observation
 * @property {string} text - The observation text
 * @property {number} timestamp - When the observation was made
 * @property {string} [trigger] - What triggered this observation
 * @property {boolean} [confirmed] - Whether user confirmed this observation
 */

/**
 * @typedef {Object} OrchestratorOptions
 * @property {(text: string) => void} [onObservation] - Callback for each observation
 * @property {(report: string) => void} [onComplete] - Callback when session completes
 * @property {(error: Error) => void} [onError] - Callback for errors
 * @property {(status: string) => void} [onStatusChange] - Callback for status changes
 * @property {number} [maxContextTurns=5] - Max conversation turns to keep
 * @property {string} [systemPrompt] - Override default system prompt
 */

const DEFAULT_SYSTEM_PROMPT = `You are a visual QA agent observing a user's screen to help reproduce bugs.

Your task is to:
1. Carefully observe the current screen state
2. Describe what you see - UI elements, their states, any error messages
3. Identify the specific action the user just performed
4. Ask for confirmation using the confirmStep tool before proceeding

Be precise and factual. Focus on:
- Button/link text and states (enabled, disabled, loading)
- Form field values and validation messages
- Error messages, toasts, or alerts
- Navigation changes
- Visual anomalies that might indicate bugs

Keep observations concise but complete.`

export class VisualAgentOrchestrator {
  /** @type {ReturnType<typeof createFastVLMProvider>} */
  #provider

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

  /** @type {OrchestratorOptions} */
  #options

  /**
   * @param {OrchestratorOptions} options
   */
  constructor(options = {}) {
    this.#options = {
      maxContextTurns: 5,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      ...options
    }

    this.#provider = createFastVLMProvider()
    this.#capture = new ScreenCaptureService()
    this.#confirmTool = createConfirmStepTool({
      onConfirmRequest: (observation, question, severity) => {
        // Could trigger local UI here if needed
        console.log('[VisualAgent] Confirmation request:', { observation, question, severity })
      }
    })
  }

  /**
   * Initialize the orchestrator (preload model)
   */
  async initialize() {
    this.#setStatus('initializing')
    // @ts-ignore - Custom extension on provider
    await this.#provider.initialize()
    this.#setStatus('ready')
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
    // @ts-ignore - Custom extension on provider
    if (!this.#provider.isReady()) {
      await this.initialize()
    }

    this.#messages = []
    this.#observations = []
    this.#sessionStart = Date.now()
    this.#isActive = true

    // Add system message
    this.#messages.push({
      role: 'system',
      content: this.#options.systemPrompt
    })
  }

  /**
   * Trigger analysis of current screen
   * @param {string} [triggerContext] - Optional context about what triggered this
   * @returns {Promise<string>} The observation text
   */
  async trigger(triggerContext = '') {
    if (!this.#isActive) {
      throw new Error('Session not active')
    }

    this.#setStatus('processing')

    try {
      // Capture current frame
      const frame = await this.#capture.captureFrame()

      // Build user message with image
      /** @type {Array<{type: string, image?: Uint8Array, text?: string}>} */
      const userContent = [
        {
          type: 'image',
          image: frame.data
        }
      ]

      if (triggerContext) {
        userContent.push({
          type: 'text',
          text: `User action: ${triggerContext}\n\nDescribe what you observe and confirm with the user.`
        })
      } else {
        userContent.push({
          type: 'text',
          text: 'Describe the current screen state and any notable elements.'
        })
      }

      // Add to context (with pruning)
      this.#addMessage({ role: 'user', content: userContent })

      // Run inference with streaming
      let observationText = ''

      const result = await streamText({
        model: this.#provider,
        messages: this.#getContextMessages(),
        tools: {
          confirmStep: this.#confirmTool
        },
        maxSteps: 3, // Allow tool calls
        onStepFinish: async ({ text, toolCalls, toolResults }) => {
          if (text) {
            observationText += text
          }

          // Handle tool results
          if (toolResults) {
            for (const result of toolResults) {
              // @ts-ignore - toolResults type is complex
              if (result.toolName === 'confirmStep') {
                const observation = this.#observations[this.#observations.length - 1]
                if (observation) {
                  // @ts-ignore - toolResults type is complex
                  observation.confirmed = result.result?.confirmed
                }
              }
            }
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

      // Record observation
      const observation = {
        text: observationText,
        timestamp: Date.now(),
        trigger: triggerContext,
        confirmed: false
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

    // Build report prompt
    const reportPrompt = `Based on the observations during this session, generate a structured QA bug report.

Session duration: ${Math.round(sessionDuration / 1000)}s
Number of observations: ${this.#observations.length}

Observations:
${this.#observations.map((o, i) => `${i + 1}. [${o.confirmed ? 'CONFIRMED' : 'UNCONFIRMED'}] ${o.trigger ? `(${o.trigger}) ` : ''}${o.text}`).join('\n\n')}

Generate a concise bug reproduction report with:
1. Summary of the issue
2. Steps to reproduce
3. Expected vs actual behavior
4. Any relevant error messages observed`

    try {
      const result = await generateText({
        model: this.#provider,
        messages: [
          { role: 'system', content: 'You are a QA engineer writing bug reports.' },
          { role: 'user', content: reportPrompt }
        ]
      })

      const report = result.text

      if (this.#options.onComplete) {
        this.#options.onComplete(report)
      }

      return report
    } catch (err) {
      // If model fails, return raw observations
      const fallbackReport = `# Session Report

**Duration:** ${Math.round(sessionDuration / 1000)}s
**Observations:** ${this.#observations.length}

## Recorded Observations

${this.#observations.map((o, i) => `### ${i + 1}. ${o.trigger || 'Observation'}
- **Timestamp:** ${new Date(o.timestamp).toISOString()}
- **Confirmed:** ${o.confirmed ? 'Yes' : 'No'}
- **Details:** ${o.text}
`).join('\n')}`

      if (this.#options.onComplete) {
        this.#options.onComplete(fallbackReport)
      }

      return fallbackReport
    }
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
    // @ts-ignore - Custom extension on provider
    this.#provider.terminate()
    this.#isActive = false
    this.#messages = []
    this.#observations = []
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
}

export default VisualAgentOrchestrator
