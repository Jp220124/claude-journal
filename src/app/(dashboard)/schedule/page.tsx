'use client'

import { useState, useEffect, useMemo } from 'react'
import { format, addDays, subDays } from 'date-fns'
import { cn } from '@/lib/utils'
import { useTimeBlocks, useScheduleSettings } from '@/hooks/useSchedule'
import { useScheduleStore } from '@/stores/scheduleStore'
import { fetchTodos } from '@/lib/todoService'
import { DayView } from '@/components/schedule/DayView'
import { TimeBlockModal } from '@/components/schedule/TimeBlockModal'
import { UnscheduledTasks } from '@/components/schedule/UnscheduledTasks'
import { PomodoroTimer, PomodoroFloatingWidget } from '@/components/schedule/PomodoroTimer'
import { DailyPlanningRitual } from '@/components/schedule/DailyPlanningRitual'
import { createRecurringTimeBlock } from '@/lib/scheduleService'
import type { Todo } from '@/types/database'
import type { TimeBlockWithTodo, TimeBlockInsert } from '@/types/schedule'

export default function SchedulePage() {
  // Store state
  const currentDate = useScheduleStore((state) => state.currentDate)
  const setCurrentDate = useScheduleStore((state) => state.setCurrentDate)
  const goToToday = useScheduleStore((state) => state.goToToday)
  const goToNextDay = useScheduleStore((state) => state.goToNextDay)
  const goToPreviousDay = useScheduleStore((state) => state.goToPreviousDay)
  const openRitual = useScheduleStore((state) => state.openRitual)
  const ritualIsOpen = useScheduleStore((state) => state.isOpen)

  // Data hooks
  const {
    blocks,
    isLoading: blocksLoading,
    createBlock,
    updateBlock,
    deleteBlock,
    completeBlock,
  } = useTimeBlocks({ date: currentDate })

  const { settings } = useScheduleSettings()

  // Local state
  const [tasks, setTasks] = useState<Todo[]>([])
  const [tasksLoading, setTasksLoading] = useState(true)
  const [selectedBlock, setSelectedBlock] = useState<TimeBlockWithTodo | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalInitialTime, setModalInitialTime] = useState<Date | undefined>()
  const [showRightSidebar, setShowRightSidebar] = useState(true)

  // Fetch tasks
  useEffect(() => {
    const loadTasks = async () => {
      setTasksLoading(true)
      try {
        const todosData = await fetchTodos()
        setTasks(todosData)
      } catch (error) {
        console.error('Error fetching tasks:', error)
      } finally {
        setTasksLoading(false)
      }
    }
    loadTasks()
  }, [currentDate])

  // Get scheduled task IDs
  const scheduledTaskIds = useMemo(() => {
    return blocks
      .filter((b) => b.todo_id)
      .map((b) => b.todo_id as string)
  }, [blocks])

  // Handlers
  const handleTimeSlotClick = (time: Date) => {
    setSelectedBlock(null)
    setModalInitialTime(time)
    setIsModalOpen(true)
  }

  const handleBlockClick = (block: TimeBlockWithTodo) => {
    setSelectedBlock(block)
    setModalInitialTime(undefined)
    setIsModalOpen(true)
  }

  const handleBlockComplete = async (blockId: string) => {
    await completeBlock(blockId)
  }

  const handleBlockDelete = async (blockId: string) => {
    await deleteBlock(blockId)
  }

  const handleSaveBlock = async (blockData: TimeBlockInsert & { isRecurring?: boolean; reminderMinutes?: number }) => {
    if (selectedBlock) {
      await updateBlock(selectedBlock.id, blockData)
    } else if (blockData.isRecurring) {
      // Create recurring time block with template + instances
      const result = await createRecurringTimeBlock({
        ...blockData,
        reminderMinutes: blockData.reminderMinutes,
      })
      if (!result.success) {
        console.error('Failed to create recurring block:', result.error)
      }
      // Refresh blocks after creating recurring block
      window.location.reload()
    } else {
      await createBlock(blockData)
    }
  }

  const handleDeleteBlock = async () => {
    if (selectedBlock) {
      await deleteBlock(selectedBlock.id)
    }
  }

  const handleScheduleTask = (task: Todo) => {
    setSelectedBlock(null)
    setModalInitialTime(new Date())
    setIsModalOpen(true)
  }

  const handleRitualComplete = (priorities: string[], intention: string) => {
    console.log('Daily planning complete:', { priorities, intention })
  }

  const isToday = format(currentDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Schedule</h1>

          {/* Date navigation */}
          <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1">
            <button
              onClick={goToPreviousDay}
              className="p-2 rounded-lg hover:bg-white dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 transition-colors"
              title="Previous day"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                chevron_left
              </span>
            </button>

            <button
              onClick={goToToday}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                isToday
                  ? 'bg-cyan-500 text-white'
                  : 'hover:bg-white dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
              )}
            >
              Today
            </button>

            <button
              onClick={goToNextDay}
              className="p-2 rounded-lg hover:bg-white dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 transition-colors"
              title="Next day"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                chevron_right
              </span>
            </button>
          </div>

          {/* Current date display */}
          <div className="text-sm text-zinc-500 dark:text-zinc-400">
            {format(currentDate, 'EEEE, MMMM d, yyyy')}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Planning ritual button */}
          <button
            onClick={openRitual}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white font-medium transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
              wb_sunny
            </span>
            Plan My Day
          </button>

          {/* Toggle right sidebar */}
          <button
            onClick={() => setShowRightSidebar(!showRightSidebar)}
            className={cn(
              'p-2 rounded-xl transition-colors',
              showRightSidebar
                ? 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            )}
            title={showRightSidebar ? 'Hide sidebar' : 'Show sidebar'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
              {showRightSidebar ? 'right_panel_close' : 'right_panel_open'}
            </span>
          </button>

          {/* Add block button */}
          <button
            onClick={() => {
              setSelectedBlock(null)
              setModalInitialTime(undefined)
              setIsModalOpen(true)
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-medium transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
              add
            </span>
            Add Block
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Schedule view */}
        <div className="flex-1 p-4 min-h-0 flex flex-col">
          <DayView
            date={currentDate}
            blocks={blocks}
            isLoading={blocksLoading}
            onBlockClick={handleBlockClick}
            onBlockComplete={handleBlockComplete}
            onBlockDelete={handleBlockDelete}
            onTimeSlotClick={handleTimeSlotClick}
          />
        </div>

        {/* Right sidebar */}
        {showRightSidebar && (
          <div className="w-80 border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col overflow-hidden">
            {/* Unscheduled tasks */}
            <div className="flex-1 overflow-hidden">
              <UnscheduledTasks
                tasks={tasks}
                scheduledTaskIds={scheduledTaskIds}
                isLoading={tasksLoading}
                onTaskClick={(task) => handleScheduleTask(task)}
                onScheduleTask={handleScheduleTask}
              />
            </div>

            {/* Pomodoro timer */}
            <div className="border-t border-zinc-200 dark:border-zinc-800 p-4">
              <PomodoroTimer />
            </div>
          </div>
        )}
      </div>

      {/* Time block modal */}
      <TimeBlockModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedBlock(null)
          setModalInitialTime(undefined)
        }}
        onSave={handleSaveBlock}
        onDelete={selectedBlock ? handleDeleteBlock : undefined}
        block={selectedBlock}
        initialStartTime={modalInitialTime}
        date={currentDate}
      />

      {/* Daily planning ritual */}
      {ritualIsOpen && (
        <DailyPlanningRitual
          date={currentDate}
          tasks={tasks}
          onComplete={handleRitualComplete}
          onClose={() => useScheduleStore.getState().closeRitual()}
        />
      )}

      {/* Floating pomodoro widget */}
      <PomodoroFloatingWidget />
    </div>
  )
}
