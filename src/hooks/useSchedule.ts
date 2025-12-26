'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  fetchTimeBlocksByDate,
  fetchTimeBlocksByRange,
  createTimeBlock,
  updateTimeBlock,
  deleteTimeBlock,
  completeTimeBlock,
  createBlockFromTodo,
  fetchScheduleSettings,
  upsertScheduleSettings,
  fetchDailyPlan,
  upsertDailyPlan,
  checkBlockOverlap,
} from '@/lib/scheduleService'
import type {
  TimeBlock,
  TimeBlockInsert,
  TimeBlockUpdate,
  TimeBlockWithTodo,
  ScheduleSettings,
  ScheduleSettingsUpdate,
  DEFAULT_SCHEDULE_SETTINGS,
} from '@/types/schedule'
import { startOfDay, endOfDay, addDays, isSameDay } from 'date-fns'

// =====================================================
// useTimeBlocks Hook
// =====================================================

interface UseTimeBlocksOptions {
  date?: Date
  startDate?: Date
  endDate?: Date
  autoRefresh?: boolean
  refreshIntervalMs?: number
}

interface UseTimeBlocksResult {
  blocks: TimeBlockWithTodo[]
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
  createBlock: (block: TimeBlockInsert) => Promise<TimeBlock | null>
  updateBlock: (id: string, updates: TimeBlockUpdate) => Promise<TimeBlock | null>
  deleteBlock: (id: string) => Promise<boolean>
  completeBlock: (id: string) => Promise<TimeBlock | null>
  createFromTodo: (
    todoId: string,
    todoTitle: string,
    startTime: Date,
    duration?: number
  ) => Promise<TimeBlock | null>
  checkOverlap: (startTime: Date, endTime: Date, excludeId?: string) => Promise<TimeBlock[]>
}

export function useTimeBlocks(options: UseTimeBlocksOptions = {}): UseTimeBlocksResult {
  const {
    date = new Date(),
    startDate,
    endDate,
    autoRefresh = false,
    refreshIntervalMs = 60000,
  } = options

  const [blocks, setBlocks] = useState<TimeBlockWithTodo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBlocks = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      let data: TimeBlockWithTodo[]
      if (startDate && endDate) {
        data = await fetchTimeBlocksByRange(startDate, endDate)
      } else {
        data = await fetchTimeBlocksByDate(date)
      }

      setBlocks(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch time blocks'
      setError(message)
      console.error('Error in useTimeBlocks:', err)
    } finally {
      setIsLoading(false)
    }
  }, [date, startDate, endDate])

  // Initial fetch
  useEffect(() => {
    fetchBlocks()
  }, [fetchBlocks])

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return

    const intervalId = setInterval(fetchBlocks, refreshIntervalMs)
    return () => clearInterval(intervalId)
  }, [autoRefresh, refreshIntervalMs, fetchBlocks])

  const handleCreateBlock = useCallback(async (block: TimeBlockInsert) => {
    const newBlock = await createTimeBlock(block)
    if (newBlock) {
      // Check if the new block is for the current view
      const blockDate = new Date(newBlock.start_time)
      const isInView = startDate && endDate
        ? blockDate >= startOfDay(startDate) && blockDate <= endOfDay(endDate)
        : isSameDay(blockDate, date)

      if (isInView) {
        setBlocks((prev) => [...prev, { ...newBlock, todo: null }].sort(
          (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        ))
      }
    }
    return newBlock
  }, [date, startDate, endDate])

  const handleUpdateBlock = useCallback(async (id: string, updates: TimeBlockUpdate) => {
    const updatedBlock = await updateTimeBlock(id, updates)
    if (updatedBlock) {
      setBlocks((prev) =>
        prev.map((b) => (b.id === id ? { ...b, ...updatedBlock } : b))
      )
    }
    return updatedBlock
  }, [])

  const handleDeleteBlock = useCallback(async (id: string) => {
    const success = await deleteTimeBlock(id)
    if (success) {
      setBlocks((prev) => prev.filter((b) => b.id !== id))
    }
    return success
  }, [])

  const handleCompleteBlock = useCallback(async (id: string) => {
    const completedBlock = await completeTimeBlock(id)
    if (completedBlock) {
      setBlocks((prev) =>
        prev.map((b) => (b.id === id ? { ...b, ...completedBlock } : b))
      )
    }
    return completedBlock
  }, [])

  const handleCreateFromTodo = useCallback(
    async (todoId: string, todoTitle: string, startTime: Date, duration?: number) => {
      const newBlock = await createBlockFromTodo(todoId, todoTitle, startTime, duration)
      if (newBlock) {
        await fetchBlocks() // Refetch to get the todo relation
      }
      return newBlock
    },
    [fetchBlocks]
  )

  const handleCheckOverlap = useCallback(
    async (startTime: Date, endTime: Date, excludeId?: string) => {
      return checkBlockOverlap(startTime, endTime, excludeId)
    },
    []
  )

  return {
    blocks,
    isLoading,
    error,
    refetch: fetchBlocks,
    createBlock: handleCreateBlock,
    updateBlock: handleUpdateBlock,
    deleteBlock: handleDeleteBlock,
    completeBlock: handleCompleteBlock,
    createFromTodo: handleCreateFromTodo,
    checkOverlap: handleCheckOverlap,
  }
}

// =====================================================
// useScheduleSettings Hook
// =====================================================

interface UseScheduleSettingsResult {
  settings: ScheduleSettings | null
  isLoading: boolean
  error: string | null
  updateSettings: (updates: ScheduleSettingsUpdate) => Promise<ScheduleSettings | null>
  refetch: () => Promise<void>
}

export function useScheduleSettings(): UseScheduleSettingsResult {
  const [settings, setSettings] = useState<ScheduleSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSettings = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await fetchScheduleSettings()
      setSettings(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch settings'
      setError(message)
      console.error('Error in useScheduleSettings:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const handleUpdateSettings = useCallback(async (updates: ScheduleSettingsUpdate) => {
    const updatedSettings = await upsertScheduleSettings(updates)
    if (updatedSettings) {
      setSettings(updatedSettings)
    }
    return updatedSettings
  }, [])

  return {
    settings,
    isLoading,
    error,
    updateSettings: handleUpdateSettings,
    refetch: fetchSettings,
  }
}

// =====================================================
// useDailyPlan Hook
// =====================================================

interface DailyPlan {
  id: string
  user_id: string
  date: string
  top_priorities: string[]
  intention: string | null
  reflection: string | null
  is_completed: boolean
  completed_at: string | null
  created_at: string
  updated_at: string
}

interface UseDailyPlanResult {
  plan: DailyPlan | null
  isLoading: boolean
  error: string | null
  updatePlan: (updates: {
    top_priorities?: string[]
    intention?: string | null
    reflection?: string | null
    is_completed?: boolean
  }) => Promise<DailyPlan | null>
  refetch: () => Promise<void>
}

export function useDailyPlan(date: Date): UseDailyPlanResult {
  const [plan, setPlan] = useState<DailyPlan | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPlan = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await fetchDailyPlan(date)
      setPlan(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch daily plan'
      setError(message)
      console.error('Error in useDailyPlan:', err)
    } finally {
      setIsLoading(false)
    }
  }, [date])

  useEffect(() => {
    fetchPlan()
  }, [fetchPlan])

  const handleUpdatePlan = useCallback(
    async (updates: {
      top_priorities?: string[]
      intention?: string | null
      reflection?: string | null
      is_completed?: boolean
    }) => {
      const updatedPlan = await upsertDailyPlan(date, updates)
      if (updatedPlan) {
        setPlan(updatedPlan)
      }
      return updatedPlan
    },
    [date]
  )

  return {
    plan,
    isLoading,
    error,
    updatePlan: handleUpdatePlan,
    refetch: fetchPlan,
  }
}

// =====================================================
// useCurrentTimePosition Hook
// =====================================================

/**
 * Hook that returns the current time's position as a percentage of the day
 * Updates every minute
 */
export function useCurrentTimePosition(options: {
  updateIntervalMs?: number
  startHour?: number
  endHour?: number
} = {}): {
  position: number
  currentTime: Date
  isWithinRange: boolean
} {
  const { updateIntervalMs = 60000, startHour = 0, endHour = 24 } = options

  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentTime(new Date())
    }, updateIntervalMs)

    return () => clearInterval(intervalId)
  }, [updateIntervalMs])

  const position = useMemo(() => {
    const hours = currentTime.getHours()
    const minutes = currentTime.getMinutes()
    const totalMinutes = hours * 60 + minutes
    const rangeMinutes = (endHour - startHour) * 60
    const offsetMinutes = totalMinutes - startHour * 60

    return Math.max(0, Math.min(100, (offsetMinutes / rangeMinutes) * 100))
  }, [currentTime, startHour, endHour])

  const isWithinRange = useMemo(() => {
    const hours = currentTime.getHours()
    return hours >= startHour && hours < endHour
  }, [currentTime, startHour, endHour])

  return { position, currentTime, isWithinRange }
}

// =====================================================
// useBlockPosition Hook
// =====================================================

/**
 * Calculate the position and height of a time block on the schedule grid
 */
export function useBlockPosition(
  startTime: Date | string,
  endTime: Date | string,
  options: {
    startHour?: number
    endHour?: number
    pixelsPerHour?: number
  } = {}
): {
  top: number
  height: number
  isVisible: boolean
} {
  const { startHour = 0, endHour = 24, pixelsPerHour = 60 } = options

  return useMemo(() => {
    const start = typeof startTime === 'string' ? new Date(startTime) : startTime
    const end = typeof endTime === 'string' ? new Date(endTime) : endTime

    const startMinutes = start.getHours() * 60 + start.getMinutes()
    const endMinutes = end.getHours() * 60 + end.getMinutes()

    const rangeStartMinutes = startHour * 60
    const rangeEndMinutes = endHour * 60

    // Check if block is visible in the range
    const isVisible = startMinutes < rangeEndMinutes && endMinutes > rangeStartMinutes

    if (!isVisible) {
      return { top: 0, height: 0, isVisible: false }
    }

    // Clamp to visible range
    const visibleStart = Math.max(startMinutes, rangeStartMinutes)
    const visibleEnd = Math.min(endMinutes, rangeEndMinutes)

    const top = ((visibleStart - rangeStartMinutes) / 60) * pixelsPerHour
    const height = ((visibleEnd - visibleStart) / 60) * pixelsPerHour

    return { top, height, isVisible: true }
  }, [startTime, endTime, startHour, endHour, pixelsPerHour])
}
