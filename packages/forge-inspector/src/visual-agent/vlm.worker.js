/**
 * VLM Web Worker - Runs transformers.js inference off main thread
 *
 * Handles model loading, inference with streaming, and abort.
 * Bridges TextStreamer callback → postMessage for SDK integration.
 */

import {
  AutoProcessor,
  AutoModelForVision2Seq,
  RawImage,
  TextStreamer,
  env
} from '@huggingface/transformers'

// Configure transformers.js
env.allowLocalModels = false
env.useBrowserCache = true

/** @type {AutoProcessor | null} */
let processor = null

/** @type {AutoModelForVision2Seq | null} */
let model = null

/** @type {string} */
let loadedModelId = ''

/** @type {Set<string>} */
const activeRequests = new Set()

/**
 * Model configurations with fallbacks
 */
const MODEL_CONFIG = {
  primary: {
    id: 'onnx-community/FastVLM-0.5B-ONNX',
    dtype: 'q4',
    device: 'webgpu'
  },
  fallbacks: [
    {
      id: 'onnx-community/Florence-2-base-ft',
      dtype: 'q4',
      device: 'webgpu'
    },
    {
      id: 'Xenova/vit-gpt2-image-captioning',
      dtype: 'fp32',
      device: 'wasm' // Fallback to CPU if WebGPU unavailable
    }
  ]
}

/**
 * Initialize model with automatic fallback
 * @param {Object} options
 * @param {string} [options.modelId] - Override model ID
 * @param {string} [options.dtype] - Override dtype
 * @param {string} [options.device] - Override device
 */
async function initModel(options = {}) {
  const configs = [MODEL_CONFIG.primary, ...MODEL_CONFIG.fallbacks]

  for (const config of configs) {
    const modelId = options.modelId || config.id
    const dtype = options.dtype || config.dtype
    const device = options.device || config.device

    // Skip WebGPU configs if not available
    if (device === 'webgpu' && !('gpu' in navigator)) {
      self.postMessage({
        type: 'log',
        data: `Skipping ${modelId} - WebGPU not available`
      })
      continue
    }

    try {
      self.postMessage({
        type: 'loading',
        data: { modelId, progress: 0 }
      })

      // Load processor
      // @ts-ignore - transformers.js types are incomplete
      processor = await AutoProcessor.from_pretrained(modelId, {
        progress_callback: (/** @type {any} */ progress) => {
          self.postMessage({
            type: 'loading',
            data: {
              modelId,
              progress: progress.progress || 0,
              status: progress.status
            }
          })
        }
      })

      // Load model
      // @ts-ignore - transformers.js types are incomplete
      model = await AutoModelForVision2Seq.from_pretrained(modelId, {
        dtype: /** @type {any} */ (dtype),
        device: /** @type {any} */ (device),
        progress_callback: (/** @type {any} */ progress) => {
          self.postMessage({
            type: 'loading',
            data: {
              modelId,
              progress: progress.progress || 0,
              status: progress.status
            }
          })
        }
      })

      loadedModelId = modelId

      self.postMessage({
        type: 'ready',
        data: { modelId, dtype, device }
      })

      return
    } catch (err) {
      self.postMessage({
        type: 'log',
        data: `Failed to load ${modelId}: ${err.message}`
      })
      // Try next fallback
    }
  }

  // All models failed
  self.postMessage({
    type: 'error',
    data: 'Failed to load any VLM model'
  })
}

/**
 * Run inference on image with streaming output
 * @param {Object} params
 * @param {string} params.requestId - Unique request identifier
 * @param {Uint8Array} params.imageData - JPEG image data
 * @param {string} params.prompt - Text prompt
 * @param {number} [params.maxTokens=256] - Max tokens to generate
 */
async function runInference({ requestId, imageData, prompt, maxTokens = 256 }) {
  if (!model || !processor) {
    self.postMessage({
      type: 'error',
      requestId,
      data: 'Model not initialized'
    })
    return
  }

  activeRequests.add(requestId)

  try {
    // Convert Uint8Array to RawImage
    const blob = new Blob([imageData], { type: 'image/jpeg' })
    const image = await RawImage.fromBlob(blob)

    // Signal stream start
    self.postMessage({ type: 'stream-start', requestId })

    let tokenCount = 0

    // Create streamer with callback bridge
    // @ts-ignore - transformers.js types are incomplete
    const streamer = new TextStreamer(processor.tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: (/** @type {string} */ text) => {
        // Check if request was aborted
        if (!activeRequests.has(requestId)) {
          return
        }

        tokenCount++
        self.postMessage({
          type: 'token',
          requestId,
          data: text
        })
      }
    })

    // Prepare inputs
    // @ts-ignore - transformers.js types are incomplete
    const inputs = await processor(image, prompt)

    // Run generation
    // @ts-ignore - transformers.js types are incomplete
    const output = await model.generate({
      ...inputs,
      max_new_tokens: maxTokens,
      streamer,
      do_sample: false
    })

    // Check if aborted
    if (!activeRequests.has(requestId)) {
      return
    }

    // Signal completion
    self.postMessage({
      type: 'stream-end',
      requestId,
      data: { tokenCount }
    })
  } catch (err) {
    if (activeRequests.has(requestId)) {
      self.postMessage({
        type: 'error',
        requestId,
        data: err.message
      })
    }
  } finally {
    activeRequests.delete(requestId)
  }
}

/**
 * Abort a running request
 * @param {string} requestId
 */
function abortRequest(requestId) {
  activeRequests.delete(requestId)
  self.postMessage({
    type: 'aborted',
    requestId
  })
}

/**
 * Message handler
 */
self.addEventListener('message', async (event) => {
  const { type, requestId, ...params } = event.data

  switch (type) {
    case 'init':
      await initModel(params)
      break

    case 'inference':
      await runInference({ requestId, ...params })
      break

    case 'abort':
      abortRequest(requestId)
      break

    case 'terminate':
      // Cleanup
      model = null
      processor = null
      activeRequests.clear()
      self.close()
      break

    default:
      self.postMessage({
        type: 'error',
        data: `Unknown message type: ${type}`
      })
  }
})

// Signal worker is ready to receive messages
self.postMessage({ type: 'worker-ready' })
