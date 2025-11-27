/**
 * @typedef {import('react-reconciler').Fiber} Fiber
 * @typedef {import('react-reconciler').Source} Source
 */

/**
 * Enable debug mode by setting window.__FORGE_INSPECTOR_DEBUG__ = true
 * This will log all checked locations when source is not found
 */
// @ts-ignore - __FORGE_INSPECTOR_DEBUG__ is a custom property
const DEBUG = typeof window !== 'undefined' && window.__FORGE_INSPECTOR_DEBUG__

/**
 * Parse React 19 _debugStack to extract source location
 * @param {Error | string} debugStack
 * @returns {{fileName: string, lineNumber: number, columnNumber: number} | null}
 */
function parseDebugStack(debugStack) {
  if (!debugStack) return null

  try {
    const stackTrace = typeof debugStack === 'string' ? debugStack : debugStack.stack
    if (!stackTrace) return null

    const stackLines = stackTrace.split('\n')

    for (const line of stackLines) {
      // Skip React internal frames
      if (
        line.includes('react-dom') ||
        line.includes('react_jsx') ||
        line.includes('jsx-runtime') ||
        line.includes('jsx-dev-runtime') ||
        line.includes('node_modules/.vite') ||
        line.includes('react-stack') ||
        line.includes('react_stack')
      ) {
        continue
      }

      // Match various stack trace formats:
      // Format 1: "at ComponentName (http://localhost:5175/src/path/file.tsx:line:column)"
      // Format 2: "at http://localhost:5175/src/path/file.tsx:line:column"
      // Format 3: "ComponentName@http://localhost:5175/src/path/file.tsx:line:column" (Firefox)
      const patterns = [
        /at\s+\S+\s+\(([^)]+):(\d+):(\d+)\)/, // Chrome/Edge with function name
        /at\s+(.+?):(\d+):(\d+)$/, // Chrome/Edge without function name (fixed for URLs)
        /([^@]+)@(.+?):(\d+):(\d+)$/, // Firefox
      ]

      for (const pattern of patterns) {
        const match = line.match(pattern)
        if (match) {
          // Extract path - it's the last capture group before line/column
          const fullPath = match[match.length === 4 ? 1 : 2]
          const lineNumber = match[match.length === 4 ? 2 : 3]
          const columnNumber = match[match.length === 4 ? 3 : 4]

          // Skip if this looks like a node_modules path
          if (fullPath.includes('node_modules') && !fullPath.includes('/src/')) {
            continue
          }

          // Extract just the file path (remove protocol and host)
          let fileName = fullPath.replace(/^https?:\/\/[^/]+/, '')

          // Remove query parameters and hash
          fileName = fileName.split('?')[0].split('#')[0]

          // Only return if we got a valid-looking file path
          if (fileName && (fileName.includes('.tsx') || fileName.includes('.ts') ||
                          fileName.includes('.jsx') || fileName.includes('.js'))) {
            return {
              fileName,
              lineNumber: parseInt(lineNumber, 10),
              columnNumber: parseInt(columnNumber, 10),
            }
          }
        }
      }
    }
  } catch (e) {
    // Failed to parse stack trace
    if (DEBUG) {
      console.warn('[ForgeInspector] Failed to parse _debugStack:', e)
    }
  }

  return null
}

/**
 * @param {Fiber} instance
 */
export function getSourceForInstance(instance) {
  // Try React 16.8-18: instance._debugSource
  if (instance._debugSource) {
    const {
      // It _does_ exist!
      // @ts-ignore Property 'columnNumber' does not exist on type 'Source'.ts(2339)
      columnNumber = 1,
      fileName,
      lineNumber = 1,
    } = instance._debugSource

    return { columnNumber, fileName, lineNumber }
  }

  // Try React 19: Parse _debugStack
  // @ts-ignore - _debugStack is an internal React 19 property
  if (instance._debugStack) {
    // @ts-ignore - _debugStack is an internal React 19 property
    const parsed = parseDebugStack(instance._debugStack)
    if (parsed) {
      return parsed
    }
  }

  // Fallback: Try React 19 alternative locations for __source
  // (These likely won't work, but kept for completeness)
  // @ts-ignore - _owner is an internal React property not in Fiber types
  const source =
    instance.type?.__source ||
    instance.elementType?.__source ||
    instance.memoizedProps?.__source ||
    instance.pendingProps?.__source ||
    // Check _owner which might contain the element that created this instance
    // @ts-ignore - _owner is an internal React property
    instance._owner?.memoizedProps?.__source ||
    // @ts-ignore - _owner is an internal React property
    instance._owner?.pendingProps?.__source

  if (source) {
    const {
      columnNumber = 1,
      fileName,
      lineNumber = 1,
    } = source

    return { columnNumber, fileName, lineNumber }
  }

  // Debug logging to help identify where __source might be in React 19
  if (DEBUG) {
    console.group('[ForgeInspector] Source not found')
    console.log('Fiber instance:', instance)
    console.log('Checked locations:')
    console.log('  - instance._debugSource:', instance._debugSource)
    // @ts-ignore - _debugStack is an internal React 19 property
    console.log('  - instance._debugStack:', instance._debugStack)
    // @ts-ignore - _debugStack is an internal React 19 property
    if (instance._debugStack) {
      // @ts-ignore
      const stackPreview = typeof instance._debugStack === 'string'
        // @ts-ignore
        ? instance._debugStack.split('\n').slice(0, 5).join('\n')
        // @ts-ignore
        : instance._debugStack.stack?.split('\n').slice(0, 5).join('\n')
      console.log('    Stack preview:', stackPreview)
    }
    console.log('  - instance.type?.__source:', instance.type?.__source)
    console.log('  - instance.elementType?.__source:', instance.elementType?.__source)
    console.log('  - instance.memoizedProps?.__source:', instance.memoizedProps?.__source)
    console.log('  - instance.pendingProps?.__source:', instance.pendingProps?.__source)
    // @ts-ignore - _owner is an internal React property
    console.log('  - instance._owner?.memoizedProps?.__source:', instance._owner?.memoizedProps?.__source)
    // @ts-ignore - _owner is an internal React property
    console.log('  - instance._owner?.pendingProps?.__source:', instance._owner?.pendingProps?.__source)
    console.log('Available keys on instance:', Object.keys(instance))
    console.log('instance.type:', instance.type)
    console.log('instance.elementType:', instance.elementType)
    // @ts-ignore - _owner is an internal React property
    console.log('instance._owner:', instance._owner)
    console.log('instance.memoizedProps (full):', instance.memoizedProps)
    console.log('instance.pendingProps (full):', instance.pendingProps)
    console.groupEnd()
  }

  return
}
