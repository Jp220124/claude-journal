'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { getTaskResearchNotes } from '@/lib/researchService'

interface ResearchNote {
  id: string
  title: string
  content_text?: string
  source_type?: string
  sources?: Array<{ title: string; url: string }>
  research_job_id?: string
  created_at: string
  link_type: string
  linked_at: string
}

interface LinkedResearchNotesProps {
  taskId: string
  onNoteClick?: (noteId: string) => void
  showEmpty?: boolean
  compact?: boolean
  className?: string
}

export function LinkedResearchNotes({
  taskId,
  onNoteClick,
  showEmpty = false,
  compact = false,
  className,
}: LinkedResearchNotesProps) {
  const [notes, setNotes] = useState<ResearchNote[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadNotes = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const result = await getTaskResearchNotes(taskId)
        // Filter to only show research notes
        const researchNotes = result.notes.filter(
          n => n.link_type === 'research' || n.source_type === 'research'
        )
        setNotes(researchNotes)
      } catch (err) {
        console.error('Error loading research notes:', err)
        setError('Failed to load research notes')
      } finally {
        setIsLoading(false)
      }
    }

    loadNotes()
  }, [taskId])

  if (isLoading) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <div className="w-3 h-3 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-slate-400">Loading research...</span>
      </div>
    )
  }

  if (error) {
    return null // Silently fail - don't show errors in the UI
  }

  if (notes.length === 0) {
    if (!showEmpty) return null
    return (
      <div className={cn('text-xs text-slate-400', className)}>
        No research notes
      </div>
    )
  }

  // Compact view - just show a badge with count
  if (compact) {
    return (
      <button
        onClick={() => notes[0] && onNoteClick?.(notes[0].id)}
        className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full',
          'bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-200',
          'text-cyan-700 text-[10px] font-medium',
          'hover:from-cyan-100 hover:to-blue-100 transition-colors',
          className
        )}
      >
        <span className="material-symbols-outlined text-[12px]">science</span>
        <span>{notes.length} research note{notes.length > 1 ? 's' : ''}</span>
      </button>
    )
  }

  // Full view - show note cards
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2 mb-2">
        <span className="material-symbols-outlined text-cyan-600 text-[16px]">science</span>
        <span className="text-xs font-medium text-slate-600">Research Notes</span>
        <span className="text-[10px] bg-cyan-100 text-cyan-700 px-1.5 py-0.5 rounded-full">
          {notes.length}
        </span>
      </div>

      {notes.map(note => (
        <div
          key={note.id}
          onClick={() => onNoteClick?.(note.id)}
          className={cn(
            'p-3 rounded-lg cursor-pointer transition-all',
            'bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-100',
            'hover:from-cyan-100 hover:to-blue-100 hover:border-cyan-200'
          )}
        >
          {/* Title */}
          <div className="flex items-start gap-2">
            <span className="material-symbols-outlined text-cyan-600 text-[16px] mt-0.5">
              article
            </span>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-cyan-800 truncate">
                {note.title}
              </h4>
              {note.content_text && (
                <p className="text-xs text-slate-600 line-clamp-2 mt-1">
                  {note.content_text}
                </p>
              )}
            </div>
          </div>

          {/* Meta info */}
          <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-500">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[12px]">schedule</span>
              {format(new Date(note.created_at), 'MMM d, h:mm a')}
            </span>
            {note.sources && note.sources.length > 0 && (
              <span className="flex items-center gap-1 text-cyan-600">
                <span className="material-symbols-outlined text-[12px]">link</span>
                {note.sources.length} sources
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// Simple indicator component for showing research status on task cards
export function ResearchNoteIndicator({
  taskId,
  onClick,
}: {
  taskId: string
  onClick?: () => void
}) {
  const [hasNotes, setHasNotes] = useState(false)
  const [noteCount, setNoteCount] = useState(0)

  useEffect(() => {
    const checkNotes = async () => {
      try {
        const result = await getTaskResearchNotes(taskId)
        const researchNotes = result.notes.filter(
          n => n.link_type === 'research' || n.source_type === 'research'
        )
        setHasNotes(researchNotes.length > 0)
        setNoteCount(researchNotes.length)
      } catch {
        // Silently fail
      }
    }

    checkNotes()
  }, [taskId])

  if (!hasNotes) return null

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 text-cyan-600 hover:text-cyan-700 transition-colors"
      title={`${noteCount} research note${noteCount > 1 ? 's' : ''}`}
    >
      <span className="material-symbols-outlined text-[14px]">science</span>
      {noteCount > 1 && (
        <span className="text-[10px] font-medium">{noteCount}</span>
      )}
    </button>
  )
}
