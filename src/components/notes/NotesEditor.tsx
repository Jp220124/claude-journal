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
import { useCallback, useEffect, useState, useRef, forwardRef, useImperativeHandle } from 'react'
import { cn } from '@/lib/utils'
import { EditorToolbar } from './EditorToolbar'
import { LinkEditorModal } from './LinkEditorModal'
import { Columns, Column } from './extensions/ColumnsExtension'
import { markdownToTiptap } from '@/lib/markdownToTiptap'

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

/**
 * Check if a table is malformed and needs re-parsing
 * Malformed tables have: all cells as headers, or single row with many cells
 */
function isTableMalformed(tableNode: Record<string, unknown>): boolean {
  if (!Array.isArray(tableNode.content)) return false

  const rows = tableNode.content as unknown[]
  if (rows.length === 0) return false

  // Check if there's only one row with many cells (all merged into one row)
  if (rows.length === 1) {
    const row = rows[0] as Record<string, unknown>
    if (Array.isArray(row.content) && row.content.length > 4) {
      // Single row with more than 4 cells is likely malformed
      return true
    }
  }

  // Check if all rows have only header cells (no regular cells)
  let hasRegularCells = false
  for (const row of rows) {
    const r = row as Record<string, unknown>
    if (Array.isArray(r.content)) {
      for (const cell of r.content as unknown[]) {
        const c = cell as Record<string, unknown>
        if (c.type === 'tableCell') {
          hasRegularCells = true
          break
        }
      }
    }
    if (hasRegularCells) break
  }

  // If there are multiple rows but no regular cells, table is malformed
  if (rows.length > 1 && !hasRegularCells) {
    return true
  }

  return false
}

/**
 * Check if content contains raw markdown that needs parsing
 * Looks for common markdown patterns in paragraph text nodes, codeBlock nodes, or malformed tables
 */
function contentNeedsMarkdownParsing(content: Record<string, unknown>): boolean {
  if (content.type !== 'doc' || !Array.isArray(content.content)) {
    return false
  }

  // First check for malformed tables
  for (const node of content.content as unknown[]) {
    const n = node as Record<string, unknown>
    if (n.type === 'table' && isTableMalformed(n)) {
      return true
    }
  }

  // Extract all text from paragraph and codeBlock nodes
  const extractText = (nodes: unknown[]): string => {
    let text = ''
    for (const node of nodes) {
      const n = node as Record<string, unknown>
      if (n.type === 'paragraph' && Array.isArray(n.content)) {
        for (const child of n.content) {
          const c = child as Record<string, unknown>
          if (c.type === 'text' && typeof c.text === 'string') {
            text += c.text + '\n'
          }
        }
      } else if (n.type === 'codeBlock' && Array.isArray(n.content)) {
        // Also check codeBlock nodes - tables may have been stored as code blocks
        for (const child of n.content) {
          const c = child as Record<string, unknown>
          if (c.type === 'text' && typeof c.text === 'string') {
            text += c.text + '\n'
          }
        }
      }
    }
    return text
  }

  const text = extractText(content.content as unknown[])

  // Check for markdown patterns - if we find these in raw text, it needs parsing
  const markdownPatterns = [
    /^#{1,6}\s+/m,           // Headings: # ## ### etc.
    /\*\*[^*]+\*\*/,         // Bold: **text**
    /\[\[[^\]]+\]\]/,        // Wiki links: [[link]]
    /\[[^\]]+\]\([^)]+\)/,   // Links: [text](url)
    /^>\s+/m,                // Blockquotes: > text
    /^-{3,}$/m,              // Horizontal rules: ---
    /^[-*+]\s+/m,            // Unordered lists: - item
    /^\d+\.\s+/m,            // Ordered lists: 1. item
    /```[\s\S]*```/,         // Code blocks: ```code```
    /^\|.+\|$/m,             // Tables: | cell | cell |
    /^\|[\s\-:]+\|$/m,       // Table separator: |---|---|
  ]

  // If multiple patterns match, it's likely raw markdown
  let matchCount = 0
  for (const pattern of markdownPatterns) {
    if (pattern.test(text)) {
      matchCount++
      if (matchCount >= 2) {
        return true
      }
    }
  }

  return false
}

/**
 * Extract text from a TipTap node recursively
 */
function extractTextFromNode(node: Record<string, unknown>): string {
  if (node.type === 'text' && typeof node.text === 'string') {
    return node.text
  }
  if (Array.isArray(node.content)) {
    return (node.content as unknown[]).map(child =>
      extractTextFromNode(child as Record<string, unknown>)
    ).join('')
  }
  return ''
}

/**
 * Extract raw text from TipTap content for markdown parsing
 * Includes text from paragraphs, codeBlocks, tables, and other nodes
 */
function extractTextFromTiptap(content: Record<string, unknown>): string {
  if (!Array.isArray(content.content)) {
    return ''
  }

  const lines: string[] = []

  for (const node of content.content as unknown[]) {
    const n = node as Record<string, unknown>
    if (n.type === 'paragraph' && Array.isArray(n.content)) {
      let lineText = ''
      for (const child of n.content) {
        const c = child as Record<string, unknown>
        if (c.type === 'text' && typeof c.text === 'string') {
          lineText += c.text
        }
      }
      lines.push(lineText)
    } else if (n.type === 'paragraph') {
      lines.push('') // Empty paragraph
    } else if (n.type === 'codeBlock' && Array.isArray(n.content)) {
      // Extract from codeBlocks - tables may have been stored as code
      for (const child of n.content) {
        const c = child as Record<string, unknown>
        if (c.type === 'text' && typeof c.text === 'string') {
          // Split code block text by newlines and add each line
          const codeLines = c.text.split('\n')
          lines.push(...codeLines)
        }
      }
    } else if (n.type === 'heading' && Array.isArray(n.content)) {
      // Preserve headings by adding markdown syntax back
      let headingText = ''
      for (const child of n.content) {
        const c = child as Record<string, unknown>
        if (c.type === 'text' && typeof c.text === 'string') {
          headingText += c.text
        }
      }
      const level = (n.attrs as Record<string, unknown>)?.level || 1
      lines.push('#'.repeat(level as number) + ' ' + headingText)
    } else if (n.type === 'table' && Array.isArray(n.content)) {
      // Convert table back to markdown format for re-parsing
      const tableRows: string[] = []
      let headerRowCount = 0

      for (const row of n.content as unknown[]) {
        const r = row as Record<string, unknown>
        if (r.type === 'tableRow' && Array.isArray(r.content)) {
          const cells: string[] = []
          let isHeaderRow = false

          for (const cell of r.content as unknown[]) {
            const c = cell as Record<string, unknown>
            if (c.type === 'tableHeader') {
              isHeaderRow = true
            }
            // Extract text from cell content
            const cellText = extractTextFromNode(c)
            cells.push(cellText)
          }

          if (cells.length > 0) {
            tableRows.push('| ' + cells.join(' | ') + ' |')
            if (isHeaderRow) {
              headerRowCount++
            }
          }
        }
      }

      // Add separator after header rows
      if (tableRows.length > 0 && headerRowCount > 0) {
        const firstRow = tableRows[0]
        const cellCount = (firstRow.match(/\|/g) || []).length - 1
        const separator = '| ' + Array(cellCount).fill('---').join(' | ') + ' |'
        // Insert separator after the last header row
        tableRows.splice(headerRowCount, 0, separator)
      }

      lines.push(...tableRows)
    }
  }

  return lines.join('\n')
}

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

  // Check if content contains raw markdown that needs parsing
  if (contentNeedsMarkdownParsing(contentObj)) {
    const rawText = extractTextFromTiptap(contentObj)
    if (rawText.trim()) {
      // Convert markdown to proper TipTap structure
      return markdownToTiptap(rawText)
    }
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

export interface NotesEditorHandle {
  insertContent: (text: string) => void
  focus: () => void
}

export const NotesEditor = forwardRef<NotesEditorHandle, NotesEditorProps>(function NotesEditor({
  content,
  onUpdate,
  placeholder = 'Start writing...',
  editable = true,
  className,
  onImageUpload,
}, ref) {
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

  // Expose imperative methods via ref
  useImperativeHandle(ref, () => ({
    insertContent: (text: string) => {
      if (!editor) return
      // Move cursor to end and insert content with a blank line before
      editor
        .chain()
        .focus('end')
        .insertContent([
          { type: 'paragraph' },
          { type: 'paragraph', content: [{ type: 'text', text }] },
        ])
        .run()
    },
    focus: () => {
      editor?.commands.focus()
    },
  }), [editor])

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
})
