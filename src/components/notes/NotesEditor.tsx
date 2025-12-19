'use client'

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
import CharacterCount from '@tiptap/extension-character-count'
import Placeholder from '@tiptap/extension-placeholder'
import Typography from '@tiptap/extension-typography'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { DragHandle } from '@tiptap/extension-drag-handle'
import { common, createLowlight } from 'lowlight'
import { useCallback, useEffect, useState, useRef } from 'react'
import { cn } from '@/lib/utils'
import { EditorToolbar } from './EditorToolbar'
import { LinkEditorModal } from './LinkEditorModal'
import { Columns, Column } from './extensions/ColumnsExtension'

const lowlight = createLowlight(common)

// Default empty TipTap document structure
const DEFAULT_CONTENT = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
}

// Note: We use the Link and Underline extensions directly
// No need to rename them as they work correctly with their default names

// Singleton extensions array - created once
const EDITOR_EXTENSIONS = [
  StarterKit.configure({
    codeBlock: false, // We use CodeBlockLowlight instead
    link: false, // We use our own Link configuration
    underline: false, // We use our own Underline configuration
    heading: {
      levels: [1, 2, 3],
    },
  }),
  TaskList,
  TaskItem.configure({
    nested: true,
  }),
  Table.configure({
    resizable: true,
    HTMLAttributes: {
      class: 'notes-table',
    },
  }),
  TableRow,
  TableCell,
  TableHeader,
  Image.configure({
    HTMLAttributes: {
      class: 'notes-image',
    },
    allowBase64: true,
    // Enable native TipTap 3.x image resize
    resize: {
      enabled: true,
      directions: ['bottom-right', 'bottom-left', 'top-right', 'top-left'],
      minWidth: 50,
      minHeight: 50,
      alwaysPreserveAspectRatio: false, // Hold Shift to lock aspect ratio
    },
  }),
  Link.configure({
    openOnClick: false,
    HTMLAttributes: {
      class: 'notes-link',
    },
  }),
  Underline,
  Highlight.configure({
    multicolor: true,
  }),
  TextAlign.configure({
    types: ['heading', 'paragraph'],
  }),
  CharacterCount,
  Placeholder.configure({
    placeholder: 'Start writing...',
  }),
  Typography,
  CodeBlockLowlight.configure({
    lowlight,
    HTMLAttributes: {
      class: 'notes-code-block',
    },
  }),
  // Drag handle for moving blocks
  DragHandle.configure({
    render: () => {
      const element = document.createElement('div')
      element.classList.add('notes-drag-handle')
      element.innerHTML = '⋮⋮'
      return element
    },
  }),
  // Multi-column layout
  Columns,
  Column,
]

// Helper to validate and normalize TipTap content
function normalizeContent(content: string | object): object | string {
  if (typeof content === 'string') {
    return content || ''
  }

  // Check if content is empty or invalid
  if (!content || typeof content !== 'object') {
    return DEFAULT_CONTENT
  }

  // Check if it's a valid TipTap document (has type: 'doc')
  const contentObj = content as Record<string, unknown>
  if (contentObj.type !== 'doc' || !Array.isArray(contentObj.content)) {
    return DEFAULT_CONTENT
  }

  return content
}

interface NotesEditorProps {
  content: string | object
  onUpdate: (content: { json: object; text: string; html: string }) => void
  placeholder?: string
  editable?: boolean
  className?: string
  onImageUpload?: (file: File) => Promise<string | null>
}

export function NotesEditor({
  content,
  onUpdate,
  placeholder = 'Start writing...',
  editable = true,
  className,
  onImageUpload,
}: NotesEditorProps) {
  const [linkModalOpen, setLinkModalOpen] = useState(false)
  const [currentLink, setCurrentLink] = useState({ url: '', text: '' })
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  // Track when the editor itself is making changes to prevent external content from overwriting
  const isLocalUpdate = useRef(false)
  const lastLocalUpdateTime = useRef(0)

  const editor = useEditor({
    immediatelyRender: false, // Required for Next.js SSR compatibility
    extensions: EDITOR_EXTENSIONS,
    content: normalizeContent(content),
    editable,
    onUpdate: ({ editor }) => {
      // Mark this as a local update
      isLocalUpdate.current = true
      lastLocalUpdateTime.current = Date.now()

      // Debounce updates
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }
      updateTimeoutRef.current = setTimeout(() => {
        onUpdate({
          json: editor.getJSON(),
          text: editor.getText(),
          html: editor.getHTML(),
        })
        // Reset local update flag after the update has been sent
        setTimeout(() => {
          isLocalUpdate.current = false
        }, 100)
      }, 300)
    },
    editorProps: {
      attributes: {
        class: 'notes-editor-content prose prose-slate max-w-none focus:outline-none',
      },
      handleDrop: (view, event, slice, moved) => {
        if (!moved && event.dataTransfer?.files.length && onImageUpload) {
          const file = event.dataTransfer.files[0]
          if (file.type.startsWith('image/')) {
            event.preventDefault()
            handleImageUpload(file)
            return true
          }
        }
        return false
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items
        if (items && onImageUpload) {
          for (const item of items) {
            if (item.type.startsWith('image/')) {
              event.preventDefault()
              const file = item.getAsFile()
              if (file) {
                handleImageUpload(file)
                return true
              }
            }
          }
        }
        return false
      },
    },
  })

  // Sync content when it changes externally
  useEffect(() => {
    if (editor) {
      // Don't sync external content if user is actively editing (within last 2 seconds)
      // This prevents server data from overwriting what the user is typing
      const timeSinceLastEdit = Date.now() - lastLocalUpdateTime.current
      if (isLocalUpdate.current || timeSinceLastEdit < 2000) {
        return
      }

      const normalizedContent = normalizeContent(content)
      const currentContent = JSON.stringify(editor.getJSON())
      const newContent = typeof normalizedContent === 'string' ? normalizedContent : JSON.stringify(normalizedContent)

      // Only update if content actually changed to avoid infinite loops
      if (currentContent !== newContent) {
        editor.commands.setContent(normalizedContent)
      }
    }
  }, [content, editor])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }
    }
  }, [])

  const handleImageUpload = useCallback(async (file: File) => {
    if (!onImageUpload || !editor) return

    const url = await onImageUpload(file)
    if (url) {
      editor.chain().focus().setImage({ src: url }).run()
    }
  }, [editor, onImageUpload])

  const openLinkModal = useCallback(() => {
    if (!editor) return

    const { from, to } = editor.state.selection
    const text = editor.state.doc.textBetween(from, to, '')
    const existingLink = editor.getAttributes('link').href || ''

    setCurrentLink({ url: existingLink, text })
    setLinkModalOpen(true)
  }, [editor])

  const setLink = useCallback((url: string) => {
    if (!editor) return

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
    } else {
      // Check if there's selected text
      const { from, to } = editor.state.selection
      const hasSelection = from !== to

      if (hasSelection) {
        // Apply link to selected text
        editor.chain().focus().setLink({ href: url }).run()
      } else {
        // No selection - insert the URL as both text and link
        editor
          .chain()
          .focus()
          .insertContent({
            type: 'text',
            text: url,
            marks: [{ type: 'link', attrs: { href: url } }],
          })
          .run()
      }
    }
    setLinkModalOpen(false)
  }, [editor])

  if (!editor) return null

  const wordCount = editor.storage.characterCount.words()
  const charCount = editor.storage.characterCount.characters()

  return (
    <div className={cn('notes-editor', className)}>
      <EditorToolbar
        editor={editor}
        onImageUpload={onImageUpload ? handleImageUpload : undefined}
        onLinkClick={openLinkModal}
      />

      <EditorContent editor={editor} className="min-h-[300px]" />

      {/* Word Count Footer */}
      <div className="flex items-center justify-between text-xs text-slate-400 mt-4 pt-4 border-t border-slate-100">
        <span>{wordCount} words</span>
        <span>{charCount} characters</span>
      </div>

      {/* Link Editor Modal */}
      <LinkEditorModal
        isOpen={linkModalOpen}
        onClose={() => setLinkModalOpen(false)}
        onSave={setLink}
        initialUrl={currentLink.url}
        selectedText={currentLink.text}
      />
    </div>
  )
}
