import { getReactInstanceForElement } from './getReactInstanceForElement'
import { getSourceForInstance } from './getSourceForInstance'

/**
 * @typedef {import('react-reconciler').Fiber} Fiber
 */

/**
 * Parse data-forge-source attribute injected by Babel plugin
 * Format: "filename:line:column"
 * @param {string} sourceAttr
 * @returns {{fileName: string, lineNumber: number, columnNumber: number} | null}
 */
function parseForgeSourceAttribute(sourceAttr) {
  if (!sourceAttr) return null

  const parts = sourceAttr.split(':')
  if (parts.length < 3) return null

  // Handle Windows paths (C:\path\to\file.tsx:10:5)
  // and Unix paths (/path/to/file.tsx:10:5)
  const columnNumber = parseInt(parts.pop(), 10)
  const lineNumber = parseInt(parts.pop(), 10)
  const fileName = parts.join(':') // Rejoin in case filename had colons

  if (isNaN(lineNumber) || isNaN(columnNumber)) return null

  return { fileName, lineNumber, columnNumber }
}

export function getSourceForElement(
  /**
   * @type {HTMLElement}
   */
  element
) {
  // 1. Check for data-forge-source attribute (injected by Babel plugin)
  // This is the most reliable method for React 19+
  const forgeSource = element.getAttribute('data-forge-source')
  if (forgeSource) {
    const parsed = parseForgeSourceAttribute(forgeSource)
    if (parsed) return parsed
  }

  // 2. Try to get source from React Fiber (React 16.8-18, some React 19 builds)
  const instance = getReactInstanceForElement(element)
  const source = getSourceForInstance(instance)

  if (source) return source

  // 3. Fallback: Check parent elements
  const fallbackSource = getFirstParentElementWithSource(element)
  return fallbackSource
}

function getFirstParentElementWithSource(element) {
  const parentElement = element.parentElement
  if (parentElement === null) {
    console.warn("Couldn't find a React instance for the element", element)
    throw new Error('No parent found for element')
  }

  const instance = getReactInstanceForElement(parentElement)
  const source = getSourceForInstance(instance)

  if (source) return source
  else return getFirstParentElementWithSource(element)
}
