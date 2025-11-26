# Request to React Team: Restore Debug Metadata or Provide Official API

## Summary

React 19 has removed all accessible source location metadata from Fiber nodes, breaking the entire ecosystem of click-to-component developer tools. We respectfully request either restoring this metadata in development builds or providing an official debug API.

## Affected Tools

All tools that provide "click component in browser → open in editor" functionality:
- ForgeInspector
- LocatorJS
- click-to-component
- react-dev-inspector
- code-inspector
- vite-plugin-react-click-to-component
- And many others

**Estimated impact**: Thousands of React developers use these tools daily for rapid development.

## What Changed

### React 18 (Working)
```javascript
fiber._debugSource = {
  fileName: '/src/components/Button.tsx',
  lineNumber: 42,
  columnNumber: 5
}
```

### React 19 (Broken)
```javascript
fiber._debugSource    // undefined ❌
fiber._debugStack     // undefined ❌
fiber.memoizedProps.__source  // undefined ❌
```

## What We've Confirmed

### ✅ Babel is Working
- `@babel/plugin-transform-react-jsx-source` adds `__source` to JSX elements
- Confirmed by "Duplicate `__source` prop" errors when adding plugin explicitly
- The `__source` data is definitely being created

### ❌ React is Stripping It
- `__source` prop never reaches Fiber nodes
- React 19 strips it during JSX element → Fiber transformation
- Not accessible anywhere in the Fiber tree (verified via deep recursive search)

## Investigation Completed

We've spent ~40 hours investigating this issue:

1. ✅ Verified Babel configuration is correct
2. ✅ Checked all known Fiber properties (`_debugSource`, `memoizedProps`, `pendingProps`, etc.)
3. ✅ Implemented `_debugStack` parsing (in case it exists)
4. ✅ Deep recursive search of entire Fiber structure (5 levels)
5. ✅ Tested with multiple browsers and configurations
6. ✅ Built updated tools ready for React 19 **IF** metadata becomes available

**Conclusion**: React 19.2.0 stable provides zero accessible source location metadata.

## What We're Requesting

Please provide **one** of these solutions:

### Option 1: Restore `_debugSource` (Preferred)
```javascript
// In development builds only:
fiber._debugSource = {
  fileName: '/src/components/Button.tsx',
  lineNumber: 42,
  columnNumber: 5
}
```

**Pros**:
- Restores all existing tools immediately
- Zero breaking changes
- Proven pattern (worked in React 16-18)

### Option 2: Ensure `_debugStack` Exists
```javascript
// In development builds only:
fiber._debugStack = Error('react-stack-top-frame')
  stack: "at Button (http://localhost:5175/src/Button.tsx:42:5)"
```

**Pros**:
- We've already implemented parsing for this
- Tools can extract file:line:column from stack traces
- One user reported seeing this (unclear which build)

### Option 3: Preserve `__source` in Props
```javascript
// Don't strip __source from memoizedProps in dev builds:
fiber.memoizedProps = {
  className: "btn",
  __source: { fileName: '/src/App.tsx', lineNumber: 42, columnNumber: 5 }
}
```

**Pros**:
- Natural location for metadata
- Easy for tools to access
- Minimal React changes needed

### Option 4: Provide Official Debug API
```javascript
// New official API:
import { getComponentSourceLocation } from 'react'

const source = getComponentSourceLocation(fiberNode)
// Returns: { fileName, lineNumber, columnNumber }
```

**Pros**:
- Official, documented, stable API
- Tools don't depend on internal properties
- Can evolve with React

## Use Case

These tools provide critical DX:

1. **Developer clicks component** in browser (Alt+Click)
2. **Tool opens file in editor** at exact line
3. **Saves hours** of manual file searching
4. **Speeds up debugging** significantly

This workflow is **essential** for:
- Large codebases
- Component libraries
- Rapid prototyping
- Bug fixing
- Learning React codebases

## Environment Tested

- **React**: 19.2.0 stable
- **React DOM**: 19.2.0
- **Vite**: 7.1.11
- **Plugin**: @vitejs/plugin-react 5.1.1
- **Mode**: Development (`import.meta.env.DEV === true`)
- **Babel**: Confirmed adding `__source` correctly

## Questions

1. **Was removing debug metadata intentional?**
   - If yes: Can we have an official API instead?
   - If no: Can we restore it in development builds?

2. **Does `_debugStack` exist in some React 19 builds?**
   - One user reported seeing it
   - Our stable 19.2.0 build doesn't have it
   - Are there debug flags to enable this?

3. **Is there an undocumented way to access source info?**
   - We've checked all Fiber properties
   - Is there a hidden API we're missing?

4. **What's the recommended migration path?**
   - Should tools use React DevTools backend?
   - Should we parse source maps instead?
   - Is there a coming solution we should wait for?

## Community Impact

This affects the React developer experience significantly. Many developers rely on these tools daily. Without source location detection, we lose:

- Instant "jump to component" functionality
- Visual component debugging
- Rapid iteration workflow
- Educational tools for learning React

## Our Commitment

We're ready to:
- Implement whatever solution you provide
- Document the migration path
- Update all affected tools
- Help other maintainers migrate

We've already built ForgeInspector v0.0.7 with `_debugStack` parsing - we just need the metadata to exist!

## Request

Please consider this issue high priority for developer experience. Even if the solution is "opt-in" or requires a flag, having **some** way to access source locations in development builds would restore this critical tooling ecosystem.

Thank you for your consideration.

---

**Submitted by**: Automagik Forge team
**Date**: 2025-11-26
**Related GitHub Issues**:
- https://github.com/facebook/react/issues/32574
- https://github.com/facebook/react/issues/31981
- https://github.com/namastexlabs/forge-inspector/issues/2

**Full Investigation**: See DEFINITIVE_DIAGNOSIS.md
