'use client'

import { memo, useCallback } from 'react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import type { Note } from '@/types/database'

// =====================================================
// MEMOIZED SIDEBAR COMPONENTS
// These components are memoized to prevent unnecessary re-renders
// during typing in the editor, which was causing UI flicker
// =====================================================

interface NotePreviewCardProps {
  note: Note
  isSelected: boolean
  onSelect: () => void
}

/**
 * Memoized note preview card for the sidebar
 * Only re-renders when note data, selection state, or onSelect changes
 */
export const NotePreviewCard = memo(function NotePreviewCard({
  note,
  isSelected,
  onSelect,
}: NotePreviewCardProps) {
  return (
    <div
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      aria-selected={isSelected}
      className={cn(
        'bg-white dark:bg-slate-800 border rounded-xl p-3 cursor-pointer shadow-sm hover:shadow-md transition-all ring-1 ring-transparent hover:ring-cyan-200 dark:hover:ring-cyan-700 relative overflow-hidden focus:outline-none focus:ring-2 focus:ring-cyan-500',
        isSelected ? 'border-cyan-300 dark:border-cyan-600 ring-cyan-100 dark:ring-cyan-900' : 'border-slate-200 dark:border-slate-700'
      )}
    >
      {/* Active indicator */}
      {isSelected && (
        <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500 dark:bg-cyan-400"></div>
      )}
      <div className={cn(isSelected ? 'pl-2' : '')}>
        <div className="flex items-start gap-2">
          {note.is_pinned && (
            <span className="material-symbols-outlined text-amber-500 dark:text-amber-400 text-[14px] mt-0.5" aria-label="Pinned">push_pin</span>
          )}
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-slate-900 dark:text-slate-100 mb-1 truncate text-sm">{note.title}</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 truncate">
              {note.content_text || 'No content'}
            </p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
              {format(new Date(note.updated_at), 'MMM d, yyyy')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}, (prevProps, nextProps) => {
  // Custom comparison - only re-render if these specific fields change
  return (
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.note.id === nextProps.note.id &&
    prevProps.note.title === nextProps.note.title &&
    prevProps.note.content_text === nextProps.note.content_text &&
    prevProps.note.updated_at === nextProps.note.updated_at &&
    prevProps.note.is_pinned === nextProps.note.is_pinned &&
    prevProps.onSelect === nextProps.onSelect
  )
})

interface NewNoteButtonProps {
  onClick: () => void
  disabled?: boolean
}

/**
 * Memoized New Note button
 * Separated from parent to prevent re-renders when isSaving changes
 */
export const NewNoteButton = memo(function NewNoteButton({
  onClick,
  disabled = false,
}: NewNoteButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label="Create new note"
      className="w-full bg-cyan-500 hover:bg-cyan-600 dark:bg-cyan-600 dark:hover:bg-cyan-500 text-white font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all shadow-md shadow-cyan-500/20 dark:shadow-cyan-600/20 text-sm disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
    >
      <span className="material-symbols-outlined text-[20px]">add</span>
      New Note
    </button>
  )
})

interface FolderButtonProps {
  id: string
  name: string
  icon: string
  color: string
  noteCount: number
  isSelected: boolean
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
}

/**
 * Memoized folder button for the sidebar
 */
export const FolderButton = memo(function FolderButton({
  id,
  name,
  icon,
  color,
  noteCount,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
}: FolderButtonProps) {
  const handleEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onEdit()
  }, [onEdit])

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete()
  }, [onDelete])

  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors group',
        isSelected
          ? 'bg-slate-100 text-slate-900'
          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
      )}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            'material-symbols-outlined text-[20px]',
            isSelected ? '' : 'group-hover:text-slate-900'
          )}
          style={{ color: isSelected ? color : undefined }}
        >
          {icon}
        </span>
        <span className="text-sm font-medium">{name}</span>
      </div>
      <div className="flex items-center gap-1">
        <span className={cn(
          'text-xs font-medium',
          isSelected ? 'text-slate-500' : 'text-slate-400'
        )}>
          {noteCount}
        </span>
        <div className="hidden group-hover:flex items-center gap-0.5 ml-1">
          <button
            onClick={handleEdit}
            className="p-1 text-slate-400 hover:text-slate-600 rounded"
          >
            <span className="material-symbols-outlined text-[14px]">edit</span>
          </button>
          <button
            onClick={handleDelete}
            className="p-1 text-slate-400 hover:text-red-600 rounded"
          >
            <span className="material-symbols-outlined text-[14px]">delete</span>
          </button>
        </div>
      </div>
    </button>
  )
})

interface RecentNotesListProps {
  notes: Note[]
  selectedNoteId: string | null
  onSelectNote: (note: Note) => void
}

/**
 * Memoized recent notes list
 * Only re-renders when the notes array or selection changes
 */
export const RecentNotesList = memo(function RecentNotesList({
  notes,
  selectedNoteId,
  onSelectNote,
}: RecentNotesListProps) {
  if (notes.length === 0) {
    return <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">No notes yet</p>
  }

  return (
    <div className="space-y-2" role="listbox" aria-label="Recent notes">
      {notes.map(note => (
        <NotePreviewCard
          key={note.id}
          note={note}
          isSelected={selectedNoteId === note.id}
          onSelect={() => onSelectNote(note)}
        />
      ))}
    </div>
  )
}, (prevProps, nextProps) => {
  // Custom comparison for the notes list
  if (prevProps.selectedNoteId !== nextProps.selectedNoteId) return false
  if (prevProps.notes.length !== nextProps.notes.length) return false
  if (prevProps.onSelectNote !== nextProps.onSelectNote) return false

  // Deep compare note IDs and key fields
  for (let i = 0; i < prevProps.notes.length; i++) {
    const prev = prevProps.notes[i]
    const next = nextProps.notes[i]
    if (
      prev.id !== next.id ||
      prev.title !== next.title ||
      prev.content_text !== next.content_text ||
      prev.updated_at !== next.updated_at ||
      prev.is_pinned !== next.is_pinned
    ) {
      return false
    }
  }

  return true
})
