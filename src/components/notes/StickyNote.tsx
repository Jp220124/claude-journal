'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, GripVertical, Palette, Minus, Maximize2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NoteAnnotation, STICKY_NOTE_COLORS, StickyNoteColor } from '@/types/annotations'

interface StickyNoteProps {
  annotation: NoteAnnotation
  containerRef: React.RefObject<HTMLDivElement | null>
  onUpdate: (id: string, updates: Partial<NoteAnnotation>) => void
  onDelete: (id: string) => void
  isActive?: boolean
  onActivate?: () => void
  isMinimized?: boolean
  onToggleMinimize?: () => void
}

export function StickyNote({
  annotation,
  containerRef,
  onUpdate,
  onDelete,
  isActive = false,
  onActivate,
  isMinimized = false,
  onToggleMinimize,
}: StickyNoteProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [localContent, setLocalContent] = useState(annotation.content)
  const noteRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const dragOffset = useRef({ x: 0, y: 0 })

  // Update local content when annotation changes
  useEffect(() => {
    setLocalContent(annotation.content)
  }, [annotation.content])

  // Auto-focus textarea when editing
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.select()
    }
  }, [isEditing])

  // Handle drag start
  const handleDragStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault()
      e.stopPropagation()

      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

      if (noteRef.current) {
        const rect = noteRef.current.getBoundingClientRect()
        dragOffset.current = {
          x: clientX - rect.left,
          y: clientY - rect.top,
        }
      }

      setIsDragging(true)
      onActivate?.()
    },
    [onActivate]
  )

  // Handle drag move
  const handleDragMove = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!isDragging || !containerRef.current) return

      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

      const containerRect = containerRef.current.getBoundingClientRect()

      // Calculate new position relative to container
      const newX = clientX - containerRect.left - dragOffset.current.x + containerRef.current.scrollLeft
      const newY = clientY - containerRect.top - dragOffset.current.y + containerRef.current.scrollTop

      // Update position - allow negative X to move left of container
      // Allow sticky note to move left up to its own width (192px = w-48)
      onUpdate(annotation.id, {
        position_x: Math.max(-200, newX),
        position_y: Math.max(0, newY),
      })
    },
    [isDragging, containerRef, annotation.id, onUpdate]
  )

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Add/remove event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove)
      window.addEventListener('mouseup', handleDragEnd)
      window.addEventListener('touchmove', handleDragMove)
      window.addEventListener('touchend', handleDragEnd)
    }

    return () => {
      window.removeEventListener('mousemove', handleDragMove)
      window.removeEventListener('mouseup', handleDragEnd)
      window.removeEventListener('touchmove', handleDragMove)
      window.removeEventListener('touchend', handleDragEnd)
    }
  }, [isDragging, handleDragMove, handleDragEnd])

  // Handle content save
  const handleContentSave = useCallback(() => {
    setIsEditing(false)
    if (localContent !== annotation.content) {
      onUpdate(annotation.id, { content: localContent })
    }
  }, [localContent, annotation.content, annotation.id, onUpdate])

  // Handle color change
  const handleColorChange = useCallback(
    (color: StickyNoteColor) => {
      onUpdate(annotation.id, { color })
      setShowColorPicker(false)
    },
    [annotation.id, onUpdate]
  )

  // Handle delete
  const handleDelete = useCallback(() => {
    onDelete(annotation.id)
  }, [annotation.id, onDelete])

  // Handle double click to edit
  const handleDoubleClick = useCallback(() => {
    setIsEditing(true)
    onActivate?.()
  }, [onActivate])

  // Handle minimize toggle
  const handleMinimizeToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onToggleMinimize?.()
  }, [onToggleMinimize])

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsEditing(false)
        setLocalContent(annotation.content)
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        handleContentSave()
      }
    },
    [annotation.content, handleContentSave]
  )

  // Minimized view - compact indicator with drag support
  if (isMinimized) {
    return (
      <div
        ref={noteRef}
        className={cn(
          'absolute z-10 rounded-lg shadow-md pointer-events-auto transition-all hover:shadow-lg',
          isDragging ? 'shadow-2xl cursor-grabbing' : 'shadow-md',
          isActive ? 'ring-2 ring-amber-500 ring-offset-2' : ''
        )}
        style={{
          left: annotation.position_x,
          top: annotation.position_y,
          backgroundColor: annotation.color || STICKY_NOTE_COLORS.yellow,
        }}
        onClick={onActivate}
      >
        <div className="flex items-center gap-1 px-2 py-1.5">
          {/* Drag handle */}
          <button
            className="cursor-grab active:cursor-grabbing p-0.5 hover:bg-black/10 rounded"
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
            title="Drag to move"
          >
            <GripVertical className="h-3 w-3 text-gray-600" />
          </button>
          {/* Expand button */}
          <button
            className="flex items-center gap-1 hover:bg-black/10 rounded px-1 py-0.5"
            onClick={handleMinimizeToggle}
            title="Click to expand"
          >
            <Maximize2 className="h-3 w-3 text-gray-600 flex-shrink-0" />
            <span className="text-xs text-gray-600 truncate max-w-[100px]">
              {annotation.anchor_text || localContent || 'Note'}
            </span>
          </button>
        </div>
      </div>
    )
  }

  // Full view
  return (
    <div
      ref={noteRef}
      className={cn(
        'absolute z-10 w-48 rounded-lg shadow-lg transition-shadow pointer-events-auto',
        isDragging ? 'shadow-2xl cursor-grabbing' : 'shadow-md',
        isActive ? 'ring-2 ring-amber-500 ring-offset-2' : ''
      )}
      style={{
        left: annotation.position_x,
        top: annotation.position_y,
        backgroundColor: annotation.color || STICKY_NOTE_COLORS.yellow,
      }}
      onClick={onActivate}
    >
      {/* Header with drag handle and actions */}
      <div className="flex items-center justify-between px-2 py-1 border-b border-black/10">
        <button
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-black/10 rounded"
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
        >
          <GripVertical className="h-4 w-4 text-gray-600" />
        </button>

        <div className="flex items-center gap-1">
          {/* Minimize button */}
          <button
            className="p-1 hover:bg-black/10 rounded text-gray-600"
            onClick={handleMinimizeToggle}
            title="Minimize"
          >
            <Minus className="h-4 w-4" />
          </button>

          {/* Color picker toggle */}
          <div className="relative">
            <button
              className="p-1 hover:bg-black/10 rounded"
              onClick={() => setShowColorPicker(!showColorPicker)}
            >
              <Palette className="h-4 w-4 text-gray-600" />
            </button>

            {/* Color picker dropdown */}
            {showColorPicker && (
              <div className="absolute top-full right-0 mt-1 p-2 bg-white rounded-lg shadow-xl border flex gap-1 z-20">
                {Object.entries(STICKY_NOTE_COLORS).map(([name, color]) => (
                  <button
                    key={name}
                    className={cn(
                      'w-6 h-6 rounded-full border-2 transition-transform hover:scale-110',
                      annotation.color === color
                        ? 'border-gray-800'
                        : 'border-gray-300'
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => handleColorChange(color as StickyNoteColor)}
                    title={name}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Delete button */}
          <button
            className="p-1 hover:bg-black/10 rounded text-gray-600 hover:text-red-600"
            onClick={handleDelete}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="p-2 min-h-[60px]">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={localContent}
            onChange={e => setLocalContent(e.target.value)}
            onBlur={handleContentSave}
            onKeyDown={handleKeyDown}
            className="w-full h-full min-h-[60px] bg-transparent resize-none outline-none text-sm text-gray-800 placeholder-gray-500"
            placeholder="Add a note..."
          />
        ) : (
          <div
            className="text-sm text-gray-800 whitespace-pre-wrap cursor-text min-h-[60px]"
            onDoubleClick={handleDoubleClick}
          >
            {localContent || (
              <span className="text-gray-500 italic">Double-click to add note...</span>
            )}
          </div>
        )}
      </div>

      {/* Anchor text reference (if available) */}
      {annotation.anchor_text && (
        <div className="px-2 pb-2">
          <div className="text-xs text-gray-500 truncate border-t border-black/10 pt-1">
            &ldquo;{annotation.anchor_text}&rdquo;
          </div>
        </div>
      )}
    </div>
  )
}

export default StickyNote
