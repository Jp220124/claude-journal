'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import Typography from '@tiptap/extension-typography'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { common, createLowlight } from 'lowlight'
import { cn } from '@/lib/utils'
import { getPublicNote, incrementNoteShareView } from '@/lib/notesService'
import { PublicNote } from '@/types/database'
import {
  Loader2,
  AlertCircle,
  Clock,
  FileText,
  ClipboardX,
} from 'lucide-react'

const lowlight = createLowlight(common)

// Read-only extensions
const READ_ONLY_EXTENSIONS = [
  StarterKit.configure({
    codeBlock: false,
    link: false,
    underline: false,
    heading: { levels: [1, 2, 3] },
  }),
  TaskList,
  TaskItem.configure({ nested: true }),
  Table.configure({
    resizable: false,
    HTMLAttributes: { class: 'notes-table' },
  }),
  TableRow,
  TableCell,
  TableHeader,
  Image.configure({
    HTMLAttributes: { class: 'notes-image' },
    allowBase64: true,
  }),
  Link.configure({
    openOnClick: true, // Allow clicking links in read-only mode
    HTMLAttributes: { class: 'notes-link' },
  }),
  Underline,
  Highlight.configure({ multicolor: true }),
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  Typography,
  CodeBlockLowlight.configure({
    lowlight,
    HTMLAttributes: { class: 'notes-code-block' },
  }),
]

export default function SharedNotePage() {
  const params = useParams()
  const token = params.token as string

  const [note, setNote] = useState<PublicNote | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Read-only TipTap editor
  const editor = useEditor({
    extensions: READ_ONLY_EXTENSIONS,
    content: '',
    editable: false,
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg dark:prose-invert max-w-none focus:outline-none',
      },
    },
  })

  // Fetch note on mount
  useEffect(() => {
    const fetchNote = async () => {
      try {
        const noteData = await getPublicNote(token)

        if (!noteData) {
          setError('This note is not available. It may have expired or been removed.')
          setLoading(false)
          return
        }

        setNote(noteData)

        // Set editor content
        if (editor && noteData.content) {
          editor.commands.setContent(noteData.content)
        }

        // Increment view count
        await incrementNoteShareView(token)
      } catch (err) {
        console.error('Error fetching note:', err)
        setError('Failed to load the shared note.')
      } finally {
        setLoading(false)
      }
    }

    if (token) {
      fetchNote()
    }
  }, [token, editor])

  // Update editor content when note changes
  useEffect(() => {
    if (editor && note?.content) {
      editor.commands.setContent(note.content)
    }
  }, [editor, note])

  // Disable text selection if copying is not allowed
  useEffect(() => {
    if (note && !note.allow_copy) {
      const handleSelectStart = (e: Event) => {
        e.preventDefault()
      }
      const handleCopy = (e: Event) => {
        e.preventDefault()
      }
      const handleContextMenu = (e: Event) => {
        e.preventDefault()
      }

      document.addEventListener('selectstart', handleSelectStart)
      document.addEventListener('copy', handleCopy)
      document.addEventListener('contextmenu', handleContextMenu)

      return () => {
        document.removeEventListener('selectstart', handleSelectStart)
        document.removeEventListener('copy', handleCopy)
        document.removeEventListener('contextmenu', handleContextMenu)
      }
    }
  }, [note])

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
          <p className="text-[var(--muted-foreground)]">Loading shared note...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)] p-4">
        <div className="max-w-md w-full bg-[var(--card)] rounded-xl shadow-lg p-8 text-center border border-[var(--border)]">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            {error.includes('expired') ? (
              <Clock className="h-8 w-8 text-red-500" />
            ) : (
              <AlertCircle className="h-8 w-8 text-red-500" />
            )}
          </div>
          <h1 className="text-xl font-bold text-[var(--foreground)] mb-2">
            Note Unavailable
          </h1>
          <p className="text-[var(--muted-foreground)]">{error}</p>
          <a
            href="/"
            className="inline-block mt-6 px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Go to Homepage
          </a>
        </div>
      </div>
    )
  }

  // Note content state
  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="bg-[var(--card)] border-b border-[var(--border)] sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center flex-shrink-0">
              <FileText className="h-5 w-5 text-[var(--primary)]" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-semibold text-[var(--foreground)] truncate text-lg">
                {note?.title || 'Untitled Note'}
              </h1>
              <p className="text-sm text-[var(--muted-foreground)]">
                Shared note
              </p>
            </div>
            {note && !note.allow_copy && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-[var(--muted)] rounded-md text-xs text-[var(--muted-foreground)]">
                <ClipboardX className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Copy disabled</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Note Content */}
      <main className="max-w-3xl mx-auto px-4 py-8">
        <article
          className={cn(
            'bg-[var(--card)] rounded-xl shadow-sm border border-[var(--border)] p-6 sm:p-8',
            note && !note.allow_copy && 'select-none'
          )}
        >
          {/* Note Title */}
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--foreground)] mb-6">
            {note?.title || 'Untitled Note'}
          </h1>

          {/* Note Content */}
          <div className="prose-container">
            <EditorContent editor={editor} />
          </div>
        </article>
      </main>

      {/* Footer */}
      <footer className="bg-[var(--card)] border-t border-[var(--border)] py-4 mt-auto">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <p className="text-sm text-[var(--muted-foreground)]">
            Shared via{' '}
            <a href="/" className="text-[var(--primary)] hover:underline">
              Claude Journal
            </a>
          </p>
        </div>
      </footer>

      {/* Global Styles for Note Content */}
      <style jsx global>{`
        .prose-container .ProseMirror {
          outline: none;
        }

        .prose-container h1 {
          font-size: 1.875rem;
          font-weight: 700;
          margin-bottom: 1rem;
          color: var(--foreground);
        }

        .prose-container h2 {
          font-size: 1.5rem;
          font-weight: 600;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
          color: var(--foreground);
        }

        .prose-container h3 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
          color: var(--foreground);
        }

        .prose-container p {
          margin-bottom: 0.75rem;
          line-height: 1.7;
          color: var(--foreground);
        }

        .prose-container ul,
        .prose-container ol {
          margin: 0.75rem 0;
          padding-left: 1.5rem;
        }

        .prose-container li {
          margin: 0.25rem 0;
          color: var(--foreground);
        }

        .prose-container a.notes-link {
          color: var(--primary);
          text-decoration: underline;
        }

        .prose-container a.notes-link:hover {
          opacity: 0.8;
        }

        .prose-container code {
          background: var(--muted);
          padding: 0.125rem 0.375rem;
          border-radius: 0.25rem;
          font-size: 0.875rem;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }

        .prose-container pre.notes-code-block {
          background: var(--muted);
          padding: 1rem;
          border-radius: 0.5rem;
          overflow-x: auto;
          margin: 1rem 0;
        }

        .prose-container pre.notes-code-block code {
          background: transparent;
          padding: 0;
        }

        .prose-container blockquote {
          border-left: 3px solid var(--primary);
          padding-left: 1rem;
          margin: 1rem 0;
          font-style: italic;
          color: var(--muted-foreground);
        }

        .prose-container img.notes-image {
          max-width: 100%;
          height: auto;
          border-radius: 0.5rem;
          margin: 1rem 0;
        }

        .prose-container table.notes-table {
          width: 100%;
          border-collapse: collapse;
          margin: 1rem 0;
        }

        .prose-container table.notes-table th,
        .prose-container table.notes-table td {
          border: 1px solid var(--border);
          padding: 0.5rem 0.75rem;
          text-align: left;
        }

        .prose-container table.notes-table th {
          background: var(--muted);
          font-weight: 600;
        }

        .prose-container ul[data-type="taskList"] {
          list-style: none;
          padding-left: 0;
        }

        .prose-container ul[data-type="taskList"] li {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
        }

        .prose-container ul[data-type="taskList"] li input[type="checkbox"] {
          margin-top: 0.25rem;
          cursor: default;
        }

        .prose-container mark {
          background: #fef08a;
          padding: 0.125rem 0.25rem;
          border-radius: 0.125rem;
        }

        .prose-container hr {
          border: none;
          border-top: 1px solid var(--border);
          margin: 1.5rem 0;
        }
      `}</style>
    </div>
  )
}
