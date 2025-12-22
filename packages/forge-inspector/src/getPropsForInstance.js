/**
 * @typedef {import('react-reconciler').Fiber} Fiber
 */

/**
 * Extract text content from React children (handles nested elements)
 * @param {unknown} children
 * @returns {string | null}
 */
function extractTextFromChildren(children) {
  if (typeof children === 'string') return children
  if (typeof children === 'number') return String(children)
  if (Array.isArray(children)) {
    return children.map(extractTextFromChildren).filter(Boolean).join(' ') || null
  }
  // Check for React element with children
  if (children && typeof children === 'object' && 'props' in children) {
    const element = /** @type {{ props?: { children?: unknown } }} */ (children)
    if (element.props?.children) {
      return extractTextFromChildren(element.props.children)
    }
  }
  return null
}

/**
 * Enhanced props extraction for AI debugging
 * Returns both scalar values and type indicators for non-scalar props
 * @param {Fiber} instance
 * @returns {{ values: Object<string, unknown>, types: Object<string, string> }}
 */
export function getPropsForInstance(instance) {
  /** @type {Object<string, unknown>} */
  const values = {}
  /** @type {Object<string, string>} */
  const types = {}

  if (!instance.memoizedProps) {
    return { values, types }
  }

  Object.entries(instance.memoizedProps).forEach(([key, value]) => {
    // Skip internal React props and forge-inspector attributes
    if (['key', 'ref', '__self', '__source', 'data-forge-source'].includes(key)) return
    // Skip if matches defaultProps
    if (value === instance.type?.defaultProps?.[key]) return

    const type = typeof value

    // Scalar values - include directly
    if (
      ['string', 'number', 'boolean'].includes(type) ||
      value instanceof String ||
      value instanceof Number ||
      value instanceof Boolean
    ) {
      values[key] = value
    }
    // Symbol - convert to string representation
    else if (type === 'symbol' || value instanceof Symbol) {
      values[key] = value.toString()
    }
    // Functions - note they exist (useful for knowing handlers are attached)
    else if (type === 'function') {
      types[key] = 'function'
    }
    // Arrays - note length (useful for lists/collections)
    else if (Array.isArray(value)) {
      types[key] = `array[${value.length}]`
    }
    // React elements (children) - extract text if simple
    else if (value?.$$typeof || key === 'children') {
      const text = extractTextFromChildren(value)
      if (text) {
        values[key] = text  // Show actual text content
      } else {
        types[key] = 'element'
      }
    }
    // Objects - note they exist
    else if (type === 'object' && value !== null) {
      // Try to provide more context for common object patterns
      // Use hasOwnProperty to avoid triggering Next.js 15 warnings on Promise-like objects (searchParams)
      if (Object.prototype.hasOwnProperty.call(value, 'current')) {
        types[key] = 'ref'
      } else if (Object.prototype.hasOwnProperty.call(value, 'type') && Object.prototype.hasOwnProperty.call(value, 'props')) {
        types[key] = 'element'
      } else {
        types[key] = 'object'
      }
    }
  })

  return { values, types }
}
