'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Header } from './components/layout'
import { ChatDrawer, ChatErrorBoundary, RecordingOverlay } from './components/inspector'
import { ChatMessageData, ElementContent } from './components/inspector/ChatMessage'
import { UrlInput, IframeView, ConnectionStatus, type ConnectionState } from './components/external'
import styles from './components/layout/layout.module.css'
import externalStyles from './components/external/external.module.css'

// Message source for iframe communication
const MESSAGE_SOURCE = 'click-to-component'
const MESSAGE_VERSION = 1

// Connection timeout in ms
const CONNECTION_TIMEOUT = 5000

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

      // Validate origin - must match loaded URL's origin for security
      if (url) {
        try {
          const expectedOrigin = new URL(url).origin
          if (event.origin !== expectedOrigin) {
            console.warn('[Playground] Rejected message from unexpected origin:', event.origin, 'expected:', expectedOrigin)
            return
          }
        } catch (err) {
          console.warn('[Playground] Failed to validate message origin:', err)
          return
        }
      }

      console.log('[Playground] Received message:', event.data.type)

      switch (event.data.type) {
        case 'ready':
          console.log('[Playground] ForgeInspector ready, sending enable-button')
          // Clear the connection timeout since we got a response
          clearConnectionTimeout()
          setConnectionState('connected')
          // Send enable-button message to show the selection/recording buttons
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

            // Create element content for the message
            const elementContent: ElementContent = {
              tag: clickedElement?.tag || 'unknown',
              componentName: selected.name || undefined,
              source: selected.source?.fileName ? {
                fileName: selected.source.fileName,
                lineNumber: selected.source.lineNumber,
                columnNumber: selected.source.columnNumber,
              } : undefined,
              props: selected.props || undefined,
            }

            // Add element message
            addMessage('element', elementContent)

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
  }, [addMessage, clearConnectionTimeout, url])

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
    console.log('[Playground] Iframe loaded, waiting for ready message')
    setConnectionState('waiting')

    // Set timeout for connection detection
    connectionTimeoutRef.current = setTimeout(() => {
      setConnectionState('not-installed')
      addMessage('system', 'ForgeInspector not detected. Make sure forge-inspector is installed in the target app.')
    }, CONNECTION_TIMEOUT)
  }, [addMessage])

  // Send message to iframe
  const sendToIframe = useCallback((type: string, payload?: unknown) => {
    if (iframeRef.current?.contentWindow && url) {
      // Use the iframe's origin for security
      const targetOrigin = new URL(url).origin
      iframeRef.current.contentWindow.postMessage(
        {
          source: MESSAGE_SOURCE,
          version: MESSAGE_VERSION,
          type,
          payload,
        },
        targetOrigin
      )
    }
  }, [url])

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

  // Set mounted ref and cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      clearConnectionTimeout()
      clearDemoTimeouts()
    }
  }, [clearConnectionTimeout, clearDemoTimeouts])

  return (
    <>
      <Header webGpuAvailable={webGpuAvailable} />

      <main className={styles.main}>
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

          {!url && (
            <div className={`${externalStyles.urlInput} animate-emerge delay-2`}>
              <button
                className={externalStyles.urlInputButton}
                onClick={handleTestSampleComponents}
                style={{ width: '100%' }}
              >
                Test with Sample Components
              </button>
            </div>
          )}

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
    </>
  )
}
