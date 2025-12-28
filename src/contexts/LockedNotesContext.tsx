'use client'

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
import type { Note } from '@/types/database'

interface LockedNotesContextType {
  // Track which locked notes have been unlocked this session
  unlockedNoteIds: Set<string>

  // Add a note to the unlocked set
  markNoteUnlocked: (noteId: string) => void

  // Remove a note from the unlocked set (when re-locking)
  markNoteLocked: (noteId: string) => void

  // Check if a note is currently unlocked in this session
  isNoteUnlockedInSession: (noteId: string) => boolean

  // Clear all unlocked notes (on logout)
  clearAllUnlocks: () => void

  // Store unlocked note content temporarily
  unlockedNoteContent: Map<string, Note>
  setUnlockedNoteContent: (noteId: string, note: Note) => void
  getUnlockedNoteContent: (noteId: string) => Note | undefined
  clearUnlockedNoteContent: (noteId: string) => void
}

const LockedNotesContext = createContext<LockedNotesContextType | undefined>(undefined)

const SESSION_STORAGE_KEY = 'unlocked_notes'

interface LockedNotesProviderProps {
  children: ReactNode
}

export function LockedNotesProvider({ children }: LockedNotesProviderProps) {
  const [unlockedNoteIds, setUnlockedNoteIds] = useState<Set<string>>(new Set())
  const [unlockedNoteContent, setUnlockedNoteContentMap] = useState<Map<string, Note>>(new Map())

  // Load from sessionStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem(SESSION_STORAGE_KEY)
        if (stored) {
          const ids = JSON.parse(stored) as string[]
          setUnlockedNoteIds(new Set(ids))
        }
      } catch (e) {
        console.error('Failed to load unlocked notes from session:', e)
      }
    }
  }, [])

  // Save to sessionStorage whenever unlockedNoteIds changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const ids = Array.from(unlockedNoteIds)
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(ids))
      } catch (e) {
        console.error('Failed to save unlocked notes to session:', e)
      }
    }
  }, [unlockedNoteIds])

  const markNoteUnlocked = useCallback((noteId: string) => {
    setUnlockedNoteIds(prev => {
      const next = new Set(prev)
      next.add(noteId)
      return next
    })
  }, [])

  const markNoteLocked = useCallback((noteId: string) => {
    setUnlockedNoteIds(prev => {
      const next = new Set(prev)
      next.delete(noteId)
      return next
    })
    // Also clear cached content
    setUnlockedNoteContentMap(prev => {
      const next = new Map(prev)
      next.delete(noteId)
      return next
    })
  }, [])

  const isNoteUnlockedInSession = useCallback((noteId: string) => {
    return unlockedNoteIds.has(noteId)
  }, [unlockedNoteIds])

  const clearAllUnlocks = useCallback(() => {
    setUnlockedNoteIds(new Set())
    setUnlockedNoteContentMap(new Map())
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(SESSION_STORAGE_KEY)
    }
  }, [])

  const setUnlockedNoteContent = useCallback((noteId: string, note: Note) => {
    setUnlockedNoteContentMap(prev => {
      const next = new Map(prev)
      next.set(noteId, note)
      return next
    })
  }, [])

  const getUnlockedNoteContent = useCallback((noteId: string) => {
    return unlockedNoteContent.get(noteId)
  }, [unlockedNoteContent])

  const clearUnlockedNoteContent = useCallback((noteId: string) => {
    setUnlockedNoteContentMap(prev => {
      const next = new Map(prev)
      next.delete(noteId)
      return next
    })
  }, [])

  const value: LockedNotesContextType = {
    unlockedNoteIds,
    markNoteUnlocked,
    markNoteLocked,
    isNoteUnlockedInSession,
    clearAllUnlocks,
    unlockedNoteContent,
    setUnlockedNoteContent,
    getUnlockedNoteContent,
    clearUnlockedNoteContent,
  }

  return (
    <LockedNotesContext.Provider value={value}>
      {children}
    </LockedNotesContext.Provider>
  )
}

export function useLockedNotes() {
  const context = useContext(LockedNotesContext)
  if (context === undefined) {
    throw new Error('useLockedNotes must be used within a LockedNotesProvider')
  }
  return context
}

// Optional hook that doesn't throw
export function useLockedNotesOptional() {
  return useContext(LockedNotesContext)
}
