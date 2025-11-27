/**
 * FastVLMProvider - Custom Vercel AI SDK provider for local VLM inference
 *
 * Implements LanguageModelV1 interface to bridge Vercel AI SDK with
 * transformers.js running in a Web Worker.
 */

/**
 * @typedef {import('ai').LanguageModelV1} LanguageModelV1
 * @typedef {import('ai').LanguageModelV1CallOptions} LanguageModelV1CallOptions
 * @typedef {import('ai').LanguageModelV1StreamPart} LanguageModelV1StreamPart
 */

/**
 * Create a FastVLM provider for Vercel AI SDK
 * @param {Object} options
 * @param {string} [options.modelId] - Override default model
 * @returns {LanguageModelV1}
 */
export function createFastVLMProvider(options = {}) {
  /** @type {Worker | null} */
  let worker = null

  /** @type {boolean} */
  let isReady = false

  /** @type {Promise<void> | null} */
  let initPromise = null

  /**
   * Initialize the worker and model
   */
  async function ensureInitialized() {
    if (isReady && worker) {
      return
    }

    if (initPromise) {
      return initPromise
    }

    initPromise = new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Model initialization timeout (60s)'))
      }, 60000)

      // Create worker with module type for ESM imports
      worker = new Worker(
        new URL('./vlm.worker.js', import.meta.url),
        { type: 'module' }
      )

      const handleMessage = (event) => {
        const { type, data } = event.data

        if (type === 'worker-ready') {
          // Worker loaded, now init model
          worker.postMessage({
            type: 'init',
            modelId: options.modelId
          })
        } else if (type === 'ready') {
          clearTimeout(timeoutId)
          isReady = true
          worker.removeEventListener('message', handleMessage)
          resolve()
        } else if (type === 'error' && !isReady) {
          clearTimeout(timeoutId)
          reject(new Error(data))
        } else if (type === 'loading') {
          // Progress callback - could emit events here
          console.log(`[FastVLM] Loading: ${data.status} ${Math.round(data.progress)}%`)
        }
      }

      worker.addEventListener('message', handleMessage)
      worker.addEventListener('error', (err) => {
        clearTimeout(timeoutId)
        reject(err)
      })
    })

    return initPromise
  }

  /**
   * Extract image data from prompt messages
   * @param {Array} messages
   * @returns {Uint8Array | null}
   */
  function extractImageFromPrompt(messages) {
    for (const message of messages) {
      if (message.role === 'user' && Array.isArray(message.content)) {
        for (const part of message.content) {
          if (part.type === 'image') {
            // Handle Uint8Array directly
            if (part.image instanceof Uint8Array) {
              return part.image
            }

            // Handle ArrayBuffer
            if (part.image instanceof ArrayBuffer) {
              return new Uint8Array(part.image)
            }

            // Handle base64 string (data URL or raw base64)
            if (typeof part.image === 'string') {
              let base64 = part.image

              // Remove data URL prefix if present
              if (base64.startsWith('data:')) {
                base64 = base64.split(',')[1]
              }

              // Decode base64
              const binary = atob(base64)
              const bytes = new Uint8Array(binary.length)
              for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i)
              }
              return bytes
            }
          }
        }
      }
    }
    return null
  }

  /**
   * Extract text prompt from messages
   * @param {Array} messages
   * @returns {string}
   */
  function extractTextFromPrompt(messages) {
    const texts = []

    for (const message of messages) {
      if (message.role === 'system') {
        texts.push(message.content)
      } else if (message.role === 'user') {
        if (typeof message.content === 'string') {
          texts.push(message.content)
        } else if (Array.isArray(message.content)) {
          for (const part of message.content) {
            if (part.type === 'text') {
              texts.push(part.text)
            }
          }
        }
      } else if (message.role === 'assistant') {
        // Include assistant messages for context
        if (typeof message.content === 'string') {
          texts.push(`Assistant: ${message.content}`)
        }
      }
    }

    return texts.join('\n')
  }

  /** @type {LanguageModelV1} */
  const provider = {
    specificationVersion: 'v1',
    provider: 'fastvlm',
    modelId: options.modelId || 'fastvlm-0.5b',
    defaultObjectGenerationMode: undefined,

    /**
     * Generate text (non-streaming)
     * @param {LanguageModelV1CallOptions} options
     */
    async doGenerate(options) {
      await ensureInitialized()

      const { prompt } = options
      const imageData = extractImageFromPrompt(prompt)
      const textPrompt = extractTextFromPrompt(prompt)

      if (!imageData) {
        throw new Error('No image found in prompt')
      }

      const requestId = crypto.randomUUID()

      return new Promise((resolve, reject) => {
        let fullText = ''
        let tokenCount = 0

        const handleMessage = (event) => {
          const { type, requestId: msgId, data } = event.data
          if (msgId !== requestId) return

          switch (type) {
            case 'token':
              fullText += data
              tokenCount++
              break

            case 'stream-end':
              worker.removeEventListener('message', handleMessage)
              resolve({
                text: fullText,
                finishReason: 'stop',
                usage: {
                  promptTokens: 0, // Not tracked by local model
                  completionTokens: tokenCount
                },
                rawCall: { rawPrompt: textPrompt, rawSettings: {} },
                rawResponse: { headers: {} }
              })
              break

            case 'error':
              worker.removeEventListener('message', handleMessage)
              reject(new Error(data))
              break
          }
        }

        worker.addEventListener('message', handleMessage)

        // Send inference request with image as Transferable
        const imageBuffer = imageData.buffer.slice(0)
        worker.postMessage(
          {
            type: 'inference',
            requestId,
            imageData: new Uint8Array(imageBuffer),
            prompt: textPrompt
          },
          [imageBuffer]
        )
      })
    },

    /**
     * Stream text generation
     * @param {LanguageModelV1CallOptions} options
     */
    async doStream(options) {
      await ensureInitialized()

      const { prompt, abortSignal } = options
      const imageData = extractImageFromPrompt(prompt)
      const textPrompt = extractTextFromPrompt(prompt)

      if (!imageData) {
        throw new Error('No image found in prompt')
      }

      const requestId = crypto.randomUUID()

      /** @type {ReadableStreamDefaultController<LanguageModelV1StreamPart>} */
      let controller

      const stream = new ReadableStream({
        start(c) {
          controller = c
        }
      })

      let tokenCount = 0

      // Worker message handler
      const handleMessage = (event) => {
        const { type, requestId: msgId, data } = event.data
        if (msgId !== requestId) return

        switch (type) {
          case 'stream-start':
            // No explicit start chunk needed for V1
            break

          case 'token':
            tokenCount++
            controller.enqueue({
              type: 'text-delta',
              textDelta: data
            })
            break

          case 'stream-end':
            controller.enqueue({
              type: 'finish',
              finishReason: 'stop',
              usage: {
                promptTokens: 0,
                completionTokens: tokenCount
              }
            })
            controller.close()
            worker.removeEventListener('message', handleMessage)
            break

          case 'error':
            controller.error(new Error(data))
            worker.removeEventListener('message', handleMessage)
            break

          case 'aborted':
            controller.close()
            worker.removeEventListener('message', handleMessage)
            break
        }
      }

      worker.addEventListener('message', handleMessage)

      // Handle abort signal
      if (abortSignal) {
        abortSignal.addEventListener('abort', () => {
          worker.postMessage({ type: 'abort', requestId })
          worker.removeEventListener('message', handleMessage)
        })
      }

      // Send inference request with image as Transferable
      const imageBuffer = imageData.buffer.slice(0)
      worker.postMessage(
        {
          type: 'inference',
          requestId,
          imageData: new Uint8Array(imageBuffer),
          prompt: textPrompt
        },
        [imageBuffer]
      )

      return {
        stream,
        rawCall: { rawPrompt: textPrompt, rawSettings: {} },
        rawResponse: { headers: {} }
      }
    }
  }

  // Attach custom methods (not part of LanguageModelV1)
  // @ts-ignore - Custom extension to LanguageModelV1
  provider.terminate = () => {
    if (worker) {
      worker.postMessage({ type: 'terminate' })
      worker = null
      isReady = false
      initPromise = null
    }
  }

  // @ts-ignore - Custom extension to LanguageModelV1
  provider.isReady = () => isReady

  // @ts-ignore - Custom extension to LanguageModelV1
  provider.initialize = ensureInitialized

  return provider
}

export default createFastVLMProvider
