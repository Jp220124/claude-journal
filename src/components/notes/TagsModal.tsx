'use client'

import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import type { NoteTag } from '@/types/database'

interface TagsModalProps {
  isOpen: boolean
  onClose: () => void
  tags: NoteTag[]
  onCreateTag: (name: string, color: string) => Promise<NoteTag | null>
  onUpdateTag: (tagId: string, name: string, color: string) => Promise<NoteTag | null>
  onDeleteTag: (tagId: string) => Promise<boolean>
}

const TAG_COLORS = [
  { name: 'Red', color: '#ef4444' },
  { name: 'Orange', color: '#f97316' },
  { name: 'Amber', color: '#f59e0b' },
  { name: 'Green', color: '#22c55e' },
  { name: 'Teal', color: '#14b8a6' },
  { name: 'Cyan', color: '#06b6d4' },
  { name: 'Blue', color: '#3b82f6' },
  { name: 'Indigo', color: '#6366f1' },
  { name: 'Purple', color: '#8b5cf6' },
  { name: 'Pink', color: '#ec4899' },
  { name: 'Slate', color: '#64748b' },
]

export function TagsModal({
  isOpen,
  onClose,
  tags,
  onCreateTag,
  onUpdateTag,
  onDeleteTag,
}: TagsModalProps) {
  const [editingTag, setEditingTag] = useState<NoteTag | null>(null)
  const [tagName, setTagName] = useState('')
  const [tagColor, setTagColor] = useState('#6366f1')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setEditingTag(null)
      setTagName('')
      setTagColor('#6366f1')
      setDeleteConfirm(null)
    }
  }, [isOpen])

  // Focus input when editing
  useEffect(() => {
    if (editingTag && inputRef.current) {
      inputRef.current.focus()
    }
  }, [editingTag])

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose()
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose])

  // Close on escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (editingTag) {
          setEditingTag(null)
          setTagName('')
        } else {
          onClose()
        }
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
    }
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, editingTag, onClose])

  const handleSubmit = async () => {
    if (!tagName.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      if (editingTag) {
        await onUpdateTag(editingTag.id, tagName.trim(), tagColor)
      } else {
        await onCreateTag(tagName.trim(), tagColor)
      }
      setEditingTag(null)
      setTagName('')
      setTagColor('#6366f1')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = (tag: NoteTag) => {
    setEditingTag(tag)
    setTagName(tag.name)
    setTagColor(tag.color)
    setDeleteConfirm(null)
  }

  const handleDelete = async (tagId: string) => {
    if (deleteConfirm !== tagId) {
      setDeleteConfirm(tagId)
      return
    }

    setIsSubmitting(true)
    try {
      await onDeleteTag(tagId)
      setDeleteConfirm(null)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    setEditingTag(null)
    setTagName('')
    setTagColor('#6366f1')
    setDeleteConfirm(null)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        ref={modalRef}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Manage Tags</h3>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Create/Edit Form */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
          <h4 className="text-sm font-medium text-slate-700 mb-3">
            {editingTag ? 'Edit Tag' : 'Create New Tag'}
          </h4>
          <div className="space-y-3">
            <div>
              <input
                ref={inputRef}
                type="text"
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                placeholder="Tag name"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-200 focus:border-cyan-300 outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSubmit()
                }}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-2 block">Color</label>
              <div className="flex flex-wrap gap-2">
                {TAG_COLORS.map(({ color }) => (
                  <button
                    key={color}
                    onClick={() => setTagColor(color)}
                    className={cn(
                      'w-7 h-7 rounded-full transition-transform hover:scale-110',
                      tagColor === color && 'ring-2 ring-offset-2 ring-slate-400'
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              {editingTag && (
                <button
                  onClick={handleCancel}
                  className="flex-1 px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={handleSubmit}
                disabled={!tagName.trim() || isSubmitting}
                className={cn(
                  'px-4 py-2 text-sm bg-cyan-600 text-white rounded-xl hover:bg-cyan-700 transition-colors disabled:opacity-50',
                  editingTag ? 'flex-1' : 'w-full'
                )}
              >
                {isSubmitting ? 'Saving...' : editingTag ? 'Update Tag' : 'Create Tag'}
              </button>
            </div>
          </div>
        </div>

        {/* Tags List */}
        <div className="max-h-64 overflow-y-auto">
          {tags.length === 0 ? (
            <div className="px-6 py-8 text-center text-slate-400">
              <span className="material-symbols-outlined text-4xl mb-2 block">label</span>
              <p className="text-sm">No tags yet</p>
              <p className="text-xs mt-1">Create your first tag above</p>
            </div>
          ) : (
            <div className="px-4 py-3 space-y-1">
              {tags.map(tag => (
                <div
                  key={tag.id}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors',
                    editingTag?.id === tag.id
                      ? 'bg-cyan-50 border border-cyan-200'
                      : 'hover:bg-slate-50'
                  )}
                >
                  <span
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="flex-1 text-sm font-medium text-slate-700">{tag.name}</span>

                  {deleteConfirm === tag.id ? (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-red-600 mr-2">Delete?</span>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="px-2 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                      >
                        No
                      </button>
                      <button
                        onClick={() => handleDelete(tag.id)}
                        disabled={isSubmitting}
                        className="px-2 py-1 text-xs text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-50"
                      >
                        Yes
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleEdit(tag)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                      </button>
                      <button
                        onClick={() => handleDelete(tag.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50">
          <p className="text-xs text-slate-500 text-center">
            {tags.length} tag{tags.length !== 1 ? 's' : ''} total
          </p>
        </div>
      </div>
    </div>
  )
}
