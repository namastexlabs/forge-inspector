'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Header } from './components/layout'
import { ChatDrawer, ChatErrorBoundary, RecordingOverlay } from './components/inspector'
import { ChatMessageData, ElementContent } from './components/inspector/ChatMessage'
import { UrlInput, IframeView, ConnectionStatus, type ConnectionState } from './components/external'
import styles from './components/layout/layout.module.css'
import externalStyles from './components/external/external.module.css'
import inspectorStyles from './components/inspector/inspector.module.css'

// Message source for iframe communication
const MESSAGE_SOURCE = 'click-to-component'
const MESSAGE_VERSION = 1

// Connection timeout in ms
const CONNECTION_TIMEOUT = 5000

// Installation prompt for AI agents
const INSTALL_PROMPT = `Goal: Install and integrate the forge-inspector so it renders at the app root in development.

Do:
1) Detect package manager from lockfiles and use it:
   - pnpm-lock.yaml → pnpm add forge-inspector
   - yarn.lock → yarn add forge-inspector
   - package-lock.json → npm i forge-inspector
   - bun.lockb → bun add forge-inspector
   If already listed in package.json dependencies, skip install.

2) Detect framework and app entry:
   - Next.js (pages router): pages/_app.(tsx|js)
   - Next.js (app router): app/layout.(tsx|js) or an app/providers.(tsx|js)
   - Vite/CRA: src/main.(tsx|jsx|ts|js) and src/App.(tsx|jsx|ts|js)
   - Monorepo: operate in the correct package for the web app.
   Confirm by reading package.json and directory structure.

3) Integrate the component:
   import { ForgeInspector } from 'forge-inspector';
   - Vite/CRA: render <ForgeInspector /> at the app root.
   - Next.js (pages): render in pages/_app.*
   - Next.js (app): render in app/layout.* or a client providers component.
   - For Next.js, if SSR issues arise, use dynamic import with ssr: false.

4) Verify:
   - Type-check, lint/format if configured.
   - Ensure it compiles and renders without SSR/hydration errors.

Acceptance:
- forge-inspector is installed in the correct package.
- The component is rendered once at the app root without SSR/hydration errors.
- Build/type-check passes.`

export default function PlaygroundPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const demoTimeoutsRef = useRef<NodeJS.Timeout[]>([])
  const isMountedRef = useRef(true)

  // State
  const [url, setUrl] = useState<string | null>(null)
  const [webGpuAvailable, setWebGpuAvailable] = useState(false)
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle')
  const [isSelecting, setIsSelecting] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isDrawerOpen, setIsDrawerOpen] = useState(true)
  const [messages, setMessages] = useState<ChatMessageData[]>([])
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [installPromptCopied, setInstallPromptCopied] = useState(false)
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const installCopyTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Helper to add a message (checks if mounted to prevent stale updates)
  const addMessage = useCallback((type: ChatMessageData['type'], content: ChatMessageData['content']) => {
    if (!isMountedRef.current) return
    // Type assertion needed because TypeScript can't narrow discriminated union
    // when type and content come from separate parameters
    const newMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      timestamp: Date.now(),
      content,
    } as ChatMessageData
    setMessages((prev) => [...prev, newMessage])
  }, [])

  // Clear connection timeout
  const clearConnectionTimeout = useCallback(() => {
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current)
      connectionTimeoutRef.current = null
    }
  }, [])

  // Clear demo timeouts
  const clearDemoTimeouts = useCallback(() => {
    demoTimeoutsRef.current.forEach(clearTimeout)
    demoTimeoutsRef.current = []
  }, [])

  // Show toast notification
  const showToast = useCallback((message: string) => {
    // Clear any existing toast timeout
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current)
    }
    setToastMessage(message)
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null)
    }, 2500)
  }, [])

  // Check WebGPU availability
  useEffect(() => {
    const checkCapabilities = async () => {
      try {
        if ('gpu' in navigator) {
          const adapter = await (navigator as { gpu: { requestAdapter: () => Promise<unknown> } }).gpu.requestAdapter()
          setWebGpuAvailable(!!adapter)
        }
      } catch (err) {
        console.info('[Playground] WebGPU not available:', err)
        setWebGpuAvailable(false)
      }
    }
    checkCapabilities()
  }, [])

  // Listen for messages from ForgeInspector in iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.source !== MESSAGE_SOURCE) return

      // Validate source - must come from our iframe window
      // Using source validation instead of origin to handle redirects (HTTP->HTTPS, domain canonicalization)
      if (iframeRef.current?.contentWindow && event.source !== iframeRef.current.contentWindow) {
        console.warn('[Playground] Rejected message from unexpected source')
        return
      }

      console.log('[Playground] Received message:', event.data.type)

      switch (event.data.type) {
        case 'ready':
          console.log('[Playground] ForgeInspector ready, sending enable-button')
          // Clear the connection timeout since we got a response
          clearConnectionTimeout()
          setConnectionState('connected')
          // Send enable-button message to signal playground mode (inspector hides floating buttons, playground controls selection)
          if (event.source && event.origin) {
            (event.source as Window).postMessage(
              {
                source: MESSAGE_SOURCE,
                version: MESSAGE_VERSION,
                type: 'enable-button',
              },
              event.origin
            )
          }
          // Add system message
          addMessage('system', 'Connected to ForgeInspector. Ready for element selection.')
          break

        case 'open-in-editor':
          if (event.data.payload?.selected) {
            const { selected, clickedElement } = event.data.payload

            // Create element content for the message with enhanced AI context
            const elementContent: ElementContent = {
              tag: clickedElement?.tag || 'unknown',
              componentName: selected.name || undefined,
              source: selected.source?.fileName ? {
                fileName: selected.source.fileName,
                lineNumber: selected.source.lineNumber,
                columnNumber: selected.source.columnNumber,
              } : undefined,
              // Props now has {values, types} structure
              props: selected.props || undefined,
              dom: clickedElement?.domPath || undefined,
              // Enhanced context for AI debugging
              textContent: clickedElement?.textContent || undefined,
              testId: clickedElement?.testId || undefined,
              aria: clickedElement?.aria || undefined,
              form: clickedElement?.form || undefined,
            }

            // Add element message
            addMessage('element', elementContent)

            // Auto-copy to clipboard
            try {
              const clipboardData = JSON.stringify(elementContent, null, 2)
              navigator.clipboard.writeText(clipboardData).then(() => {
                showToast('Element copied to clipboard')
              }).catch((err) => {
                console.warn('[Playground] Clipboard write failed:', err)
              })
            } catch (err) {
              console.warn('[Playground] Clipboard copy error:', err)
            }

            // Auto-deactivate selection mode
            setIsSelecting(false)
          }
          break

        case 'recording-started':
          setIsRecording(true)
          addMessage('recording', 'Recording started. Observing page interactions...')
          break

        case 'recording-observation':
          if (event.data.payload) {
            addMessage('observation', event.data.payload.observation || event.data.payload.text)
          }
          break

        case 'recording-stopped':
        case 'qa-report':
          setIsRecording(false)
          addMessage('system', 'Recording stopped.')
          break

        case 'recording-error':
          if (event.data.payload?.error) {
            addMessage('error', `Recording error: ${event.data.payload.error}`)
          }
          setIsRecording(false)
          break
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [addMessage, clearConnectionTimeout, showToast])

  // Handle URL load
  const handleLoadUrl = useCallback((newUrl: string) => {
    // Clear any existing timeout
    clearConnectionTimeout()

    setUrl(newUrl)
    setConnectionState('loading')
    setMessages([])
    setIsSelecting(false)
    setIsRecording(false)
    addMessage('system', `Loading ${newUrl}...`)
  }, [addMessage, clearConnectionTimeout])

  // Handle "Test Sample Components" button
  const handleTestSampleComponents = useCallback(() => {
    const embedUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/embed`
      : '/embed'
    handleLoadUrl(embedUrl)
  }, [handleLoadUrl])

  // Handle iframe load
  const handleIframeLoad = useCallback(() => {
    // Skip if already connected (iframe may fire onLoad on internal navigation)
    if (connectionState === 'connected') {
      console.log('[Playground] Iframe loaded (internal navigation), already connected')
      return
    }

    console.log('[Playground] Iframe loaded, waiting for ready message')
    setConnectionState('waiting')

    // Set timeout for connection detection
    connectionTimeoutRef.current = setTimeout(() => {
      setConnectionState('not-installed')
      addMessage('system', 'ForgeInspector not detected. Make sure forge-inspector is installed in the target app.')
    }, CONNECTION_TIMEOUT)
  }, [addMessage, connectionState])

  // Send message to iframe
  const sendToIframe = useCallback((type: string, payload?: unknown) => {
    if (iframeRef.current?.contentWindow) {
      // Use '*' for targetOrigin since iframe may have redirected
      // This is safe because we validate incoming messages by source (window reference)
      iframeRef.current.contentWindow.postMessage(
        {
          source: MESSAGE_SOURCE,
          version: MESSAGE_VERSION,
          type,
          payload,
        },
        '*'
      )
    }
  }, [])

  // Handle select element toggle
  const handleToggleSelection = useCallback(() => {
    const newState = !isSelecting
    setIsSelecting(newState)

    // Send message to iframe to toggle selection mode
    sendToIframe(newState ? 'start-selection' : 'stop-selection')

    if (newState) {
      addMessage('system', 'Selection mode active. Click an element in the preview to inspect it.')
    }
  }, [isSelecting, sendToIframe, addMessage])

  // Handle recording toggle
  const handleToggleRecording = useCallback(() => {
    if (isRecording) {
      // Stop recording - clear any pending demo timeouts
      clearDemoTimeouts()
      setIsRecording(false)
    } else {
      // Start recording
      setIsRecording(true)
      setMessages([]) // Clear messages on new recording
      clearDemoTimeouts() // Clear any existing demo timeouts

      // Demo observations since recording requires the visual agent
      const demoObservations = [
        'Page loaded, analyzing initial state...',
        'Detected interactive form with 3 input fields',
        'Button states component shows 5 variants',
        'Data table has 3 rows with sortable columns',
      ]

      addMessage('recording', 'Recording started. Observing page interactions...')

      demoObservations.forEach((text, index) => {
        const timeoutId = setTimeout(() => {
          addMessage('observation', text)
        }, (index + 1) * 2000)
        demoTimeoutsRef.current.push(timeoutId)
      })
    }
  }, [isRecording, addMessage, clearDemoTimeouts])

  // Handle copy message
  const handleCopyMessage = useCallback((content: string) => {
    navigator.clipboard.writeText(content)
    addMessage('system', 'Copied to clipboard!')
  }, [addMessage])

  // Handle open in editor
  const handleOpenEditor = useCallback((source: ElementContent['source']) => {
    if (source?.fileName) {
      const editorUrl = `vscode://file/${source.fileName}:${source.lineNumber}:${source.columnNumber || 0}`
      window.open(editorUrl, '_blank')
    }
  }, [])

  // Close drawer
  const handleCloseDrawer = useCallback(() => {
    setIsDrawerOpen(false)
  }, [])

  // Reopen drawer
  const handleReopenDrawer = useCallback(() => {
    setIsDrawerOpen(true)
  }, [])

  // Copy installation prompt
  const handleCopyInstallPrompt = useCallback(() => {
    if (installCopyTimeoutRef.current) {
      clearTimeout(installCopyTimeoutRef.current)
    }
    navigator.clipboard.writeText(INSTALL_PROMPT).then(() => {
      setInstallPromptCopied(true)
      showToast('Installation prompt copied')
      installCopyTimeoutRef.current = setTimeout(() => {
        setInstallPromptCopied(false)
      }, 2500)
    }).catch((err) => {
      console.warn('[Playground] Failed to copy install prompt:', err)
    })
  }, [showToast])

  // Set mounted ref and cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      clearConnectionTimeout()
      clearDemoTimeouts()
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current)
      }
      if (installCopyTimeoutRef.current) {
        clearTimeout(installCopyTimeoutRef.current)
      }
    }
  }, [clearConnectionTimeout, clearDemoTimeouts])

  return (
    <>
      <Header webGpuAvailable={webGpuAvailable} />

      <main className={`${styles.main} ${isDrawerOpen ? styles.mainWithDrawer : ''}`}>
        <div className={styles.mainContent}>
          <h1 className={`${styles.pageTitle} animate-emerge`}>
            Playground
          </h1>
          <p className={`${styles.pageSubtitle} animate-emerge delay-1`}>
            Load a project with forge-inspector installed to test element picking and recording.
          </p>

          <UrlInput
            onLoad={handleLoadUrl}
            isLoading={connectionState === 'loading'}
          />

          <div className="animate-emerge delay-2" style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            {!url && (
              <button
                className={externalStyles.urlInputButton}
                onClick={handleTestSampleComponents}
                style={{ flex: 1 }}
              >
                Test with Sample Components
              </button>
            )}
            <button
              className={`${externalStyles.installPromptButton} ${installPromptCopied ? externalStyles.installPromptButtonCopied : ''}`}
              onClick={handleCopyInstallPrompt}
            >
              <span className={externalStyles.installPromptIcon}>{installPromptCopied ? '✓' : '📋'}</span>
              {installPromptCopied ? 'Copied!' : 'Copy Install Prompt'}
            </button>
          </div>

          <div className={externalStyles.externalLayout}>
            <div className={externalStyles.externalMain}>
              <div style={{ position: 'relative' }}>
                <IframeView
                  ref={iframeRef}
                  url={url}
                  onLoad={handleIframeLoad}
                />
                <ConnectionStatus state={connectionState} />
              </div>

              {connectionState === 'not-installed' && (
                <div className={externalStyles.notInstalledBanner}>
                  <span className={externalStyles.notInstalledIcon}>⚠️</span>
                  <div className={externalStyles.notInstalledContent}>
                    <div className={externalStyles.notInstalledTitle}>
                      forge-inspector not detected
                    </div>
                    <div className={externalStyles.notInstalledText}>
                      The loaded project doesn&apos;t appear to have forge-inspector installed.
                      Copy the installation prompt below and paste it to your AI assistant to set it up.
                    </div>
                    <div className={externalStyles.notInstalledActions}>
                      <button
                        className={externalStyles.notInstalledCopyButton}
                        onClick={handleCopyInstallPrompt}
                      >
                        {installPromptCopied ? '✓ Copied!' : '📋 Copy Installation Prompt'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <ChatErrorBoundary
        onError={(error) => console.error('[ChatDrawer Error]', error)}
      >
        <ChatDrawer
          messages={messages}
          isOpen={isDrawerOpen}
          isSelecting={isSelecting}
          isRecording={isRecording}
          webGpuAvailable={webGpuAvailable}
          onToggleSelection={handleToggleSelection}
          onToggleRecording={handleToggleRecording}
          onClose={handleCloseDrawer}
          onCopyMessage={handleCopyMessage}
          onOpenEditor={handleOpenEditor}
        />
      </ChatErrorBoundary>

      <RecordingOverlay isRecording={isRecording} />

      {!isDrawerOpen && (
        <button
          className={inspectorStyles.reopenConsoleButton}
          onClick={handleReopenDrawer}
          aria-label="Open console"
        >
          <span className={inspectorStyles.reopenConsoleIcon}>⚡</span>
          Console
        </button>
      )}

      {toastMessage && (
        <div className={inspectorStyles.toast}>
          <span className={inspectorStyles.toastIcon}>✓</span>
          {toastMessage}
        </div>
      )}
    </>
  )
}
