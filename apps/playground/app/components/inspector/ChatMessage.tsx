'use client'

import { useState } from 'react'
import styles from './inspector.module.css'

export type MessageType = 'system' | 'element' | 'observation' | 'error' | 'recording'

export interface ElementContent {
  tag: string
  componentName?: string
  source?: {
    fileName: string
    lineNumber: number
    columnNumber?: number
  }
  props?: Record<string, unknown>
  dom?: string
}

// Discriminated union for type-safe message handling
interface BaseMessage {
  id: string
  timestamp: number
}

interface SystemMessage extends BaseMessage {
  type: 'system' | 'error' | 'recording' | 'observation'
  content: string
}

interface ElementMessage extends BaseMessage {
  type: 'element'
  content: ElementContent
}

export type ChatMessageData = SystemMessage | ElementMessage

// Constants for safeStringify configuration
const SAFE_STRINGIFY_DEFAULTS = {
  MAX_DEPTH: 5,
  MAX_STRING_LENGTH: 500,
} as const

/**
 * Type guard to check if content is ElementContent
 */
function isElementContent(content: unknown): content is ElementContent {
  return (
    typeof content === 'object' &&
    content !== null &&
    'tag' in content &&
    typeof (content as ElementContent).tag === 'string'
  )
}

interface ChatMessageProps {
  message: ChatMessageData
  onCopy?: (content: string) => void
  onOpenEditor?: (source: ElementContent['source']) => void
}

const typeIcons: Record<MessageType, string> = {
  system: '◎',
  element: '◉',
  observation: '◇',
  error: '⚠',
  recording: '●',
}

const typeLabels: Record<MessageType, string> = {
  system: 'SYSTEM',
  element: 'ELEMENT',
  observation: 'OBSERVATION',
  error: 'ERROR',
  recording: 'RECORDING',
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/**
 * Safely stringify an object, handling circular references and limiting depth.
 * @param obj - The object to stringify
 * @param maxDepth - Maximum nesting depth (default: 5)
 * @param maxStringLength - Maximum length for string values (default: 500)
 */
function safeStringify(
  obj: unknown,
  maxDepth = SAFE_STRINGIFY_DEFAULTS.MAX_DEPTH,
  maxStringLength = SAFE_STRINGIFY_DEFAULTS.MAX_STRING_LENGTH
): string {
  const seen = new WeakSet<object>()

  function serialize(value: unknown, depth: number): unknown {
    // Handle primitives
    if (value === null || value === undefined) return value
    if (typeof value === 'boolean' || typeof value === 'number') return value

    // Truncate long strings
    if (typeof value === 'string') {
      if (value.length > maxStringLength) {
        return value.slice(0, maxStringLength) + '...[truncated]'
      }
      return value
    }

    // Handle functions
    if (typeof value === 'function') {
      return '[Function]'
    }

    // Check depth limit
    if (depth > maxDepth) {
      return '[Max depth exceeded]'
    }

    // Handle objects and arrays
    if (typeof value === 'object') {
      // Check for circular reference
      if (seen.has(value)) {
        return '[Circular]'
      }
      seen.add(value)

      if (Array.isArray(value)) {
        return value.map((item) => serialize(item, depth + 1))
      }

      const result: Record<string, unknown> = {}
      for (const key of Object.keys(value)) {
        try {
          result[key] = serialize((value as Record<string, unknown>)[key], depth + 1)
        } catch (err) {
          result[key] = `[Error: ${err instanceof Error ? err.message : 'unknown'}]`
        }
      }
      return result
    }

    return String(value)
  }

  try {
    const sanitized = serialize(obj, 0)
    return JSON.stringify(sanitized, null, 2)
  } catch (err) {
    console.warn('[ChatMessage] safeStringify failed:', err)
    return `[Object: ${typeof obj}]`
  }
}

function formatProps(props: Record<string, unknown>): string {
  return safeStringify(props)
}

export function ChatMessage({ message, onCopy, onOpenEditor }: ChatMessageProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  // Use discriminated union for type-safe narrowing
  const isElement = message.type === 'element'
  const elementContent = isElement && isElementContent(message.content) ? message.content : null

  const messageClass = `${styles.chatMessage} ${styles[`chatMessage${message.type.charAt(0).toUpperCase() + message.type.slice(1)}`]}`

  return (
    <div className={messageClass}>
      {/* Header */}
      <div className={styles.chatMessageHeader}>
        <span className={styles.chatMessageIcon}>{typeIcons[message.type]}</span>
        <span className={styles.chatMessageLabel}>{typeLabels[message.type]}</span>
        <span className={styles.chatMessageTime}>{formatTime(message.timestamp)}</span>
        {isElement && (
          <button
            className={styles.chatMessageToggle}
            onClick={() => setIsExpanded(!isExpanded)}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? '−' : '+'}
          </button>
        )}
      </div>

      {/* Content */}
      <div className={styles.chatMessageContent}>
        {typeof message.content === 'string' ? (
          <p className={styles.chatMessageText}>{message.content}</p>
        ) : elementContent && (
          <>
            {/* Element preview */}
            <div className={styles.chatMessageElement}>
              <code className={styles.chatMessageTag}>
                {'<'}{elementContent.componentName || elementContent.tag}
                {elementContent.props && Object.keys(elementContent.props).length > 0 && (
                  <span className={styles.chatMessageTagProps}>
                    {' '}{Object.entries(elementContent.props).slice(0, 2).map(([k, v]) =>
                      `${k}="${String(v)}"`
                    ).join(' ')}
                    {Object.keys(elementContent.props).length > 2 && ' ...'}
                  </span>
                )}
                {'>'}
              </code>
            </div>

            {/* Expanded details */}
            {isExpanded && (
              <div className={styles.chatMessageDetails}>
                {elementContent.componentName && (
                  <div className={styles.chatMessageField}>
                    <span className={styles.chatMessageFieldLabel}>Component</span>
                    <span className={styles.chatMessageFieldValue}>{elementContent.componentName}</span>
                  </div>
                )}

                {elementContent.source && (
                  <div className={styles.chatMessageField}>
                    <span className={styles.chatMessageFieldLabel}>Source</span>
                    <span className={styles.chatMessageFieldValue}>
                      {elementContent.source.fileName.split('/').pop()}
                      <span className={styles.chatMessageSourceLine}>
                        :{elementContent.source.lineNumber}
                        {elementContent.source.columnNumber && `:${elementContent.source.columnNumber}`}
                      </span>
                    </span>
                  </div>
                )}

                {elementContent.props && Object.keys(elementContent.props).length > 0 && (
                  <div className={styles.chatMessageField}>
                    <span className={styles.chatMessageFieldLabel}>Props</span>
                    <pre className={styles.chatMessageCode}>
                      {formatProps(elementContent.props)}
                    </pre>
                  </div>
                )}

                {/* Actions */}
                <div className={styles.chatMessageActions}>
                  {onCopy && (
                    <button
                      className={styles.chatMessageAction}
                      onClick={() => onCopy(safeStringify(elementContent))}
                    >
                      Copy
                    </button>
                  )}
                  {onOpenEditor && elementContent.source && (
                    <button
                      className={`${styles.chatMessageAction} ${styles.chatMessageActionPrimary}`}
                      onClick={() => onOpenEditor(elementContent.source)}
                    >
                      Open in Editor
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
