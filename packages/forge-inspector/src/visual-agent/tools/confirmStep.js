/**
 * confirmStep Tool - Interactive user confirmation for visual observations
 *
 * The VLM calls this tool to verify its observations with the user.
 * The tool posts a message to the parent window and waits for a response.
 */

// CDN imports - this file runs directly in browser via /visual-agent/
// Using jsdelivr instead of esm.sh to avoid onnxruntime-web bundling issues
import { z } from 'https://cdn.jsdelivr.net/npm/zod@3/+esm'
import { tool } from 'https://cdn.jsdelivr.net/npm/ai@4/+esm'

// Message protocol constants
const MESSAGE_SOURCE = 'click-to-component'
const MESSAGE_VERSION = 1

/**
 * Schema for confirmStep tool parameters
 */
export const confirmStepSchema = z.object({
  observation: z
    .string()
    .describe('A summary of the action or state observed by the visual agent'),
  question: z
    .string()
    .describe('The confirmation question to ask the user'),
  severity: z
    .enum(['info', 'warning', 'error'])
    .optional()
    .default('info')
    .describe('Severity level of the observation')
})

/**
 * Create a confirmStep tool instance
 * @param {Object} options
 * @param {number} [options.timeout=60000] - Response timeout in ms
 * @param {(observation: string, question: string, severity: string) => void} [options.onConfirmRequest] - Callback when confirmation is requested
 * @returns {any}
 */
export function createConfirmStepTool(options = {}) {
  const { timeout = 60000, onConfirmRequest } = options

  /** @type {Map<string, { resolve: Function, reject: Function }>} */
  const pendingConfirmations = new Map()

  // Listen for confirmation responses from parent
  if (typeof window !== 'undefined') {
    window.addEventListener('message', (event) => {
      const data = event?.data
      if (
        data &&
        data.source === MESSAGE_SOURCE &&
        data.version === MESSAGE_VERSION &&
        data.type === 'confirm-step-response'
      ) {
        const { confirmationId, confirmed, note } = data.payload || {}
        const pending = pendingConfirmations.get(confirmationId)
        if (pending) {
          pendingConfirmations.delete(confirmationId)
          pending.resolve({ confirmed, note })
        }
      }
    })
  }

  return tool({
    description:
      'Ask the user to confirm an observed action or state. Use this to verify your visual observations are accurate before proceeding.',
    parameters: confirmStepSchema,

    /**
     * Execute the confirmation request
     * @param {z.infer<typeof confirmStepSchema>} params
     * @returns {Promise<{ confirmed: boolean, note?: string }>}
     */
    execute: async ({ observation, question, severity }) => {
      const confirmationId = crypto.randomUUID()

      // Notify callback if provided (for local UI handling)
      if (onConfirmRequest) {
        onConfirmRequest(observation, question, severity)
      }

      // Check if we're in an iframe
      const inIframe =
        typeof window !== 'undefined' &&
        window.parent &&
        window.parent !== window

      if (!inIframe) {
        // Not in iframe - return auto-confirm for testing
        console.log('[confirmStep] Not in iframe, auto-confirming:', {
          observation,
          question,
          severity
        })
        return { confirmed: true, note: 'Auto-confirmed (not in iframe)' }
      }

      // Post message to parent
      const message = {
        source: MESSAGE_SOURCE,
        version: MESSAGE_VERSION,
        type: 'confirm-step',
        payload: {
          confirmationId,
          observation,
          question,
          severity,
          timestamp: Date.now()
        }
      }

      try {
        window.parent.postMessage(message, '*')
      } catch (err) {
        console.warn('[confirmStep] postMessage failed:', err)
        return { confirmed: true, note: 'Auto-confirmed (postMessage failed)' }
      }

      // Wait for response with timeout
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          pendingConfirmations.delete(confirmationId)
          // On timeout, auto-confirm to not block the agent
          resolve({ confirmed: true, note: 'Auto-confirmed (timeout)' })
        }, timeout)

        pendingConfirmations.set(confirmationId, {
          resolve: (result) => {
            clearTimeout(timeoutId)
            resolve(result)
          },
          reject: (err) => {
            clearTimeout(timeoutId)
            reject(err)
          }
        })
      })
    }
  })
}

/**
 * Default confirmStep tool instance
 */
export const confirmStep = createConfirmStepTool()

export default confirmStep
