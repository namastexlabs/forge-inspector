import { ForgeInspector as Component } from './ForgeInspector.js'

export const ForgeInspector =
  process.env.NODE_ENV === 'development' ? Component : () => null

// Re-export visual agent API for direct usage
export {
  eyes,
  checkCapabilities,
  VisualAgentOrchestrator,
  ScreenCaptureService,
  createFastVLMProvider,
  createConfirmStepTool
} from './visual-agent/index.js'
