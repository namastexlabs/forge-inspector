import { ForgeInspector as Component } from './ForgeInspector.js'

export const ForgeInspector =
  process.env.NODE_ENV === 'development' ? Component : () => null

// Export debug utilities for React 19 troubleshooting
export { debugFiberSource, deepSearchForSource } from './deepSearchForSource.js'
