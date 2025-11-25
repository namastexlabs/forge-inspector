/**
 * @typedef {import('react-reconciler').Fiber} Fiber
 * @typedef {import('react-reconciler').Source} Source
 */

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

  // Try React 19+: __source from memoizedProps or pendingProps
  // Babel still adds __source prop, but React 19 doesn't copy it to _debugSource
  const source =
    instance.memoizedProps?.__source ||
    instance.pendingProps?.__source

  if (source) {
    const {
      columnNumber = 1,
      fileName,
      lineNumber = 1,
    } = source

    return { columnNumber, fileName, lineNumber }
  }

  return
}
