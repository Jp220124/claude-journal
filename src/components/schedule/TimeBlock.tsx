'use client'

import { useState, useMemo, CSSProperties } from 'react'
import { format, differenceInMinutes } from 'date-fns'
import { cn } from '@/lib/utils'
import type { TimeBlockWithTodo, TimeBlockType } from '@/types/schedule'
import { BLOCK_COLORS, BLOCK_TYPE_ICONS } from '@/types/schedule'

interface TimeBlockProps {
  block: TimeBlockWithTodo
  style?: CSSProperties
  className?: string
  isSelected?: boolean
  isDragging?: boolean
  onClick?: () => void
  onComplete?: () => void
  onDelete?: () => void
  onStartPomodoro?: () => void
}

export function TimeBlock({
  block,
  style,
  className,
  isSelected = false,
  isDragging = false,
  onClick,
  onComplete,
  onDelete,
  onStartPomodoro,
}: TimeBlockProps) {
  const [isHovered, setIsHovered] = useState(false)

  const startTime = new Date(block.start_time)
  const endTime = new Date(block.end_time)
  const duration = differenceInMinutes(endTime, startTime)
  const isCompleted = !!block.completed_at
  const isShort = duration <= 30

  // Get the appropriate color based on block type or custom color
  const blockColor = block.color || BLOCK_COLORS[block.block_type as TimeBlockType] || BLOCK_COLORS.task
  const blockIcon = BLOCK_TYPE_ICONS[block.block_type as TimeBlockType] || BLOCK_TYPE_ICONS.task

  // Calculate if we have enough space for various elements
  const showDetails = !isShort
  const showActions = isHovered && !isDragging

  return (
    <div
      className={cn(
        'group relative rounded-lg cursor-pointer overflow-hidden transition-all duration-200',
        'border-l-4 shadow-sm hover:shadow-md pointer-events-auto',
        isCompleted && 'opacity-60',
        isSelected && 'ring-2 ring-cyan-500 ring-offset-2 dark:ring-offset-zinc-900',
        isDragging && 'opacity-70 scale-105 shadow-lg',
        className
      )}
      style={{
        ...style,
        backgroundColor: `${blockColor}15`,
        borderLeftColor: blockColor,
      }}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Main content */}
      <div className="absolute inset-0 p-2 flex flex-col">
        {/* Header row */}
        <div className="flex items-start gap-2 min-w-0">
          {/* Icon */}
          <span
            className="material-symbols-outlined flex-shrink-0"
            style={{ fontSize: '16px', color: blockColor }}
          >
            {isCompleted ? 'check_circle' : blockIcon}
          </span>

          {/* Title and time */}
          <div className="flex-1 min-w-0">
            <h4
              className={cn(
                'text-sm font-medium truncate',
                isCompleted ? 'line-through text-zinc-500 dark:text-zinc-400' : 'text-zinc-900 dark:text-zinc-100'
              )}
            >
              {block.title}
            </h4>
            {showDetails && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {format(startTime, 'h:mm a')} - {format(endTime, 'h:mm a')}
                <span className="ml-1 text-zinc-400 dark:text-zinc-500">
                  ({duration} min)
                </span>
              </p>
            )}
          </div>

          {/* Recurring indicator */}
          {block.is_recurring && (
            <span
              className="flex-shrink-0 text-cyan-600 dark:text-cyan-400"
              title="Recurring daily"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                repeat
              </span>
            </span>
          )}

          {/* Duration badge for short blocks */}
          {isShort && (
            <span className="text-xs text-zinc-500 dark:text-zinc-400 flex-shrink-0">
              {duration}m
            </span>
          )}
        </div>

        {/* Description (if space allows) */}
        {showDetails && block.description && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">
            {block.description}
          </p>
        )}

        {/* Linked todo indicator */}
        {block.todo && showDetails && (
          <div className="flex items-center gap-1 mt-1">
            <span
              className="material-symbols-outlined text-zinc-400"
              style={{ fontSize: '12px' }}
            >
              link
            </span>
            <span className="text-xs text-zinc-400 dark:text-zinc-500 truncate">
              {block.todo.title}
            </span>
          </div>
        )}
      </div>

      {/* Hover actions */}
      {showActions && (
        <div
          className="absolute top-1 right-1 flex items-center gap-1 bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 p-0.5 z-10"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Complete button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onComplete?.()
            }}
            className={cn(
              'p-1 rounded transition-colors',
              isCompleted
                ? 'hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-600'
                : 'hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600'
            )}
            title={isCompleted ? 'Mark incomplete' : 'Mark complete'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
              {isCompleted ? 'undo' : 'check'}
            </span>
          </button>

          {/* Pomodoro button */}
          {!isCompleted && onStartPomodoro && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onStartPomodoro?.()
              }}
              className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 transition-colors"
              title="Start Pomodoro"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                timer
              </span>
            </button>
          )}

          {/* Delete button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete?.()
            }}
            className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 transition-colors"
            title="Delete block"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
              delete
            </span>
          </button>
        </div>
      )}

      {/* Progress indicator for active blocks */}
      {!isCompleted && isSelected && (
        <div
          className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-cyan-500 to-cyan-400"
          style={{ width: '30%' }} // This would be dynamic based on elapsed time
        />
      )}
    </div>
  )
}

// Drag overlay component for dnd-kit
export function TimeBlockDragOverlay({
  block,
}: {
  block: TimeBlockWithTodo
}) {
  return (
    <div
      className="rounded-lg shadow-xl border-l-4 p-2 bg-white dark:bg-zinc-800"
      style={{
        borderLeftColor: block.color || BLOCK_COLORS[block.block_type as TimeBlockType],
        width: '200px',
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="material-symbols-outlined"
          style={{
            fontSize: '16px',
            color: block.color || BLOCK_COLORS[block.block_type as TimeBlockType],
          }}
        >
          {BLOCK_TYPE_ICONS[block.block_type as TimeBlockType]}
        </span>
        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
          {block.title}
        </span>
      </div>
    </div>
  )
}
