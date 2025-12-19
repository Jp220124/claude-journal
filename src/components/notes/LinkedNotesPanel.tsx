'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { getLinkedNotes, unlinkTaskFromNote, type LinkedNote } from '@/lib/notes/taskLinks'

interface LinkedNotesPanelProps {
  taskId: string
  onNoteClick?: (noteId: string) => void
  isDemo?: boolean
}

// Demo linked notes for non-authenticated users
const demoLinkedNotes: LinkedNote[] = [
  {
    id: 'demo-note-1',
    user_id: 'demo',
    title: 'Project Meeting Notes',
    content: {},
    content_text: 'Discussed project timeline and deliverables for Q1...',
    folder_id: null,
    is_pinned: false,
    is_archived: false,
    word_count: 150,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    link_type: 'reference',
    linked_at: new Date().toISOString(),
  },
]

export function LinkedNotesPanel({
  taskId,
  onNoteClick,
  isDemo = false,
}: LinkedNotesPanelProps) {
  const [linkedNotes, setLinkedNotes] = useState<LinkedNote[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isExpanded, setIsExpanded] = useState(true)

  // Load linked notes
  useEffect(() => {
    const loadLinkedNotes = async () => {
      if (isDemo) {
        setLinkedNotes(demoLinkedNotes)
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      try {
        const notes = await getLinkedNotes(taskId)
        setLinkedNotes(notes)
      } catch (error) {
        console.error('Error loading linked notes:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadLinkedNotes()
  }, [taskId, isDemo])

  const handleUnlink = async (noteId: string, e: React.MouseEvent) => {
    e.stopPropagation()

    if (isDemo) {
      setLinkedNotes(prev => prev.filter(n => n.id !== noteId))
      return
    }

    try {
      const success = await unlinkTaskFromNote(taskId, noteId)
      if (success) {
        setLinkedNotes(prev => prev.filter(n => n.id !== noteId))
      }
    } catch (error) {
      console.error('Error unlinking note:', error)
    }
  }

  if (!isExpanded && linkedNotes.length === 0) return null

  return (
    <div className="mt-3">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left group"
      >
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-slate-400 text-[16px]">
            description
          </span>
          <span className="text-xs font-medium text-slate-600">
            Linked Notes
          </span>
          {linkedNotes.length > 0 && (
            <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">
              {linkedNotes.length}
            </span>
          )}
        </div>
        <span className={cn(
          'material-symbols-outlined text-slate-400 text-[16px] transition-transform',
          isExpanded ? 'rotate-180' : ''
        )}>
          expand_more
        </span>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="mt-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-3">
              <div className="w-4 h-4 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : linkedNotes.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">No linked notes</p>
          ) : (
            <div className="space-y-2">
              {linkedNotes.map(note => (
                <div
                  key={note.id}
                  onClick={() => onNoteClick?.(note.id)}
                  className={cn(
                    'flex items-start gap-2 p-2 bg-slate-50 rounded-lg group/note',
                    onNoteClick && 'cursor-pointer hover:bg-slate-100'
                  )}
                >
                  {/* Note icon */}
                  <span className="material-symbols-outlined text-slate-400 text-[16px] mt-0.5">
                    article
                  </span>

                  {/* Note info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">
                      {note.title}
                    </p>
                    {note.content_text && (
                      <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                        {note.content_text}
                      </p>
                    )}
                    <p className="text-[10px] text-slate-400 mt-1">
                      Updated {format(new Date(note.updated_at), 'MMM d')}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover/note:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => handleUnlink(note.id, e)}
                      className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Unlink note"
                    >
                      <span className="material-symbols-outlined text-[14px]">link_off</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
