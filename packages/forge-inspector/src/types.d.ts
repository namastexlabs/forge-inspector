export { ForgeInspector } from './ForgeInspector'

export type Editor = 'vscode' | 'vscode-insiders' | 'cursor' | string

export type PathModifier = (path: string) => string

export type ForgeInspectorProps = {
  editor?: Editor
  pathModifier?: PathModifier
}

export type Coords = [MouseEvent['pageX'], MouseEvent['pageY']]

export type Target = HTMLElement

// Debug utilities for React 19 troubleshooting
export interface SourceLocation {
  path: string
  value: {
    fileName: string
    lineNumber: number
    columnNumber: number
  }
  fileName: string
  lineNumber: number
  columnNumber: number
}

export interface DebugSearchSummary {
  totalFound: number
  locations: string[]
  fiberTag: number
  fiberType: string | Function
  hasDebugSource: boolean
  hasDebugStack: boolean
  hasDebugOwner: boolean
  hasMemoizedProps: boolean
  hasPendingProps: boolean
  hasElementType: boolean
  hasType: boolean
  hasOwner: boolean
  hasReturn: boolean
}

export interface DebugSearchResult {
  found: SourceLocation[]
  summary: DebugSearchSummary | { error: string }
}

export function deepSearchForSource(fiberNode: any): DebugSearchResult

export function debugFiberSource(element: HTMLElement): DebugSearchResult | null


