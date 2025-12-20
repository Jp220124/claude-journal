'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { isDemoAccount, demoTasksData } from '@/lib/demo'
import { LinkedNotesPanel } from '@/components/notes'
import {
  fetchTaskCategories,
  fetchCategoriesWithTodos,
  createTaskCategory,
  updateTaskCategory,
  archiveTaskCategory,
  hasTaskCategories,
  createStarterCategories,
  createTodo,
  updateTodo,
  toggleTodoComplete,
  deleteTodo,
  moveTodoToCategory,
} from '@/lib/taskCategoryService'
import type { TaskCategory, Todo, TaskCategoryWithTodos } from '@/types/database'

interface Task {
  id: string
  title: string
  completed: boolean
  priority: 'low' | 'medium' | 'high'
  dueDate?: string
  dueTime?: string
  category?: string
  category_id?: string | null
  recurrence?: string
  notes?: string
}

// Convert Todo to Task for UI
const todoToTask = (todo: Todo): Task => ({
  id: todo.id,
  title: todo.title,
  completed: todo.completed,
  priority: todo.priority,
  dueDate: todo.due_date || undefined,
  dueTime: todo.due_time || undefined,
  category: todo.category || undefined,
  category_id: todo.category_id,
  recurrence: todo.recurrence || undefined,
  notes: todo.notes || undefined,
})

export default function TodayPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const isDemo = isDemoAccount(user?.email)

  const [categories, setCategories] = useState<TaskCategoryWithTodos[]>([])
  const [allTasks, setAllTasks] = useState<Task[]>([])
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskCategoryId, setNewTaskCategoryId] = useState<string | null>(null)
  const [newTaskDueDate, setNewTaskDueDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'))
  const [newTaskDueTime, setNewTaskDueTime] = useState<string>('')
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [activeTab, setActiveTab] = useState<'todo' | 'completed' | 'high'>('todo')
  const [greeting, setGreeting] = useState('Good Morning')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  // Category management state
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<TaskCategory | null>(null)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryIcon, setNewCategoryIcon] = useState('folder')
  const [newCategoryColor, setNewCategoryColor] = useState('#6366f1')
  const [newCategoryIsRecurring, setNewCategoryIsRecurring] = useState(false)

  const categoryModalRef = useRef<HTMLDivElement>(null)
  const datePickerRef = useRef<HTMLDivElement>(null)
  const starterCategoriesCreated = useRef(false)

  const today = new Date()
  const dateStr = format(today, 'yyyy-MM-dd')

  // Get all tasks from categories
  const getAllTasks = useCallback(() => {
    return categories.flatMap(cat => cat.todos.map(todoToTask))
  }, [categories])

  const pendingTasks = allTasks.filter(t => !t.completed)
  const completedTasks = allTasks.filter(t => t.completed)
  const progress = allTasks.length > 0 ? Math.round((completedTasks.length / allTasks.length) * 100) : 0

  // Set greeting based on time of day
  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting('Good Morning')
    else if (hour < 17) setGreeting('Good Afternoon')
    else setGreeting('Good Evening')
  }, [])

  // Load categories and todos
  const loadData = useCallback(async () => {
    if (isDemo) {
      // Demo mode - show demo tasks in a single category
      const demoCategory: TaskCategoryWithTodos = {
        id: 'demo',
        user_id: 'demo',
        name: 'One-Time Tasks',
        icon: 'task_alt',
        color: '#3b82f6',
        is_recurring: false,
        order_index: 0,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        todos: demoTasksData.map(t => ({
          id: t.id,
          user_id: 'demo',
          title: t.title,
          completed: t.completed,
          priority: t.priority,
          due_date: dateStr,
          due_time: t.dueTime || null,
          category: t.category || null,
          category_id: 'demo',
          recurrence: t.recurrence || null,
          notes: t.notes || null,
          completed_date: t.completed ? dateStr : null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })),
      }
      setCategories([demoCategory])
      setAllTasks(demoTasksData)
      setExpandedCategories(new Set(['demo']))
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      // Check if user has categories, if not create starter ones (only once per session)
      if (!starterCategoriesCreated.current) {
        const hasCategories = await hasTaskCategories()
        if (!hasCategories) {
          await createStarterCategories()
        }
        starterCategoriesCreated.current = true
      }

      // Fetch categories with todos
      const data = await fetchCategoriesWithTodos(dateStr)
      setCategories(data)

      // Extract all tasks
      const tasks = data.flatMap(cat => cat.todos.map(todoToTask))
      setAllTasks(tasks)

      // Expand all categories by default
      setExpandedCategories(new Set(data.map(c => c.id)))

      if (tasks.length > 0) {
        setSelectedTask(prev => prev || tasks[0])
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [isDemo, dateStr])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Update allTasks when categories change
  useEffect(() => {
    setAllTasks(getAllTasks())
  }, [categories, getAllTasks])

  // Toggle category expansion
  const toggleCategoryExpand = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(categoryId)) {
        next.delete(categoryId)
      } else {
        next.add(categoryId)
      }
      return next
    })
  }

  // Add a new task
  const handleAddTask = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newTaskTitle.trim()) {
      if (isDemo) {
        const newTask: Task = {
          id: Date.now().toString(),
          title: newTaskTitle,
          completed: false,
          priority: 'medium',
          category_id: 'demo',
        }
        setAllTasks([newTask, ...allTasks])
        setNewTaskTitle('')
        return
      }

      setIsSaving(true)
      try {
        const result = await createTodo({
          title: newTaskTitle,
          priority: 'medium',
          due_date: newTaskDueDate,
          due_time: newTaskDueTime || null,
          category_id: newTaskCategoryId,
        })
        if (result) {
          await loadData() // Reload to get updated categories
          setNewTaskTitle('')
          // Reset to today after creating
          setNewTaskDueDate(format(new Date(), 'yyyy-MM-dd'))
          setNewTaskDueTime('')
        }
      } catch (error) {
        console.error('Error creating todo:', error)
      } finally {
        setIsSaving(false)
      }
    }
  }

  // Toggle task completion
  const handleToggleComplete = async (taskId: string) => {
    const task = allTasks.find(t => t.id === taskId)
    if (!task) return

    const newCompleted = !task.completed

    // Find if this task belongs to a recurring category
    const taskCategory = categories.find(cat => cat.id === task.category_id)
    const isRecurringCategory = taskCategory?.is_recurring ?? false

    // Optimistic update
    setCategories(prev => prev.map(cat => ({
      ...cat,
      todos: cat.todos.map(t => t.id === taskId ? { ...t, completed: newCompleted } : t)
    })))

    if (selectedTask?.id === taskId) {
      setSelectedTask({ ...selectedTask, completed: newCompleted })
    }

    if (isDemo) return

    try {
      await toggleTodoComplete(taskId, newCompleted, isRecurringCategory)
    } catch (error) {
      console.error('Error toggling todo:', error)
      await loadData()
    }
  }

  // Update task details
  const handleUpdateTask = async (taskId: string, updates: Partial<Task>) => {
    // Optimistic update
    setCategories(prev => prev.map(cat => ({
      ...cat,
      todos: cat.todos.map(t => t.id === taskId ? { ...t, ...updates } : t)
    })))

    if (selectedTask?.id === taskId) {
      setSelectedTask({ ...selectedTask, ...updates })
    }

    if (isDemo) return

    try {
      await updateTodo(taskId, {
        title: updates.title,
        priority: updates.priority,
        notes: updates.notes,
        category: updates.category,
        recurrence: updates.recurrence,
        due_date: updates.dueDate || undefined,
        due_time: updates.dueTime !== undefined ? (updates.dueTime || null) : undefined,
      })
    } catch (error) {
      console.error('Error updating todo:', error)
      await loadData()
    }
  }

  // Delete a task
  const handleDeleteTask = async (taskId: string) => {
    // Optimistic update
    setCategories(prev => prev.map(cat => ({
      ...cat,
      todos: cat.todos.filter(t => t.id !== taskId)
    })))

    if (selectedTask?.id === taskId) {
      setSelectedTask(null)
    }

    if (isDemo) return

    try {
      await deleteTodo(taskId)
    } catch (error) {
      console.error('Error deleting todo:', error)
      await loadData()
    }
  }

  // Move task to category
  const handleMoveToCategory = async (taskId: string, categoryId: string | null) => {
    if (isDemo) return

    try {
      await moveTodoToCategory(taskId, categoryId === 'uncategorized' ? null : categoryId)
      await loadData()
    } catch (error) {
      console.error('Error moving task:', error)
    }
  }

  // Category CRUD
  const handleSaveCategory = async () => {
    if (!newCategoryName.trim()) return

    setIsSaving(true)
    try {
      if (editingCategory) {
        await updateTaskCategory(editingCategory.id, {
          name: newCategoryName,
          icon: newCategoryIcon,
          color: newCategoryColor,
          is_recurring: newCategoryIsRecurring,
        })
      } else {
        await createTaskCategory({
          name: newCategoryName,
          icon: newCategoryIcon,
          color: newCategoryColor,
          is_recurring: newCategoryIsRecurring,
        })
      }
      await loadData()
      closeCategoryModal()
    } catch (error) {
      console.error('Error saving category:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteCategory = async (categoryId: string) => {
    if (isDemo || categoryId === 'uncategorized') return

    try {
      await archiveTaskCategory(categoryId)
      await loadData()
    } catch (error) {
      console.error('Error deleting category:', error)
    }
  }

  const openCategoryModal = (category?: TaskCategory) => {
    if (category) {
      setEditingCategory(category)
      setNewCategoryName(category.name)
      setNewCategoryIcon(category.icon)
      setNewCategoryColor(category.color)
      setNewCategoryIsRecurring(category.is_recurring)
    } else {
      setEditingCategory(null)
      setNewCategoryName('')
      setNewCategoryIcon('folder')
      setNewCategoryColor('#6366f1')
      setNewCategoryIsRecurring(false)
    }
    setShowCategoryModal(true)
  }

  const closeCategoryModal = () => {
    setShowCategoryModal(false)
    setEditingCategory(null)
    setNewCategoryName('')
  }

  // Close modal on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryModalRef.current && !categoryModalRef.current.contains(event.target as Node)) {
        closeCategoryModal()
      }
    }
    if (showCategoryModal) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showCategoryModal])

  // Close date picker on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setShowDatePicker(false)
      }
    }
    if (showDatePicker) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showDatePicker])

  // Helper to format date for display
  const formatDateForDisplay = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00')
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    if (dateStr === format(today, 'yyyy-MM-dd')) return 'Today'
    if (dateStr === format(tomorrow, 'yyyy-MM-dd')) return 'Tomorrow'
    return format(date, 'MMM d')
  }

  // Quick date options
  const getQuickDateOptions = () => {
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const nextWeek = new Date(today)
    nextWeek.setDate(nextWeek.getDate() + 7)

    return [
      { label: 'Today', value: format(today, 'yyyy-MM-dd') },
      { label: 'Tomorrow', value: format(tomorrow, 'yyyy-MM-dd') },
      { label: 'Next Week', value: format(nextWeek, 'yyyy-MM-dd') },
    ]
  }

  const getPriorityStyles = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-orange-50 text-orange-600 border-orange-100'
      case 'medium':
        return 'bg-cyan-50 text-cyan-600 border-cyan-100'
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200'
    }
  }

  const getPriorityDot = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-orange-500'
      case 'medium':
        return 'bg-cyan-500'
      default:
        return 'bg-slate-400'
    }
  }

  // Filter categories based on active tab
  const getFilteredCategories = () => {
    return categories.map(cat => {
      let filteredTodos = cat.todos
      if (activeTab === 'todo') {
        filteredTodos = cat.todos.filter(t => !t.completed)
      } else if (activeTab === 'completed') {
        filteredTodos = cat.todos.filter(t => t.completed)
      } else if (activeTab === 'high') {
        filteredTodos = cat.todos.filter(t => t.priority === 'high' && !t.completed)
      }
      return { ...cat, todos: filteredTodos }
    }).filter(cat => cat.todos.length > 0 || activeTab === 'todo')
  }

  const filteredCategories = getFilteredCategories()

  // Icon options for categories
  const iconOptions = [
    'folder', 'work', 'person', 'home', 'fitness_center',
    'school', 'shopping_cart', 'favorite', 'star', 'flag',
    'repeat', 'task_alt', 'event', 'groups', 'lightbulb',
  ]

  // Color options
  const colorOptions = [
    '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
    '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
    '#a855f7', '#ec4899', '#64748b',
  ]

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-slate-50">
        {/* Header */}
        <header className="h-18 flex items-center justify-between px-8 py-5 bg-transparent z-10 shrink-0">
          <div className="flex items-center gap-4 text-slate-500">
            <div className="hidden sm:flex items-center gap-2 text-sm font-medium">
              <span className="text-slate-400">Journal</span>
              <span className="text-slate-300">/</span>
              <span className="text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide">Today</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => openCategoryModal()}
              className="flex items-center gap-2 px-4 py-2 bg-white text-slate-600 rounded-xl text-sm font-medium shadow-sm hover:shadow-md transition-all border border-slate-200 hover:border-cyan-200"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              New Category
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 md:px-10 pb-10">
          <div className="max-w-4xl mx-auto flex flex-col gap-8">
            {/* Demo Mode Banner */}
            {isDemo && (
              <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
                <span className="font-medium">Demo Mode:</span> Changes are not saved. Create an account to save your tasks.
              </div>
            )}

            {/* Welcome Card */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-3xl shadow-soft">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-cyan-500 font-bold text-sm uppercase tracking-wider">
                  <span className="material-symbols-outlined text-xl fill">light_mode</span>
                  {greeting}
                </div>
                <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
                  {format(today, 'EEEE,')}<br />
                  {format(today, 'MMM d')}
                </h2>
                <p className="text-slate-500 font-medium text-base mt-1">
                  {isLoading
                    ? 'Loading your tasks...'
                    : pendingTasks.length > 0
                    ? `You have ${pendingTasks.length} tasks remaining for today.`
                    : allTasks.length > 0
                    ? "All tasks completed! Great job!"
                    : "No tasks yet. Add your first task below."
                  }
                </p>
              </div>
              <div className="flex flex-col gap-4 w-full md:w-64 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                <div className="flex justify-between items-baseline">
                  <span className="text-slate-600 font-semibold text-sm">Daily Progress</span>
                  <span className="text-cyan-600 font-bold text-lg">{progress}%</span>
                </div>
                <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-500 rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <div className="text-sm text-center font-medium text-slate-400">
                  {completedTasks.length}/{allTasks.length} Tasks Completed
                </div>
              </div>
            </div>

            {/* Add Task Input */}
            <div className="group relative shadow-sm hover:shadow-md transition-shadow duration-300 rounded-2xl bg-white">
              <div className="absolute inset-y-0 left-0 flex items-center pl-5 pointer-events-none text-cyan-600">
                <span className="material-symbols-outlined text-2xl">add_circle</span>
              </div>
              <input
                className="block w-full py-5 pl-14 pr-[340px] text-lg font-medium bg-transparent border border-transparent rounded-2xl focus:ring-2 focus:ring-cyan-200 focus:bg-white placeholder:text-slate-400 transition-all text-slate-800 outline-none disabled:opacity-50"
                placeholder="Add a new task..."
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={handleAddTask}
                disabled={isSaving}
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-4 gap-2">
                {/* Date picker for new task */}
                <div className="relative" ref={datePickerRef}>
                  <button
                    type="button"
                    onClick={() => setShowDatePicker(!showDatePicker)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                      newTaskDueDate === format(new Date(), 'yyyy-MM-dd')
                        ? "bg-cyan-50 text-cyan-600 hover:bg-cyan-100"
                        : "bg-purple-50 text-purple-600 hover:bg-purple-100"
                    )}
                  >
                    <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                    {formatDateForDisplay(newTaskDueDate)}
                  </button>

                  {/* Date picker dropdown */}
                  {showDatePicker && (
                    <div className="absolute top-full right-0 mt-2 bg-white rounded-xl shadow-lg border border-slate-200 p-3 z-50 min-w-[200px]">
                      {/* Quick options */}
                      <div className="flex flex-col gap-1 mb-3">
                        {getQuickDateOptions().map(option => (
                          <button
                            key={option.value}
                            onClick={() => {
                              setNewTaskDueDate(option.value)
                              setShowDatePicker(false)
                            }}
                            className={cn(
                              "text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                              newTaskDueDate === option.value
                                ? "bg-cyan-50 text-cyan-600"
                                : "hover:bg-slate-50 text-slate-700"
                            )}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>

                      {/* Divider */}
                      <div className="border-t border-slate-100 my-2"></div>

                      {/* Custom date input */}
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">Custom Date</label>
                        <input
                          type="date"
                          value={newTaskDueDate}
                          onChange={(e) => {
                            setNewTaskDueDate(e.target.value)
                            setShowDatePicker(false)
                          }}
                          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-cyan-200 outline-none"
                        />
                      </div>

                      {/* Time input */}
                      <div className="flex flex-col gap-2 mt-3">
                        <label className="text-xs font-bold text-slate-400 uppercase">Time (Optional)</label>
                        <input
                          type="time"
                          value={newTaskDueTime}
                          onChange={(e) => setNewTaskDueTime(e.target.value)}
                          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-cyan-200 outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Category selector for new task */}
                <select
                  value={newTaskCategoryId || ''}
                  onChange={(e) => setNewTaskCategoryId(e.target.value || null)}
                  className="text-sm bg-slate-100 border-none rounded-lg px-3 py-1.5 text-slate-600 focus:ring-2 focus:ring-cyan-200"
                >
                  <option value="">No category</option>
                  {categories.filter(c => c.id !== 'uncategorized').map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
                {isSaving ? (
                  <span className="text-xs text-cyan-600 font-medium">Saving...</span>
                ) : (
                  <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-slate-400 bg-slate-100 rounded-lg border border-slate-200 shadow-sm">
                    <span className="text-xs">Enter</span>
                  </kbd>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex flex-col gap-6">
              <div className="flex gap-6 border-b border-slate-200 pb-1 px-2">
                <button
                  onClick={() => setActiveTab('todo')}
                  className={`pb-3 text-sm font-bold transition-colors ${
                    activeTab === 'todo'
                      ? 'text-cyan-600 border-b-2 border-cyan-600'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  To Do ({pendingTasks.length})
                </button>
                <button
                  onClick={() => setActiveTab('completed')}
                  className={`pb-3 text-sm font-semibold transition-colors ${
                    activeTab === 'completed'
                      ? 'text-cyan-600 border-b-2 border-cyan-600'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Completed ({completedTasks.length})
                </button>
                <button
                  onClick={() => setActiveTab('high')}
                  className={`pb-3 text-sm font-semibold transition-colors ${
                    activeTab === 'high'
                      ? 'text-cyan-600 border-b-2 border-cyan-600'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  High Priority
                </button>
              </div>

              {/* Categorized Task List */}
              <div className="flex flex-col gap-6">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-8 h-8 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-sm text-slate-500">Loading tasks...</p>
                  </div>
                ) : filteredCategories.length > 0 ? (
                  filteredCategories.map((category) => {
                    const catPendingCount = category.todos.filter(t => !t.completed).length
                    const catCompletedCount = category.todos.filter(t => t.completed).length
                    const isExpanded = expandedCategories.has(category.id)

                    return (
                      <div key={category.id} className="flex flex-col gap-3">
                        {/* Category Header */}
                        <div className="flex items-center justify-between px-2">
                          <button
                            onClick={() => toggleCategoryExpand(category.id)}
                            className="flex items-center gap-3 group"
                          >
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center"
                              style={{ backgroundColor: `${category.color}20` }}
                            >
                              <span
                                className="material-symbols-outlined"
                                style={{ fontSize: '18px', color: category.color }}
                              >
                                {category.icon}
                              </span>
                            </div>
                            <span className="text-sm font-bold uppercase tracking-wider text-slate-500 group-hover:text-slate-700">
                              {category.name}
                            </span>
                            <span className="material-symbols-outlined text-slate-400 text-[18px] transition-transform" style={{ transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
                              expand_more
                            </span>
                          </button>
                          <div className="flex items-center gap-3">
                            {activeTab === 'todo' && catPendingCount > 0 && (
                              <span className="text-xs font-medium text-slate-400">
                                {catPendingCount} Remaining
                              </span>
                            )}
                            {activeTab === 'todo' && catCompletedCount > 0 && (
                              <span className="text-xs font-medium px-2 py-0.5 bg-cyan-50 text-cyan-600 rounded">
                                {catCompletedCount}/{category.todos.length + catCompletedCount} Done
                              </span>
                            )}
                            {category.id !== 'uncategorized' && (
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => openCategoryModal(category)}
                                  className="p-1 text-slate-400 hover:text-slate-600 rounded"
                                >
                                  <span className="material-symbols-outlined text-[16px]">edit</span>
                                </button>
                                <button
                                  onClick={() => handleDeleteCategory(category.id)}
                                  className="p-1 text-slate-400 hover:text-red-600 rounded"
                                >
                                  <span className="material-symbols-outlined text-[16px]">delete</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Tasks in Category */}
                        {isExpanded && (
                          <div className="flex flex-col gap-3">
                            {category.todos.map((todo) => {
                              const task = todoToTask(todo)
                              return (
                                <div
                                  key={task.id}
                                  onClick={() => setSelectedTask(task)}
                                  className={cn(
                                    'group flex items-start sm:items-center gap-4 p-5 bg-white border rounded-2xl cursor-pointer transition-all hover:scale-[1.005] relative overflow-hidden',
                                    selectedTask?.id === task.id
                                      ? 'border-cyan-200 shadow-[0_4px_20px_-4px_rgba(8,145,178,0.1)] ring-1 ring-cyan-100'
                                      : task.completed
                                      ? 'border-transparent bg-slate-50 opacity-70 hover:opacity-100'
                                      : 'border-slate-100 hover:bg-slate-50 hover:shadow-card hover:border-slate-200'
                                  )}
                                >
                                  {selectedTask?.id === task.id && !task.completed && (
                                    <div
                                      className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
                                      style={{ backgroundColor: category.color }}
                                    ></div>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleToggleComplete(task.id)
                                    }}
                                    className={`flex-shrink-0 mt-0.5 sm:mt-0 transition-colors ${
                                      task.completed ? 'text-cyan-600' : 'text-slate-300 hover:text-cyan-600'
                                    }`}
                                  >
                                    <span className={`material-symbols-outlined text-2xl ${task.completed ? 'fill-1' : ''}`}>
                                      {task.completed ? 'check_circle' : 'radio_button_unchecked'}
                                    </span>
                                  </button>
                                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                                    <h3 className={`text-base font-semibold truncate transition-colors ${
                                      task.completed
                                        ? 'text-slate-500 line-through'
                                        : 'text-slate-700 group-hover:text-slate-900'
                                    }`}>
                                      {task.title}
                                    </h3>
                                    {!task.completed && (
                                      <div className="flex flex-wrap items-center gap-3 text-xs font-medium">
                                        <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md border ${getPriorityStyles(task.priority)}`}>
                                          <span className={`size-1.5 rounded-full ${getPriorityDot(task.priority)}`}></span>
                                          {task.priority === 'high' ? 'High Priority' : task.priority === 'medium' ? 'Medium' : 'Low'}
                                        </span>
                                        {task.dueTime && (
                                          <span className="flex items-center gap-1 text-slate-500">
                                            <span className="material-symbols-outlined text-[16px]">schedule</span>
                                            {task.dueTime}
                                          </span>
                                        )}
                                        {category.is_recurring && (
                                          <span className="flex items-center gap-1 text-slate-500">
                                            <span className="material-symbols-outlined text-[16px]">repeat</span>
                                            Daily
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  {!task.completed && (
                                    <div className="flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleDeleteTask(task.id)
                                        }}
                                        className="p-2 text-slate-400 hover:text-red-600 transition-colors rounded-full hover:bg-red-50"
                                      >
                                        <span className="material-symbols-outlined text-[20px]">delete</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                      <span className="material-symbols-outlined text-slate-400" style={{ fontSize: '32px' }}>
                        {activeTab === 'completed' ? 'task_alt' : activeTab === 'high' ? 'priority_high' : 'checklist'}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">
                      {activeTab === 'completed'
                        ? 'No completed tasks yet'
                        : activeTab === 'high'
                        ? 'No high priority tasks'
                        : 'No tasks yet'}
                    </h3>
                    <p className="text-slate-500 max-w-sm">
                      {activeTab === 'completed'
                        ? 'Complete some tasks to see them here.'
                        : activeTab === 'high'
                        ? 'Add tasks with high priority to see them here.'
                        : 'Add your first task using the input above.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Task Details Sidebar */}
      <aside className="w-80 lg:w-96 flex-shrink-0 bg-white border-l border-slate-200 flex flex-col h-full overflow-y-auto hidden lg:flex shadow-[-4px_0_24px_-12px_rgba(0,0,0,0.02)] z-20">
        {selectedTask ? (
          <>
            <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-white/50 backdrop-blur-sm sticky top-0 z-10">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Task Details</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleDeleteTask(selectedTask.id)}
                  className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">delete</span>
                </button>
                <button
                  onClick={() => setSelectedTask(null)}
                  className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
            </div>
            <div className="flex-1 p-6 flex flex-col gap-8">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3 group cursor-pointer">
                  <div className="relative flex items-center justify-center size-6">
                    <input
                      type="checkbox"
                      checked={selectedTask.completed}
                      onChange={() => handleToggleComplete(selectedTask.id)}
                      className="peer appearance-none size-5 border-2 border-slate-300 rounded-md checked:bg-cyan-600 checked:border-cyan-600 focus:ring-2 focus:ring-offset-1 focus:ring-cyan-300 transition-all cursor-pointer"
                    />
                    <span className="material-symbols-outlined text-white text-[16px] absolute opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity">
                      check
                    </span>
                  </div>
                  <span className="text-sm font-medium text-slate-500 group-hover:text-slate-700 transition-colors">
                    Mark as complete
                  </span>
                </div>
                <textarea
                  className="w-full bg-transparent border-0 p-0 text-xl font-bold text-slate-900 focus:ring-0 resize-none h-auto leading-tight outline-none"
                  placeholder="Task title"
                  rows={2}
                  value={selectedTask.title}
                  onChange={(e) => handleUpdateTask(selectedTask.id, { title: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 gap-6">
                {/* Category */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Category</label>
                  <select
                    value={selectedTask.category_id || ''}
                    onChange={(e) => handleMoveToCategory(selectedTask.id, e.target.value || null)}
                    className="w-full px-4 py-3 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 hover:border-cyan-300 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-cyan-200 appearance-none cursor-pointer shadow-sm transition-all outline-none"
                    disabled={isDemo}
                  >
                    <option value="">Uncategorized</option>
                    {categories.filter(c => c.id !== 'uncategorized').map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                {/* Priority */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Priority</label>
                  <div className="flex bg-slate-100 rounded-xl p-1.5 shadow-inner">
                    {(['low', 'medium', 'high'] as const).map(p => (
                      <button
                        key={p}
                        onClick={() => handleUpdateTask(selectedTask.id, { priority: p })}
                        className={cn(
                          'flex-1 py-2 text-xs font-semibold rounded-lg transition-all capitalize',
                          selectedTask.priority === p
                            ? p === 'high'
                              ? 'bg-white text-orange-600 shadow-sm border border-slate-100 ring-1 ring-black/5'
                              : p === 'medium'
                              ? 'bg-white text-cyan-600 shadow-sm border border-slate-100 ring-1 ring-black/5'
                              : 'bg-white text-slate-700 shadow-sm border border-slate-100 ring-1 ring-black/5'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                        )}
                      >
                        {p === 'medium' ? 'Med' : p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Due Date */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Due Date</label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={selectedTask.dueDate || ''}
                      onChange={(e) => handleUpdateTask(selectedTask.id, { dueDate: e.target.value })}
                      className="flex-1 px-4 py-3 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 hover:border-cyan-300 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-cyan-200 appearance-none cursor-pointer shadow-sm transition-all outline-none"
                      disabled={isDemo}
                    />
                  </div>
                  {/* Quick date buttons */}
                  <div className="flex gap-2 flex-wrap">
                    {getQuickDateOptions().map(option => (
                      <button
                        key={option.value}
                        onClick={() => handleUpdateTask(selectedTask.id, { dueDate: option.value })}
                        disabled={isDemo}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                          selectedTask.dueDate === option.value
                            ? "bg-cyan-100 text-cyan-700"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Due Time */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Due Time (Optional)</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="time"
                      value={selectedTask.dueTime || ''}
                      onChange={(e) => handleUpdateTask(selectedTask.id, { dueTime: e.target.value })}
                      className="flex-1 px-4 py-3 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 hover:border-cyan-300 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-cyan-200 cursor-pointer shadow-sm transition-all outline-none"
                      disabled={isDemo}
                    />
                    {selectedTask.dueTime && (
                      <button
                        onClick={() => handleUpdateTask(selectedTask.id, { dueTime: '' })}
                        className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                        disabled={isDemo}
                      >
                        <span className="material-symbols-outlined text-[18px]">close</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Notes */}
                <div className="flex-1 flex flex-col gap-2 min-h-[150px]">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Notes</label>
                  <textarea
                    className="flex-1 bg-white rounded-xl border border-slate-200 p-4 text-sm text-slate-700 focus:ring-2 focus:ring-cyan-200 focus:border-cyan-600 resize-none placeholder:text-slate-400 leading-relaxed outline-none shadow-sm"
                    placeholder="Add notes..."
                    value={selectedTask.notes || ''}
                    onChange={(e) => handleUpdateTask(selectedTask.id, { notes: e.target.value })}
                  />
                </div>

                {/* Linked Notes */}
                <LinkedNotesPanel
                  taskId={selectedTask.id}
                  onNoteClick={(noteId) => router.push(`/notes?note=${noteId}`)}
                  isDemo={isDemo}
                />
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-6 text-slate-400">
            <div className="text-center">
              <span className="material-symbols-outlined text-6xl mb-4 block">task_alt</span>
              <p className="text-sm font-medium">Select a task to view details</p>
            </div>
          </div>
        )}
      </aside>

      {/* Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div
            ref={categoryModalRef}
            className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl"
          >
            <h3 className="text-lg font-bold text-slate-900 mb-4">
              {editingCategory ? 'Edit Category' : 'New Category'}
            </h3>

            <div className="flex flex-col gap-4">
              {/* Name */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">
                  Name
                </label>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Category name"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </div>

              {/* Icon */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">
                  Icon
                </label>
                <div className="flex flex-wrap gap-2">
                  {iconOptions.map(icon => (
                    <button
                      key={icon}
                      onClick={() => setNewCategoryIcon(icon)}
                      className={cn(
                        'p-2 rounded-lg transition-colors',
                        newCategoryIcon === icon
                          ? 'bg-cyan-100 text-cyan-600'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      )}
                    >
                      <span className="material-symbols-outlined text-[20px]">{icon}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Color */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">
                  Color
                </label>
                <div className="flex flex-wrap gap-2">
                  {colorOptions.map(color => (
                    <button
                      key={color}
                      onClick={() => setNewCategoryColor(color)}
                      className={cn(
                        'w-8 h-8 rounded-lg transition-transform hover:scale-110',
                        newCategoryColor === color && 'ring-2 ring-offset-2 ring-slate-400'
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Is Recurring */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isRecurring"
                  checked={newCategoryIsRecurring}
                  onChange={(e) => setNewCategoryIsRecurring(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                />
                <label htmlFor="isRecurring" className="text-sm text-slate-700">
                  Daily recurring tasks (tasks repeat every day)
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={closeCategoryModal}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCategory}
                disabled={isSaving || !newCategoryName.trim()}
                className="px-4 py-2 bg-cyan-600 text-white rounded-xl font-medium hover:bg-cyan-700 transition-colors disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : editingCategory ? 'Save Changes' : 'Create Category'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
