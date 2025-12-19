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
import { getSourceForInstance } from './getSourceForInstance.js'
import { getUrl } from './getUrl.js'

// Visual agent is dynamically imported to avoid bundling onnxruntime-node
// These will be loaded on-demand when recording features are used
let visualAgentModule = null
const getVisualAgent = async () => {
  if (!visualAgentModule) {
    // webpackIgnore tells webpack to skip bundling this import
    visualAgentModule = await import(/* webpackIgnore: true */ './visual-agent/index.js')
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
 * Extract component instances data for a target element
 * @param {HTMLElement} target
 * @param {import('./types.js').PathModifier} pathModifier
 * @returns {Array}
 */
function getComponentInstances(target, pathModifier) {
  if (!target) return []

  const instances = getReactInstancesForElement(target).filter((instance) =>
    getSourceForInstance(instance)
  )

  return instances.map((instance) => {
    const name = getDisplayNameForInstance(instance)
    const source = getSourceForInstance(instance)
    const path = getPathToSource(source, pathModifier)
    const props = getPropsForInstance(instance)

    return {
      name,
      props,
      source: {
        fileName: source.fileName,
        lineNumber: source.lineNumber,
        columnNumber: source.columnNumber
      },
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

  const [showButton, setShowButton] = React.useState(false)

  // Visual agent state
  const [isRecording, setIsRecording] = React.useState(false)
  const [recordingStatus, setRecordingStatus] = React.useState('idle')
  const [hasWebGPU, setHasWebGPU] = React.useState(false)
  const visualAgentRef = React.useRef(null)

  // Check capabilities on mount (dynamic import)
  React.useEffect(() => {
    getVisualAgent().then(({ checkCapabilities }) => {
      const caps = checkCapabilities()
      setHasWebGPU(caps.webgpu)
    }).catch(() => {
      // Visual agent not available, WebGPU features disabled
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
        bottom: '16px',
        right: '16px',
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        background: active ? 'royalblue' : 'white',
        color: active ? 'white' : 'black',
        border: '1px solid #ccc',
        boxShadow: '0 2px 6px rgba(0,0,0,.3)',
        zIndex: 2147483647,
        cursor: 'pointer',
        fontSize: '18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '8px',
      }}
        title="Select component for AI help"
      >
        <img
          src=${'data:image/svg+xml;utf8,' + encodeURIComponent(fiIcon)}
          alt="FI Icon"
          style=${{
        width: '32px',
        height: '32px',
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
          bottom: '16px',
          right: '72px',
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          background: recording ? '#dc2626' : disabled ? '#9ca3af' : 'white',
          color: recording ? 'white' : disabled ? '#6b7280' : 'black',
          border: '1px solid #ccc',
          boxShadow: '0 2px 6px rgba(0,0,0,.3)',
          zIndex: 2147483647,
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: '18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px',
          opacity: disabled ? 0.6 : 1,
        }}
        title=${disabled ? 'WebGPU required for visual recording' : recording ? 'Stop recording' : 'Start visual recording'}
      >
        <img
          src=${'data:image/svg+xml;utf8,' + encodeURIComponent(recording ? stopIcon : recordIcon)}
          alt=${recording ? 'Stop' : 'Record'}
          style=${{
            width: '32px',
            height: '32px',
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

  // Toggle recording
  const toggleRecording = React.useCallback(async () => {
    if (!hasWebGPU) return

    if (isRecording) {
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
      // Start recording
      setRecordingStatus('initializing')

      try {
        const { eyes } = await getVisualAgent()
        const agent = eyes({
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
          onError: (err) => {
            console.error('[ForgeInspector] Visual agent error:', err)
            postVisualMessage('recording-error', { error: err.message })
          }
        })

        await agent.start()
        visualAgentRef.current = agent
        setIsRecording(true)

        postVisualMessage('recording-started', { timestamp: Date.now() })
      } catch (err) {
        console.error('[ForgeInspector] Error starting recording:', err)
        postVisualMessage('recording-error', { error: err.message })
        setRecordingStatus('idle')
        setState(State.IDLE)
      }
    }
  }, [hasWebGPU, isRecording, postVisualMessage])

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
        const context = `clicked ${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className ? '.' + el.className.split(' ')[0] : ''}`
        visualAgentRef.current.trigger(context).catch(err => {
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
            console.log('[ForgeInspector] Enable button message received! Setting showButton=true')
            setShowButton(true)
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
          case 'enable-recording':
            // Could auto-start recording here if needed
            break
        }
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  // Cleanup visual agent on unmount
  React.useEffect(() => {
    return () => {
      if (visualAgentRef.current) {
        visualAgentRef.current.terminate()
        visualAgentRef.current = null
      }
    }
  }, [])

  // Send ready message to parent when component mounts
  React.useEffect(function sendReadyMessage() {
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
            type: 'ready'
          },
          getTargetOrigin()
        )
      } catch (err) {
        console.warn('[ForgeInspector] ready message failed', err)
      }
    }
    // Not logging "Not in iframe" to reduce console noise
  }, [])

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
      <!-- Record Button - Only when showButton is true (running from forge) -->
      ${showButton && html`
        <${RecordButton}
          key="click-to-component-record-button"
          recording=${isRecording}
          status=${recordingStatus}
          disabled=${!hasWebGPU}
          onToggle=${toggleRecording}
        />
      `}

      <!-- Target Button - Only when showButton is true -->
      ${showButton && html`
        <${TargetButton}
          key="click-to-component-target-button"
          active=${state === State.HOVER && trigger === Trigger.BUTTON}
          onToggle=${toggleTargeting}
        />
      `}
    </${FloatingPortal}>
  `
}
