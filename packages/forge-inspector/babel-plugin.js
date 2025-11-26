/**
 * Babel plugin to inject source location data for forge-inspector
 *
 * This plugin adds data-forge-source attributes to JSX elements containing
 * the file path, line number, and column number. This data survives React's
 * reconciliation process and provides reliable source detection in React 19+.
 *
 * Usage in babel.config.js or vite.config.ts:
 *
 * // Babel
 * {
 *   plugins: ['forge-inspector/babel-plugin']
 * }
 *
 * // Vite (with @vitejs/plugin-react)
 * import react from '@vitejs/plugin-react'
 *
 * export default {
 *   plugins: [
 *     react({
 *       babel: {
 *         plugins: ['forge-inspector/babel-plugin']
 *       }
 *     })
 *   ]
 * }
 */

module.exports = function forgeInspectorBabelPlugin({ types: t }) {
  return {
    name: 'forge-inspector',
    visitor: {
      JSXElement(path, state) {
        // Only inject in development mode
        if (process.env.NODE_ENV === 'production') {
          return
        }

        const { filename } = state.file.opts
        if (!filename) {
          return
        }

        // Skip if already has forge-inspector attribute (avoid duplicates)
        const existingAttr = path.node.openingElement.attributes.find(
          attr =>
            t.isJSXAttribute(attr) &&
            t.isJSXIdentifier(attr.name) &&
            attr.name.name === 'data-forge-source'
        )
        if (existingAttr) {
          return
        }

        // Get source location
        const { line, column } = path.node.loc?.start || {}
        if (!line || column === undefined) {
          return
        }

        // Create attribute: data-forge-source="filename:line:column"
        const sourceValue = `${filename}:${line}:${column}`
        const attribute = t.jSXAttribute(
          t.jSXIdentifier('data-forge-source'),
          t.stringLiteral(sourceValue)
        )

        // Add attribute to opening element
        path.node.openingElement.attributes.push(attribute)
      }
    }
  }
}
