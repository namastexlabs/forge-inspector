/**
 * Deep search utility to find __source in React 19 Fiber nodes
 * This is a debug utility to help identify where React 19 stores source information
 *
 * Usage:
 *   import { deepSearchForSource } from './deepSearchForSource.js'
 *   const result = deepSearchForSource(fiberNode)
 *   console.log(result)
 */

/**
 * Recursively search an object for __source properties
 * @param {any} obj - Object to search
 * @param {string} path - Current path (for debugging)
 * @param {Set<any>} visited - Visited objects (to avoid circular references)
 * @param {number} maxDepth - Maximum recursion depth
 * @param {number} currentDepth - Current recursion depth
 * @returns {Array<{path: string, value: any}>}
 */
function searchObject(obj, path = 'root', visited = new Set(), maxDepth = 5, currentDepth = 0) {
  const results = []

  // Prevent circular references and excessive depth
  if (!obj || visited.has(obj) || currentDepth >= maxDepth) {
    return results
  }

  visited.add(obj)

  // Check if this object is a valid object or array
  if (typeof obj !== 'object') {
    return results
  }

  try {
    // Check all enumerable properties
    for (const key in obj) {
      try {
        const value = obj[key]
        const currentPath = `${path}.${key}`

        // Found __source!
        if (key === '__source' && value && typeof value === 'object') {
          results.push({
            path: currentPath,
            value: value,
            fileName: value.fileName,
            lineNumber: value.lineNumber,
            columnNumber: value.columnNumber
          })
        }

        // Recursively search nested objects
        if (value && typeof value === 'object') {
          const nestedResults = searchObject(value, currentPath, visited, maxDepth, currentDepth + 1)
          results.push(...nestedResults)
        }
      } catch (e) {
        // Skip properties that throw errors when accessed
      }
    }

    // Also check non-enumerable properties that might be relevant
    try {
      const ownProps = Object.getOwnPropertyNames(obj)
      for (const key of ownProps) {
        if (key === '__source') {
          try {
            const value = obj[key]
            if (value && typeof value === 'object') {
              results.push({
                path: `${path}.${key}`,
                value: value,
                fileName: value.fileName,
                lineNumber: value.lineNumber,
                columnNumber: value.columnNumber
              })
            }
          } catch (e) {
            // Skip
          }
        }
      }
    } catch (e) {
      // Skip
    }
  } catch (e) {
    // Skip objects that can't be enumerated
  }

  return results
}

/**
 * Deep search for __source in a Fiber node
 * @param {import('react-reconciler').Fiber} fiberNode
 * @returns {{found: Array, summary: object}}
 */
export function deepSearchForSource(fiberNode) {
  if (!fiberNode) {
    return {
      found: [],
      summary: {
        error: 'No fiber node provided'
      }
    }
  }

  const found = searchObject(fiberNode, 'fiber', new Set(), 5, 0)

  const summary = {
    totalFound: found.length,
    locations: found.map(f => f.path),
    fiberTag: fiberNode.tag,
    fiberType: typeof fiberNode.type === 'function' ? fiberNode.type.name : fiberNode.type,
    hasDebugSource: !!fiberNode._debugSource,
    // @ts-ignore - _debugStack is an internal React 19 property
    hasDebugStack: !!fiberNode._debugStack,
    hasDebugOwner: !!fiberNode._debugOwner,
    hasMemoizedProps: !!fiberNode.memoizedProps,
    hasPendingProps: !!fiberNode.pendingProps,
    hasElementType: !!fiberNode.elementType,
    hasType: !!fiberNode.type,
    // @ts-ignore - _owner is an internal React property
    hasOwner: !!fiberNode._owner,
    hasReturn: !!fiberNode.return
  }

  return {
    found,
    summary
  }
}

/**
 * Find and log all __source locations in a Fiber tree
 * @param {HTMLElement} element - DOM element to start from
 */
export function debugFiberSource(element) {
  console.group('🔍 Deep Source Search')

  // Get React instance
  const keys = Object.keys(element || {})
  const reactKey = keys.find(k => k.startsWith('__react'))

  if (!reactKey) {
    console.error('No React fiber found on element')
    console.groupEnd()
    return null
  }

  const fiber = element[reactKey]
  console.log('Found fiber:', fiber)

  // Deep search current fiber
  const result = deepSearchForSource(fiber)
  console.log('Search result:', result)

  if (result.found.length > 0) {
    console.log('✅ __source found at:')
    result.found.forEach(({ path, fileName, lineNumber, columnNumber }) => {
      console.log(`  ${path}`)
      console.log(`    → ${fileName}:${lineNumber}:${columnNumber}`)
    })
  } else {
    console.log('❌ No __source found in fiber node')
    console.log('Summary:', result.summary)
  }

  // Also check parent fibers
  let parent = fiber.return
  let depth = 0
  console.log('\nChecking parent fibers...')

  while (parent && depth < 10) {
    const parentResult = deepSearchForSource(parent)
    if (parentResult.found.length > 0) {
      console.log(`✅ __source found in parent ${depth}:`)
      parentResult.found.forEach(({ path, fileName, lineNumber, columnNumber }) => {
        console.log(`  ${path}`)
        console.log(`    → ${fileName}:${lineNumber}:${columnNumber}`)
      })
      break
    }
    parent = parent.return
    depth++
  }

  console.groupEnd()
  return result
}

// Make it available globally for browser console debugging
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.__debugFiberSource = debugFiberSource
  // @ts-ignore
  window.__deepSearchForSource = deepSearchForSource
}
