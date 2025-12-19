'use client'

import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import type { NoteTag } from '@/types/database'

interface TagSelectorProps {
  tags: NoteTag[]
  selectedTags: NoteTag[]
  onTagAdd: (tagId: string) => void
  onTagRemove: (tagId: string) => void
  onCreateTag: (name: string, color: string) => Promise<NoteTag | null>
  onManageTags: () => void
  disabled?: boolean
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

export function TagSelector({
  tags,
  selectedTags,
  onTagAdd,
  onTagRemove,
  onCreateTag,
  onManageTags,
  disabled = false,
}: TagSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#6366f1')
  const [isCreating, setIsCreating] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setShowCreateForm(false)
        setSearchQuery('')
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const filteredTags = tags.filter(tag =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const availableTags = filteredTags.filter(
    tag => !selectedTags.some(st => st.id === tag.id)
  )

  const handleCreateTag = async () => {
    if (!newTagName.trim() || isCreating) return

    setIsCreating(true)
    try {
      const newTag = await onCreateTag(newTagName.trim(), newTagColor)
      if (newTag) {
        onTagAdd(newTag.id)
        setNewTagName('')
        setShowCreateForm(false)
        setSearchQuery('')
      }
    } finally {
      setIsCreating(false)
    }
  }

  const showCreateOption = searchQuery.trim() &&
    !tags.some(tag => tag.name.toLowerCase() === searchQuery.toLowerCase().trim())

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Selected Tags Display */}
      <div className="flex flex-wrap items-center gap-2">
        {selectedTags.map(tag => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-white"
            style={{ backgroundColor: tag.color }}
          >
            {tag.name}
            {!disabled && (
              <button
                onClick={() => onTagRemove(tag.id)}
                className="hover:bg-white/20 rounded-full p-0.5 transition-colors"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            )}
          </span>
        ))}

        {!disabled && (
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <span className="material-symbols-outlined text-[14px]">add</span>
            Add tag
          </button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-slate-200 z-50 overflow-hidden">
          {/* Search Input */}
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                search
              </span>
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search or create tag..."
                className="w-full pl-8 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cyan-200 focus:border-cyan-300 outline-none"
              />
            </div>
          </div>

          {/* Tag List */}
          <div className="max-h-48 overflow-y-auto p-2">
            {showCreateForm ? (
              // Create Tag Form
              <div className="space-y-3 p-2">
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Tag Name</label>
                  <input
                    type="text"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder="Enter tag name"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-cyan-200 outline-none"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Color</label>
                  <div className="flex flex-wrap gap-1.5">
                    {TAG_COLORS.map(({ color }) => (
                      <button
                        key={color}
                        onClick={() => setNewTagColor(color)}
                        className={cn(
                          'w-6 h-6 rounded-full transition-transform hover:scale-110',
                          newTagColor === color && 'ring-2 ring-offset-1 ring-slate-400'
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={() => {
                      setShowCreateForm(false)
                      setNewTagName('')
                    }}
                    className="flex-1 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateTag}
                    disabled={!newTagName.trim() || isCreating}
                    className="flex-1 px-3 py-1.5 text-sm bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50"
                  >
                    {isCreating ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Available Tags */}
                {availableTags.length > 0 ? (
                  availableTags.map(tag => (
                    <button
                      key={tag.id}
                      onClick={() => {
                        onTagAdd(tag.id)
                        setSearchQuery('')
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="text-sm text-slate-700">{tag.name}</span>
                    </button>
                  ))
                ) : searchQuery && !showCreateOption ? (
                  <p className="text-sm text-slate-400 text-center py-4">No matching tags</p>
                ) : !searchQuery && tags.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">No tags yet</p>
                ) : null}

                {/* Create New Tag Option */}
                {showCreateOption && (
                  <button
                    onClick={() => {
                      setNewTagName(searchQuery.trim())
                      setShowCreateForm(true)
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors text-cyan-600"
                  >
                    <span className="material-symbols-outlined text-[18px]">add</span>
                    <span className="text-sm">Create &quot;{searchQuery.trim()}&quot;</span>
                  </button>
                )}

                {/* All tags assigned message */}
                {availableTags.length === 0 && tags.length > 0 && !searchQuery && (
                  <p className="text-sm text-slate-400 text-center py-4">All tags assigned</p>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          {!showCreateForm && (
            <div className="p-2 border-t border-slate-100">
              <button
                onClick={() => {
                  setIsOpen(false)
                  onManageTags()
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">settings</span>
                Manage tags
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
