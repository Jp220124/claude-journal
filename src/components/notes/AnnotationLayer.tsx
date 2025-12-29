'use client'

import { useCallback, useEffect } from 'react'
import { Editor } from '@tiptap/react'
import { StickyNote } from './StickyNote'
import { ConnectionLine } from './ConnectionLine'
import { useStickyNotes } from '@/hooks/useStickyNotes'
import { NoteAnnotation } from '@/types/annotations'

// Type for editor storage with sticky notes
interface EditorStorageWithStickyNotes {
  stickyNotes?: {
    createStickyNote: (anchorId: string, anchorText: string) => Promise<void>
  }
}

interface AnnotationLayerProps {
  noteId: string
  editor: Editor | null
  containerRef: React.RefObject<HTMLDivElement | null>
  onAnnotationCreate?: (anchorId: string, anchorText: string) => void
  visible?: boolean
}

/**
 * AnnotationLayer - Container for all sticky notes and connection lines
 *
 * This component manages:
 * - Rendering all sticky notes for a note
 * - Rendering connection lines between anchors and sticky notes
 * - Coordinating create/update/delete operations
 * - Tracking anchor positions in the document
 */
export function AnnotationLayer({
  noteId,
  editor,
  containerRef,
  onAnnotationCreate,
  visible = true,
}: AnnotationLayerProps) {
  const {
    annotations,
    activeAnnotationId,
    connectionLines,
    minimizedIds,
    hiddenIds,
    isLoading,
    createStickyNote,
    updateStickyNote,
    deleteStickyNote,
    setActiveAnnotation,
    toggleMinimize,
    toggleByAnchorId,
  } = useStickyNotes({
    noteId,
    editor,
    containerRef,
  })

  // Filter out hidden annotations
  const visibleAnnotations = annotations.filter(a => !hiddenIds.has(a.id))

  // Handle clicks on anchor text to toggle connected sticky note (show/hide)
  useEffect(() => {
    if (!containerRef.current || !visible) return

    const container = containerRef.current

    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const anchor = target.closest('[data-sticky-anchor-id]')

      if (anchor) {
        const anchorId = anchor.getAttribute('data-sticky-anchor-id')
        if (anchorId) {
          e.preventDefault()
          e.stopPropagation()
          toggleByAnchorId(anchorId)
        }
      }
    }

    container.addEventListener('click', handleAnchorClick)

    return () => {
      container.removeEventListener('click', handleAnchorClick)
    }
  }, [containerRef, visible, toggleByAnchorId])

  // Handle annotation update
  const handleUpdate = useCallback(
    (id: string, updates: Partial<NoteAnnotation>) => {
      updateStickyNote(id, updates)
    },
    [updateStickyNote]
  )

  // Handle annotation delete
  const handleDelete = useCallback(
    (id: string) => {
      deleteStickyNote(id)
    },
    [deleteStickyNote]
  )

  // Handle click outside to deactivate
  const handleBackgroundClick = useCallback(
    (e: React.MouseEvent) => {
      // Only deactivate if clicking on the layer background itself
      if (e.target === e.currentTarget) {
        setActiveAnnotation(null)
      }
    },
    [setActiveAnnotation]
  )

  // Create sticky note (called from editor command)
  const handleCreateStickyNote = useCallback(
    async (anchorId: string, anchorText: string) => {
      await createStickyNote(anchorId, anchorText)
      onAnnotationCreate?.(anchorId, anchorText)
    },
    [createStickyNote, onAnnotationCreate]
  )

  // Expose create function via editor storage for toolbar access
  if (editor && !(editor.storage as EditorStorageWithStickyNotes).stickyNotes) {
    (editor.storage as EditorStorageWithStickyNotes).stickyNotes = {
      createStickyNote: handleCreateStickyNote,
    }
  }

  if (isLoading) {
    return null // Don't render anything while loading
  }

  // When hidden, don't render the layer at all (keeps anchor highlights visible in editor)
  if (!visible) {
    return null
  }

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ overflow: 'visible' }}
      onClick={handleBackgroundClick}
    >
      {/* Connection lines layer (behind sticky notes) */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ overflow: 'visible' }}
      >
        {visibleAnnotations.map(annotation => {
          const coords = connectionLines.get(annotation.id)
          if (!coords) return null

          return (
            <ConnectionLine
              key={`line-${annotation.id}`}
              coords={coords}
              color={annotation.color || '#F59E0B'}
              isActive={activeAnnotationId === annotation.id}
            />
          )
        })}
      </svg>

      {/* Sticky notes layer - container is pointer-events-none, only StickyNote components receive events */}
      <div className="absolute inset-0 pointer-events-none" style={{ overflow: 'visible' }}>
        {visibleAnnotations.map(annotation => (
          <StickyNote
            key={annotation.id}
            annotation={annotation}
            containerRef={containerRef}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            isActive={activeAnnotationId === annotation.id}
            onActivate={() => setActiveAnnotation(annotation.id)}
            isMinimized={minimizedIds.has(annotation.id)}
            onToggleMinimize={() => toggleMinimize(annotation.id)}
          />
        ))}
      </div>
    </div>
  )
}

export default AnnotationLayer
