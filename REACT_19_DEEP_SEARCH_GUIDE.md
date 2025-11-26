# React 19 Deep Source Search Guide

## Problem Statement

React 19 strips `__source` metadata from Fiber nodes before we can access it through normal prop checks. This utility performs a **deep recursive search** of the entire Fiber structure to find where `__source` might be hiding.

## What This Tool Does

The `deepSearchForSource` utility:
1. Recursively searches all properties of a Fiber node (up to 5 levels deep)
2. Checks both enumerable and non-enumerable properties
3. Avoids circular references
4. Reports ALL locations where `__source` is found
5. Provides a summary of what was checked

## Usage

### Method 1: Browser Console (Easiest)

The debug utilities are automatically exposed to `window` in development mode.

#### Step 1: Click on an element
Click on any button, div, or component in your app.

#### Step 2: Run deep search
```javascript
// Get the element you just clicked
const el = $0  // or document.querySelector('button')

// Run deep search
window.__debugFiberSource(el)
```

#### Expected Output:
```javascript
🔍 Deep Source Search
  Found fiber: FiberNode {tag: 5, key: null, ...}
  Search result: {found: Array(1), summary: {...}}
  ✅ __source found at:
    fiber.memoizedProps.__source
      → src/components/Button.tsx:42:5
```

Or if not found:
```javascript
🔍 Deep Source Search
  Found fiber: FiberNode {tag: 5, key: null, ...}
  Search result: {found: Array(0), summary: {...}}
  ❌ No __source found in fiber node
  Summary: {
    totalFound: 0,
    fiberTag: 5,
    hasDebugSource: false,
    hasMemoizedProps: true,
    ...
  }
```

### Method 2: Import in Your Code

```javascript
import { debugFiberSource, deepSearchForSource } from 'forge-inspector'

// In a React component or dev tool:
function MyDebugComponent() {
  const handleClick = (e) => {
    debugFiberSource(e.target)
  }

  return <button onClick={handleClick}>Debug Me</button>
}
```

### Method 3: Programmatic Search

```javascript
import { deepSearchForSource } from 'forge-inspector'

// Get fiber from element
const el = document.querySelector('button')
const reactKey = Object.keys(el).find(k => k.startsWith('__react'))
const fiber = el[reactKey]

// Deep search
const result = deepSearchForSource(fiber)

if (result.found.length > 0) {
  console.log('Found __source at:', result.found[0].path)
  console.log('File:', result.found[0].fileName)
  console.log('Line:', result.found[0].lineNumber)
} else {
  console.log('Not found. Checked:', result.summary)
}
```

## Understanding the Output

### Success Case
```javascript
{
  found: [
    {
      path: "fiber.memoizedProps.__source",
      value: { fileName: "src/App.tsx", lineNumber: 42, columnNumber: 5 },
      fileName: "src/App.tsx",
      lineNumber: 42,
      columnNumber: 5
    }
  ],
  summary: {
    totalFound: 1,
    locations: ["fiber.memoizedProps.__source"],
    fiberTag: 5,
    fiberType: "Button",
    hasDebugSource: false,
    hasMemoizedProps: true,
    hasPendingProps: true
  }
}
```

**What this means**:
- `__source` WAS found!
- It's at `fiber.memoizedProps.__source`
- We can update our code to check this location

### Failure Case
```javascript
{
  found: [],
  summary: {
    totalFound: 0,
    locations: [],
    fiberTag: 5,
    fiberType: "div",
    hasDebugSource: false,
    hasMemoizedProps: true,
    hasPendingProps: true,
    hasElementType: true,
    hasType: true
  }
}
```

**What this means**:
- `__source` was NOT found anywhere in the Fiber structure
- This suggests Babel might not be adding it, or it's being stripped earlier
- Need to check Vite/Babel configuration

## Fiber Property Summary

The summary shows which standard Fiber properties exist:

- `hasDebugSource`: React 16.8-18 property (will be `false` in React 19)
- `hasMemoizedProps`: Current props on the Fiber
- `hasPendingProps`: Props waiting to be applied
- `hasElementType`: Component function/class reference
- `hasType`: Similar to elementType
- `hasOwner`: Reference to component that created this one
- `hasReturn`: Parent Fiber node

## What to Do With Results

### If __source is Found

1. **Note the path** (e.g., `fiber.memoizedProps.__source`)
2. **Update `getSourceForInstance.js`** to check this location first:
   ```javascript
   const source =
     instance.memoizedProps?.__source ||  // <-- Add this!
     instance._debugSource ||
     instance.type?.__source
   ```
3. **Test** to verify it works
4. **Report** the finding so we can update forge-inspector

### If __source is NOT Found

This means React 19 is completely stripping `__source` before it reaches the Fiber. Possible causes:

1. **Using SWC instead of Babel**
   - Check: `@vitejs/plugin-react-swc` vs `@vitejs/plugin-react`
   - Fix: Use Babel-based plugin

2. **Production build**
   - Check: `import.meta.env.DEV === true`
   - Fix: Use dev server, not production build

3. **Babel plugin not configured**
   - Check: Vite/Next.js/CRA should auto-configure
   - Fix: Manually add `@babel/plugin-transform-react-jsx-source`

4. **React 19 truly strips it**
   - This is the fundamental issue
   - Requires React DevTools integration or alternative approach

## Advanced: Searching Parent Fibers

The debug utility also searches up the Fiber tree (up to 10 parents) to find source info:

```javascript
Checking parent fibers...
✅ __source found in parent 3:
  fiber.return.return.return.memoizedProps.__source
    → src/App.tsx:10:3
```

This helps identify if source info is only available on parent components.

## Performance Notes

- Recursion depth limited to 5 levels (prevents hanging)
- Circular reference protection (prevents infinite loops)
- Only runs when explicitly called (zero overhead otherwise)
- Safe to use in development, but don't ship to production

## Comparison with Standard Debug Mode

**Standard debug mode** (`window.__FORGE_INSPECTOR_DEBUG__ = true`):
- Checks 7 specific locations
- Logs when source NOT found
- Runs on every component click
- Shows what we're currently checking

**Deep search** (`window.__debugFiberSource(element)`):
- Recursively searches EVERYTHING
- Logs when source IS found
- Runs only when you call it
- Shows where source ACTUALLY is

Use **both** together for maximum debugging power!

## Example Workflow

```javascript
// 1. Enable standard debug mode
window.__FORGE_INSPECTOR_DEBUG__ = true

// 2. Click on a component
// (You'll see: "[ForgeInspector] Source not found")

// 3. Run deep search on the same element
window.__debugFiberSource($0)

// 4. If deep search finds it:
//    → Report the path so we can add it to getSourceForInstance.js
//
// 5. If deep search doesn't find it:
//    → Check Babel/Vite configuration
//    → Verify you're in development mode
//    → Consider React DevTools integration approach
```

## Reporting Findings

If you find `__source` in a location we're not checking, please report:

1. **React version**: `19.2.0`
2. **Build tool**: `Vite 7.1.11`
3. **Plugin**: `@vitejs/plugin-react 5.1.1`
4. **Path where found**: `fiber.memoizedProps.__source`
5. **Element type**: `button`, `div`, custom component, etc.
6. **Full console output**: Copy the entire debug output

Post this information at:
- https://github.com/namastexlabs/forge-inspector/issues/2

## Troubleshooting

### "window.__debugFiberSource is not defined"

**Cause**: forge-inspector not loaded or not in development mode

**Fix**:
```javascript
// Import directly
import { debugFiberSource } from 'forge-inspector'
debugFiberSource(element)
```

### "No React fiber found on element"

**Cause**: Clicked on a non-React element

**Fix**: Click on an element that's part of your React app

### "Maximum call stack size exceeded"

**Cause**: Circular reference protection failed (very rare)

**Fix**: This shouldn't happen, but if it does, report it as a bug

## Next Steps

Based on what you find:

1. **If found**: We update forge-inspector to check that location
2. **If not found**: We investigate React DevTools integration
3. **If SWC issue**: We document the Babel requirement
4. **If fundamental limitation**: We provide workarounds/alternatives

---

**Version**: forge-inspector 0.0.7+
**Last Updated**: 2025-11-26
**Status**: Experimental debugging utility
