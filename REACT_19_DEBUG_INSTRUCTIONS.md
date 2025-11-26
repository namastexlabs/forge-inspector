# React 19 Debugging Instructions for forge-inspector

## Updated Changes in v0.0.7+

We've enhanced `forge-inspector` to support React 19 by checking multiple locations where `__source` metadata might be stored:

### Checked Locations (in order):
1. `instance._debugSource` (React 16.8-18)
2. `instance.type.__source` (React 19 - component type)
3. `instance.elementType.__source` (React 19 - element type)
4. `instance.memoizedProps.__source` (React 19 - memoized props)
5. `instance.pendingProps.__source` (React 19 - pending props)

## How to Enable Debug Mode

If you're still seeing "Unknown (no source)" after updating to v0.0.7+, enable debug mode to see exactly where forge-inspector is looking for `__source`:

### Step 1: Enable Debug Logging

In your browser console, run:
```javascript
window.__FORGE_INSPECTOR_DEBUG__ = true
```

### Step 2: Click on a Component

Click on any component in your app. You should now see detailed console logs showing:
- The Fiber instance structure
- All checked locations for `__source`
- Available keys on the Fiber instance
- The `type` and `elementType` properties

### Step 3: Analyze the Output

Look for the debug output in the console:
```
[ForgeInspector] Source not found
  Fiber instance: {tag: 5, type: ƒ, ...}
  Checked locations:
    - instance._debugSource: undefined
    - instance.type?.__source: undefined
    - instance.elementType?.__source: undefined
    - instance.memoizedProps?.__source: undefined
    - instance.pendingProps?.__source: undefined
  Available keys on instance: [...array of keys...]
  instance.type: ƒ Button()
  instance.elementType: ƒ Button()
```

### Step 4: Look for __source

In the logged `Fiber instance` object, manually expand it in the console and search for any properties containing `__source` or `source`. It might be nested in:
- A different property we're not checking yet
- A parent/child Fiber node
- The return value of a function

## Verify Babel is Adding __source

To confirm Babel is correctly adding `__source` to your JSX elements:

### Method 1: Check Compiled Output
```javascript
// In your browser console, inspect the compiled code
const el = document.querySelector('button, div, span');
const keys = Object.keys(el || {});
const reactKey = keys.find(k => k.startsWith('__react'));
const fiber = el[reactKey];

// Check all possible locations
console.log('fiber.type?.__source:', fiber.type?.__source);
console.log('fiber.elementType?.__source:', fiber.elementType?.__source);
console.log('fiber.memoizedProps:', fiber.memoizedProps);
console.log('fiber.pendingProps:', fiber.pendingProps);
```

### Method 2: Check Your Vite Config

Ensure you're using `@vitejs/plugin-react` (not `@vitejs/plugin-react-swc`):

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react' // NOT react-swc

export default defineConfig({
  plugins: [
    react({
      // The plugin automatically adds @babel/plugin-transform-react-jsx-source
      // in development mode
    })
  ]
})
```

**Important**: `@vitejs/plugin-react-swc` does NOT support `__source` metadata. You must use the Babel-based plugin.

## Common Issues

### Issue 1: Using SWC instead of Babel
**Problem**: `@vitejs/plugin-react-swc` doesn't add `__source` metadata
**Solution**: Switch to `@vitejs/plugin-react`

```bash
pnpm remove @vitejs/plugin-react-swc
pnpm add -D @vitejs/plugin-react
```

### Issue 2: Production Build
**Problem**: `__source` is only added in development mode
**Solution**: Ensure you're running in development mode:
```bash
pnpm dev  # or npm run dev
```

### Issue 3: Vite Environment
**Problem**: Not detecting development environment correctly
**Solution**: Check that `import.meta.env.DEV` is `true` in your app

## Report Your Findings

If debug mode reveals that `__source` is stored in a location we're not checking, please:

1. Copy the debug console output
2. Note which property contains `__source`
3. Report it as an issue at: https://github.com/namastexlabs/forge-inspector/issues

Include:
- React version
- Vite version
- Build tool configuration
- Console debug output
- The path where you found `__source` in the Fiber node

## Testing Different React Versions

To help us improve compatibility, you can test with different React versions:

```bash
# Test with React 18
pnpm add react@^18.3.1 react-dom@^18.3.1

# Test with React 19
pnpm add react@^19.2.0 react-dom@^19.2.0
```

Compare the debug output between versions to identify where React 19 changed the Fiber structure.

## Expected Behavior

When working correctly, forge-inspector should:
1. Show component name and file path (e.g., `Button (src/components/Button.tsx:42)`)
2. Allow clicking to open the file in your editor
3. Navigate up the component hierarchy with Shift+Click

## Additional Resources

- [React Fiber Architecture](https://github.com/acdlite/react-fiber-architecture)
- [Babel JSX Source Plugin](https://babeljs.io/docs/babel-plugin-transform-react-jsx-source)
- [forge-inspector GitHub Issues](https://github.com/namastexlabs/forge-inspector/issues)
