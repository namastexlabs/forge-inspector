/**
 * Vite plugin to inject source location data for forge-inspector
 *
 * This plugin provides zero-config support for Vite users. It automatically
 * injects data-forge-source attributes to JSX elements without requiring
 * manual Babel configuration.
 *
 * Usage in vite.config.ts:
 *
 * import { forgeInspectorPlugin } from 'forge-inspector/vite-plugin'
 *
 * export default {
 *   plugins: [
 *     react(),
 *     forgeInspectorPlugin()
 *   ]
 * }
 *
 * Note: This plugin works alongside @vitejs/plugin-react, not as a replacement.
 */

/**
 * @returns {any} Vite plugin object
 */
export function forgeInspectorPlugin() {
  return {
    name: 'forge-inspector',
    enforce: 'pre', // Run before other plugins

    transform(code, id) {
      // Only process JSX/TSX files
      if (!/\.(jsx|tsx)$/.test(id)) {
        return null
      }

      // Only inject in development mode
      if (process.env.NODE_ENV === 'production') {
        return null
      }

      // Use a simple regex-based approach to inject data attributes
      // This is faster than full AST parsing and works for most cases
      const transformed = injectSourceAttributes(code, id)

      return {
        code: transformed,
        map: null // Source maps handled by @vitejs/plugin-react
      }
    }
  }
}

/**
 * Inject data-forge-source attributes using regex
 * This is a lightweight approach that doesn't require full AST parsing
 *
 * @param {string} code - Source code
 * @param {string} filename - File path
 * @returns {string} Transformed code
 */
function injectSourceAttributes(code, filename) {
  const lines = code.split('\n')
  const result = []

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex]
    const lineNumber = lineIndex + 1

    // Match JSX opening tags: <Component or <div
    // This regex finds opening tags but avoids self-closing tags and closing tags
    const jsxOpeningTagRegex = /<([A-Z][a-zA-Z0-9]*|\w+)(\s+[^>]*)?(?<!\/)\s*>/g

    let match
    let lastIndex = 0
    let modifiedLine = ''

    while ((match = jsxOpeningTagRegex.exec(line)) !== null) {
      const [fullMatch, tagName, attributes = ''] = match
      const columnNumber = match.index + 1

      // Skip if already has data-forge-source
      if (attributes.includes('data-forge-source')) {
        modifiedLine += line.slice(lastIndex, match.index + fullMatch.length)
        lastIndex = match.index + fullMatch.length
        continue
      }

      // Build the modified tag with injected attribute
      const sourceAttr = ` data-forge-source="${filename}:${lineNumber}:${columnNumber}"`

      // Insert attribute before the closing >
      const beforeClosing = fullMatch.slice(0, -1)
      const modifiedTag = beforeClosing + sourceAttr + '>'

      modifiedLine += line.slice(lastIndex, match.index) + modifiedTag
      lastIndex = match.index + fullMatch.length
    }

    // Add the rest of the line
    modifiedLine += line.slice(lastIndex)
    result.push(modifiedLine)
  }

  return result.join('\n')
}

// Default export for convenience
export default forgeInspectorPlugin
