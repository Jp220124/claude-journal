import { createClient } from '@/lib/supabase/client'
import type {
  TaskCategory,
  TaskCategoryInsert,
  TaskCategoryUpdate,
  Todo,
  TodoWithCategory,
  TaskCategoryWithTodos,
} from '@/types/database'

// =====================================================
// TASK CATEGORIES CRUD
// =====================================================

/**
 * Fetch all task categories for the current user
 */
export async function fetchTaskCategories(): Promise<TaskCategory[]> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('task_categories')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('order_index', { ascending: true })

  if (error) {
    console.error('Error fetching task categories:', error)
    return []
  }

  return data || []
}

/**
 * Fetch categories with their todos for today
 * Includes: today's tasks, tasks with no due date, AND incomplete past tasks (carryover)
 */
export async function fetchCategoriesWithTodos(date: string): Promise<TaskCategoryWithTodos[]> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // First get all categories
  const { data: categories, error: catError } = await supabase
    .from('task_categories')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('order_index', { ascending: true })

  if (catError) {
    console.error('Error fetching categories:', catError)
    return []
  }

  // Create a map of recurring category IDs for quick lookup
  const recurringCategoryIds = new Set(
    (categories || []).filter(cat => cat.is_recurring).map(cat => cat.id)
  )

  // Fetch todos:
  // 1. due_date = today (today's tasks)
  // 2. due_date is null (no due date tasks)
  // 3. due_date < today AND completed = false (incomplete past tasks - carryover)
  const { data: todos, error: todoError } = await supabase
    .from('todos')
    .select('*')
    .eq('user_id', user.id)
    .or(`due_date.eq.${date},due_date.is.null,and(due_date.lt.${date},completed.eq.false)`)

  if (todoError) {
    console.error('Error fetching todos:', todoError)
    return []
  }

  // Process todos: For recurring categories, check if completed_date matches today
  const processedTodos = (todos || []).map(todo => {
    // Check if this todo belongs to a recurring category
    if (todo.category_id && recurringCategoryIds.has(todo.category_id)) {
      // For recurring tasks, show as incomplete if completed_date != today
      const isCompletedToday = todo.completed_date === date
      return {
        ...todo,
        completed: isCompletedToday
      }
    }
    return todo
  })

  // Group todos by category
  const result: TaskCategoryWithTodos[] = categories?.map(cat => ({
    ...cat,
    todos: processedTodos.filter(todo => todo.category_id === cat.id)
  })) || []

  // Add uncategorized todos - ALWAYS show this section
  const uncategorizedTodos = processedTodos.filter(todo => !todo.category_id)
  result.push({
    id: 'uncategorized',
    user_id: user.id,
    name: 'Uncategorized',
    icon: 'inbox',
    color: '#64748b',
    is_recurring: false,
    order_index: 999,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    todos: uncategorizedTodos,
  })

  return result
}

/**
 * Create a new task category
 */
export async function createTaskCategory(
  category: Omit<TaskCategoryInsert, 'user_id'>
): Promise<TaskCategory | null> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    console.error('No authenticated user')
    return null
  }

  const { data, error } = await supabase
    .from('task_categories')
    .insert({
      ...category,
      user_id: user.id,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating task category:', error)
    return null
  }

  return data
}

/**
 * Update a task category
 */
export async function updateTaskCategory(
  id: string,
  updates: TaskCategoryUpdate
): Promise<TaskCategory | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('task_categories')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating task category:', error)
    return null
  }

  return data
}

/**
 * Delete (archive) a task category
 */
export async function archiveTaskCategory(id: string): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase
    .from('task_categories')
    .update({ is_active: false })
    .eq('id', id)

  if (error) {
    console.error('Error archiving task category:', error)
    return false
  }

  return true
}

/**
 * Reorder categories
 */
export async function reorderCategories(categoryIds: string[]): Promise<boolean> {
  const supabase = createClient()

  const updates = categoryIds.map((id, index) =>
    supabase
      .from('task_categories')
      .update({ order_index: index })
      .eq('id', id)
  )

  const results = await Promise.all(updates)
  const hasError = results.some(result => result.error)

  if (hasError) {
    console.error('Error reordering categories')
    return false
  }

  return true
}

/**
 * Check if user has any categories
 */
export async function hasTaskCategories(): Promise<boolean> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { count, error } = await supabase
    .from('task_categories')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_active', true)

  if (error) {
    console.error('Error checking categories:', error)
    return false
  }

  return (count || 0) > 0
}

/**
 * Create starter categories for a new user
 */
export async function createStarterCategories(): Promise<boolean> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { error } = await supabase.rpc('create_starter_task_categories', {
    p_user_id: user.id
  })

  if (error) {
    console.error('Error creating starter categories:', error)
    return false
  }

  return true
}

// =====================================================
// TODO CRUD WITH CATEGORY SUPPORT
// =====================================================

/**
 * Create a new todo with optional category
 */
export async function createTodo(todo: {
  title: string
  priority?: 'low' | 'medium' | 'high'
  due_date?: string | null
  due_time?: string | null
  category_id?: string | null
  notes?: string | null
}): Promise<Todo | null> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('todos')
    .insert({
      ...todo,
      user_id: user.id,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating todo:', error)
    return null
  }

  return data
}

/**
 * Update a todo
 */
export async function updateTodo(
  id: string,
  updates: Partial<Todo>
): Promise<Todo | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('todos')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating todo:', error)
    return null
  }

  return data
}

/**
 * Toggle todo completion
 * For recurring category tasks, also sets completed_date to track daily completion
 */
export async function toggleTodoComplete(
  id: string,
  completed: boolean,
  isRecurringCategory: boolean = false
): Promise<boolean> {
  const supabase = createClient()

  // For recurring category tasks, we set completed_date to today when completing
  // This allows the task to appear incomplete again tomorrow
  const today = new Date().toISOString().split('T')[0]

  const updateData: { completed: boolean; completed_date?: string | null } = { completed }

  if (isRecurringCategory) {
    // For recurring tasks: set completed_date to today when completing, null when uncompleting
    updateData.completed_date = completed ? today : null
  }

  const { error } = await supabase
    .from('todos')
    .update(updateData)
    .eq('id', id)

  if (error) {
    console.error('Error toggling todo:', error)
    return false
  }

  return true
}

/**
 * Delete a todo
 */
export async function deleteTodo(id: string): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase
    .from('todos')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting todo:', error)
    return false
  }

  return true
}

/**
 * Fetch todos for a specific date (includes tasks with NULL due_date as they're recurring)
 */
export async function fetchTodosForDate(date: string): Promise<Todo[]> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('todos')
    .select('*')
    .eq('user_id', user.id)
    .or(`due_date.eq.${date},due_date.is.null`)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching todos:', error)
    return []
  }

  return data || []
}

/**
 * Fetch todos for a date range (for calendar view)
 * Also includes todos with NULL due_date (recurring tasks)
 */
export async function fetchTodosForRange(
  startDate: string,
  endDate: string
): Promise<Todo[]> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // Fetch todos in date range OR with null due_date (recurring)
  const { data, error } = await supabase
    .from('todos')
    .select('*')
    .eq('user_id', user.id)
    .or(`and(due_date.gte.${startDate},due_date.lte.${endDate}),due_date.is.null`)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching todos for range:', error)
    return []
  }

  return data || []
}

/**
 * Move todo to a different category
 */
export async function moveTodoToCategory(todoId: string, categoryId: string | null): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase
    .from('todos')
    .update({ category_id: categoryId })
    .eq('id', todoId)

  if (error) {
    console.error('Error moving todo:', error)
    return false
  }

  return true
}
