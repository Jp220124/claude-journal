'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { cn, linkifyText } from '@/lib/utils'
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
import {
  triggerResearch,
  getResearchStatus,
  getCategoryAutomations,
  createCategoryAutomation,
  updateCategoryAutomation,
  deleteCategoryAutomation,
  type CategoryAutomation
} from '@/lib/researchService'
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
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [activeTab, setActiveTab] = useState<'all' | 'today' | 'recurring'>('all')
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'priority' | 'dueDate' | 'name'>('priority')
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

  // Category automation state
  const [categoryAutomations, setCategoryAutomations] = useState<Record<string, CategoryAutomation>>({})
  const [enableAutomation, setEnableAutomation] = useState(false)
  const [automationResearchDepth, setAutomationResearchDepth] = useState<'quick' | 'medium' | 'deep'>('medium')
  const [automationAskClarification, setAutomationAskClarification] = useState(false)
  const [automationMaxSources, setAutomationMaxSources] = useState(5)
  const [existingAutomationId, setExistingAutomationId] = useState<string | null>(null)

  // Research state
  const [researchEnabled, setResearchEnabled] = useState(false)
  const [isResearching, setIsResearching] = useState<string | null>(null)

  const categoryModalRef = useRef<HTMLDivElement>(null)
  const starterCategoriesCreated = useRef(false)

  const today = new Date()
  const dateStr = format(today, 'yyyy-MM-dd')

  // Get all tasks from categories
  const getAllTasks = useCallback(() => {
    return categories.flatMap(cat => cat.todos.map(todoToTask))
  }, [categories])

  const pendingTasks = allTasks.filter(t => !t.completed)
  const completedTasks = allTasks.filter(t => t.completed)
  const dueTodayCount = pendingTasks.filter(t => t.dueDate === dateStr).length
  const overdueCount = pendingTasks.filter(t => t.dueDate && t.dueDate < dateStr).length

  // Load categories and todos
  const loadData = useCallback(async () => {
    if (isDemo) {
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
      setExpandedCategories(new Set()) // Start collapsed
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      if (!starterCategoriesCreated.current) {
        const hasCategories = await hasTaskCategories()
        if (!hasCategories) {
          await createStarterCategories()
        }
        starterCategoriesCreated.current = true
      }

      const data = await fetchCategoriesWithTodos(dateStr)
      setCategories(data)

      const tasks = data.flatMap(cat => cat.todos.map(todoToTask))
      setAllTasks(tasks)

      setExpandedCategories(new Set()) // Start collapsed
      // Don't auto-select any task - sidebar should be hidden until user clicks a task
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [isDemo, dateStr])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Check if research is enabled and load category automations
  useEffect(() => {
    async function checkResearchAndLoadAutomations() {
      try {
        const status = await getResearchStatus()
        setResearchEnabled(status.enabled)

        if (status.enabled) {
          const automations = await getCategoryAutomations()
          const automationMap: Record<string, CategoryAutomation> = {}
          automations.forEach(a => {
            automationMap[a.category_id] = a
          })
          setCategoryAutomations(automationMap)
        }
      } catch (err) {
        console.error('Error checking research status:', err)
      }
    }
    if (!isDemo) {
      checkResearchAndLoadAutomations()
    }
  }, [isDemo])

  // Handle research trigger
  const handleTriggerResearch = async (task: Task) => {
    if (isDemo || isResearching) return

    setIsResearching(task.id)
    try {
      const result = await triggerResearch({
        taskId: task.id,
        taskName: task.title,
        taskDescription: task.notes,
        categoryId: task.category_id || undefined,
      })
      if (result.success) {
        alert(`Research started! Job ID: ${result.jobId}\n\nYou can track progress on the Research page.`)
      }
    } catch (err) {
      console.error('Error triggering research:', err)
      alert(err instanceof Error ? err.message : 'Failed to start research')
    } finally {
      setIsResearching(null)
    }
  }

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
          priority: newTaskPriority,
          category_id: 'demo',
          dueDate: newTaskDueDate,
        }
        setAllTasks([newTask, ...allTasks])
        setNewTaskTitle('')
        return
      }

      setIsSaving(true)
      try {
        const result = await createTodo({
          title: newTaskTitle,
          priority: newTaskPriority,
          due_date: newTaskDueDate,
          due_time: newTaskDueTime || null,
          category_id: newTaskCategoryId,
        })
        if (result) {
          await loadData()
          setNewTaskTitle('')
          setNewTaskDueDate(format(new Date(), 'yyyy-MM-dd'))
          setNewTaskDueTime('')
          setNewTaskPriority('medium')
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
    const taskCategory = categories.find(cat => cat.id === task.category_id)
    const isRecurringCategory = taskCategory?.is_recurring ?? false

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
      let categoryId: string

      if (editingCategory) {
        await updateTaskCategory(editingCategory.id, {
          name: newCategoryName,
          icon: newCategoryIcon,
          color: newCategoryColor,
          is_recurring: newCategoryIsRecurring,
        })
        categoryId = editingCategory.id
      } else {
        const newCategory = await createTaskCategory({
          name: newCategoryName,
          icon: newCategoryIcon,
          color: newCategoryColor,
          is_recurring: newCategoryIsRecurring,
        })
        if (!newCategory) {
          throw new Error('Failed to create category')
        }
        categoryId = newCategory.id
      }

      if (researchEnabled) {
        if (enableAutomation) {
          if (existingAutomationId) {
            const updated = await updateCategoryAutomation(existingAutomationId, {
              research_depth: automationResearchDepth,
              ask_clarification: automationAskClarification,
              max_sources: automationMaxSources,
              is_active: true,
            })
            setCategoryAutomations(prev => ({ ...prev, [categoryId]: updated }))
          } else {
            const created = await createCategoryAutomation({
              categoryId,
              researchDepth: automationResearchDepth,
              askClarification: automationAskClarification,
              maxSources: automationMaxSources,
            })
            setCategoryAutomations(prev => ({ ...prev, [categoryId]: created }))
          }
        } else if (existingAutomationId) {
          const updated = await updateCategoryAutomation(existingAutomationId, {
            is_active: false,
          })
          setCategoryAutomations(prev => ({ ...prev, [categoryId]: updated }))
        }
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

      const existingAutomation = categoryAutomations[category.id]
      if (existingAutomation) {
        setEnableAutomation(existingAutomation.is_active)
        setAutomationResearchDepth(existingAutomation.research_depth as 'quick' | 'medium' | 'deep')
        setAutomationAskClarification(existingAutomation.ask_clarification)
        setAutomationMaxSources(existingAutomation.max_sources)
        setExistingAutomationId(existingAutomation.id)
      } else {
        setEnableAutomation(false)
        setAutomationResearchDepth('medium')
        setAutomationAskClarification(false)
        setAutomationMaxSources(5)
        setExistingAutomationId(null)
      }
    } else {
      setEditingCategory(null)
      setNewCategoryName('')
      setNewCategoryIcon('folder')
      setNewCategoryColor('#6366f1')
      setNewCategoryIsRecurring(false)
      setEnableAutomation(false)
      setAutomationResearchDepth('medium')
      setAutomationAskClarification(false)
      setAutomationMaxSources(5)
      setExistingAutomationId(null)
    }
    setShowCategoryModal(true)
  }

  const closeCategoryModal = () => {
    setShowCategoryModal(false)
    setEditingCategory(null)
    setNewCategoryName('')
    setEnableAutomation(false)
    setAutomationResearchDepth('medium')
    setAutomationAskClarification(false)
    setAutomationMaxSources(5)
    setExistingAutomationId(null)
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

  // Get filtered and sorted tasks
  const getFilteredTasks = () => {
    let filtered = allTasks.filter(t => !t.completed)

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(t => t.title.toLowerCase().includes(query))
    }

    // Apply tab filter
    if (activeTab === 'today') {
      filtered = filtered.filter(t => t.dueDate === dateStr)
    } else if (activeTab === 'recurring') {
      const recurringCatIds = categories.filter(c => c.is_recurring).map(c => c.id)
      filtered = filtered.filter(t => t.category_id && recurringCatIds.includes(t.category_id))
    }

    // Apply category filter
    if (activeFilter) {
      if (activeFilter === 'high') {
        filtered = filtered.filter(t => t.priority === 'high')
      } else {
        filtered = filtered.filter(t => t.category_id === activeFilter)
      }
    }

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === 'priority') {
        const priorityOrder = { high: 0, medium: 1, low: 2 }
        return priorityOrder[a.priority] - priorityOrder[b.priority]
      } else if (sortBy === 'dueDate') {
        return (a.dueDate || '9999').localeCompare(b.dueDate || '9999')
      } else {
        return a.title.localeCompare(b.title)
      }
    })

    return filtered
  }

  // Group tasks by category
  const getGroupedTasks = () => {
    const filtered = getFilteredTasks()
    const grouped: Record<string, { category: TaskCategoryWithTodos, tasks: Task[] }> = {}

    // First pass: group by category
    filtered.forEach(task => {
      const catId = task.category_id || 'uncategorized'
      if (!grouped[catId]) {
        const category = categories.find(c => c.id === catId)
        if (category) {
          grouped[catId] = { category, tasks: [] }
        } else {
          // Uncategorized fallback
          grouped[catId] = {
            category: {
              id: 'uncategorized',
              user_id: '',
              name: 'Uncategorized',
              icon: 'folder',
              color: '#64748b',
              is_recurring: false,
              order_index: 999,
              is_active: true,
              created_at: '',
              updated_at: '',
              todos: []
            },
            tasks: []
          }
        }
      }
      grouped[catId].tasks.push(task)
    })

    return Object.values(grouped).sort((a, b) => a.category.order_index - b.category.order_index)
  }

  const groupedTasks = getGroupedTasks()

  // Get priority display info
  const getPriorityInfo = (priority: string) => {
    switch (priority) {
      case 'high':
        return { label: 'URGENT', color: 'text-white', bg: 'bg-orange-500', border: '' }
      case 'medium':
        return { label: 'MEDIUM', color: 'text-orange-600', bg: 'bg-transparent', border: 'border border-orange-300' }
      default:
        return { label: 'LOW', color: 'text-blue-600', bg: 'bg-transparent', border: 'border border-blue-300' }
    }
  }

  // Format due date with time
  const formatDueDateTime = (dueDate?: string, dueTime?: string) => {
    if (!dueDate) return null

    const date = new Date(dueDate + 'T00:00:00')
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    let dateText = ''
    if (dueDate === format(today, 'yyyy-MM-dd')) {
      dateText = 'Today'
    } else if (dueDate === format(tomorrow, 'yyyy-MM-dd')) {
      dateText = 'Tomorrow'
    } else {
      dateText = format(date, 'MMM d')
    }

    if (dueTime) {
      // Format time like "5 PM" or "9:30 AM"
      const [hours, minutes] = dueTime.split(':').map(Number)
      const period = hours >= 12 ? 'PM' : 'AM'
      const hour12 = hours % 12 || 12
      const timeText = minutes === 0 ? `${hour12} ${period}` : `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`
      return `${dateText}, ${timeText}`
    }

    return dateText
  }

  // Get category color styles
  const getCategoryStyles = (category: TaskCategoryWithTodos) => {
    const colors: Record<string, { headerBg: string, headerBorder: string, headerText: string }> = {
      '#ef4444': { headerBg: 'bg-red-50/40', headerBorder: 'border-red-100/50', headerText: 'text-red-800' },
      '#f97316': { headerBg: 'bg-orange-50/40', headerBorder: 'border-orange-100/50', headerText: 'text-orange-800' },
      '#f59e0b': { headerBg: 'bg-amber-50/40', headerBorder: 'border-amber-100/50', headerText: 'text-amber-800' },
      '#84cc16': { headerBg: 'bg-lime-50/40', headerBorder: 'border-lime-100/50', headerText: 'text-lime-800' },
      '#22c55e': { headerBg: 'bg-green-50/40', headerBorder: 'border-green-100/50', headerText: 'text-green-800' },
      '#10b981': { headerBg: 'bg-emerald-50/40', headerBorder: 'border-emerald-100/50', headerText: 'text-emerald-800' },
      '#06b6d4': { headerBg: 'bg-cyan-50/40', headerBorder: 'border-cyan-100/50', headerText: 'text-cyan-800' },
      '#3b82f6': { headerBg: 'bg-blue-50/40', headerBorder: 'border-blue-100/50', headerText: 'text-blue-800' },
      '#6366f1': { headerBg: 'bg-indigo-50/40', headerBorder: 'border-indigo-100/50', headerText: 'text-indigo-800' },
      '#8b5cf6': { headerBg: 'bg-violet-50/40', headerBorder: 'border-violet-100/50', headerText: 'text-violet-800' },
      '#a855f7': { headerBg: 'bg-purple-50/40', headerBorder: 'border-purple-100/50', headerText: 'text-purple-800' },
      '#ec4899': { headerBg: 'bg-pink-50/40', headerBorder: 'border-pink-100/50', headerText: 'text-pink-800' },
      '#64748b': { headerBg: 'bg-slate-50/40', headerBorder: 'border-slate-100/50', headerText: 'text-slate-800' },
    }
    return colors[category.color] || colors['#64748b']
  }

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
    <div className="flex h-full overflow-hidden bg-slate-50">
      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <header className="shrink-0 bg-white border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Title & Badges */}
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-slate-900">My Tasks</h1>
              {dueTodayCount > 0 && (
                <span className="px-2.5 py-1 bg-cyan-50 text-cyan-700 rounded-full text-xs font-semibold">
                  {dueTodayCount} Due Today
                </span>
              )}
              {overdueCount > 0 && (
                <span className="px-2.5 py-1 bg-red-50 text-red-600 rounded-full text-xs font-semibold">
                  {overdueCount} Overdue
                </span>
              )}
            </div>

            {/* Search Bar */}
            <div className="flex-1 max-w-md">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-16 py-2 bg-slate-100 border-0 rounded-lg text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-cyan-200 focus:bg-white transition-all outline-none"
                />
                <kbd className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 bg-white rounded border border-slate-200 text-[10px] font-medium text-slate-400 shadow-sm">
                  ⌘K
                </kbd>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => openCategoryModal()}
                className="flex items-center gap-1.5 px-3 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">create_new_folder</span>
                New Folder
              </button>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-1">
            <button
              onClick={() => {
                const newFilter = activeFilter === 'high' ? null : 'high'
                setActiveFilter(newFilter)
                // Expand all categories when filtering by high priority
                if (newFilter === 'high') {
                  setExpandedCategories(new Set(categories.map(c => c.id)))
                }
              }}
              className={cn(
                "shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors",
                activeFilter === 'high'
                  ? "bg-orange-100 text-orange-700"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              <span className="material-symbols-outlined text-[14px]">priority_high</span>
              High Priority
            </button>
            {categories.filter(c => c.id !== 'uncategorized').map(cat => (
              <button
                key={cat.id}
                onClick={() => {
                  const newFilter = activeFilter === cat.id ? null : cat.id
                  setActiveFilter(newFilter)
                  // Expand the selected category when filtering
                  if (newFilter) {
                    setExpandedCategories(prev => new Set([...prev, newFilter]))
                  }
                }}
                className={cn(
                  "shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors",
                  activeFilter === cat.id
                    ? "text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
                style={activeFilter === cat.id ? { backgroundColor: cat.color } : {}}
              >
                <span className="material-symbols-outlined text-[14px]">{cat.icon}</span>
                {cat.name}
              </button>
            ))}
            <button
              onClick={() => openCategoryModal()}
              className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors border border-dashed border-slate-300"
            >
              <span className="material-symbols-outlined text-[14px]">add</span>
              New Folder
            </button>
          </div>
        </header>

        {/* Add Task Bar */}
        <div className="shrink-0 bg-white border-b border-slate-200 px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-slate-400 text-[20px]">add_circle</span>
            <input
              type="text"
              placeholder="Add a new task..."
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={handleAddTask}
              disabled={isSaving}
              className="flex-1 border-0 p-0 text-sm placeholder:text-slate-400 focus:ring-0 outline-none disabled:opacity-50"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => setNewTaskDueDate(format(new Date(), 'yyyy-MM-dd'))}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  newTaskDueDate === format(new Date(), 'yyyy-MM-dd')
                    ? "bg-cyan-50 text-cyan-600"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                <span className="material-symbols-outlined text-[14px]">today</span>
                Today
              </button>
              <button
                onClick={() => setNewTaskPriority(newTaskPriority === 'high' ? 'medium' : 'high')}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  newTaskPriority === 'high'
                    ? "bg-red-50 text-red-600"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                <span className="material-symbols-outlined text-[14px]">flag</span>
                Priority
              </button>
              <select
                value={newTaskCategoryId || ''}
                onChange={(e) => setNewTaskCategoryId(e.target.value || null)}
                className="text-xs bg-slate-100 border-0 rounded-lg px-2.5 py-1.5 text-slate-600 focus:ring-2 focus:ring-cyan-200"
              >
                <option value="">No folder</option>
                {categories.filter(c => c.id !== 'uncategorized').map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Tabs & Sort */}
        <div className="shrink-0 bg-white border-b border-slate-200 px-6 py-2 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('all')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                activeTab === 'all'
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              )}
            >
              All Tasks
            </button>
            <button
              onClick={() => setActiveTab('today')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                activeTab === 'today'
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              )}
            >
              My Day
            </button>
            <button
              onClick={() => setActiveTab('recurring')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                activeTab === 'recurring'
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              )}
            >
              Recurring
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Sort by</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'priority' | 'dueDate' | 'name')}
              className="text-xs bg-transparent border-0 text-slate-600 font-medium focus:ring-0 cursor-pointer"
            >
              <option value="priority">Priority</option>
              <option value="dueDate">Due Date</option>
              <option value="name">Name</option>
            </select>
          </div>
        </div>

        {/* Demo Banner */}
        {isDemo && (
          <div className="shrink-0 bg-amber-50 border-b border-amber-200 px-6 py-2 text-amber-800 text-xs">
            <span className="font-medium">Demo Mode:</span> Changes are not saved. Create an account to save your tasks.
          </div>
        )}

        {/* Task List */}
        <div className="flex-1 overflow-y-auto bg-white">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm text-slate-500">Loading tasks...</p>
              </div>
            </div>
          ) : groupedTasks.length > 0 ? (
            <div>
              {/* Category Groups */}
              {groupedTasks.map(({ category, tasks }) => {
                const isExpanded = expandedCategories.has(category.id)
                const styles = getCategoryStyles(category)

                return (
                  <div key={category.id} className="border-b border-slate-100">
                    {/* Category Header */}
                    <button
                      onClick={() => toggleCategoryExpand(category.id)}
                      className="w-full px-4 py-2.5 flex items-center gap-2 hover:bg-slate-50 transition-colors"
                      style={{ borderLeft: `3px solid ${category.color}` }}
                    >
                      <span className={cn("material-symbols-outlined text-[18px] text-slate-400 transition-transform", !isExpanded && "-rotate-90")}>
                        {isExpanded ? 'expand_more' : 'chevron_right'}
                      </span>
                      <span className={cn("text-xs font-bold uppercase tracking-wide", styles.headerText)}>
                        {category.name} ({tasks.length})
                      </span>
                      {category.is_recurring && (
                        <span className="material-symbols-outlined text-[14px] text-slate-400">repeat</span>
                      )}
                    </button>

                    {/* Tasks */}
                    {isExpanded && (
                      <div className="divide-y divide-slate-100">
                        {tasks.map(task => {
                          const priorityInfo = getPriorityInfo(task.priority)
                          const isSelected = selectedTask?.id === task.id
                          const isOverdue = task.dueDate && task.dueDate < dateStr
                          const dueDateTimeText = formatDueDateTime(task.dueDate, task.dueTime)

                          return (
                            <div
                              key={task.id}
                              onClick={() => setSelectedTask(task)}
                              className={cn(
                                "group flex items-center gap-4 px-4 py-3 cursor-pointer transition-colors",
                                isSelected ? "bg-cyan-50/50" : "hover:bg-slate-50"
                              )}
                            >
                              {/* Checkbox */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleToggleComplete(task.id)
                                }}
                                className={cn(
                                  "shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                                  task.completed
                                    ? "bg-emerald-500 border-emerald-500 text-white"
                                    : "border-slate-300 hover:border-cyan-500"
                                )}
                              >
                                {task.completed && (
                                  <span className="material-symbols-outlined text-[14px]">check</span>
                                )}
                              </button>

                              {/* Task Content */}
                              <div className="flex-1 min-w-0">
                                <div className={cn(
                                  "text-sm font-medium",
                                  task.completed ? "text-slate-400 line-through" : "text-slate-800"
                                )}>
                                  {linkifyText(task.title)}
                                </div>
                                {task.notes && (
                                  <div className="text-xs text-slate-400 truncate mt-0.5">
                                    {task.notes.length > 50 ? task.notes.substring(0, 50) + '...' : task.notes}
                                  </div>
                                )}
                              </div>

                              {/* Category Badge */}
                              <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 rounded-full border border-slate-200">
                                <span
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: category.color }}
                                ></span>
                                <span className="text-xs font-medium text-slate-600">{category.name}</span>
                              </div>

                              {/* Priority Badge */}
                              {!task.completed && (
                                <span className={cn(
                                  "shrink-0 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wide",
                                  priorityInfo.bg,
                                  priorityInfo.color,
                                  priorityInfo.border
                                )}>
                                  {priorityInfo.label}
                                </span>
                              )}

                              {/* Due Date/Time */}
                              <div className={cn(
                                "shrink-0 text-sm font-medium min-w-[100px] text-right",
                                isOverdue ? "text-red-500" : task.completed ? "text-slate-400" : "text-slate-600"
                              )}>
                                {dueDateTimeText || (task.dueTime ? task.dueTime : '—')}
                              </div>

                              {/* Hover Actions */}
                              <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {researchEnabled && !task.completed && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleTriggerResearch(task)
                                    }}
                                    disabled={isResearching === task.id}
                                    className="p-1.5 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors"
                                    title="Research"
                                  >
                                    {isResearching === task.id ? (
                                      <div className="w-4 h-4 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                      <span className="material-symbols-outlined text-[18px]">science</span>
                                    )}
                                  </button>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDeleteTask(task.id)
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Delete"
                                >
                                  <span className="material-symbols-outlined text-[18px]">delete</span>
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <span className="material-symbols-outlined text-6xl text-slate-300 mb-4 block">task_alt</span>
                <h3 className="text-lg font-bold text-slate-900 mb-2">No tasks found</h3>
                <p className="text-sm text-slate-500">
                  {searchQuery ? 'Try a different search term' : 'Add your first task using the input above'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Task Details Sidebar - Only shows when a task is selected */}
      {selectedTask && (
        <aside className="w-80 lg:w-96 shrink-0 bg-white border-l border-slate-200 flex flex-col h-full overflow-hidden transition-all duration-300 animate-in slide-in-from-right-4">
            {/* Sidebar Header */}
            <div className="shrink-0 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Task Details</span>
              <button
                onClick={() => setSelectedTask(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Sidebar Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="flex flex-col gap-6">
                {/* Task Title */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleComplete(selectedTask.id)}
                      className={cn(
                        "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors shrink-0",
                        selectedTask.completed
                          ? "bg-cyan-600 border-cyan-600 text-white"
                          : "border-slate-300 hover:border-cyan-600"
                      )}
                    >
                      {selectedTask.completed && (
                        <span className="material-symbols-outlined text-[14px]">check</span>
                      )}
                    </button>
                    <span className="text-sm text-slate-500">Mark as complete</span>
                  </div>
                  <textarea
                    className="w-full bg-transparent border-0 p-0 text-lg font-bold text-slate-900 focus:ring-0 resize-none outline-none leading-tight"
                    placeholder="Task title"
                    rows={2}
                    value={selectedTask.title}
                    onChange={(e) => handleUpdateTask(selectedTask.id, { title: e.target.value })}
                  />
                </div>

                {/* Research Button */}
                {researchEnabled && !selectedTask.completed && (
                  <button
                    onClick={() => handleTriggerResearch(selectedTask)}
                    disabled={isResearching === selectedTask.id || isDemo}
                    className={cn(
                      "flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-semibold text-sm transition-all",
                      isResearching === selectedTask.id
                        ? "bg-cyan-100 text-cyan-600 cursor-wait"
                        : "bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-600 hover:to-blue-600 shadow-md hover:shadow-lg"
                    )}
                  >
                    {isResearching === selectedTask.id ? (
                      <>
                        <div className="w-4 h-4 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin"></div>
                        Starting...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[18px]">science</span>
                        Research This Task
                      </>
                    )}
                  </button>
                )}

                {/* Due Date */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Due Date</label>
                  <input
                    type="date"
                    value={selectedTask.dueDate || ''}
                    onChange={(e) => handleUpdateTask(selectedTask.id, { dueDate: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:ring-2 focus:ring-cyan-200 focus:border-cyan-400 outline-none"
                    disabled={isDemo}
                  />
                </div>

                {/* Priority */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Priority</label>
                  <div className="flex gap-2">
                    {(['high', 'medium', 'low'] as const).map(p => {
                      const info = getPriorityInfo(p)
                      const isActive = selectedTask.priority === p
                      return (
                        <button
                          key={p}
                          onClick={() => handleUpdateTask(selectedTask.id, { priority: p })}
                          className={cn(
                            "flex-1 py-2 text-[10px] font-bold uppercase tracking-wide rounded-lg transition-all",
                            isActive
                              ? cn(info.bg, info.color, info.border, "ring-2 ring-offset-1", p === 'high' ? "ring-orange-300" : p === 'medium' ? "ring-orange-200" : "ring-blue-200")
                              : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                          )}
                        >
                          {info.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Project */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Project</label>
                  <select
                    value={selectedTask.category_id || ''}
                    onChange={(e) => handleMoveToCategory(selectedTask.id, e.target.value || null)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:ring-2 focus:ring-cyan-200 focus:border-cyan-400 outline-none appearance-none cursor-pointer"
                    disabled={isDemo}
                  >
                    <option value="">Uncategorized</option>
                    {categories.filter(c => c.id !== 'uncategorized').map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                {/* Tags */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Tags</label>
                  <div className="flex flex-wrap gap-2">
                    {selectedTask.priority === 'high' && (
                      <span className="px-2 py-1 bg-red-50 text-red-600 rounded-md text-xs font-medium">urgent</span>
                    )}
                    {categories.find(c => c.id === selectedTask.category_id)?.is_recurring && (
                      <span className="px-2 py-1 bg-purple-50 text-purple-600 rounded-md text-xs font-medium">recurring</span>
                    )}
                    <button className="px-2 py-1 bg-slate-100 text-slate-500 rounded-md text-xs font-medium hover:bg-slate-200 transition-colors">
                      + Add tag
                    </button>
                  </div>
                </div>

                {/* Description */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Description</label>
                  <textarea
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:ring-2 focus:ring-cyan-200 focus:border-cyan-400 resize-none outline-none leading-relaxed"
                    placeholder="Add a description..."
                    rows={4}
                    value={selectedTask.notes || ''}
                    onChange={(e) => handleUpdateTask(selectedTask.id, { notes: e.target.value })}
                  />
                </div>

                {/* Subtasks Preview */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Subtasks</label>
                    <span className="text-xs text-slate-400">0/0</span>
                  </div>
                  <button className="w-full py-2.5 text-sm text-slate-500 bg-slate-50 border border-dashed border-slate-200 rounded-xl hover:bg-slate-100 hover:text-slate-700 transition-colors">
                    + Add subtask
                  </button>
                </div>

                {/* Linked Notes */}
                <LinkedNotesPanel
                  taskId={selectedTask.id}
                  onNoteClick={(noteId) => router.push(`/notes?note=${noteId}`)}
                  isDemo={isDemo}
                />
              </div>
            </div>

            {/* Sidebar Footer */}
            <div className="shrink-0 px-6 py-4 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Created {selectedTask.dueDate ? format(new Date(selectedTask.dueDate), 'MMM d, yyyy') : 'Today'}
              </span>
              <button
                onClick={() => handleDeleteTask(selectedTask.id)}
                className="flex items-center gap-1 px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg text-xs font-medium transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
                Delete
              </button>
            </div>
        </aside>
      )}

      {/* Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div
            ref={categoryModalRef}
            className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl"
          >
            <h3 className="text-lg font-bold text-slate-900 mb-4">
              {editingCategory ? 'Edit Folder' : 'New Folder'}
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
                  placeholder="Folder name"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
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
                  Daily recurring tasks
                </label>
              </div>

              {/* Research Automation */}
              {researchEnabled && (
                <div className="border-t border-slate-200 pt-4 mt-2">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="material-symbols-outlined text-cyan-600 text-[20px]">science</span>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                      Research Automation
                    </span>
                  </div>

                  <div className="flex items-center gap-3 mb-4">
                    <input
                      type="checkbox"
                      id="enableAutomation"
                      checked={enableAutomation}
                      onChange={(e) => setEnableAutomation(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                    />
                    <label htmlFor="enableAutomation" className="text-sm text-slate-700">
                      Auto-research new tasks
                    </label>
                  </div>

                  {enableAutomation && (
                    <div className="space-y-3 pl-7 border-l-2 border-cyan-100">
                      <div>
                        <label className="text-xs font-medium text-slate-600 mb-1 block">
                          Research Depth
                        </label>
                        <div className="flex gap-2">
                          {(['quick', 'medium', 'deep'] as const).map(depth => (
                            <button
                              key={depth}
                              type="button"
                              onClick={() => setAutomationResearchDepth(depth)}
                              className={cn(
                                'px-3 py-1.5 text-xs rounded-lg font-medium transition-colors capitalize',
                                automationResearchDepth === depth
                                  ? 'bg-cyan-100 text-cyan-700'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              )}
                            >
                              {depth}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-slate-600 mb-1 block">
                          Max Sources: {automationMaxSources}
                        </label>
                        <input
                          type="range"
                          min="3"
                          max="10"
                          value={automationMaxSources}
                          onChange={(e) => setAutomationMaxSources(Number(e.target.value))}
                          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-cyan-600"
                        />
                      </div>

                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="askClarification"
                          checked={automationAskClarification}
                          onChange={(e) => setAutomationAskClarification(e.target.checked)}
                          className="w-4 h-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                        />
                        <label htmlFor="askClarification" className="text-xs text-slate-600">
                          Ask for clarification before researching
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              )}
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
                {isSaving ? 'Saving...' : editingCategory ? 'Save Changes' : 'Create Folder'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
