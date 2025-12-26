'use client'

import { useState, useEffect } from 'react'
import { format, setHours, setMinutes, addMinutes } from 'date-fns'
import { cn } from '@/lib/utils'
import type { TimeBlockWithTodo, TimeBlockInsert, TimeBlockType } from '@/types/schedule'
import { BLOCK_COLORS, BLOCK_TYPE_ICONS } from '@/types/schedule'

interface TimeBlockModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (block: TimeBlockInsert) => Promise<void>
  onDelete?: () => Promise<void>
  block?: TimeBlockWithTodo | null
  initialStartTime?: Date
  date: Date
}

const BLOCK_TYPES: { value: TimeBlockType; label: string; icon: string }[] = [
  { value: 'task', label: 'Task', icon: 'check_circle' },
  { value: 'focus', label: 'Focus Time', icon: 'center_focus_strong' },
  { value: 'break', label: 'Break', icon: 'coffee' },
  { value: 'meeting', label: 'Meeting', icon: 'groups' },
  { value: 'personal', label: 'Personal', icon: 'person' },
]

const DURATION_OPTIONS = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
  { value: 120, label: '2 hours' },
  { value: 180, label: '3 hours' },
]

export function TimeBlockModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  block,
  initialStartTime,
  date,
}: TimeBlockModalProps) {
  const isEditing = !!block

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [blockType, setBlockType] = useState<TimeBlockType>('task')
  const [startTime, setStartTime] = useState('09:00')
  const [duration, setDuration] = useState(60)
  const [color, setColor] = useState(BLOCK_COLORS.task)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Initialize form when modal opens or block changes
  useEffect(() => {
    if (isOpen) {
      if (block) {
        // Editing existing block
        const start = new Date(block.start_time)
        const end = new Date(block.end_time)
        const durationMins = Math.round((end.getTime() - start.getTime()) / 60000)

        setTitle(block.title)
        setDescription(block.description || '')
        setBlockType(block.block_type as TimeBlockType)
        setStartTime(format(start, 'HH:mm'))
        setDuration(durationMins)
        setColor(block.color || BLOCK_COLORS[block.block_type as TimeBlockType])
      } else if (initialStartTime) {
        // New block with initial time
        setTitle('')
        setDescription('')
        setBlockType('task')
        setStartTime(format(initialStartTime, 'HH:mm'))
        setDuration(60)
        setColor(BLOCK_COLORS.task)
      } else {
        // New block, default to current hour
        const now = new Date()
        setTitle('')
        setDescription('')
        setBlockType('task')
        setStartTime(format(setMinutes(now, 0), 'HH:mm'))
        setDuration(60)
        setColor(BLOCK_COLORS.task)
      }
    }
  }, [isOpen, block, initialStartTime])

  // Update color when block type changes
  useEffect(() => {
    setColor(BLOCK_COLORS[blockType])
  }, [blockType])

  const handleSave = async () => {
    if (!title.trim()) return

    setIsSaving(true)
    try {
      const [hours, minutes] = startTime.split(':').map(Number)
      const startDateTime = setMinutes(setHours(date, hours), minutes)
      const endDateTime = addMinutes(startDateTime, duration)

      await onSave({
        title: title.trim(),
        description: description.trim() || null,
        block_type: blockType,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        color,
      })
      onClose()
    } catch (error) {
      console.error('Error saving time block:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!onDelete) return

    setIsDeleting(true)
    try {
      await onDelete()
      onClose()
    } catch (error) {
      console.error('Error deleting time block:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {isEditing ? 'Edit Time Block' : 'New Time Block'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
              close
            </span>
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What are you working on?"
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              autoFocus
            />
          </div>

          {/* Block Type */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              Type
            </label>
            <div className="grid grid-cols-5 gap-2">
              {BLOCK_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setBlockType(type.value)}
                  className={cn(
                    'flex flex-col items-center gap-1 p-2 rounded-lg border transition-all',
                    blockType === type.value
                      ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20'
                      : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                  )}
                  title={type.label}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{
                      fontSize: '20px',
                      color: blockType === type.value ? BLOCK_COLORS[type.value] : undefined,
                    }}
                  >
                    {type.icon}
                  </span>
                  <span className="text-xs text-zinc-600 dark:text-zinc-400 truncate w-full text-center">
                    {type.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Time and Duration */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                Start Time
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                Duration
              </label>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              >
                {DURATION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add notes or details..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Color preview */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
            <div
              className="w-4 h-4 rounded-full flex-shrink-0"
              style={{ backgroundColor: color }}
            />
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              Preview: This block will appear as a{' '}
              <span className="font-medium">{BLOCK_TYPES.find((t) => t.value === blockType)?.label}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
          {isEditing && onDelete ? (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                delete
              </span>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!title.trim() || isSaving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                    {isEditing ? 'save' : 'add'}
                  </span>
                  {isEditing ? 'Save Changes' : 'Create Block'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
