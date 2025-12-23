/**
 * @typedef {import('./types.js').ForgeInspector} Props
 * @typedef {import('./types.js').Coords} Coords
 */

import { FloatingPortal } from '@floating-ui/react'
import { html } from 'htm/react'
import * as React from 'react'


import { getDisplayNameForInstance } from './getDisplayNameFromReactInstance.js'
import { getPathToSource } from './getPathToSource.js'
import { getPropsForInstance } from './getPropsForInstance.js'
import { getReactInstancesForElement } from './getReactInstancesForElement.js'
import { getSourceForInstance, getSourceFromElement } from './getSourceForInstance.js'
import { getUrl } from './getUrl.js'

// Visual agent imports - split between lightweight capability check and full agent
// Using webpackIgnore because transformers.js can't be processed by Babel
// The visual-agent is served from /visual-agent/ with CDN deps

// Debug: Catch "illegal path" errors to find source
if (typeof window !== 'undefined' && !window.__illegalPathDebugger) {
  window.__illegalPathDebugger = true
  window.addEventListener('error', (event) => {
    if (event.message && event.message.includes('illegal path')) {
      console.error('[DEBUG] Illegal path error caught:', event.message)
      console.error('[DEBUG] Source:', event.filename, 'line:', event.lineno)
      console.error('[DEBUG] Stack:', event.error?.stack)
    }
  })
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason?.message?.includes('illegal path')) {
      console.error('[DEBUG] Illegal path rejection:', event.reason)
      console.error('[DEBUG] Stack:', event.reason?.stack)
    }
  })
}

// Lightweight capability check - doesn't load AI SDK or transformers.js
let capabilitiesModule = null
const getCapabilities = async () => {
  if (!capabilitiesModule) {
    capabilitiesModule = await import(/* webpackIgnore: true */ '/visual-agent/capabilities.js')
  }
  return capabilitiesModule.checkCapabilities()
}

// Full visual agent - lazy-loaded only when recording starts
let visualAgentModule = null
const getVisualAgent = async () => {
  if (!visualAgentModule) {
    console.log('[ForgeInspector] Importing /visual-agent/index.js...')
    try {
      visualAgentModule = await import(/* webpackIgnore: true */ '/visual-agent/index.js')
      console.log('[ForgeInspector] Import successful:', Object.keys(visualAgentModule))
    } catch (err) {
      console.error('[ForgeInspector] Import failed:', err)
      throw err
    }
  }
  return visualAgentModule
}

export const State = /** @type {const} */ ({
  IDLE: 'IDLE',
  HOVER: 'HOVER',
  SELECT: 'SELECT',
  RECORDING: 'RECORDING',
  PROCESSING: 'PROCESSING',
})

export const Trigger = /** @type {const} */ ({
  ALT_KEY: 'alt-key',
  BUTTON: 'button',
})

// Message source and version for iframe communication
const MESSAGE_SOURCE = 'click-to-component'
const MESSAGE_VERSION = 1

// Allowed development origins for postMessage security
// Using explicit allowlist instead of prefix matching to prevent
// malicious scripts on arbitrary localhost ports from controlling the inspector
const ALLOWED_DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3333',
  'http://localhost:5173',  // Vite default
  'http://localhost:5174',
  'http://localhost:8080',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3333',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:8080',
]

/**
 * Get the target origin for postMessage.
 * Uses document.referrer in iframe context, falls back to '*' when referrer is stripped.
 * Using '*' is safe here because we specifically target window.parent.postMessage(),
 * not a broadcast. The message only goes to the parent window reference.
 * @returns {string}
 */
function getTargetOrigin() {
  if (typeof window === 'undefined') return '*'

  // Try to get origin from document.referrer (parent frame URL)
  if (document.referrer) {
    try {
      const url = new URL(document.referrer)
      return url.origin
    } catch (err) {
      // Invalid referrer URL - log for debugging
      console.warn('[ForgeInspector] Invalid referrer URL:', err)
    }
  }

  // No referrer (stripped by referrerpolicy="no-referrer") - use '*'
  // This is safe because we target window.parent explicitly, not a broadcast
  return '*'
}

/**
 * Generate a CSS-selector-style DOM path from an element up to the root.
 * Optimized for AI code navigation - includes disambiguating nth-child when needed.
 * @param {HTMLElement} element
 * @returns {string}
 */
function getDOMPath(element) {
  if (!element || element === document.body || element === document.documentElement) {
    return ''
  }

  const path = []
  let current = element

  while (current && current !== document.body && current !== document.documentElement) {
    let selector = current.tagName.toLowerCase()

    // Add ID if present (most specific)
    if (current.id) {
      selector += `#${current.id}`
    } else {
      // Add first class if present
      if (current.className && typeof current.className === 'string') {
        const firstClass = current.className.trim().split(/\s+/)[0]
        if (firstClass) {
          selector += `.${firstClass}`
        }
      }

      // Add nth-child for disambiguation when no id
      if (current.parentElement) {
        const siblings = Array.from(current.parentElement.children)
        const sameTagSiblings = siblings.filter(s => s.tagName === current.tagName)
        if (sameTagSiblings.length > 1) {
          const index = sameTagSiblings.indexOf(current) + 1
          selector += `:nth-child(${index})`
        }
      }
    }

    path.unshift(selector)

    // Stop at element with ID (sufficient for unique identification)
    if (current.id) break

    current = current.parentElement
  }

  return path.join(' > ')
}

/**
 * Validate if a message event origin is trusted.
 * Primary security check: event.source === window.parent
 * Secondary check: origin validation when referrer is available
 * @param {MessageEvent} event
 * @returns {boolean}
 */
function isValidMessageOrigin(event) {
  if (typeof window === 'undefined') return false

  // Primary security check: must be from parent window
  // This validates the message comes from the actual parent window reference
  if (event.source !== window.parent) return false

  // If referrer is available, validate origin matches (additional security)
  if (document.referrer) {
    try {
      const parentOrigin = new URL(document.referrer).origin
      return event.origin === parentOrigin
    } catch (err) {
      // Invalid referrer, fall through to fallback logic
      console.debug('[ForgeInspector] Referrer validation failed:', err)
    }
  }

  // No referrer (stripped by referrerpolicy="no-referrer")
  // The source === window.parent check above is the primary security gate
  // Accept from same origin, dev origins, or trust the source check for cross-origin parents
  const origin = event.origin
  if (origin === window.location.origin || ALLOWED_DEV_ORIGINS.includes(origin)) {
    return true
  }

  // When referrer is stripped, we can't know the parent's expected origin
  // But event.source === window.parent already passed, confirming it's from parent
  // This is safe: the parent controls what messages it sends, and we validate MESSAGE_SOURCE
  return true
}

/**
 * Get visible text content from an element (what the user sees)
 * Prefers direct text nodes, falls back to innerText (truncated)
 * @param {HTMLElement} el
 * @returns {string | undefined}
 */
function getVisibleText(el) {
  if (!el) return undefined

  // Get direct text content from text nodes (not nested elements)
  const directText = Array.from(el.childNodes)
    .filter(node => node.nodeType === Node.TEXT_NODE)
    .map(node => node.textContent?.trim())
    .filter(Boolean)
    .join(' ')

  if (directText) return directText

  // Fallback to innerText if no direct text (truncated for large content)
  if (el.innerText) {
    const inner = el.innerText.trim()
    if (inner.length > 100) {
      return inner.substring(0, 100) + '...'
    }
    return inner || undefined
  }

  return undefined
}

/**
 * Extract component instances data for a target element
 * Returns component info even without source location (for production builds)
 * @param {HTMLElement} target
 * @param {import('./types.js').PathModifier} pathModifier
 * @returns {Array}
 */
function getComponentInstances(target, pathModifier) {
  if (!target) return []

  // Get all React instances - don't filter by source availability
  // This allows component names to be returned even in production builds
  // where _debugSource and _debugStack are stripped
  const instances = getReactInstancesForElement(target).filter((instance) => {
    // Filter out non-component fibers (HostComponent = DOM elements like div, button)
    // We want FunctionComponent (0), ClassComponent (1), ForwardRef (11), Memo (14, 15)
    const tag = instance.tag
    return tag === 0 || tag === 1 || tag === 11 || tag === 14 || tag === 15
  })

  return instances.map((instance) => {
    const name = getDisplayNameForInstance(instance)
    // Try React internals first, fallback to DOM data-forge-source attribute
    let source = getSourceForInstance(instance)
    if (!source) {
      source = getSourceFromElement(target)
    }
    const path = source ? getPathToSource(source, pathModifier) : null
    const props = getPropsForInstance(instance)

    return {
      name,
      props,
      source: source ? {
        fileName: source.fileName,
        lineNumber: source.lineNumber,
        columnNumber: source.columnNumber
      } : null,
      pathToSource: path
    }
  })
}

/**
 * Send a message to the parent window when opening in editor.
 * No-ops when not inside an iframe.
 * @param {Object} args
 * @param {string} args.editor
 * @param {string} args.pathToSource
 * @param {string} args.url
 * @param {'alt-click'|'context-menu'} args.trigger
 * @param {MouseEvent} [args.event]
 * @param {HTMLElement} [args.element]
 * @param {import('./types.js').PathModifier} [args.pathModifier]
 * @param {string} [args.selectedComponent] - Name of the selected component
 */
function postOpenToParent({ editor, pathToSource, url, trigger, event, element, pathModifier, selectedComponent }) {
  try {
    const el = element || (event && event.target instanceof HTMLElement ? event.target : null)

    // Get all component instances for the clicked element
    const allComponents = el ? getComponentInstances(el, pathModifier) : []

    // Find the selected component in the list (or use the first one)
    const selected = selectedComponent
      ? allComponents.find(comp => comp.name === selectedComponent)
      : allComponents.find(comp => comp.pathToSource === pathToSource) || allComponents[0]

    // Build aria object, filtering out undefined values
    const ariaAttrs = el ? {
      label: el.getAttribute('aria-label') || undefined,
      describedby: el.getAttribute('aria-describedby') || undefined,
      placeholder: el.getAttribute('placeholder') || undefined,
      title: el.getAttribute('title') || undefined,
    } : undefined
    const hasAria = ariaAttrs && Object.values(ariaAttrs).some(v => v !== undefined)

    // Build form context for form elements
    const isFormElement = el && ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)
    const formAttrs = isFormElement ? {
      name: el.getAttribute('name') || undefined,
      type: el.getAttribute('type') || undefined,
      value: /** @type {HTMLInputElement} */ (el).value?.substring?.(0, 100) || undefined,
    } : undefined

    const elementInfo = el
      ? {
        tag: el.tagName?.toLowerCase?.() || undefined,
        id: el.id || undefined,
        className:
          typeof el.className === 'string'
            ? el.className
            : String(el.className || ''),
        role: el.getAttribute('role') || undefined,
        dataset: { ...el.dataset },
        domPath: getDOMPath(el),
        // Enhanced context for AI debugging
        textContent: getVisibleText(el),
        testId: el.getAttribute('data-testid') || el.getAttribute('data-test-id') || undefined,
        aria: hasAria ? ariaAttrs : undefined,
        form: formAttrs,
      }
      : undefined

    const message = {
      source: MESSAGE_SOURCE,
      version: MESSAGE_VERSION,
      type: 'open-in-editor',
      payload: {
        selected: selected ? {
          editor,
          pathToSource: selected.pathToSource,
          url,
          name: selected.name,
          props: selected.props,
          source: selected.source
        } : {
          editor,
          pathToSource,
          url,
          name: selectedComponent || 'Unknown',
          props: {},
          source: {}
        },
        components: allComponents,
        trigger,
        coords: event
          ? { x: event.clientX ?? undefined, y: event.clientY ?? undefined }
          : undefined,
        clickedElement: elementInfo,
      },
    }

    if (
      typeof window !== 'undefined' &&
      window.parent &&
      window.parent !== window &&
      typeof window.parent.postMessage === 'function'
    ) {
      window.parent.postMessage(message, getTargetOrigin())
    }
  } catch (err) {
    // Never break product flows due to messaging
    console.warn('[click-to-component] postMessage failed', err)
  }
}

/**
 * ForgeInspector component for click-to-edit functionality
 */
export function ForgeInspector() {
  // Only render when running from forge (inside an iframe)
  if (typeof window !== 'undefined' && window.parent === window) {
    return null
  }

  const editor = 'vscode' // legacy
  const pathModifier = (path) => path // legacy
  const [state, setState] = React.useState(
    /** @type {State[keyof State]} */
    (State.IDLE)
  )

  const [trigger, setTrigger] = React.useState(
    /** @type {Trigger[keyof Trigger] | null} */
    (null)
  )

  const [target, setTarget] = React.useState(
    /** @type {HTMLElement | null} */
    (null)
  )

  // Show buttons by default in iframe contexts (for standalone forge-inspector usage)
  // When in playground, isInPlayground will be set to true to hide them
  const [showButton, setShowButton] = React.useState(true)
  const [isInPlayground, setIsInPlayground] = React.useState(false)

  // Visual agent state
  const [isRecording, setIsRecording] = React.useState(false)
  const [recordingStatus, setRecordingStatus] = React.useState('idle')
  const [hasWebGPU, setHasWebGPU] = React.useState(false)
  const visualAgentRef = React.useRef(null)

  // Model selection modal state
  const [showModelModal, setShowModelModal] = React.useState(false)
  const [selectedModelId, setSelectedModelId] = React.useState('smolvlm-256m')
  const [modelLoading, setModelLoading] = React.useState(null) // { modelId, progress, status }
  const [geminiApiKey, setGeminiApiKey] = React.useState('')

  // Load saved Gemini API key on mount
  React.useEffect(() => {
    const savedKey = localStorage.getItem('forge-inspector-gemini-key')
    if (savedKey) setGeminiApiKey(savedKey)
  }, [])

  // Refs to avoid stale closures in message handlers
  const isRecordingRef = React.useRef(isRecording)
  const hasWebGPURef = React.useRef(hasWebGPU)
  React.useEffect(() => { isRecordingRef.current = isRecording }, [isRecording])
  React.useEffect(() => { hasWebGPURef.current = hasWebGPU }, [hasWebGPU])

  // Check capabilities on mount (lightweight import - no AI SDK)
  React.useEffect(() => {
    console.log('[ForgeInspector] Checking visual agent capabilities...')
    getCapabilities().then((caps) => {
      console.log('[ForgeInspector] Visual agent capabilities:', JSON.stringify(caps))
      console.log('[ForgeInspector] WebGPU available:', caps.webgpu)
      setHasWebGPU(caps.webgpu)
    }).catch((err) => {
      // Visual agent not available, WebGPU features disabled
      console.error('[ForgeInspector] Capability check failed:', err)
      setHasWebGPU(false)
    })
  }, [])

  const fiIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-square-mouse-pointer-icon lucide-square-mouse-pointer"><path d="M12.034 12.681a.498.498 0 0 1 .647-.647l9 3.5a.5.5 0 0 1-.033.943l-3.444 1.068a1 1 0 0 0-.66.66l-1.067 3.443a.5.5 0 0 1-.943.033z"/><path d="M21 11V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6"/></svg>`;

  const recordIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4" fill="currentColor"/></svg>`;

  const stopIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><rect x="9" y="9" width="6" height="6" fill="currentColor"/></svg>`;

  const TargetButton = React.useCallback(
    ({ active, onToggle }) => html`
      <button
        onClick=${function handleButtonClick(e) {
        e.stopPropagation()
        onToggle()
      }}
        aria-pressed=${active}
        style=${{
        position: 'fixed',
        bottom: '12px',
        right: '12px',
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        background: active ? 'royalblue' : 'white',
        color: active ? 'white' : 'black',
        border: '1px solid #ccc',
        boxShadow: '0 2px 6px rgba(0,0,0,.3)',
        zIndex: 2147483647,
        cursor: 'pointer',
        fontSize: '14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '6px',
      }}
        title="Select component for AI help"
      >
        <img
          src=${'data:image/svg+xml;utf8,' + encodeURIComponent(fiIcon)}
          alt="FI Icon"
          style=${{
        width: '24px',
        height: '24px',
        filter: active ? 'brightness(0) invert(1)' : 'none',
      }}
        />
      </button>
    `,
    []
  )

  const RecordButton = React.useCallback(
    ({ recording, status, disabled, onToggle }) => html`
      <button
        onClick=${function handleRecordClick(e) {
          e.stopPropagation()
          onToggle()
        }}
        disabled=${disabled}
        aria-pressed=${recording}
        style=${{
          position: 'fixed',
          bottom: '12px',
          right: '52px',
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          background: recording ? '#dc2626' : disabled ? '#9ca3af' : 'white',
          color: recording ? 'white' : disabled ? '#6b7280' : 'black',
          border: '1px solid #ccc',
          boxShadow: '0 2px 6px rgba(0,0,0,.3)',
          zIndex: 2147483647,
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '6px',
          opacity: disabled ? 0.6 : 1,
        }}
        title=${disabled ? 'WebGPU required for visual recording' : recording ? 'Stop recording' : 'Start visual recording'}
      >
        <img
          src=${'data:image/svg+xml;utf8,' + encodeURIComponent(recording ? stopIcon : recordIcon)}
          alt=${recording ? 'Stop' : 'Record'}
          style=${{
            width: '24px',
            height: '24px',
            filter: recording ? 'brightness(0) invert(1)' : disabled ? 'grayscale(1)' : 'none',
          }}
        />
        ${status === 'processing' && html`
          <span style=${{
            position: 'absolute',
            top: '-4px',
            right: '-4px',
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: '#f59e0b',
            animation: 'pulse 1s infinite',
          }}/>
        `}
      </button>
    `,
    [recordIcon, stopIcon]
  )

  const toggleTargeting = React.useCallback(() => {
    if (state === State.HOVER && trigger === Trigger.BUTTON) {
      setState(State.IDLE)
      setTrigger(null)
    } else {
      setState(State.HOVER)
      setTrigger(Trigger.BUTTON)
    }
  }, [state, trigger])

  // Post message helper for visual agent
  const postVisualMessage = React.useCallback((type, payload) => {
    if (
      typeof window !== 'undefined' &&
      window.parent &&
      window.parent !== window
    ) {
      try {
        window.parent.postMessage({
          source: MESSAGE_SOURCE,
          version: MESSAGE_VERSION,
          type,
          payload
        }, getTargetOrigin())
      } catch (err) {
        console.warn('[ForgeInspector] postMessage failed:', err)
      }
    }
  }, [])

  // Available models for selection
  // SmolVLM works with AutoModelForVision2Seq in transformers.js
  const AVAILABLE_MODELS = [
    {
      id: 'smolvlm-256m',
      name: 'SmolVLM 256M',
      type: 'local',
      modelId: 'HuggingFaceTB/SmolVLM-256M-Instruct',
      dtype: 'q4',
      device: 'webgpu',
      description: 'Compact vision-language model. Fast inference.',
      size: '~150MB'
    },
    {
      id: 'smolvlm-500m',
      name: 'SmolVLM 500M',
      type: 'local',
      modelId: 'HuggingFaceTB/SmolVLM-500M-Instruct',
      dtype: 'q4',
      device: 'webgpu',
      description: 'Larger SmolVLM. Better accuracy.',
      size: '~300MB'
    },
    {
      id: 'gemini-flash',
      name: 'Gemini 2.0 Flash',
      type: 'cloud',
      providerId: 'gemini-2.0-flash',
      description: "Google's SOTA vision model. Requires API key.",
      size: 'Cloud',
      requiresApiKey: true
    }
  ]

  // Get selected model config
  const getSelectedModel = () => AVAILABLE_MODELS.find(m => m.id === selectedModelId) || AVAILABLE_MODELS[0]

  // Toggle recording - use refs to avoid stale closure issues
  const toggleRecording = React.useCallback(async () => {
    console.log('[ForgeInspector] toggleRecording called, hasWebGPU:', hasWebGPURef.current, 'isRecording:', isRecordingRef.current)
    if (!hasWebGPURef.current) {
      console.warn('[ForgeInspector] toggleRecording early return - no WebGPU')
      return
    }

    if (isRecordingRef.current) {
      // Stop recording
      setRecordingStatus('processing')
      setState(State.PROCESSING)

      try {
        const agent = visualAgentRef.current
        if (agent) {
          const report = await agent.stop()
          postVisualMessage('qa-report', {
            report,
            observations: agent.observations,
            sessionDuration: agent.sessionDuration
          })
          visualAgentRef.current = null
        }
      } catch (err) {
        console.error('[ForgeInspector] Error stopping recording:', err)
        postVisualMessage('recording-error', { error: `Stop failed: ${err.message}` })
      }

      setIsRecording(false)
      setRecordingStatus('idle')
      setState(State.IDLE)
    } else {
      // Show model selection modal instead of starting directly
      setShowModelModal(true)
    }
  }, [postVisualMessage]) // Using refs for hasWebGPU and isRecording to avoid stale closures

  // Start recording with selected model
  // When called from parent (playground mode), modelConfig and apiKey come from params
  // When called from local modal (standalone mode), uses local state
  const startRecordingWithModel = React.useCallback(async (parentModelConfig, parentApiKey) => {
    // Use parent-provided config or fall back to local selection
    const modelConfig = parentModelConfig || getSelectedModel()
    const apiKey = parentApiKey || geminiApiKey

    // Validate API key for cloud models
    if (modelConfig.requiresApiKey && !apiKey) {
      if (!parentModelConfig) {
        // Only show alert if running in standalone mode (not from playground)
        alert('Please enter your Gemini API key')
      }
      return
    }

    // Save API key to localStorage if provided
    if (modelConfig.requiresApiKey && apiKey) {
      localStorage.setItem('forge-inspector-gemini-key', apiKey)
    }

    setShowModelModal(false)
    setRecordingStatus('initializing')

    // Notify parent immediately that we're initializing (before model loads)
    postVisualMessage('recording-initializing', {
      message: `Loading ${modelConfig.name}...`,
      modelId: modelConfig.id,
      timestamp: Date.now()
    })

    try {
      console.log('[ForgeInspector] Loading visual agent module...')
      const { eyes } = await getVisualAgent()
      console.log('[ForgeInspector] Visual agent module loaded, creating agent with model:', modelConfig.id)

      const agent = eyes({
        modelConfig,
        onObservation: (text) => {
          postVisualMessage('recording-observation', {
            observation: text,
            timestamp: Date.now()
          })
        },
        onStatusChange: (status) => {
          setRecordingStatus(status)
          if (status === 'recording') {
            setState(State.RECORDING)
          } else if (status === 'processing') {
            setState(State.PROCESSING)
          }
        },
        onLoadingProgress: (data) => {
          setModelLoading(data)
          postVisualMessage('model-loading', data)
        },
        onError: (err) => {
          console.error('[ForgeInspector] Visual agent error:', err)
          postVisualMessage('recording-error', { error: err.message })
        }
      })

      await agent.start()
      visualAgentRef.current = agent
      setIsRecording(true)
      setModelLoading(null)
      postVisualMessage('model-ready', { modelId: modelConfig.id })

      postVisualMessage('recording-started', {
        modelId: modelConfig.id,
        modelName: modelConfig.name,
        timestamp: Date.now()
      })

      // Trigger initial screen observation
      console.log('[ForgeInspector] Triggering initial screen observation...')
      agent.trigger('Recording started - analyzing initial screen state').catch(err => {
        console.warn('[ForgeInspector] Initial observation failed:', err)
      })
    } catch (err) {
      console.error('[ForgeInspector] Error starting recording:', err)
      postVisualMessage('recording-error', { error: err.message })
      setRecordingStatus('idle')
      setModelLoading(null)
      setState(State.IDLE)
    }
  }, [postVisualMessage, geminiApiKey, selectedModelId])

  const onContextMenu = React.useCallback(
    function handleContextMenu(
      /**
       * @type {MouseEvent}
       */
      event
    ) {
      // Only interfere when the tool is active
      if (state !== State.IDLE && event.target instanceof HTMLElement) {
        event.preventDefault()

        // Optional: notify the parent for visualization
        postOpenToParent({
          editor,
          pathToSource: '',
          url: '',
          trigger: 'context-menu',
          event,
          element: event.target,
          pathModifier
        })
      }
    },
    [state, editor, pathModifier]
  )

  const onClick = React.useCallback(
    function handleClick(
      /**
       * @type {MouseEvent}
       */
      event
    ) {
      // Prevent all default actions when targeting is active
      if (state === State.HOVER) {
        event.preventDefault()
        event.stopPropagation()
      }

      // Trigger visual agent observation when recording
      if (state === State.RECORDING && visualAgentRef.current && event.target instanceof HTMLElement) {
        const el = event.target
        // Build rich element context for QA step tracking
        const elementInfo = {
          action: 'click',
          element: {
            tag: el.tagName.toLowerCase(),
            text: getVisibleText(el).substring(0, 100), // Limit length
            id: el.id || null,
            role: el.getAttribute('role'),
            type: el.getAttribute('type'),
            value: el.value?.substring(0, 50) || null // Limit length
          },
          component: getComponentInstances(el, pathModifier)[0] || null
        }
        visualAgentRef.current.trigger(elementInfo).catch(err => {
          console.warn('[ForgeInspector] Trigger observation failed:', err)
        })
      }

      // Handle targeting mode click (left-click sends message to parent)
      // Use event.target as fallback when target state hasn't been set (e.g., quick click without mousemove)
      const clickTarget = target instanceof HTMLElement ? target : (event.target instanceof HTMLElement ? event.target : null)
      if (state === State.HOVER && trigger === Trigger.BUTTON && clickTarget) {

        // Notify parent window with component info
        postOpenToParent({
          editor,
          pathToSource: '', // Will be determined when user selects
          url: '',
          trigger: 'context-menu',
          event,
          element: clickTarget,
          pathModifier,
        })

        setState(State.IDLE)
        setTrigger(null)
        return
      }

      // Handle Alt+click mode (use postMessage instead of navigation)
      if (state === State.HOVER && trigger === Trigger.ALT_KEY && target instanceof HTMLElement) {
        const instance = getReactInstancesForElement(target).find((instance) =>
          getSourceForInstance(instance)
        )

        if (!instance) {
          return console.warn(
            'Could not find React instance for element',
            target
          )
        }

        const source = getSourceForInstance(instance)

        if (!source) {
          return console.warn(
            'Could not find source for React instance',
            instance
          )
        }
        const path = getPathToSource(source, pathModifier)
        const url = getUrl({
          editor,
          pathToSource: path,
        })

        event.preventDefault()

        // Use postMessage instead of direct navigation
        postOpenToParent({
          editor,
          pathToSource: path,
          url,
          trigger: 'alt-click',
          event,
          element: target,
          pathModifier
        })

        setState(State.IDLE)
        setTrigger(null)
      }
    },
    [editor, pathModifier, state, trigger, target]
  )



  const onKeyDown = React.useCallback(
    function handleKeyDown(
      /**
       * @type {KeyboardEvent}
       */
      event
    ) {
      switch (state) {
        case State.IDLE:
          if (event.altKey) {
            setState(State.HOVER)
            setTrigger(Trigger.ALT_KEY)
          }
          break

        case State.HOVER:
          if (event.key === 'Escape' && trigger === Trigger.BUTTON) {
            setState(State.IDLE)
            setTrigger(null)
          }
          break

        default:
      }
    },
    [state, trigger]
  )

  const onKeyUp = React.useCallback(
    function handleKeyUp(
      /**
       * @type {KeyboardEvent}
       */
      event
    ) {
      switch (state) {
        case State.HOVER:
          if (trigger === Trigger.ALT_KEY) {
            setState(State.IDLE)
            setTrigger(null)
          }
          break

        default:
      }
    },
    [state, trigger]
  )

  const onMouseMove = React.useCallback(
    function handleMouseMove(
      /** @type {MouseEvent} */
      event
    ) {
      if (!(event.target instanceof HTMLElement)) {
        return
      }

      switch (state) {
        case State.IDLE:
        case State.HOVER:
          setTarget(event.target)
          break

        default:
          break
      }
    },
    [state]
  )

  const onBlur = React.useCallback(
    function handleBlur() {
      switch (state) {
        case State.HOVER:
          setState(State.IDLE)
          setTrigger(null)
          break

        default:
      }
    },
    [state]
  )

  React.useEffect(
    function toggleIndicator() {
      for (const element of Array.from(
        document.querySelectorAll('[data-click-to-component-target]')
      )) {
        if (element instanceof HTMLElement) {
          delete element.dataset.clickToComponentTarget
        }
      }

      if (state === State.IDLE) {
        delete window.document.body.dataset.clickToComponent
        window.document.body.style.removeProperty('--click-to-component-cursor')
        if (target) {
          delete target.dataset.clickToComponentTarget
        }
        return
      }

      if (target instanceof HTMLElement) {
        window.document.body.dataset.clickToComponent = state
        target.dataset.clickToComponentTarget = state

        // Set cursor to crosshair for targeting
        window.document.body.style.setProperty(
          '--click-to-component-cursor',
          'crosshair'
        )
      }
    },
    [state, target, trigger]
  )

  // Listen for messages from parent
  React.useEffect(function listenForParentMessages() {
    if (typeof window === 'undefined') return
    function onMessage(event) {
      // Validate message origin for security
      if (!isValidMessageOrigin(event)) return

      const data = event?.data
      // Only process messages from our own source
      if (
        data &&
        data.source === MESSAGE_SOURCE &&
        data.version === MESSAGE_VERSION
      ) {
        console.log('[ForgeInspector] Received message:', data)
        switch (data.type) {
          case 'enable-button':
            console.log('[ForgeInspector] Enable button message received - hiding floating buttons (playground mode)')
            setShowButton(true)  // Keep for backwards compatibility
            setIsInPlayground(true)  // Mark as inside playground - hide floating buttons
            break
          case 'start-selection':
            // Parent wants us to enter selection mode
            console.log('[ForgeInspector] Starting selection mode')
            setState(State.HOVER)
            setTrigger(Trigger.BUTTON)
            break
          case 'stop-selection':
            // Parent wants us to exit selection mode
            console.log('[ForgeInspector] Stopping selection mode')
            setState(State.IDLE)
            setTrigger(null)
            break
          case 'confirm-step-response':
            // Handled by confirmStep tool internally
            break
          case 'start-recording':
            // Parent wants us to start visual recording with model config
            const payloadConfig = data.payload?.modelConfig
            const payloadApiKey = data.payload?.apiKey
            const isCloudModel = payloadConfig?.type === 'cloud'

            console.log('[ForgeInspector] start-recording received. isRecording:', isRecordingRef.current, 'hasWebGPU:', hasWebGPURef.current, 'isCloud:', isCloudModel, 'payload:', data.payload)

            // Cloud models don't need WebGPU, local models do
            if (!isRecordingRef.current && (hasWebGPURef.current || isCloudModel)) {
              console.log('[ForgeInspector] Starting recording with config:', payloadConfig?.id || 'default')
              startRecordingWithModel(payloadConfig, payloadApiKey)
            } else {
              const errorMsg = isRecordingRef.current
                ? 'Already recording'
                : 'WebGPU not available - please select a cloud model (Gemini)'
              console.warn('[ForgeInspector] Cannot start recording:', errorMsg)
              // Send error back to parent
              window.parent.postMessage({
                type: 'forge-inspector',
                action: 'recording-error',
                payload: { error: errorMsg }
              }, '*')
            }
            break
          case 'stop-recording':
            // Parent wants us to stop visual recording
            console.log('[ForgeInspector] Stopping recording from parent message')
            if (isRecordingRef.current) {
              toggleRecording()
            }
            break
        }
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [startRecordingWithModel, toggleRecording])

  // Cleanup visual agent on unmount
  React.useEffect(() => {
    return () => {
      if (visualAgentRef.current) {
        visualAgentRef.current.terminate()
        visualAgentRef.current = null
      }
    }
  }, [])

  // Send ready message to parent when capabilities are known
  React.useEffect(function sendReadyMessage() {
    // Only send after we've checked capabilities (hasWebGPU will be false initially, then updated)
    // This effect runs on hasWebGPU change, so we send when we know the actual value
    if (
      typeof window !== 'undefined' &&
      window.parent &&
      window.parent !== window &&
      typeof window.parent.postMessage === 'function'
    ) {
      try {
        window.parent.postMessage(
          {
            source: MESSAGE_SOURCE,
            version: MESSAGE_VERSION,
            type: 'ready',
            payload: {
              hasWebGPU: hasWebGPU
            }
          },
          getTargetOrigin()
        )
      } catch (err) {
        console.warn('[ForgeInspector] ready message failed', err)
      }
    }
    // Not logging "Not in iframe" to reduce console noise
  }, [hasWebGPU])

  React.useEffect(
    function addEventListenersToWindow() {
      window.addEventListener('click', onClick, { capture: true })
      window.addEventListener('contextmenu', onContextMenu, { capture: true })
      window.addEventListener('keydown', onKeyDown)
      window.addEventListener('keyup', onKeyUp)
      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('blur', onBlur)

      return function removeEventListenersFromWindow() {
        window.removeEventListener('click', onClick, { capture: true })
        window.removeEventListener('contextmenu', onContextMenu, {
          capture: true,
        })
        window.removeEventListener('keydown', onKeyDown)
        window.removeEventListener('keyup', onKeyUp)
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('blur', onBlur)
      }
    },
    [onClick, onContextMenu, onKeyDown, onKeyUp, onMouseMove, onBlur]
  )

  return html`
    <style key="click-to-component-style">
      [data-click-to-component] * {
        pointer-events: auto !important;
      }

      [data-click-to-component-target] {
        cursor: var(--click-to-component-cursor, crosshair) !important;
        outline: auto 1px;
        outline: var(
          --click-to-component-outline,
          -webkit-focus-ring-color auto 1px
        ) !important;
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }

      [data-recording-active] {
        outline: 2px solid #dc2626 !important;
        outline-offset: 2px;
      }
    </style>

    <${FloatingPortal} key="click-to-component-portal">
      <!-- Record Button - Only when showButton is true AND not in playground -->
      ${showButton && !isInPlayground && html`
        <${RecordButton}
          key="click-to-component-record-button"
          recording=${isRecording}
          status=${recordingStatus}
          disabled=${!hasWebGPU}
          onToggle=${toggleRecording}
        />
      `}

      <!-- Target Button - Only when showButton is true AND not in playground -->
      ${showButton && !isInPlayground && html`
        <${TargetButton}
          key="click-to-component-target-button"
          active=${state === State.HOVER && trigger === Trigger.BUTTON}
          onToggle=${toggleTargeting}
        />
      `}

      <!-- Model Selection Modal -->
      ${showModelModal && html`
        <div
          key="model-selection-modal"
          style=${{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            backdropFilter: 'blur(4px)'
          }}
          onClick=${(e) => e.target === e.currentTarget && setShowModelModal(false)}
        >
          <div style=${{
            background: '#1a1a2e',
            borderRadius: '16px',
            padding: '24px',
            width: '400px',
            maxWidth: '90vw',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <h2 style=${{
              margin: '0 0 20px 0',
              fontSize: '18px',
              fontWeight: '600',
              color: '#fff',
              fontFamily: 'system-ui, -apple-system, sans-serif'
            }}>Select Vision Model</h2>

            <div style=${{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              ${AVAILABLE_MODELS.map(model => html`
                <label
                  key=${model.id}
                  style=${{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '12px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    background: selectedModelId === model.id ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    border: selectedModelId === model.id ? '1px solid rgba(99, 102, 241, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
                    transition: 'all 0.2s ease'
                  }}
                  onClick=${() => setSelectedModelId(model.id)}
                >
                  <input
                    type="radio"
                    name="model"
                    checked=${selectedModelId === model.id}
                    style=${{ marginTop: '4px', accentColor: '#6366f1' }}
                  />
                  <div style=${{ flex: 1 }}>
                    <div style=${{
                      fontWeight: '500',
                      color: '#fff',
                      fontSize: '14px',
                      fontFamily: 'system-ui, -apple-system, sans-serif'
                    }}>${model.name}</div>
                    <div style=${{
                      fontSize: '12px',
                      color: 'rgba(255, 255, 255, 0.6)',
                      marginTop: '4px',
                      fontFamily: 'system-ui, -apple-system, sans-serif'
                    }}>${model.description}</div>
                    <div style=${{
                      fontSize: '11px',
                      color: model.type === 'cloud' ? '#10b981' : '#6366f1',
                      marginTop: '4px',
                      fontFamily: 'monospace'
                    }}>${model.size}</div>
                  </div>
                </label>
              `)}
            </div>

            <!-- API Key input for Gemini -->
            ${getSelectedModel()?.requiresApiKey && html`
              <div style=${{ marginTop: '16px' }}>
                <label style=${{
                  display: 'block',
                  fontSize: '12px',
                  color: 'rgba(255, 255, 255, 0.7)',
                  marginBottom: '6px',
                  fontFamily: 'system-ui, -apple-system, sans-serif'
                }}>Gemini API Key</label>
                <input
                  type="password"
                  value=${geminiApiKey}
                  onChange=${(e) => setGeminiApiKey(e.target.value)}
                  placeholder="Enter your API key"
                  style=${{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    background: 'rgba(0, 0, 0, 0.3)',
                    color: '#fff',
                    fontSize: '14px',
                    fontFamily: 'monospace',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            `}

            <div style=${{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button
                onClick=${() => setShowModelModal(false)}
                style=${{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  background: 'transparent',
                  color: '#fff',
                  fontSize: '14px',
                  cursor: 'pointer',
                  fontFamily: 'system-ui, -apple-system, sans-serif'
                }}
              >Cancel</button>
              <button
                onClick=${startRecordingWithModel}
                style=${{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#6366f1',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  fontFamily: 'system-ui, -apple-system, sans-serif'
                }}
              >Start Recording</button>
            </div>
          </div>
        </div>
      `}

      <!-- Loading Progress Overlay -->
      ${modelLoading && html`
        <div
          key="loading-overlay"
          style=${{
            position: 'fixed',
            bottom: '80px',
            right: '12px',
            background: '#1a1a2e',
            borderRadius: '12px',
            padding: '16px 20px',
            width: '280px',
            boxShadow: '0 10px 40px -10px rgba(0, 0, 0, 0.5)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            zIndex: 10000
          }}
        >
          <div style=${{
            fontSize: '12px',
            color: 'rgba(255, 255, 255, 0.7)',
            marginBottom: '8px',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}>Loading Model...</div>
          <div style=${{
            fontSize: '14px',
            color: '#fff',
            fontWeight: '500',
            marginBottom: '12px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>${modelLoading.modelId?.split('/').pop() || 'Model'}</div>
          <div style=${{
            height: '6px',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '3px',
            overflow: 'hidden'
          }}>
            <div style=${{
              height: '100%',
              width: `${Math.round((modelLoading.progress || 0) * 100)}%`,
              background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
              borderRadius: '3px',
              transition: 'width 0.3s ease'
            }}></div>
          </div>
          <div style=${{
            fontSize: '11px',
            color: 'rgba(255, 255, 255, 0.5)',
            marginTop: '8px',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}>${modelLoading.status || 'Initializing...'}</div>
        </div>
      `}
    </${FloatingPortal}>
  `
}
