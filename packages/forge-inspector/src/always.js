// Export ForgeInspector component that always works (ignores NODE_ENV check)
// Use this for playground/demo scenarios where you want ForgeInspector in production

export { ForgeInspector } from './ForgeInspector.js'

// Re-export debug utilities
export { debugFiberSource, deepSearchForSource } from './deepSearchForSource.js'
