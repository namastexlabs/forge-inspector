# Quick Test Guide - forge-inspector v0.0.8 (Bug Fixes)

## What Was Fixed

✅ **Bug #1**: Babel plugin now uses ESM (`export default` instead of `module.exports`)
✅ **Bug #2**: Removed broken Vite plugin (was breaking TypeScript generics)

## How to Test

### Step 1: Build Package

```bash
cd /home/cezar/dev/forge-inspector/packages/forge-inspector
pnpm build && rm -f forge-inspector-0.0.7.tgz && pnpm pack
```

### Step 2: Install in Your React 19 App

```bash
# In your enterprise template directory:
pnpm add /home/cezar/dev/forge-inspector/packages/forge-inspector/forge-inspector-0.0.7.tgz
```

### Step 3: Configure Vite

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react' // Must be Babel version

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: ['forge-inspector/babel-plugin'] // Add this
      }
    })
  ]
})
```

**IMPORTANT**: Remove any previous `forgeInspectorPlugin()` if you had it.

### Step 4: Start Dev Server

```bash
pnpm dev
```

## Verification Tests

### Test 1: Build Should Succeed ✅

**Expected**: No errors during build
**Previous**: 6+ TypeScript generic syntax errors
**Check**:
```bash
# Should build cleanly with no errors
pnpm dev
```

### Test 2: Attributes Should Be Injected ✅

**Expected**: `data-forge-source` attributes on JSX elements
**Check in browser console**:
```javascript
// Click on any element first
const el = $0

console.log(el.getAttribute('data-forge-source'))
// Expected: "/src/components/SomeComponent.tsx:42:10"
// Previous: null (Vite plugin didn't inject or caused errors)
```

### Test 3: ForgeInspector Should Detect Sources ✅

**Expected**: Shows component name and file location
**Check**:
1. Alt+Click (or Option+Click) on any component
2. Should show: `ComponentName (src/path/file.tsx:line)`
3. Click on it → Opens in editor

**Previous**: "Unknown (no source)" in React 19

### Test 4: TypeScript Generics Should Work ✅

**Expected**: No syntax errors in files using generics
**Check these patterns should compile**:
```typescript
const context = createContext<MyType>()      // ✅ Should work
const ref = useRef<HTMLDivElement>(null)     // ✅ Should work
const [state, setState] = useState<Type>()   // ✅ Should work
```

**Previous**: All generated syntax errors with Vite plugin

## Success Criteria

All of these should be true:

- [ ] Package installs without errors
- [ ] Dev server starts without TypeScript errors
- [ ] TypeScript generic syntax (`<Type>`) compiles correctly
- [ ] `data-forge-source` attributes appear on JSX elements
- [ ] ForgeInspector shows source locations (not "Unknown")
- [ ] Alt+Click opens correct file in editor

## If Something Fails

### Problem: "module is not defined"

**Cause**: Babel plugin still using CommonJS
**Check**:
```bash
cat /node_modules/forge-inspector/babel-plugin.js | head -30
# Should show: export default function
# Should NOT show: module.exports
```

### Problem: TypeScript errors with generics

**Cause**: Vite plugin still present
**Check**:
```bash
ls /node_modules/forge-inspector/
# Should NOT see: vite-plugin.js
```

### Problem: No `data-forge-source` attributes

**Checks**:
1. Is plugin in vite.config.ts?
2. Is NODE_ENV="development"?
3. Did you restart dev server after adding plugin?
4. Using `@vitejs/plugin-react` (not `-swc`)?

### Problem: Still shows "Unknown (no source)"

**Debug**:
```javascript
// Enable debug mode:
window.__FORGE_INSPECTOR_DEBUG__ = true

// Alt+Click on component
// Check console logs for details
```

## Expected Debug Output (Success)

When you Alt+Click on a component, you should see in console:

```javascript
// If data-forge-source is found:
// No debug output (works silently)

// If not found but _debugSource exists (React 18):
// No debug output (works silently)

// If nothing found (failure):
[ForgeInspector] Source not found
  - instance._debugSource: undefined
  - instance._debugStack: undefined
  - instance.memoizedProps.__source: undefined
  // ... etc
```

## Report Results

Please share:

1. **Build result**:
   - ✅ Clean build / ❌ Errors (paste error)

2. **Attribute check**:
   ```javascript
   $0.getAttribute('data-forge-source')
   ```
   - Result: (paste value or "null")

3. **ForgeInspector result**:
   - What it shows when you Alt+Click
   - Screenshot if possible

4. **TypeScript generics**:
   - ✅ No errors / ❌ Errors (which files?)

---

**This should work!** 🎯

The fixes address both critical bugs discovered in testing.
