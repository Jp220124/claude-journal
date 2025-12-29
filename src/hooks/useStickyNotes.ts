'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Editor } from '@tiptap/react'
import {
  NoteAnnotation,
  AnchorPosition,
  ConnectionLineCoords,
} from '@/types/annotations'
import {
  getAnnotations,
  createAnnotation,
  updateAnnotation,
  deleteAnnotation,
} from '@/lib/annotationService'

interface UseStickyNotesOptions {
  noteId: string
  editor: Editor | null
  containerRef: React.RefObject<HTMLDivElement | null>
}

interface UseStickyNotesReturn {
  annotations: NoteAnnotation[]
  activeAnnotationId: string | null
  anchorPositions: Map<string, AnchorPosition>
  connectionLines: Map<string, ConnectionLineCoords>
  minimizedIds: Set<string>
  hiddenIds: Set<string>
  isLoading: boolean
  createStickyNote: (anchorId: string, anchorText: string) => Promise<void>
  updateStickyNote: (id: string, updates: Partial<NoteAnnotation>) => Promise<void>
  deleteStickyNote: (id: string) => Promise<void>
  setActiveAnnotation: (id: string | null) => void
  refreshAnchorPositions: () => void
  toggleMinimize: (id: string) => void
  toggleByAnchorId: (anchorId: string) => void
}

/**
 * useStickyNotes - Custom hook for managing sticky note annotations
 *
 * Handles:
 * - Loading/saving annotations from database
 * - Tracking anchor element positions in the DOM
 * - Calculating connection line coordinates
 * - Optimistic updates with debounced persistence
 */
export function useStickyNotes({
  noteId,
  editor,
  containerRef,
}: UseStickyNotesOptions): UseStickyNotesReturn {
  const [annotations, setAnnotations] = useState<NoteAnnotation[]>([])
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null)
  const [anchorPositions, setAnchorPositions] = useState<Map<string, AnchorPosition>>(
    new Map()
  )
  const [connectionLines, setConnectionLines] = useState<
    Map<string, ConnectionLineCoords>
  >(new Map())
  const [minimizedIds, setMinimizedIds] = useState<Set<string>>(new Set())
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)

  // Debounce timer refs for position updates
  const positionUpdateTimers = useRef<Map<string, NodeJS.Timeout>>(new Map())

  // Load annotations on mount and when noteId changes
  useEffect(() => {
    if (!noteId) return

    const loadAnnotations = async () => {
      setIsLoading(true)
      const data = await getAnnotations(noteId)
      setAnnotations(data)
      setIsLoading(false)
    }

    loadAnnotations()
  }, [noteId])

  // Calculate anchor positions from DOM
  const refreshAnchorPositions = useCallback(() => {
    if (!containerRef.current || !editor) return

    const container = containerRef.current
    const containerRect = container.getBoundingClientRect()
    const newPositions = new Map<string, AnchorPosition>()

    // Find all anchor elements in the editor
    const anchorElements = container.querySelectorAll('[data-sticky-anchor-id]')

    anchorElements.forEach(element => {
      const anchorId = element.getAttribute('data-sticky-anchor-id')
      if (!anchorId) return

      const rect = element.getBoundingClientRect()

      // Calculate position relative to container (accounting for scroll)
      newPositions.set(anchorId, {
        top: rect.top - containerRect.top + container.scrollTop,
        left: rect.left - containerRect.left + container.scrollLeft,
        right: rect.right - containerRect.left + container.scrollLeft,
        bottom: rect.bottom - containerRect.top + container.scrollTop,
        width: rect.width,
        height: rect.height,
      })
    })

    setAnchorPositions(newPositions)
  }, [containerRef, editor])

  // Calculate connection lines between anchors and sticky notes
  useEffect(() => {
    const newLines = new Map<string, ConnectionLineCoords>()

    annotations.forEach(annotation => {
      const anchorPos = anchorPositions.get(annotation.anchor_id)
      if (!anchorPos) return

      // Start point: right edge of anchor, vertically centered
      const startX = anchorPos.right
      const startY = anchorPos.top + anchorPos.height / 2

      // End point: left edge of sticky note, vertically centered (assuming ~100px height)
      const endX = annotation.position_x
      const endY = annotation.position_y + 50 // Approximate vertical center

      newLines.set(annotation.id, {
        startX,
        startY,
        endX,
        endY,
      })
    })

    setConnectionLines(newLines)
  }, [annotations, anchorPositions])

  // Refresh positions when content changes
  useEffect(() => {
    if (!editor) return

    const handleUpdate = () => {
      // Debounce position refresh
      setTimeout(refreshAnchorPositions, 100)
    }

    editor.on('update', handleUpdate)
    editor.on('selectionUpdate', handleUpdate)

    // Initial refresh
    refreshAnchorPositions()

    return () => {
      editor.off('update', handleUpdate)
      editor.off('selectionUpdate', handleUpdate)
    }
  }, [editor, refreshAnchorPositions])

  // Also refresh on scroll
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleScroll = () => {
      refreshAnchorPositions()
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleScroll, { passive: true })

    return () => {
      container.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
    }
  }, [containerRef, refreshAnchorPositions])

  // Create a new sticky note
  const createStickyNote = useCallback(
    async (anchorId: string, anchorText: string) => {
      const anchorPos = anchorPositions.get(anchorId)

      // Calculate initial position to the right of the anchor
      const initialX = anchorPos ? anchorPos.right + 50 : 400
      const initialY = anchorPos ? anchorPos.top - 20 : 0

      const newAnnotation = await createAnnotation({
        note_id: noteId,
        anchor_id: anchorId,
        anchor_text: anchorText,
        position_x: initialX,
        position_y: initialY,
      })

      if (newAnnotation) {
        setAnnotations(prev => [...prev, newAnnotation])
        setActiveAnnotationId(newAnnotation.id)
      }
    },
    [noteId, anchorPositions]
  )

  // Update a sticky note (with debounced persistence for position)
  const updateStickyNote = useCallback(
    async (id: string, updates: Partial<NoteAnnotation>) => {
      // Optimistic update
      setAnnotations(prev =>
        prev.map(ann =>
          ann.id === id ? { ...ann, ...updates } : ann
        )
      )

      // For position updates, debounce the database write
      if ('position_x' in updates || 'position_y' in updates) {
        // Clear existing timer
        const existingTimer = positionUpdateTimers.current.get(id)
        if (existingTimer) {
          clearTimeout(existingTimer)
        }

        // Set new debounced timer
        const timer = setTimeout(async () => {
          await updateAnnotation(id, {
            position_x: updates.position_x,
            position_y: updates.position_y,
          })
          positionUpdateTimers.current.delete(id)
        }, 300)

        positionUpdateTimers.current.set(id, timer)
      } else {
        // For other updates (content, color), persist immediately
        await updateAnnotation(id, updates)
      }
    },
    []
  )

  // Delete a sticky note
  const deleteStickyNote = useCallback(
    async (id: string) => {
      // Get the annotation to find its anchor
      const annotation = annotations.find(a => a.id === id)

      // Optimistic delete
      setAnnotations(prev => prev.filter(ann => ann.id !== id))

      if (activeAnnotationId === id) {
        setActiveAnnotationId(null)
      }

      // Delete from database
      const success = await deleteAnnotation(id)

      if (!success) {
        // Rollback on failure
        if (annotation) {
          setAnnotations(prev => [...prev, annotation])
        }
      } else if (annotation && editor) {
        // Remove the anchor mark from the editor
        editor.commands.removeStickyAnchor(annotation.anchor_id)
      }
    },
    [annotations, activeAnnotationId, editor]
  )

  // Set active annotation
  const setActiveAnnotation = useCallback((id: string | null) => {
    setActiveAnnotationId(id)
  }, [])

  // Toggle minimize state for a sticky note
  const toggleMinimize = useCallback((id: string) => {
    setMinimizedIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }, [])

  // Toggle a sticky note visibility by its anchor ID (called when clicking on anchor text)
  // If visible -> hide completely, if hidden -> show
  const toggleByAnchorId = useCallback((anchorId: string) => {
    const annotation = annotations.find(a => a.anchor_id === anchorId)
    if (annotation) {
      let wasHidden = false
      setHiddenIds(prev => {
        const newSet = new Set(prev)
        if (newSet.has(annotation.id)) {
          // Currently hidden -> show it
          newSet.delete(annotation.id)
          wasHidden = true
        } else {
          // Currently visible -> hide it completely
          newSet.add(annotation.id)
        }
        return newSet
      })
      // Make it active only when showing (was hidden before)
      if (wasHidden) {
        setActiveAnnotationId(annotation.id)
      }
    }
  }, [annotations])

  // Cleanup debounce timers on unmount
  useEffect(() => {
    return () => {
      positionUpdateTimers.current.forEach(timer => clearTimeout(timer))
    }
  }, [])

  return {
    annotations,
    activeAnnotationId,
    anchorPositions,
    connectionLines,
    minimizedIds,
    hiddenIds,
    isLoading,
    createStickyNote,
    updateStickyNote,
    deleteStickyNote,
    setActiveAnnotation,
    refreshAnchorPositions,
    toggleMinimize,
    toggleByAnchorId,
  }
}

export default useStickyNotes
