'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

type TabType = 'ai' | 'search'

interface AIProvider {
  id: string
  name: string
  isConnected: boolean
  icon: string
}

interface ResearchPanelContextType {
  // Panel state
  isOpen: boolean
  openPanel: () => void
  closePanel: () => void
  togglePanel: () => void

  // Tab state
  activeTab: TabType
  setActiveTab: (tab: TabType) => void

  // Provider state
  connectedProviders: AIProvider[]
  activeProvider: AIProvider | null
  setActiveProvider: (provider: AIProvider | null) => void

  // Note context
  currentNoteId: string | null
  currentNoteContent: string | null
  setNoteContext: (noteId: string | null, content: string | null) => void

  // Insert functionality
  insertToNote: (content: string) => void
  onInsertCallback: ((content: string) => void) | null
  setInsertCallback: (callback: ((content: string) => void) | null) => void
}

const ResearchPanelContext = createContext<ResearchPanelContextType | undefined>(undefined)

// Default providers (will be populated with actual connection status)
const defaultProviders: AIProvider[] = [
  { id: 'gemini', name: 'Google Gemini', isConnected: false, icon: 'auto_awesome' },
  { id: 'claude', name: 'Claude', isConnected: false, icon: 'psychology' },
  { id: 'openai', name: 'OpenAI', isConnected: false, icon: 'smart_toy' },
]

interface ResearchPanelProviderProps {
  children: ReactNode
}

export function ResearchPanelProvider({ children }: ResearchPanelProviderProps) {
  // Panel state
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('ai')

  // Provider state
  const [connectedProviders, setConnectedProviders] = useState<AIProvider[]>(defaultProviders)
  const [activeProvider, setActiveProvider] = useState<AIProvider | null>(null)

  // Note context
  const [currentNoteId, setCurrentNoteId] = useState<string | null>(null)
  const [currentNoteContent, setCurrentNoteContent] = useState<string | null>(null)

  // Insert callback
  const [onInsertCallback, setOnInsertCallbackState] = useState<((content: string) => void) | null>(null)

  // Panel controls
  const openPanel = useCallback(() => setIsOpen(true), [])
  const closePanel = useCallback(() => setIsOpen(false), [])
  const togglePanel = useCallback(() => setIsOpen(prev => !prev), [])

  // Note context setter
  const setNoteContext = useCallback((noteId: string | null, content: string | null) => {
    setCurrentNoteId(noteId)
    setCurrentNoteContent(content)
  }, [])

  // Insert callback setter
  const setInsertCallback = useCallback((callback: ((content: string) => void) | null) => {
    setOnInsertCallbackState(() => callback)
  }, [])

  // Insert to note handler
  const insertToNote = useCallback((content: string) => {
    if (onInsertCallback) {
      onInsertCallback(content)
    }
  }, [onInsertCallback])

  const value: ResearchPanelContextType = {
    isOpen,
    openPanel,
    closePanel,
    togglePanel,
    activeTab,
    setActiveTab,
    connectedProviders,
    activeProvider,
    setActiveProvider,
    currentNoteId,
    currentNoteContent,
    setNoteContext,
    insertToNote,
    onInsertCallback,
    setInsertCallback,
  }

  return (
    <ResearchPanelContext.Provider value={value}>
      {children}
    </ResearchPanelContext.Provider>
  )
}

export function useResearchPanel() {
  const context = useContext(ResearchPanelContext)
  if (context === undefined) {
    throw new Error('useResearchPanel must be used within a ResearchPanelProvider')
  }
  return context
}

// Separate hook for just checking if panel is available (doesn't throw)
export function useResearchPanelOptional() {
  return useContext(ResearchPanelContext)
}
