'use client'

import { format, isToday, isYesterday, isThisWeek } from 'date-fns'
import { cn } from '@/lib/utils'
import type { Note, NoteTag } from '@/types/database'

interface RecentNotesProps {
  notes: Note[]
  selectedNoteId: string | null
  onNoteSelect: (note: Note) => void
  noteTags?: Record<string, NoteTag[]> // Optional map of noteId to tags
  maxNotes?: number
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  if (isToday(date)) {
    return `Today at ${format(date, 'h:mm a')}`
  }
  if (isYesterday(date)) {
    return `Yesterday at ${format(date, 'h:mm a')}`
  }
  if (isThisWeek(date)) {
    return format(date, 'EEEE')
  }
  return format(date, 'MMM d')
}

export function RecentNotes({
  notes,
  selectedNoteId,
  onNoteSelect,
  noteTags = {},
  maxNotes = 5,
}: RecentNotesProps) {
  // Get most recently updated notes (excluding archived)
  const recentNotes = notes
    .filter(n => !n.is_archived)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, maxNotes)

  if (recentNotes.length === 0) {
    return null
  }

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between px-2 mb-2">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Recent</span>
        <span className="text-xs text-slate-400">{recentNotes.length} notes</span>
      </div>

      <div className="space-y-1">
        {recentNotes.map(note => {
          const tags = noteTags[note.id] || []
          return (
            <button
              key={note.id}
              onClick={() => onNoteSelect(note)}
              className={cn(
                'w-full text-left p-3 rounded-xl transition-all',
                selectedNoteId === note.id
                  ? 'bg-cyan-50 border border-cyan-200'
                  : 'bg-white hover:bg-slate-50 border border-transparent'
              )}
            >
              <div className="flex items-start gap-2">
                {note.is_pinned && (
                  <span className="material-symbols-outlined text-amber-500 text-[14px] mt-0.5 flex-shrink-0">
                    push_pin
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-900 truncate flex-1">
                      {note.title}
                    </h4>
                    <span className="text-[10px] text-slate-400 flex-shrink-0">
                      {formatRelativeDate(note.updated_at)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                    {note.content_text || 'No content'}
                  </p>
                  {tags.length > 0 && (
                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                      {tags.slice(0, 3).map(tag => (
                        <span
                          key={tag.id}
                          className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium text-white"
                          style={{ backgroundColor: tag.color }}
                        >
                          {tag.name}
                        </span>
                      ))}
                      {tags.length > 3 && (
                        <span className="text-[10px] text-slate-400">+{tags.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
