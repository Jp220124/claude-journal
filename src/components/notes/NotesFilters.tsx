'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import type { NoteTag } from '@/types/database'

export type SortOption = 'updated' | 'created' | 'title' | 'words'
export type SortDirection = 'asc' | 'desc'

interface NotesFiltersProps {
  sortBy: SortOption
  sortDirection: SortDirection
  onSortChange: (sortBy: SortOption, direction: SortDirection) => void
  tags: NoteTag[]
  selectedTagIds: string[]
  onTagFilterChange: (tagIds: string[]) => void
  showPinnedFirst: boolean
  onPinnedFirstChange: (show: boolean) => void
}

const SORT_OPTIONS: { value: SortOption; label: string; icon: string }[] = [
  { value: 'updated', label: 'Last Modified', icon: 'schedule' },
  { value: 'created', label: 'Date Created', icon: 'event' },
  { value: 'title', label: 'Title', icon: 'sort_by_alpha' },
  { value: 'words', label: 'Word Count', icon: 'format_list_numbered' },
]

export function NotesFilters({
  sortBy,
  sortDirection,
  onSortChange,
  tags,
  selectedTagIds,
  onTagFilterChange,
  showPinnedFirst,
  onPinnedFirstChange,
}: NotesFiltersProps) {
  const [showSortDropdown, setShowSortDropdown] = useState(false)
  const [showTagDropdown, setShowTagDropdown] = useState(false)
  const sortDropdownRef = useRef<HTMLDivElement>(null)
  const tagDropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
        setShowSortDropdown(false)
      }
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(event.target as Node)) {
        setShowTagDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const currentSortOption = SORT_OPTIONS.find(o => o.value === sortBy)
  const hasTagFilters = selectedTagIds.length > 0

  const handleSortSelect = (option: SortOption) => {
    if (option === sortBy) {
      // Toggle direction if same option
      onSortChange(option, sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      // Default to desc for new option (newest first, most words, etc)
      onSortChange(option, option === 'title' ? 'asc' : 'desc')
    }
    setShowSortDropdown(false)
  }

  const handleTagToggle = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onTagFilterChange(selectedTagIds.filter(id => id !== tagId))
    } else {
      onTagFilterChange([...selectedTagIds, tagId])
    }
  }

  const clearTagFilters = () => {
    onTagFilterChange([])
    setShowTagDropdown(false)
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Sort Dropdown */}
      <div className="relative" ref={sortDropdownRef}>
        <button
          onClick={() => setShowSortDropdown(!showSortDropdown)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">{currentSortOption?.icon}</span>
          <span>{currentSortOption?.label}</span>
          <span className="material-symbols-outlined text-[14px]">
            {sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}
          </span>
        </button>

        {showSortDropdown && (
          <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-xl shadow-lg border border-slate-200 z-50 py-1 overflow-hidden">
            {SORT_OPTIONS.map(option => (
              <button
                key={option.value}
                onClick={() => handleSortSelect(option.value)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors',
                  sortBy === option.value
                    ? 'bg-cyan-50 text-cyan-700'
                    : 'text-slate-600 hover:bg-slate-50'
                )}
              >
                <span className="material-symbols-outlined text-[18px]">{option.icon}</span>
                <span className="flex-1 text-left">{option.label}</span>
                {sortBy === option.value && (
                  <span className="material-symbols-outlined text-[16px]">
                    {sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                  </span>
                )}
              </button>
            ))}

            <div className="border-t border-slate-100 mt-1 pt-1">
              <button
                onClick={() => {
                  onPinnedFirstChange(!showPinnedFirst)
                  setShowSortDropdown(false)
                }}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors',
                  showPinnedFirst
                    ? 'bg-amber-50 text-amber-700'
                    : 'text-slate-600 hover:bg-slate-50'
                )}
              >
                <span className="material-symbols-outlined text-[18px]">push_pin</span>
                <span className="flex-1 text-left">Pinned First</span>
                {showPinnedFirst && (
                  <span className="material-symbols-outlined text-[16px]">check</span>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tag Filter Dropdown */}
      {tags.length > 0 && (
        <div className="relative" ref={tagDropdownRef}>
          <button
            onClick={() => setShowTagDropdown(!showTagDropdown)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors',
              hasTagFilters
                ? 'text-cyan-700 bg-cyan-50 border-cyan-200'
                : 'text-slate-600 bg-white border-slate-200 hover:bg-slate-50'
            )}
          >
            <span className="material-symbols-outlined text-[16px]">label</span>
            <span>
              {hasTagFilters ? `${selectedTagIds.length} tag${selectedTagIds.length > 1 ? 's' : ''}` : 'Filter by tag'}
            </span>
            <span className="material-symbols-outlined text-[14px]">expand_more</span>
          </button>

          {showTagDropdown && (
            <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-xl shadow-lg border border-slate-200 z-50 py-1 overflow-hidden">
              <div className="max-h-48 overflow-y-auto">
                {tags.map(tag => (
                  <button
                    key={tag.id}
                    onClick={() => handleTagToggle(tag.id)}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors',
                      selectedTagIds.includes(tag.id)
                        ? 'bg-cyan-50'
                        : 'hover:bg-slate-50'
                    )}
                  >
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="flex-1 text-left text-slate-700">{tag.name}</span>
                    {selectedTagIds.includes(tag.id) && (
                      <span className="material-symbols-outlined text-cyan-600 text-[16px]">check</span>
                    )}
                  </button>
                ))}
              </div>

              {hasTagFilters && (
                <div className="border-t border-slate-100 p-2">
                  <button
                    onClick={clearTagFilters}
                    className="w-full px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Active Tag Filters Display */}
      {hasTagFilters && (
        <div className="flex items-center gap-1 flex-wrap">
          {selectedTagIds.map(tagId => {
            const tag = tags.find(t => t.id === tagId)
            if (!tag) return null
            return (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                style={{ backgroundColor: tag.color }}
              >
                {tag.name}
                <button
                  onClick={() => handleTagToggle(tag.id)}
                  className="hover:bg-white/20 rounded-full p-0.5 transition-colors"
                >
                  <span className="material-symbols-outlined text-[12px]">close</span>
                </button>
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
