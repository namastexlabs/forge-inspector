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

  // Try React 19+: Check multiple possible locations for __source
  // Babel still adds __source prop, but React 19 stores it in different locations
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
