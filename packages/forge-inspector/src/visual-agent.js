/**
 * Visual Agent API
 *
 * Separate entry point for visual agent features that require @huggingface/transformers.
 * Import from 'forge-inspector/visual-agent' to use these features.
 *
 * Note: This module requires WebGPU or WASM support in the browser.
 */

// Visual agent core API
export {
  eyes,
  checkCapabilities,
  VisualAgentOrchestrator,
  ScreenCaptureService,
  createFastVLMProvider,
  createConfirmStepTool
} from './visual-agent/index.js'

// Parent integration utilities for apps embedding forge-inspector in iframes
export {
  createVisualAgentListener,
  useVisualAgentListener,
  VisualAgentOverlay
} from './parent-integration/index.js'
