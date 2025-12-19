'use client'

import { Editor } from '@tiptap/react'
import { useState, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'

interface EditorToolbarProps {
  editor: Editor
  onImageUpload?: (file: File) => void
  onLinkClick: () => void
}

export function EditorToolbar({ editor, onImageUpload, onLinkClick }: EditorToolbarProps) {
  const [showHeadingMenu, setShowHeadingMenu] = useState(false)
  const [showHighlightMenu, setShowHighlightMenu] = useState(false)
  const [showTableMenu, setShowTableMenu] = useState(false)
  const [showColumnsMenu, setShowColumnsMenu] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const highlightColors = [
    { name: 'Yellow', color: '#fef08a' },
    { name: 'Green', color: '#bbf7d0' },
    { name: 'Blue', color: '#bfdbfe' },
    { name: 'Pink', color: '#fbcfe8' },
    { name: 'Orange', color: '#fed7aa' },
    { name: 'Purple', color: '#ddd6fe' },
  ]

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && onImageUpload) {
      onImageUpload(file)
    }
    e.target.value = ''
  }, [onImageUpload])

  const insertTable = useCallback(() => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
    setShowTableMenu(false)
  }, [editor])

  const ToolbarButton = ({
    onClick,
    isActive = false,
    disabled = false,
    children,
    title,
  }: {
    onClick: () => void
    isActive?: boolean
    disabled?: boolean
    children: React.ReactNode
    title?: string
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'p-1.5 rounded-md transition-colors',
        isActive
          ? 'bg-cyan-100 text-cyan-700'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      {children}
    </button>
  )

  const ToolbarDivider = () => (
    <div className="w-px h-5 bg-slate-200 mx-0.5" />
  )

  return (
    <div className="sticky top-0 z-20 flex flex-wrap items-center gap-0 p-1.5 bg-slate-50 rounded-lg border border-slate-200 mb-3 shadow-sm backdrop-blur-sm">
      {/* Text Formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        title="Bold (Ctrl+B)"
      >
        <span className="material-symbols-outlined text-[18px]">format_bold</span>
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        title="Italic (Ctrl+I)"
      >
        <span className="material-symbols-outlined text-[18px]">format_italic</span>
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive('underline')}
        title="Underline (Ctrl+U)"
      >
        <span className="material-symbols-outlined text-[18px]">format_underlined</span>
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive('strike')}
        title="Strikethrough"
      >
        <span className="material-symbols-outlined text-[18px]">format_strikethrough</span>
      </ToolbarButton>

      {/* Highlight Menu */}
      <div className="relative">
        <ToolbarButton
          onClick={() => setShowHighlightMenu(!showHighlightMenu)}
          isActive={editor.isActive('highlight')}
          title="Highlight"
        >
          <span className="material-symbols-outlined text-[18px]">ink_highlighter</span>
        </ToolbarButton>
        {showHighlightMenu && (
          <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-slate-200 p-2 z-50">
            <div className="flex gap-1">
              {highlightColors.map((item) => (
                <button
                  key={item.color}
                  onClick={() => {
                    editor.chain().focus().toggleHighlight({ color: item.color }).run()
                    setShowHighlightMenu(false)
                  }}
                  title={item.name}
                  className="w-6 h-6 rounded border border-slate-200 hover:scale-110 transition-transform"
                  style={{ backgroundColor: item.color }}
                />
              ))}
            </div>
            <button
              onClick={() => {
                editor.chain().focus().unsetHighlight().run()
                setShowHighlightMenu(false)
              }}
              className="w-full text-xs text-slate-500 hover:text-slate-700 mt-2 text-center"
            >
              Remove highlight
            </button>
          </div>
        )}
      </div>

      <ToolbarDivider />

      {/* Headings Menu */}
      <div className="relative">
        <ToolbarButton
          onClick={() => setShowHeadingMenu(!showHeadingMenu)}
          isActive={editor.isActive('heading')}
          title="Headings"
        >
          <span className="material-symbols-outlined text-[18px]">title</span>
        </ToolbarButton>
        {showHeadingMenu && (
          <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-slate-200 p-1 z-50 min-w-[120px]">
            <button
              onClick={() => {
                editor.chain().focus().toggleHeading({ level: 1 }).run()
                setShowHeadingMenu(false)
              }}
              className={cn(
                'w-full text-left px-3 py-2 rounded hover:bg-slate-100 text-xl font-bold',
                editor.isActive('heading', { level: 1 }) && 'bg-cyan-50 text-cyan-700'
              )}
            >
              Heading 1
            </button>
            <button
              onClick={() => {
                editor.chain().focus().toggleHeading({ level: 2 }).run()
                setShowHeadingMenu(false)
              }}
              className={cn(
                'w-full text-left px-3 py-2 rounded hover:bg-slate-100 text-lg font-bold',
                editor.isActive('heading', { level: 2 }) && 'bg-cyan-50 text-cyan-700'
              )}
            >
              Heading 2
            </button>
            <button
              onClick={() => {
                editor.chain().focus().toggleHeading({ level: 3 }).run()
                setShowHeadingMenu(false)
              }}
              className={cn(
                'w-full text-left px-3 py-2 rounded hover:bg-slate-100 text-base font-bold',
                editor.isActive('heading', { level: 3 }) && 'bg-cyan-50 text-cyan-700'
              )}
            >
              Heading 3
            </button>
            <div className="border-t border-slate-100 my-1" />
            <button
              onClick={() => {
                editor.chain().focus().setParagraph().run()
                setShowHeadingMenu(false)
              }}
              className={cn(
                'w-full text-left px-3 py-2 rounded hover:bg-slate-100 text-sm',
                editor.isActive('paragraph') && 'bg-cyan-50 text-cyan-700'
              )}
            >
              Normal text
            </button>
          </div>
        )}
      </div>

      <ToolbarDivider />

      {/* Lists */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
        title="Bullet List"
      >
        <span className="material-symbols-outlined text-[18px]">format_list_bulleted</span>
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
        title="Numbered List"
      >
        <span className="material-symbols-outlined text-[18px]">format_list_numbered</span>
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        isActive={editor.isActive('taskList')}
        title="Checkbox List"
      >
        <span className="material-symbols-outlined text-[18px]">checklist</span>
      </ToolbarButton>

      <ToolbarDivider />

      {/* Alignment */}
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        isActive={editor.isActive({ textAlign: 'left' })}
        title="Align Left"
      >
        <span className="material-symbols-outlined text-[18px]">format_align_left</span>
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        isActive={editor.isActive({ textAlign: 'center' })}
        title="Align Center"
      >
        <span className="material-symbols-outlined text-[18px]">format_align_center</span>
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        isActive={editor.isActive({ textAlign: 'right' })}
        title="Align Right"
      >
        <span className="material-symbols-outlined text-[18px]">format_align_right</span>
      </ToolbarButton>

      <ToolbarDivider />

      {/* Blocks */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive('blockquote')}
        title="Quote"
      >
        <span className="material-symbols-outlined text-[18px]">format_quote</span>
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        isActive={editor.isActive('codeBlock')}
        title="Code Block"
      >
        <span className="material-symbols-outlined text-[18px]">code</span>
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Horizontal Rule"
      >
        <span className="material-symbols-outlined text-[18px]">horizontal_rule</span>
      </ToolbarButton>

      <ToolbarDivider />

      {/* Links & Media */}
      <ToolbarButton
        onClick={onLinkClick}
        isActive={editor.isActive('link')}
        title="Insert Link (Ctrl+K)"
      >
        <span className="material-symbols-outlined text-[18px]">link</span>
      </ToolbarButton>

      {onImageUpload && (
        <>
          <ToolbarButton
            onClick={() => fileInputRef.current?.click()}
            title="Insert Image"
          >
            <span className="material-symbols-outlined text-[18px]">image</span>
          </ToolbarButton>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />
        </>
      )}

      {/* Table Menu */}
      <div className="relative">
        <ToolbarButton
          onClick={() => setShowTableMenu(!showTableMenu)}
          isActive={editor.isActive('table')}
          title="Insert Table"
        >
          <span className="material-symbols-outlined text-[18px]">table_chart</span>
        </ToolbarButton>
        {showTableMenu && (
          <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-slate-200 p-2 z-50 min-w-[160px]">
            <button
              onClick={insertTable}
              className="w-full text-left px-3 py-2 rounded hover:bg-slate-100 text-sm flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Insert Table (3x3)
            </button>
            {editor.isActive('table') && (
              <>
                <div className="border-t border-slate-100 my-1" />
                <button
                  onClick={() => {
                    editor.chain().focus().addColumnBefore().run()
                    setShowTableMenu(false)
                  }}
                  className="w-full text-left px-3 py-2 rounded hover:bg-slate-100 text-sm"
                >
                  Add Column Before
                </button>
                <button
                  onClick={() => {
                    editor.chain().focus().addColumnAfter().run()
                    setShowTableMenu(false)
                  }}
                  className="w-full text-left px-3 py-2 rounded hover:bg-slate-100 text-sm"
                >
                  Add Column After
                </button>
                <button
                  onClick={() => {
                    editor.chain().focus().addRowBefore().run()
                    setShowTableMenu(false)
                  }}
                  className="w-full text-left px-3 py-2 rounded hover:bg-slate-100 text-sm"
                >
                  Add Row Before
                </button>
                <button
                  onClick={() => {
                    editor.chain().focus().addRowAfter().run()
                    setShowTableMenu(false)
                  }}
                  className="w-full text-left px-3 py-2 rounded hover:bg-slate-100 text-sm"
                >
                  Add Row After
                </button>
                <div className="border-t border-slate-100 my-1" />
                <button
                  onClick={() => {
                    editor.chain().focus().deleteColumn().run()
                    setShowTableMenu(false)
                  }}
                  className="w-full text-left px-3 py-2 rounded hover:bg-red-50 text-sm text-red-600"
                >
                  Delete Column
                </button>
                <button
                  onClick={() => {
                    editor.chain().focus().deleteRow().run()
                    setShowTableMenu(false)
                  }}
                  className="w-full text-left px-3 py-2 rounded hover:bg-red-50 text-sm text-red-600"
                >
                  Delete Row
                </button>
                <button
                  onClick={() => {
                    editor.chain().focus().deleteTable().run()
                    setShowTableMenu(false)
                  }}
                  className="w-full text-left px-3 py-2 rounded hover:bg-red-50 text-sm text-red-600"
                >
                  Delete Table
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Columns Menu */}
      <div className="relative">
        <ToolbarButton
          onClick={() => setShowColumnsMenu(!showColumnsMenu)}
          isActive={editor.isActive('columns')}
          title="Insert Columns (Side by Side)"
        >
          <span className="material-symbols-outlined text-[18px]">view_column</span>
        </ToolbarButton>
        {showColumnsMenu && (
          <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-slate-200 p-2 z-50 min-w-[180px]">
            {/* Column count options */}
            <div className="text-xs text-slate-400 px-3 py-1 font-medium">Insert Columns</div>
            <button
              onClick={() => {
                editor.chain().focus().setColumnCount(1).run()
                setShowColumnsMenu(false)
              }}
              className="w-full text-left px-3 py-2 rounded hover:bg-slate-100 text-sm flex items-center gap-2"
            >
              <span className="flex gap-0.5">
                <span className="w-8 h-4 bg-slate-300 rounded-sm"></span>
              </span>
              Single Column
            </button>
            <button
              onClick={() => {
                editor.chain().focus().setColumnCount(2).run()
                setShowColumnsMenu(false)
              }}
              className="w-full text-left px-3 py-2 rounded hover:bg-slate-100 text-sm flex items-center gap-2"
            >
              <span className="flex gap-0.5">
                <span className="w-4 h-4 bg-slate-300 rounded-sm"></span>
                <span className="w-4 h-4 bg-slate-300 rounded-sm"></span>
              </span>
              Two Columns
            </button>
            <button
              onClick={() => {
                editor.chain().focus().setColumnCount(3).run()
                setShowColumnsMenu(false)
              }}
              className="w-full text-left px-3 py-2 rounded hover:bg-slate-100 text-sm flex items-center gap-2"
            >
              <span className="flex gap-0.5">
                <span className="w-3 h-4 bg-slate-300 rounded-sm"></span>
                <span className="w-3 h-4 bg-slate-300 rounded-sm"></span>
                <span className="w-3 h-4 bg-slate-300 rounded-sm"></span>
              </span>
              Three Columns
            </button>
            <button
              onClick={() => {
                editor.chain().focus().setColumnCount(4).run()
                setShowColumnsMenu(false)
              }}
              className="w-full text-left px-3 py-2 rounded hover:bg-slate-100 text-sm flex items-center gap-2"
            >
              <span className="flex gap-0.5">
                <span className="w-2 h-4 bg-slate-300 rounded-sm"></span>
                <span className="w-2 h-4 bg-slate-300 rounded-sm"></span>
                <span className="w-2 h-4 bg-slate-300 rounded-sm"></span>
                <span className="w-2 h-4 bg-slate-300 rounded-sm"></span>
              </span>
              Four Columns
            </button>
            <button
              onClick={() => {
                editor.chain().focus().setColumnCount(5).run()
                setShowColumnsMenu(false)
              }}
              className="w-full text-left px-3 py-2 rounded hover:bg-slate-100 text-sm flex items-center gap-2"
            >
              <span className="flex gap-0.5">
                <span className="w-1.5 h-4 bg-slate-300 rounded-sm"></span>
                <span className="w-1.5 h-4 bg-slate-300 rounded-sm"></span>
                <span className="w-1.5 h-4 bg-slate-300 rounded-sm"></span>
                <span className="w-1.5 h-4 bg-slate-300 rounded-sm"></span>
                <span className="w-1.5 h-4 bg-slate-300 rounded-sm"></span>
              </span>
              Five Columns
            </button>
            <button
              onClick={() => {
                editor.chain().focus().setColumnCount(6).run()
                setShowColumnsMenu(false)
              }}
              className="w-full text-left px-3 py-2 rounded hover:bg-slate-100 text-sm flex items-center gap-2"
            >
              <span className="flex gap-0.5">
                <span className="w-1 h-4 bg-slate-300 rounded-sm"></span>
                <span className="w-1 h-4 bg-slate-300 rounded-sm"></span>
                <span className="w-1 h-4 bg-slate-300 rounded-sm"></span>
                <span className="w-1 h-4 bg-slate-300 rounded-sm"></span>
                <span className="w-1 h-4 bg-slate-300 rounded-sm"></span>
                <span className="w-1 h-4 bg-slate-300 rounded-sm"></span>
              </span>
              Six Columns
            </button>

            {/* Ratio layouts */}
            <div className="border-t border-slate-100 my-1" />
            <div className="text-xs text-slate-400 px-3 py-1 font-medium">With Ratios</div>
            <button
              onClick={() => {
                editor.chain().focus().setColumns('1-2').run()
                setShowColumnsMenu(false)
              }}
              className="w-full text-left px-3 py-2 rounded hover:bg-slate-100 text-sm flex items-center gap-2"
            >
              <span className="flex gap-0.5">
                <span className="w-3 h-4 bg-slate-300 rounded-sm"></span>
                <span className="w-5 h-4 bg-slate-300 rounded-sm"></span>
              </span>
              Sidebar Left (1:2)
            </button>
            <button
              onClick={() => {
                editor.chain().focus().setColumns('2-1').run()
                setShowColumnsMenu(false)
              }}
              className="w-full text-left px-3 py-2 rounded hover:bg-slate-100 text-sm flex items-center gap-2"
            >
              <span className="flex gap-0.5">
                <span className="w-5 h-4 bg-slate-300 rounded-sm"></span>
                <span className="w-3 h-4 bg-slate-300 rounded-sm"></span>
              </span>
              Sidebar Right (2:1)
            </button>

            {/* Column management when inside columns */}
            {editor.isActive('columns') && (
              <>
                <div className="border-t border-slate-100 my-1" />
                <div className="text-xs text-slate-400 px-3 py-1 font-medium">Modify Columns</div>
                <button
                  onClick={() => {
                    editor.chain().focus().addColumn().run()
                    setShowColumnsMenu(false)
                  }}
                  className="w-full text-left px-3 py-2 rounded hover:bg-slate-100 text-sm flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  Add Column
                </button>
                <button
                  onClick={() => {
                    editor.chain().focus().removeColumn().run()
                    setShowColumnsMenu(false)
                  }}
                  className="w-full text-left px-3 py-2 rounded hover:bg-slate-100 text-sm flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[16px]">remove</span>
                  Remove Column
                </button>
                <div className="border-t border-slate-100 my-1" />
                <button
                  onClick={() => {
                    editor.chain().focus().unsetColumns().run()
                    setShowColumnsMenu(false)
                  }}
                  className="w-full text-left px-3 py-2 rounded hover:bg-red-50 text-sm text-red-600 flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                  Remove All Columns
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <ToolbarDivider />

      {/* Undo/Redo */}
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Undo (Ctrl+Z)"
      >
        <span className="material-symbols-outlined text-[18px]">undo</span>
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Redo (Ctrl+Y)"
      >
        <span className="material-symbols-outlined text-[18px]">redo</span>
      </ToolbarButton>
    </div>
  )
}
