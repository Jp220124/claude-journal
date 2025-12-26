'use client'

import { useRef, useEffect, useMemo } from 'react'
import { format, setHours, setMinutes, isSameDay } from 'date-fns'
import { cn } from '@/lib/utils'
import { useCurrentTimePosition } from '@/hooks/useSchedule'
import { useScheduleStore } from '@/stores/scheduleStore'
import type { TimeBlockWithTodo } from '@/types/schedule'
import { TimeBlock } from './TimeBlock'

interface DayViewProps {
  date: Date
  blocks: TimeBlockWithTodo[]
  isLoading?: boolean
  onBlockClick?: (block: TimeBlockWithTodo) => void
  onBlockComplete?: (blockId: string) => void
  onBlockDelete?: (blockId: string) => void
  onTimeSlotClick?: (time: Date) => void
  onBlockDrop?: (blockId: string, newStartTime: Date) => void
}

const HOUR_HEIGHT = 60 // pixels per hour
const HOURS = Array.from({ length: 24 }, (_, i) => i) // 0-23

export function DayView({
  date,
  blocks,
  isLoading = false,
  onBlockClick,
  onBlockComplete,
  onBlockDelete,
  onTimeSlotClick,
  onBlockDrop,
}: DayViewProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const { position, currentTime, isWithinRange } = useCurrentTimePosition({
    updateIntervalMs: 60000,
    startHour: 0,
    endHour: 24,
  })

  const isToday = isSameDay(date, new Date())

  // Scroll to current time on mount (for today) or to 8am otherwise
  useEffect(() => {
    // Only scroll after loading is complete
    if (isLoading) return

    // Use a small timeout to ensure the DOM is fully rendered
    const timeoutId = setTimeout(() => {
      if (scrollContainerRef.current) {
        // Get fresh current time for accurate positioning
        const now = new Date()
        const currentHour = now.getHours()
        const currentMinutes = now.getMinutes()

        // Calculate scroll position - show current time in upper third of view
        const scrollTo = isToday
          ? Math.max(0, ((currentHour * 60 + currentMinutes) / 60 - 2) * HOUR_HEIGHT)
          : 8 * HOUR_HEIGHT

        scrollContainerRef.current.scrollTo({
          top: scrollTo,
          behavior: 'instant'
        })
      }
    }, 100)

    return () => clearTimeout(timeoutId)
  }, [isToday, date, isLoading])

  // Calculate block positions
  const blockPositions = useMemo(() => {
    return blocks.map((block) => {
      const start = new Date(block.start_time)
      const end = new Date(block.end_time)

      const startMinutes = start.getHours() * 60 + start.getMinutes()
      const endMinutes = end.getHours() * 60 + end.getMinutes()

      const top = (startMinutes / 60) * HOUR_HEIGHT
      const height = ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT

      return {
        block,
        top,
        height: Math.max(height, 30), // Minimum height for visibility
      }
    })
  }, [blocks])

  // Handle click on time slot
  const handleTimeSlotClick = (hour: number, halfHour: boolean = false) => {
    if (!onTimeSlotClick) return

    const clickedTime = setMinutes(setHours(date, hour), halfHour ? 30 : 0)
    onTimeSlotClick(clickedTime)
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading schedule...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-2xl font-bold",
            isToday ? "text-cyan-600 dark:text-cyan-400" : "text-zinc-900 dark:text-zinc-100"
          )}>
            {format(date, 'd')}
          </span>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {format(date, 'EEEE')}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {format(date, 'MMMM yyyy')}
            </span>
          </div>
          {isToday && (
            <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 rounded-full">
              Today
            </span>
          )}
        </div>
        <div className="text-sm text-zinc-500 dark:text-zinc-400">
          {blocks.length} {blocks.length === 1 ? 'block' : 'blocks'}
        </div>
      </div>

      {/* Scrollable time grid */}
      <div
        ref={scrollContainerRef}
        className="flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700 scrollbar-track-transparent"
      >
        <div className="relative" style={{ height: `${24 * HOUR_HEIGHT}px` }}>
          {/* Hour rows */}
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="absolute left-0 right-0 border-b border-zinc-100 dark:border-zinc-800/50"
              style={{ top: `${hour * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}
            >
              {/* Hour label */}
              <div className="absolute left-0 top-0 w-16 pr-3 text-right">
                <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500">
                  {format(setHours(new Date(), hour), 'h a')}
                </span>
              </div>

              {/* Clickable time slots */}
              <div className="absolute left-16 right-4 top-0 bottom-0">
                {/* First half hour */}
                <div
                  className="absolute left-0 right-0 top-0 h-1/2 cursor-pointer hover:bg-cyan-50 dark:hover:bg-cyan-900/10 transition-colors rounded"
                  onClick={() => handleTimeSlotClick(hour, false)}
                />
                {/* Second half hour */}
                <div
                  className="absolute left-0 right-0 top-1/2 h-1/2 cursor-pointer hover:bg-cyan-50 dark:hover:bg-cyan-900/10 transition-colors border-t border-dashed border-zinc-100 dark:border-zinc-800/30 rounded"
                  onClick={() => handleTimeSlotClick(hour, true)}
                />
              </div>
            </div>
          ))}

          {/* Current time indicator */}
          {isToday && isWithinRange && (
            <div
              className="absolute left-12 right-0 z-20 pointer-events-none"
              style={{ top: `${(position / 100) * 24 * HOUR_HEIGHT}px` }}
            >
              <div className="relative flex items-center">
                <div className="w-3 h-3 bg-red-500 rounded-full shadow-sm shadow-red-500/50" />
                <div className="flex-1 h-0.5 bg-red-500 shadow-sm shadow-red-500/50" />
              </div>
            </div>
          )}

          {/* Time blocks */}
          <div className="absolute left-16 right-4 top-0 bottom-0 pointer-events-none">
            {blockPositions.map(({ block, top, height }) => (
              <TimeBlock
                key={block.id}
                block={block}
                style={{
                  position: 'absolute',
                  top: `${top}px`,
                  left: 0,
                  right: 0,
                  height: `${height}px`,
                }}
                onClick={() => onBlockClick?.(block)}
                onComplete={() => onBlockComplete?.(block.id)}
                onDelete={() => onBlockDelete?.(block.id)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
