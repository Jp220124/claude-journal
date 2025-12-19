'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { getLinkedTasks, unlinkTaskFromNote, type LinkedTask } from '@/lib/notes/taskLinks'

interface LinkedTasksPanelProps {
  noteId: string
  onLinkTask: () => void
  isDemo?: boolean
}

// Demo linked tasks for non-authenticated users
const demoLinkedTasks: LinkedTask[] = [
  {
    id: 'demo-task-1',
    user_id: 'demo',
    title: 'Review project requirements',
    completed: false,
    priority: 'high',
    due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    due_time: null,
    category: null,
    category_id: null,
    recurrence: null,
    notes: null,
    completed_date: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    link_type: 'reference',
    linked_at: new Date().toISOString(),
  },
]

export function LinkedTasksPanel({
  noteId,
  onLinkTask,
  isDemo = false,
}: LinkedTasksPanelProps) {
  const [linkedTasks, setLinkedTasks] = useState<LinkedTask[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isExpanded, setIsExpanded] = useState(false)

  // Load linked tasks
  useEffect(() => {
    const loadLinkedTasks = async () => {
      if (isDemo) {
        setLinkedTasks(demoLinkedTasks)
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      try {
        const tasks = await getLinkedTasks(noteId)
        setLinkedTasks(tasks)
      } catch (error) {
        console.error('Error loading linked tasks:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadLinkedTasks()
  }, [noteId, isDemo])

  const handleUnlink = async (taskId: string) => {
    if (isDemo) {
      setLinkedTasks(prev => prev.filter(t => t.id !== taskId))
      return
    }

    try {
      const success = await unlinkTaskFromNote(taskId, noteId)
      if (success) {
        setLinkedTasks(prev => prev.filter(t => t.id !== taskId))
      }
    } catch (error) {
      console.error('Error unlinking task:', error)
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50'
      case 'medium': return 'text-amber-600 bg-amber-50'
      case 'low': return 'text-green-600 bg-green-50'
      default: return 'text-slate-600 bg-slate-50'
    }
  }

  const formatDueDate = (date: string | null) => {
    if (!date) return null
    const dueDate = new Date(date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    if (dueDate < today) {
      return { text: 'Overdue', className: 'text-red-600' }
    }
    if (dueDate.getTime() === today.getTime()) {
      return { text: 'Today', className: 'text-amber-600' }
    }
    if (dueDate.getTime() === tomorrow.getTime()) {
      return { text: 'Tomorrow', className: 'text-blue-600' }
    }
    return { text: format(dueDate, 'MMM d'), className: 'text-slate-500' }
  }

  return (
    <div className="border-t border-slate-100 mt-3 pt-2">
      {/* Header - compact inline design */}
      <div className="w-full flex items-center justify-between text-left group">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1.5 flex-1"
        >
          <span className="material-symbols-outlined text-slate-400 text-[16px]">
            task_alt
          </span>
          <span className="text-xs font-medium text-slate-500">
            Linked Tasks
          </span>
          {linkedTasks.length > 0 && (
            <span className="text-[10px] bg-cyan-100 text-cyan-600 px-1.5 py-0.5 rounded-full font-medium">
              {linkedTasks.length}
            </span>
          )}
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={onLinkTask}
            className="p-1 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded transition-colors text-xs flex items-center gap-1"
            title="Link a task"
          >
            <span className="material-symbols-outlined text-[14px]">add_link</span>
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-0.5"
          >
            <span className={cn(
              'material-symbols-outlined text-slate-400 text-[16px] transition-transform',
              isExpanded ? 'rotate-180' : ''
            )}>
              expand_more
            </span>
          </button>
        </div>
      </div>

      {/* Content - only show when expanded */}
      {isExpanded && (
        <div className="mt-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-2">
              <div className="w-4 h-4 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : linkedTasks.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-2 text-xs text-slate-400">
              <span>No tasks linked</span>
              <button
                onClick={onLinkTask}
                className="text-cyan-600 hover:text-cyan-700 font-medium"
              >
                + Add
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {linkedTasks.map(task => {
                const dueInfo = formatDueDate(task.due_date)
                return (
                  <div
                    key={task.id}
                    className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg group/task"
                  >
                    {/* Checkbox */}
                    <div className={cn(
                      'w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center mt-0.5',
                      task.completed
                        ? 'bg-cyan-600 border-cyan-600 text-white'
                        : 'border-slate-300'
                    )}>
                      {task.completed && (
                        <span className="material-symbols-outlined text-[14px]">check</span>
                      )}
                    </div>

                    {/* Task info */}
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'text-sm font-medium',
                        task.completed ? 'text-slate-400 line-through' : 'text-slate-700'
                      )}>
                        {task.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {/* Priority */}
                        <span className={cn(
                          'text-[10px] font-medium px-1.5 py-0.5 rounded',
                          getPriorityColor(task.priority)
                        )}>
                          {task.priority}
                        </span>
                        {/* Due date */}
                        {dueInfo && (
                          <span className={cn('text-xs', dueInfo.className)}>
                            {dueInfo.text}
                          </span>
                        )}
                        {/* Link type badge */}
                        <span className="text-[10px] text-slate-400">
                          {task.link_type}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover/task:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleUnlink(task.id)}
                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Unlink task"
                      >
                        <span className="material-symbols-outlined text-[16px]">link_off</span>
                      </button>
                    </div>
                  </div>
                )
              })}

              {/* Link more button */}
              <button
                onClick={onLinkTask}
                className="w-full flex items-center justify-center gap-1 py-2 text-sm text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                Link another task
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
