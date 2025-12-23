'use client'

import { useState, useEffect, useCallback } from 'react'
import styles from './ModelSelectionModal.module.css'

export interface ModelConfig {
  id: string
  name: string
  type: 'local' | 'cloud'
  modelId?: string
  modelClass?: string
  providerId?: string
  dtype?: string | object
  device?: string
  description: string
  size: string
  requiresApiKey?: boolean
}

const AVAILABLE_MODELS: ModelConfig[] = [
  {
    id: 'florence-2-large',
    name: 'Florence-2 Large',
    type: 'local',
    modelId: 'onnx-community/Florence-2-large-ft',
    modelClass: 'AutoModelForImageTextToText',
    dtype: {
      vision_encoder: 'fp16',
      encoder_model: 'q4',
      decoder_model_merged: 'q4'
    },
    device: 'webgpu',
    description: 'Microsoft vision model. Best for UI understanding.',
    size: '~770MB'
  },
  {
    id: 'ministral-3b',
    name: 'Ministral 3B',
    type: 'local',
    modelId: 'mistralai/Ministral-3-3B-Instruct-2512-ONNX',
    modelClass: 'AutoModelForImageTextToText',
    dtype: 'q4',
    device: 'webgpu',
    description: 'Mistral vision model. 3.4B LM + 0.4B Vision Encoder.',
    size: '~2GB'
  },
  {
    id: 'gemini-flash',
    name: 'Gemini 3 Flash',
    type: 'cloud',
    providerId: 'gemini-3-flash-preview',
    description: "Google's latest vision model (Dec 2025). Requires API key.",
    size: 'Cloud',
    requiresApiKey: true
  }
]

const GEMINI_KEY_STORAGE = 'forge-inspector-gemini-key'

interface ModelSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  onStartRecording: (config: ModelConfig, apiKey?: string) => void
  loadingProgress?: {
    modelId: string
    progress: number
    status: string
    indeterminate?: boolean
  } | null
}

export function ModelSelectionModal({
  isOpen,
  onClose,
  onStartRecording,
  loadingProgress
}: ModelSelectionModalProps) {
  const [selectedModelId, setSelectedModelId] = useState('florence-2-large')
  const [apiKey, setApiKey] = useState('')

  // Load saved API key
  useEffect(() => {
    const saved = localStorage.getItem(GEMINI_KEY_STORAGE)
    if (saved) setApiKey(saved)
  }, [])

  const selectedModel = AVAILABLE_MODELS.find(m => m.id === selectedModelId) || AVAILABLE_MODELS[0]

  const handleStart = useCallback(() => {
    console.log('[ModelModal] handleStart called, model:', selectedModel.id, 'requiresApiKey:', selectedModel.requiresApiKey)
    if (selectedModel.requiresApiKey && !apiKey.trim()) {
      console.log('[ModelModal] Blocked - API key required but not provided')
      return
    }
    if (selectedModel.requiresApiKey && apiKey.trim()) {
      localStorage.setItem(GEMINI_KEY_STORAGE, apiKey.trim())
    }
    console.log('[ModelModal] Calling onStartRecording with:', selectedModel)
    onStartRecording(selectedModel, apiKey.trim() || undefined)
  }, [selectedModel, apiKey, onStartRecording])

  const handleModelChange = useCallback((modelId: string) => {
    setSelectedModelId(modelId)
  }, [])

  if (!isOpen) return null

  const isLoading = !!loadingProgress

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && !isLoading && onClose()}>
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerIcon}>◉</div>
          <h2 className={styles.title}>Vision Model</h2>
          {!isLoading && (
            <button className={styles.closeButton} onClick={onClose} aria-label="Close">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1L13 13M1 13L13 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          )}
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className={styles.loadingContainer}>
            <div className={styles.loadingIcon}>
              <div className={styles.loadingSpinner} />
            </div>
            <div className={styles.loadingModelName}>
              {loadingProgress.modelId.split('/').pop()}
            </div>
            <div className={styles.progressBar}>
              <div
                className={`${styles.progressFill} ${loadingProgress.indeterminate ? styles.progressFillIndeterminate : ''}`}
                style={loadingProgress.indeterminate ? {} : { width: `${Math.round(loadingProgress.progress * 100)}%` }}
              />
            </div>
            <div className={styles.loadingStatus}>
              {loadingProgress.status || 'Initializing...'}
            </div>
            <div className={styles.loadingPercent}>
              {loadingProgress.indeterminate ? 'Downloading...' : `${Math.round(loadingProgress.progress * 100)}%`}
            </div>
          </div>
        ) : (
          <>
            {/* Model List */}
            <div className={styles.modelList}>
              {AVAILABLE_MODELS.map((model) => (
                <button
                  key={model.id}
                  className={`${styles.modelCard} ${selectedModelId === model.id ? styles.modelCardSelected : ''}`}
                  onClick={() => handleModelChange(model.id)}
                  type="button"
                >
                  <div className={styles.modelRadio}>
                    <div className={`${styles.radioOuter} ${selectedModelId === model.id ? styles.radioOuterSelected : ''}`}>
                      {selectedModelId === model.id && <div className={styles.radioInner} />}
                    </div>
                  </div>
                  <div className={styles.modelInfo}>
                    <div className={styles.modelHeader}>
                      <span className={styles.modelName}>{model.name}</span>
                      <span className={`${styles.modelBadge} ${model.type === 'cloud' ? styles.modelBadgeCloud : styles.modelBadgeLocal}`}>
                        {model.type === 'cloud' ? '☁ Cloud' : '⚡ Local'}
                      </span>
                    </div>
                    <p className={styles.modelDescription}>{model.description}</p>
                    <div className={styles.modelMeta}>
                      <span className={styles.modelSize}>{model.size}</span>
                      {model.requiresApiKey && (
                        <span className={styles.modelApiRequired}>API Key Required</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* API Key Input */}
            {selectedModel.requiresApiKey && (
              <div className={styles.apiKeySection}>
                <label className={styles.apiKeyLabel}>
                  <span className={styles.apiKeyIcon}>🔑</span>
                  Gemini API Key
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your API key..."
                  className={styles.apiKeyInput}
                  autoComplete="off"
                />
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.apiKeyLink}
                >
                  Get API Key →
                </a>
              </div>
            )}

            {/* Footer */}
            <div className={styles.footer}>
              <button className={styles.cancelButton} onClick={onClose}>
                Cancel
              </button>
              <button
                className={styles.startButton}
                onClick={handleStart}
                disabled={selectedModel.requiresApiKey && !apiKey.trim()}
              >
                <span className={styles.startIcon}>●</span>
                Start Recording
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default ModelSelectionModal
