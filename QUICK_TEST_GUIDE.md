# Quick Test Guide - Build the Solution

## Step 1: Build the Package

```bash
cd /home/cezar/dev/forge-inspector/packages/forge-inspector
pnpm pack
```

This creates `forge-inspector-0.0.7.tgz` with the new plugins.

## Step 2: Install in Your React 19 App

```bash
# In your React 19 app directory
pnpm add /home/cezar/dev/forge-inspector/packages/forge-inspector/forge-inspector-0.0.7.tgz
```

## Step 3: Add the Vite Plugin

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { forgeInspectorPlugin } from 'forge-inspector/vite-plugin'

export default defineConfig({
  plugins: [
    react(),
    forgeInspectorPlugin() // <-- Add this line
  ]
})
```

## Step 4: Start Dev Server

```bash
pnpm dev
```

## Step 5: Verify Attribute Injection

Open browser console and run:

```javascript
// Click on any button/div in your app first
const el = $0 // The element you just clicked

// Check for the injected attribute
console.log(el.getAttribute('data-forge-source'))
// Expected output: "/src/components/Button.tsx:42:10" or similar
```

**If you see the attribute**, the plugin is working! ✅

**If you DON'T see it**, the plugin isn't running. Check:
1. Is plugin in `vite.config.ts`?
2. Did you restart dev server after adding plugin?
3. Is `NODE_ENV` set to `development`?

## Step 6: Test ForgeInspector

1. Make sure `<ForgeInspector />` is in your app
2. **Alt+Click** (or **Option+Click** on Mac) on any component
3. Should show: `ComponentName (src/path/file.tsx:line)`
4. Click on it → Opens in your editor

## Expected Behavior

### ✅ Success
```
Selected: Button (src/components/Button.tsx:42)
[Editor opens to line 42 of Button.tsx]
```

### ❌ Failure (No Plugin)
```
Selected: Unknown (no source)
```

### ❌ Failure (Plugin Not Working)
```
Selected: Unknown (no source)

// In console:
$0.getAttribute('data-forge-source')
// null
```

## Troubleshooting

### Plugin Not Injecting Attributes

**Problem**: `data-forge-source` attribute missing

**Solutions**:
1. **Restart dev server** after adding plugin
2. **Check plugin order**:
   ```typescript
   plugins: [
     react(),
     forgeInspectorPlugin() // Must be AFTER react()
   ]
   ```
3. **Verify NODE_ENV**:
   ```javascript
   console.log(import.meta.env.DEV) // Should be true
   console.log(process.env.NODE_ENV) // Should be "development"
   ```

### ForgeInspector Still Shows "Unknown"

**Problem**: Attribute exists but not detected

**Debug**:
```javascript
window.__FORGE_INSPECTOR_DEBUG__ = true
// Then Alt+Click on component
// Check console logs
```

### Using SWC?

**Problem**: Plugin doesn't work with `@vitejs/plugin-react-swc`

**Solution**: Either:
1. Switch to `@vitejs/plugin-react` (Babel-based)
2. Or use Vite plugin (works with both)

## Alternative: Babel Plugin Method

If Vite plugin doesn't work, try Babel plugin:

```typescript
// vite.config.ts
import react from '@vitejs/plugin-react' // NOT -swc

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

## Debug Checklist

- [ ] Installed latest forge-inspector package
- [ ] Added plugin to vite.config.ts
- [ ] Restarted dev server
- [ ] Verified `data-forge-source` attribute exists
- [ ] `NODE_ENV` is "development"
- [ ] `<ForgeInspector />` component is rendered
- [ ] Alt+Click shows component info

## Success Criteria

1. **Attribute exists**: `$0.getAttribute('data-forge-source')` returns filename
2. **Detection works**: Alt+Click shows component name and file
3. **Editor opens**: Clicking opens VS Code at correct line

If all three work, **SUCCESS!** 🎉

## Report Results

When you test, please report:

1. **Does attribute injection work?**
   - Yes/No
   - Attribute value if yes

2. **Does source detection work?**
   - Yes/No
   - What does it show?

3. **Does editor opening work?**
   - Yes/No
   - Does it open at the correct line?

4. **Any errors in console?**
   - Copy full error messages

---

**This is the moment of truth!** 🚀

Build, install, configure, test, and let me know what happens!
