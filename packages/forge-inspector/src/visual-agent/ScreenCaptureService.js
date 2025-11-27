/**
 * ScreenCaptureService - Dual input support for live capture and pre-recorded sessions
 *
 * Ephemeral storage only - frames held in memory, never persisted.
 * Auto-cleanup on stop/unmount.
 */

/**
 * @typedef {'live' | 'file' | 'url'} CaptureSource
 * @typedef {Object} CaptureFrame
 * @property {Uint8Array} data - JPEG image data
 * @property {number} timestamp - Capture timestamp
 * @property {number} width
 * @property {number} height
 */

export class ScreenCaptureService {
  /** @type {MediaStream | null} */
  #stream = null

  /** @type {HTMLVideoElement | null} */
  #video = null

  /** @type {OffscreenCanvas | null} */
  #canvas = null

  /** @type {string[]} */
  #blobUrls = []

  /** @type {CaptureSource} */
  #source = 'live'

  /** @type {boolean} */
  #isActive = false

  /**
   * Initialize live screen capture via getDisplayMedia
   * @returns {Promise<void>}
   */
  async startLive() {
    if (this.#isActive) {
      await this.stop()
    }

    try {
      /** @type {any} */
      const displayMediaOptions = {
        video: {
          cursor: 'always',
          displaySurface: 'window'
        },
        audio: false
      }
      this.#stream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions)

      this.#video = document.createElement('video')
      this.#video.srcObject = this.#stream
      this.#video.muted = true
      await this.#video.play()

      // Wait for video to be ready
      await new Promise((resolve) => {
        if (this.#video.readyState >= 2) {
          resolve()
        } else {
          this.#video.addEventListener('loadeddata', resolve, { once: true })
        }
      })

      this.#canvas = new OffscreenCanvas(
        this.#video.videoWidth,
        this.#video.videoHeight
      )

      this.#source = 'live'
      this.#isActive = true

      // Handle stream end (user stops sharing)
      this.#stream.getVideoTracks()[0].addEventListener('ended', () => {
        this.stop()
      })
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        throw new Error('Screen capture permission denied')
      }
      throw err
    }
  }

  /**
   * Load video/image from File input
   * @param {File} file - Video or image file
   * @returns {Promise<void>}
   */
  async fromFile(file) {
    if (this.#isActive) {
      await this.stop()
    }

    const blobUrl = URL.createObjectURL(file)
    this.#blobUrls.push(blobUrl)

    if (file.type.startsWith('video/')) {
      await this.#loadVideo(blobUrl)
    } else if (file.type.startsWith('image/')) {
      await this.#loadImage(blobUrl)
    } else {
      throw new Error(`Unsupported file type: ${file.type}`)
    }

    this.#source = 'file'
    this.#isActive = true
  }

  /**
   * Load video/image from URL
   * @param {string} url - URL to video or image
   * @returns {Promise<void>}
   */
  async fromURL(url) {
    if (this.#isActive) {
      await this.stop()
    }

    // Determine type from extension or content-type
    const isVideo = /\.(mp4|webm|mov|avi)$/i.test(url) || url.includes('video')

    if (isVideo) {
      await this.#loadVideo(url)
    } else {
      await this.#loadImage(url)
    }

    this.#source = 'url'
    this.#isActive = true
  }

  /**
   * Load video element
   * @param {string} src
   */
  async #loadVideo(src) {
    this.#video = document.createElement('video')
    this.#video.src = src
    this.#video.muted = true
    this.#video.crossOrigin = 'anonymous'

    await new Promise((resolve, reject) => {
      this.#video.addEventListener('loadeddata', resolve, { once: true })
      this.#video.addEventListener('error', reject, { once: true })
      this.#video.load()
    })

    this.#canvas = new OffscreenCanvas(
      this.#video.videoWidth,
      this.#video.videoHeight
    )
  }

  /**
   * Load image element
   * @param {string} src
   */
  async #loadImage(src) {
    const img = new Image()
    img.crossOrigin = 'anonymous'

    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
      img.src = src
    })

    this.#canvas = new OffscreenCanvas(img.naturalWidth, img.naturalHeight)
    const ctx = this.#canvas.getContext('2d')
    ctx.drawImage(img, 0, 0)

    // For images, we don't need video element
    this.#video = null
  }

  /**
   * Capture current frame as JPEG Uint8Array
   * @param {number} [quality=0.85] - JPEG quality (0-1)
   * @returns {Promise<CaptureFrame>}
   */
  async captureFrame(quality = 0.85) {
    if (!this.#isActive) {
      throw new Error('ScreenCaptureService not active')
    }

    if (!this.#canvas) {
      throw new Error('Canvas not initialized')
    }

    const ctx = this.#canvas.getContext('2d')

    // Draw current video frame (if video source)
    if (this.#video) {
      ctx.drawImage(this.#video, 0, 0)
    }

    // Convert to JPEG blob
    const blob = await this.#canvas.convertToBlob({
      type: 'image/jpeg',
      quality
    })

    // Convert blob to Uint8Array
    const arrayBuffer = await blob.arrayBuffer()
    const data = new Uint8Array(arrayBuffer)

    return {
      data,
      timestamp: Date.now(),
      width: this.#canvas.width,
      height: this.#canvas.height
    }
  }

  /**
   * Seek video to specific time (for pre-recorded)
   * @param {number} time - Time in seconds
   * @returns {Promise<void>}
   */
  async seek(time) {
    if (!this.#video || this.#source === 'live') {
      return
    }

    this.#video.currentTime = time
    await new Promise((resolve) => {
      this.#video.addEventListener('seeked', resolve, { once: true })
    })
  }

  /**
   * Play video (for pre-recorded)
   */
  play() {
    if (this.#video && this.#source !== 'live') {
      this.#video.play()
    }
  }

  /**
   * Pause video (for pre-recorded)
   */
  pause() {
    if (this.#video && this.#source !== 'live') {
      this.#video.pause()
    }
  }

  /**
   * Get video duration (for pre-recorded)
   * @returns {number} Duration in seconds, or 0 for live/image
   */
  get duration() {
    if (this.#video && this.#source !== 'live') {
      return this.#video.duration || 0
    }
    return 0
  }

  /**
   * Get current time (for pre-recorded)
   * @returns {number} Current time in seconds
   */
  get currentTime() {
    if (this.#video) {
      return this.#video.currentTime || 0
    }
    return 0
  }

  /**
   * Check if service is active
   * @returns {boolean}
   */
  get isActive() {
    return this.#isActive
  }

  /**
   * Get current source type
   * @returns {CaptureSource}
   */
  get source() {
    return this.#source
  }

  /**
   * Stop capture and cleanup all resources
   */
  async stop() {
    // Stop media stream tracks
    if (this.#stream) {
      this.#stream.getTracks().forEach(track => track.stop())
      this.#stream = null
    }

    // Pause and cleanup video
    if (this.#video) {
      this.#video.pause()
      this.#video.srcObject = null
      this.#video.src = ''
      this.#video = null
    }

    // Cleanup canvas
    this.#canvas = null

    // Revoke all blob URLs (ephemeral cleanup)
    this.#blobUrls.forEach(url => URL.revokeObjectURL(url))
    this.#blobUrls = []

    this.#isActive = false
  }

  /**
   * Check if WebGPU is available (for model inference)
   * @returns {boolean}
   */
  static hasWebGPU() {
    return 'gpu' in navigator
  }

  /**
   * Check if screen capture is supported
   * @returns {boolean}
   */
  static hasDisplayMedia() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia)
  }
}

export default ScreenCaptureService
