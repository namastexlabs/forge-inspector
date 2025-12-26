/**
 * VLM Web Worker - Runs transformers.js inference off main thread
 *
 * Handles model loading, inference with streaming, and abort.
 * Bridges TextStreamer callback → postMessage for SDK integration.
 */

// CDN import - this file runs directly in browser, not through bundler
import {
  AutoProcessor,
  AutoModelForVision2Seq,
  AutoModelForImageTextToText,
  AutoTokenizer,
  RawImage,
  TextStreamer,
  env
} from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3/dist/transformers.min.js'

// Configure transformers.js for browser/worker environment
env.allowLocalModels = false
env.useBrowserCache = true
env.useFSCache = false  // Disable FS cache - causes "illegal path" error in browser
env.cacheDir = null     // Completely disable cache path resolution

/** @type {AutoProcessor | null} */
let processor = null

/** @type {any} */
let tokenizer = null

/** @type {AutoModelForVision2Seq | null} */
let model = null

/** @type {string} */
let loadedModelId = ''

/** @type {Set<string>} */
const activeRequests = new Set()

/**
 * Model configuration - Florence-2 only
 */
const MODEL_CONFIG = {
  primary: {
    id: 'onnx-community/Florence-2-large-ft',
    dtype: {
      vision_encoder: 'fp16',
      encoder_model: 'q4',
      decoder_model_merged: 'q4'
    },
    device: 'webgpu',
    modelClass: 'AutoModelForImageTextToText'
  }
}

/**
 * Calculate normalized progress and status from transformers.js progress object
 * Handles cases where content-length is unknown (progress.progress undefined)
 * @param {any} progress - Progress object from transformers.js
 * @param {string} modelId - Model ID for status messages
 * @param {string} fallbackStatus - Default status if none available
 * @returns {{progress: number, status: string, indeterminate: boolean}}
 */
function calculateProgress(progress, modelId, fallbackStatus = 'Loading...') {
  // Calculate normalized progress (0-1)
  let normalizedProgress = 0
  let indeterminate = true

  if (progress.progress !== undefined && progress.progress !== null && !isNaN(progress.progress)) {
    // transformers.js sends 0-100 when content-length is known
    normalizedProgress = progress.progress / 100
    indeterminate = false
  } else if (progress.loaded && progress.total) {
    // Calculate from bytes if available
    normalizedProgress = progress.loaded / progress.total
    indeterminate = false
  }

  // Clamp to 0-1 range
  normalizedProgress = Math.max(0, Math.min(1, normalizedProgress))

  // Build better status text
  let status = fallbackStatus
  if (progress.status === 'done') {
    status = 'Ready'
    normalizedProgress = 1
    indeterminate = false
  } else if (progress.file) {
    const fileName = progress.file.split('/').pop()
    if (progress.loaded) {
      const mb = (progress.loaded / 1024 / 1024).toFixed(1)
      status = `${fileName} (${mb} MB)`
    } else if (progress.status === 'initiate') {
      status = `Starting ${fileName}...`
    } else {
      status = `Loading ${fileName}...`
    }
  } else if (progress.status) {
    status = progress.status
  }

  return { progress: normalizedProgress, status, indeterminate }
}

/**
 * Initialize model
 * @param {Object} options
 * @param {string} [options.modelId] - Override model ID
 * @param {string} [options.dtype] - Override dtype
 * @param {string} [options.device] - Override device
 */
async function initModel(options = {}) {
  // Use user config or default to Florence-2
  const config = options.modelId ? {
    id: options.modelId,
    dtype: options.dtype || 'q4',
    device: options.device || 'webgpu',
    modelClass: options.modelClass || 'AutoModelForVision2Seq'
  } : MODEL_CONFIG.primary

  const modelId = config.id
  const dtype = config.dtype
  const device = config.device
  const modelClass = config.modelClass || 'AutoModelForVision2Seq'

  // Check WebGPU availability
  if (device === 'webgpu' && !('gpu' in navigator)) {
    self.postMessage({
      type: 'error',
      data: `WebGPU not available - cannot load ${modelId}`
    })
    return
  }

  try {
    self.postMessage({
      type: 'loading',
      data: { modelId, progress: 0, status: `Loading ${modelId.split('/').pop()} (${device})...` }
    })

    self.postMessage({
      type: 'log',
      data: `[Worker] Attempting to load ${modelId} with dtype=${JSON.stringify(dtype)}, device=${device}`
    })

    // Load processor
    // @ts-ignore - transformers.js types are incomplete
    processor = await AutoProcessor.from_pretrained(modelId, {
      progress_callback: (/** @type {any} */ progress) => {
        const calc = calculateProgress(progress, modelId, 'Loading processor...')
        self.postMessage({
          type: 'loading',
          data: {
            modelId,
            progress: calc.progress,
            status: calc.status,
            indeterminate: calc.indeterminate
          }
        })
      }
    })

    // Load tokenizer
    // @ts-ignore - transformers.js types are incomplete
    tokenizer = await AutoTokenizer.from_pretrained(modelId, {
      progress_callback: (/** @type {any} */ progress) => {
        const calc = calculateProgress(progress, modelId, 'Loading tokenizer...')
        self.postMessage({
          type: 'loading',
          data: {
            modelId,
            progress: calc.progress,
            status: calc.status,
            indeterminate: calc.indeterminate
          }
        })
      }
    })

    // Load model with correct class
    const ModelClass = modelClass === 'AutoModelForImageTextToText'
      ? AutoModelForImageTextToText
      : AutoModelForVision2Seq

    self.postMessage({
      type: 'log',
      data: `[Worker] Using ${modelClass} for ${modelId}`
    })

    const modelOptions = {
      device: /** @type {any} */ (device),
      progress_callback: (/** @type {any} */ progress) => {
        const calc = calculateProgress(progress, modelId, 'Loading model...')
        self.postMessage({
          type: 'loading',
          data: {
            modelId,
            progress: calc.progress,
            status: calc.status,
            indeterminate: calc.indeterminate
          }
        })
      }
    }

    if (dtype) {
      modelOptions.dtype = /** @type {any} */ (dtype)
    }

    // @ts-ignore - transformers.js types are incomplete
    model = await ModelClass.from_pretrained(modelId, modelOptions)

    loadedModelId = modelId

    self.postMessage({
      type: 'ready',
      data: { modelId, dtype, device }
    })
  } catch (err) {
    // Better error message parsing for numeric error codes (OOM, WebGPU errors)
    let errorMsg = 'Unknown error'
    if (err instanceof Error) {
      errorMsg = err.message || err.stack || String(err)
    } else if (typeof err === 'number') {
      // OOM or WebGPU error codes from ONNX runtime
      errorMsg = `WebGPU/ONNX error code: ${err} (likely out of memory - try a smaller model)`
    } else {
      errorMsg = String(err)
    }

    self.postMessage({
      type: 'error',
      data: `Failed to load ${modelId}: ${errorMsg}`
    })
    console.error(`[Worker] Model load error:`, err)
  }
}

/**
 * Run inference on image with streaming output
 * @param {Object} params
 * @param {string} params.requestId - Unique request identifier
 * @param {Uint8Array} params.imageData - JPEG image data
 * @param {string} params.prompt - Text prompt (ignored for Florence-2)
 * @param {number} [params.maxTokens=64] - Max tokens to generate
 */
async function runInference({ requestId, imageData, prompt, maxTokens = 64 }) {
  if (!model || !processor) {
    self.postMessage({
      type: 'error',
      requestId,
      data: 'Model not initialized'
    })
    return
  }

  activeRequests.add(requestId)

  // Check if this is Florence-2 (task-based model)
  const isFlorence = loadedModelId.toLowerCase().includes('florence')

  try {
    // Convert Uint8Array to RawImage
    const blob = new Blob([imageData], { type: 'image/jpeg' })
    const image = await RawImage.fromBlob(blob)

    // Signal stream start
    self.postMessage({ type: 'stream-start', requestId })

    let tokenCount = 0

    // Create streamer with callback bridge
    // @ts-ignore - transformers.js types are incomplete
    const streamer = new TextStreamer(tokenizer, {
      skip_prompt: true,
      skip_special_tokens: false,
      callback_function: (/** @type {string} */ text) => {
        // Check if request was aborted
        if (!activeRequests.has(requestId)) {
          return
        }

        tokenCount++

        // For Florence-2, strip task tokens before sending
        let cleanText = text
        if (isFlorence) {
          cleanText = text.replace(/<[^>]+>/g, '')
        }

        if (cleanText) {
          self.postMessage({
            type: 'token',
            requestId,
            data: cleanText
          })
        }
      }
    })

    // Prepare inputs based on model type
    // @ts-ignore - transformers.js types are incomplete
    let inputs
    if (isFlorence) {
      // Florence-2 uses task tokens, not free-form prompts
      const task = '<MORE_DETAILED_CAPTION>'
      inputs = await processor(image, task)
    } else {
      // Other models use regular prompts
      inputs = await processor(image, prompt)
    }

    // Run generation
    const generateOptions = {
      ...inputs,
      max_new_tokens: maxTokens,
      streamer,
      do_sample: false
    }

    // @ts-ignore - transformers.js types are incomplete
    await model.generate(generateOptions)

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
      tokenizer = null
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
