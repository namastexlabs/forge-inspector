# forge-inspector Plugin Usage Guide

## React 19 Support

forge-inspector now supports React 19 through **build-time plugins** that inject source location data. These plugins provide 100% reliable source detection that works across all React versions.

## Why Plugins are Needed

React 19 removed the `_debugSource` property that previous versions used to store source location information. To work around this, forge-inspector provides plugins that inject source location data directly into your JSX elements as `data-forge-source` attributes.

**Benefits:**
- ✅ Works with React 16.8 through React 19+
- ✅ 100% reliable source detection
- ✅ No dependency on React internals
- ✅ Industry-standard approach (used by LocatorJS, react-source-lens, etc.)

## Quick Start

### Option 1: Vite Plugin (Recommended for Vite users)

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { forgeInspectorPlugin } from 'forge-inspector/vite-plugin'

export default defineConfig({
  plugins: [
    react(),
    forgeInspectorPlugin() // Add this line
  ]
})
```

**That's it!** The Vite plugin automatically injects source data in development mode.

### Option 2: Babel Plugin (For all other setups)

#### With Vite (alternative to Vite plugin)

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: ['forge-inspector/babel-plugin']
      }
    })
  ]
})
```

#### With Next.js

```javascript
// next.config.js
module.exports = {
  // ... other config

  // For Next.js 13+ (app directory)
  experimental: {
    swcPlugins: [
      // Note: Babel plugin won't work with SWC
      // Use the Babel-based approach instead
    ]
  },

  // Or use Babel (Next.js 12 and below)
  webpack: (config) => {
    config.module.rules.push({
      test: /\.(jsx|tsx)$/,
      use: [
        {
          loader: 'babel-loader',
          options: {
            plugins: ['forge-inspector/babel-plugin']
          }
        }
      ]
    })
    return config
  }
}
```

**For Next.js 13+**, you'll need to disable SWC and use Babel:

```javascript
// next.config.js
module.exports = {
  // Disable SWC, use Babel instead
  swcMinify: false,

  babel: {
    plugins: ['forge-inspector/babel-plugin']
  }
}
```

#### With Create React App

1. Eject CRA or use `react-app-rewired`:

```bash
npm install react-app-rewired --save-dev
```

2. Create `config-overrides.js`:

```javascript
// config-overrides.js
module.exports = function override(config) {
  // Find the babel-loader
  const babelLoader = config.module.rules
    .find(rule => rule.oneOf)
    .oneOf.find(rule => rule.loader && rule.loader.includes('babel-loader'))

  if (babelLoader) {
    babelLoader.options.plugins = [
      ...(babelLoader.options.plugins || []),
      'forge-inspector/babel-plugin'
    ]
  }

  return config
}
```

3. Update `package.json` scripts:

```json
{
  "scripts": {
    "start": "react-app-rewired start",
    "build": "react-app-rewired build"
  }
}
```

#### With Standalone Babel

```javascript
// babel.config.js
module.exports = {
  plugins: [
    'forge-inspector/babel-plugin',
    // ... other plugins
  ]
}
```

Or `.babelrc`:

```json
{
  "plugins": ["forge-inspector/babel-plugin"]
}
```

## Fallback Detection

Even **without** the plugins, forge-inspector still works with:
- ✅ React 16.8 - 18 (via `_debugSource`)
- ⚠️ React 19 (limited - tries `_debugStack` if available)

However, for **100% reliable React 19 support**, use one of the plugins above.

## How It Works

### With Plugin

1. **Build time**: Plugin injects `data-forge-source` attributes:
   ```html
   <button data-forge-source="/src/App.tsx:42:10">Click me</button>
   ```

2. **Runtime**: forge-inspector reads the attribute:
   ```javascript
   element.getAttribute('data-forge-source') // "/src/App.tsx:42:10"
   ```

3. **Result**: 100% accurate source location, works with all React versions

### Without Plugin (Fallback)

1. **React 16.8-18**: Uses `fiber._debugSource` ✅
2. **React 19**: Tries `fiber._debugStack` (if available) ⚠️
3. **Fallback**: Checks multiple Fiber properties ⚠️

## Performance Impact

**Development**: Negligible (~0.01ms per component)
**Production**: Zero (plugins only run in `NODE_ENV=development`)

The `data-forge-source` attributes are automatically stripped in production builds.

## Troubleshooting

### Plugin Not Working?

1. **Check NODE_ENV**:
   ```javascript
   console.log(process.env.NODE_ENV) // Should be "development"
   ```

2. **Verify attribute injection**:
   ```javascript
   // In browser console:
   document.querySelector('button').getAttribute('data-forge-source')
   // Should show: "/src/App.tsx:42:10"
   ```

3. **Check plugin is loaded**:
   - Vite: Plugin appears in `vite.config.ts` plugins array
   - Babel: Plugin appears in Babel config

### Still Showing "Unknown (no source)"?

Enable debug mode:
```javascript
window.__FORGE_INSPECTOR_DEBUG__ = true
```

Then Alt+Click on a component. Check console logs to see what's being detected.

### Using SWC Instead of Babel?

**SWC doesn't support Babel plugins!** You have two options:

1. **Switch to Babel** (recommended for forge-inspector):
   ```typescript
   // vite.config.ts
   import react from '@vitejs/plugin-react' // NOT -swc

   export default defineConfig({
     plugins: [
       react({ // Babel-based
         babel: {
           plugins: ['forge-inspector/babel-plugin']
         }
       })
     ]
   })
   ```

2. **Use Vite Plugin** (works with SWC):
   ```typescript
   import react from '@vitejs/plugin-react-swc' // SWC is OK here
   import { forgeInspectorPlugin } from 'forge-inspector/vite-plugin'

   export default defineConfig({
     plugins: [
       react(),
       forgeInspectorPlugin() // This runs separately from SWC
     ]
   })
   ```

## Examples

### Minimal Vite Setup

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { forgeInspectorPlugin } from 'forge-inspector/vite-plugin'

export default defineConfig({
  plugins: [react(), forgeInspectorPlugin()]
})
```

```jsx
// src/App.tsx
import { ForgeInspector } from 'forge-inspector'

function App() {
  return (
    <>
      <ForgeInspector />
      <button>Click me</button> {/* Alt+Click → Opens in editor! */}
    </>
  )
}
```

### Minimal Next.js Setup

```javascript
// next.config.js
module.exports = {
  swcMinify: false, // Use Babel instead
  babel: {
    plugins: ['forge-inspector/babel-plugin']
  }
}
```

```jsx
// pages/index.tsx
import { ForgeInspector } from 'forge-inspector'

export default function Home() {
  return (
    <>
      <ForgeInspector />
      <div>Hello World</div> {/* Alt+Click → Opens in editor! */}
    </>
  )
}
```

## Migration from v0.0.6

If you were using forge-inspector v0.0.6 or earlier:

1. **React 16.8-18 users**: No changes needed! Everything works as before.

2. **React 19 users**: Add one of the plugins above for reliable detection.

3. **Update**:
   ```bash
   pnpm update forge-inspector
   ```

That's it! The plugins are optional but highly recommended for React 19.

## FAQ

**Q: Do I need the plugin for React 18?**
A: No, but it still works and provides more reliable detection.

**Q: Will this work in production?**
A: The plugins only run in development mode. Production builds are unaffected.

**Q: Does this slow down my build?**
A: No measurable impact. The plugins are very lightweight.

**Q: Can I use this with TypeScript?**
A: Yes! Works with `.tsx` files out of the box.

**Q: What about Vue/Svelte?**
A: These plugins are React-specific. Vue/Svelte support is separate.

## Support

- GitHub Issues: https://github.com/namastexlabs/forge-inspector/issues
- Documentation: See README.md
- Debug mode: `window.__FORGE_INSPECTOR_DEBUG__ = true`

---

**Version**: forge-inspector 0.0.8+
**Last Updated**: 2025-11-26
**Status**: Production Ready ✅
