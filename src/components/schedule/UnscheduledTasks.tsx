'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { Todo } from '@/types/database'

interface UnscheduledTasksProps {
  tasks: Todo[]
  scheduledTaskIds: string[]
  onTaskClick?: (task: Todo) => void
  onScheduleTask?: (task: Todo) => void
  isLoading?: boolean
  className?: string
}

const PRIORITY_COLORS = {
  high: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
  medium: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  low: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
}

const PRIORITY_ICONS = {
  high: 'priority_high',
  medium: 'remove',
  low: 'arrow_downward',
}

export function UnscheduledTasks({
  tasks,
  scheduledTaskIds,
  onTaskClick,
  onScheduleTask,
  isLoading = false,
  className,
}: UnscheduledTasksProps) {
  // Filter out already scheduled tasks and completed tasks
  const unscheduledTasks = useMemo(() => {
    return tasks.filter(
      (task) => !scheduledTaskIds.includes(task.id) && !task.completed
    )
  }, [tasks, scheduledTaskIds])

  // Group by priority
  const tasksByPriority = useMemo(() => {
    const groups = {
      high: [] as Todo[],
      medium: [] as Todo[],
      low: [] as Todo[],
    }

    unscheduledTasks.forEach((task) => {
      groups[task.priority].push(task)
    })

    return groups
  }, [unscheduledTasks])

  if (isLoading) {
    return (
      <div className={cn('flex flex-col gap-4 p-4', className)}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse" />
          <div className="h-5 w-32 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse" />
        </div>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-16 bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse"
          />
        ))}
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-zinc-500" style={{ fontSize: '20px' }}>
            checklist
          </span>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Unscheduled Tasks
          </h3>
        </div>
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
          {unscheduledTasks.length}
        </span>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {unscheduledTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <span
              className="material-symbols-outlined text-zinc-300 dark:text-zinc-600 mb-2"
              style={{ fontSize: '48px' }}
            >
              task_alt
            </span>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              All tasks are scheduled!
            </p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
              Great job planning your day.
            </p>
          </div>
        ) : (
          <>
            {/* High priority */}
            {tasksByPriority.high.length > 0 && (
              <TaskGroup
                title="High Priority"
                tasks={tasksByPriority.high}
                priority="high"
                onTaskClick={onTaskClick}
                onScheduleTask={onScheduleTask}
              />
            )}

            {/* Medium priority */}
            {tasksByPriority.medium.length > 0 && (
              <TaskGroup
                title="Medium Priority"
                tasks={tasksByPriority.medium}
                priority="medium"
                onTaskClick={onTaskClick}
                onScheduleTask={onScheduleTask}
              />
            )}

            {/* Low priority */}
            {tasksByPriority.low.length > 0 && (
              <TaskGroup
                title="Low Priority"
                tasks={tasksByPriority.low}
                priority="low"
                onTaskClick={onTaskClick}
                onScheduleTask={onScheduleTask}
              />
            )}
          </>
        )}
      </div>

      {/* Helper text */}
      {unscheduledTasks.length > 0 && (
        <div className="px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
          <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
              info
            </span>
            Click a task to schedule it on the timeline
          </p>
        </div>
      )}
    </div>
  )
}

interface TaskGroupProps {
  title: string
  tasks: Todo[]
  priority: 'high' | 'medium' | 'low'
  onTaskClick?: (task: Todo) => void
  onScheduleTask?: (task: Todo) => void
}

function TaskGroup({
  title,
  tasks,
  priority,
  onTaskClick,
  onScheduleTask,
}: TaskGroupProps) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <span
          className={cn(
            'material-symbols-outlined',
            priority === 'high'
              ? 'text-red-500'
              : priority === 'medium'
              ? 'text-amber-500'
              : 'text-blue-500'
          )}
          style={{ fontSize: '14px' }}
        >
          {PRIORITY_ICONS[priority]}
        </span>
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
          {title}
        </span>
      </div>
      <div className="space-y-2">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            priority={priority}
            onClick={() => onTaskClick?.(task)}
            onSchedule={() => onScheduleTask?.(task)}
          />
        ))}
      </div>
    </div>
  )
}

interface TaskCardProps {
  task: Todo
  priority: 'high' | 'medium' | 'low'
  onClick?: () => void
  onSchedule?: () => void
}

function TaskCard({ task, priority, onClick, onSchedule }: TaskCardProps) {
  return (
    <div
      className={cn(
        'group relative p-3 rounded-lg border cursor-pointer transition-all',
        'bg-white dark:bg-zinc-800/50 hover:shadow-md',
        PRIORITY_COLORS[priority]
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        {/* Drag handle / checkbox area */}
        <div className="flex-shrink-0 mt-0.5">
          <span
            className="material-symbols-outlined text-zinc-400 dark:text-zinc-500"
            style={{ fontSize: '18px' }}
          >
            drag_indicator
          </span>
        </div>

        {/* Task content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
            {task.title}
          </p>
          {task.due_time && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 flex items-center gap-1">
              <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>
                schedule
              </span>
              {task.due_time}
            </p>
          )}
          {task.notes && (
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1 line-clamp-1">
              {task.notes}
            </p>
          )}
        </div>

        {/* Quick schedule button */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onSchedule?.()
          }}
          className="flex-shrink-0 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 bg-cyan-500 hover:bg-cyan-600 text-white transition-all"
          title="Schedule this task"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
            event
          </span>
        </button>
      </div>
    </div>
  )
}
