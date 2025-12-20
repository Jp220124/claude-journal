'use client'

import { useState, useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { cn, linkifyText } from '@/lib/utils'
import {
  linkTaskToNote,
  searchTasks,
  getRecentTasks,
  createTaskAndLink,
  type LinkedTask,
} from '@/lib/notes/taskLinks'
import type { Todo } from '@/types/database'

interface TaskLinkerProps {
  isOpen: boolean
  onClose: () => void
  noteId: string
  existingTaskIds: string[]
  onTaskLinked: (task: LinkedTask) => void
  isDemo?: boolean
}

// Demo tasks for non-authenticated users
const demoTasks: Todo[] = [
  {
    id: 'demo-task-2',
    user_id: 'demo',
    title: 'Complete project documentation',
    completed: false,
    priority: 'high',
    due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    due_time: null,
    category: 'Work',
    category_id: null,
    recurrence: null,
    notes: null,
    completed_date: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'demo-task-3',
    user_id: 'demo',
    title: 'Schedule team meeting',
    completed: false,
    priority: 'medium',
    due_date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    due_time: null,
    category: 'Work',
    category_id: null,
    recurrence: null,
    notes: null,
    completed_date: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'demo-task-4',
    user_id: 'demo',
    title: 'Review pull requests',
    completed: false,
    priority: 'low',
    due_date: null,
    due_time: null,
    category: 'Development',
    category_id: null,
    recurrence: null,
    notes: null,
    completed_date: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
]

export function TaskLinker({
  isOpen,
  onClose,
  noteId,
  existingTaskIds,
  onTaskLinked,
  isDemo = false,
}: TaskLinkerProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [tasks, setTasks] = useState<Todo[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLinking, setIsLinking] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const modalRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load tasks when modal opens
  useEffect(() => {
    if (!isOpen) return

    const loadTasks = async () => {
      if (isDemo) {
        setTasks(demoTasks.filter(t => !existingTaskIds.includes(t.id)))
        return
      }

      setIsLoading(true)
      try {
        const recentTasks = await getRecentTasks(20)
        setTasks(recentTasks.filter(t => !existingTaskIds.includes(t.id)))
      } catch (error) {
        console.error('Error loading tasks:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadTasks()
    setSearchQuery('')
    setShowCreateForm(false)
    setNewTaskTitle('')

    // Focus input
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [isOpen, isDemo, existingTaskIds])

  // Search tasks when query changes
  useEffect(() => {
    if (!isOpen || isDemo) return

    const search = async () => {
      if (!searchQuery.trim()) {
        const recentTasks = await getRecentTasks(20)
        setTasks(recentTasks.filter(t => !existingTaskIds.includes(t.id)))
        return
      }

      setIsLoading(true)
      try {
        const results = await searchTasks(searchQuery, 20)
        setTasks(results.filter(t => !existingTaskIds.includes(t.id)))
      } catch (error) {
        console.error('Error searching tasks:', error)
      } finally {
        setIsLoading(false)
      }
    }

    const debounce = setTimeout(search, 300)
    return () => clearTimeout(debounce)
  }, [searchQuery, isOpen, isDemo, existingTaskIds])

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
        onClose()
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
    }
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  const handleLinkTask = async (task: Todo) => {
    if (isDemo) {
      onTaskLinked({
        ...task,
        link_type: 'reference',
        linked_at: new Date().toISOString(),
      })
      setTasks(prev => prev.filter(t => t.id !== task.id))
      return
    }

    setIsLinking(task.id)
    try {
      const link = await linkTaskToNote(task.id, noteId, 'reference')
      if (link) {
        onTaskLinked({
          ...task,
          link_type: link.link_type,
          linked_at: link.created_at,
        })
        setTasks(prev => prev.filter(t => t.id !== task.id))
      }
    } catch (error) {
      console.error('Error linking task:', error)
    } finally {
      setIsLinking(null)
    }
  }

  const handleCreateAndLink = async () => {
    if (!newTaskTitle.trim()) return

    if (isDemo) {
      const newTask: LinkedTask = {
        id: `demo-task-${Date.now()}`,
        user_id: 'demo',
        title: newTaskTitle.trim(),
        completed: false,
        priority: 'medium',
        due_date: null,
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
      }
      onTaskLinked(newTask)
      setNewTaskTitle('')
      setShowCreateForm(false)
      return
    }

    setIsLinking('creating')
    try {
      const { task, link } = await createTaskAndLink(noteId, newTaskTitle.trim(), 'reference')
      if (task && link) {
        onTaskLinked({
          ...task,
          link_type: link.link_type,
          linked_at: link.created_at,
        })
        setNewTaskTitle('')
        setShowCreateForm(false)
      }
    } catch (error) {
      console.error('Error creating and linking task:', error)
    } finally {
      setIsLinking(null)
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

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        ref={modalRef}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Link Task to Note</h3>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="p-4 border-b border-slate-100">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">
              search
            </span>
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-200 focus:border-cyan-300 outline-none"
            />
          </div>
        </div>

        {/* Task List */}
        <div className="max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : showCreateForm ? (
            <div className="p-4">
              <label className="text-sm font-medium text-slate-700 mb-2 block">
                New Task Title
              </label>
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Enter task title..."
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-200 outline-none mb-3"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateAndLink()
                }}
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateAndLink}
                  disabled={!newTaskTitle.trim() || isLinking === 'creating'}
                  className="flex-1 px-4 py-2 text-sm bg-cyan-600 text-white rounded-xl hover:bg-cyan-700 transition-colors disabled:opacity-50"
                >
                  {isLinking === 'creating' ? 'Creating...' : 'Create & Link'}
                </button>
              </div>
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <span className="material-symbols-outlined text-4xl mb-2 block">task</span>
              <p className="text-sm">
                {searchQuery ? 'No matching tasks found' : 'No tasks available'}
              </p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="mt-3 text-sm text-cyan-600 hover:text-cyan-700 font-medium"
              >
                + Create new task
              </button>
            </div>
          ) : (
            <div className="p-2">
              {tasks.map(task => (
                <button
                  key={task.id}
                  onClick={() => handleLinkTask(task)}
                  disabled={isLinking === task.id}
                  className={cn(
                    'w-full flex items-start gap-3 p-3 rounded-xl text-left transition-colors',
                    isLinking === task.id
                      ? 'bg-cyan-50 opacity-50'
                      : 'hover:bg-slate-50'
                  )}
                >
                  {/* Checkbox placeholder */}
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
                      {linkifyText(task.title)}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={cn(
                        'text-[10px] font-medium px-1.5 py-0.5 rounded',
                        getPriorityColor(task.priority)
                      )}>
                        {task.priority}
                      </span>
                      {task.due_date && (
                        <span className="text-xs text-slate-500">
                          Due {format(new Date(task.due_date), 'MMM d')}
                        </span>
                      )}
                      {task.category && (
                        <span className="text-xs text-slate-400">
                          {task.category}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Link icon */}
                  <div className="flex-shrink-0">
                    {isLinking === task.id ? (
                      <div className="w-5 h-5 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <span className="material-symbols-outlined text-slate-400 text-[20px]">
                        add_link
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {!showCreateForm && tasks.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50">
            <button
              onClick={() => setShowCreateForm(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-cyan-600 hover:bg-white rounded-xl transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Create new task
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
