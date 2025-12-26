/**
 * Capabilities check - lightweight module for checking WebGPU/DisplayMedia
 *
 * This file is kept separate from the main visual agent to avoid
 * importing the AI SDK and transformers.js during capability checks.
 */

import { ScreenCaptureService } from './ScreenCaptureService.js'

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

export default checkCapabilities
