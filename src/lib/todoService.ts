import { createClient } from '@/lib/supabase/client'

export interface Todo {
  id: string
  user_id: string
  title: string
  completed: boolean
  priority: 'low' | 'medium' | 'high'
  due_date: string | null
  due_time: string | null
  category: string | null
  category_id: string | null
  recurrence: string | null
  notes: string | null
  completed_date: string | null
  order_index: number
  created_at: string
  updated_at: string
}

export interface TodoInsert {
  title: string
  completed?: boolean
  priority?: 'low' | 'medium' | 'high'
  due_date?: string | null
  due_time?: string | null
  category?: string | null
  category_id?: string | null
  recurrence?: string | null
  notes?: string | null
  completed_date?: string | null
  order_index?: number
}

export interface TodoUpdate {
  title?: string
  completed?: boolean
  priority?: 'low' | 'medium' | 'high'
  due_date?: string | null
  due_time?: string | null
  category?: string | null
  category_id?: string | null
  recurrence?: string | null
  notes?: string | null
  completed_date?: string | null
  order_index?: number
}

/**
 * Fetch all todos for the current user
 */
export async function fetchTodos(): Promise<Todo[]> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('todos')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching todos:', error)
    return []
  }

  return data || []
}

/**
 * Fetch todos for a specific date
 */
export async function fetchTodosByDate(date: string): Promise<Todo[]> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('todos')
    .select('*')
    .eq('user_id', user.id)
    .eq('due_date', date)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching todos by date:', error)
    return []
  }

  return data || []
}

/**
 * Fetch today's todos (due today or no due date)
 */
export async function fetchTodaysTodos(): Promise<Todo[]> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('todos')
    .select('*')
    .eq('user_id', user.id)
    .or(`due_date.eq.${today},due_date.is.null`)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching today\'s todos:', error)
    return []
  }

  return data || []
}

/**
 * Create a new todo
 */
export async function createTodo(todo: TodoInsert): Promise<Todo | null> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    console.error('No authenticated user')
    return null
  }

  const { data, error } = await supabase
    .from('todos')
    .insert({
      user_id: user.id,
      title: todo.title,
      completed: todo.completed ?? false,
      priority: todo.priority ?? 'medium',
      due_date: todo.due_date ?? null,
      due_time: todo.due_time ?? null,
      category: todo.category ?? null,
      recurrence: todo.recurrence ?? null,
      notes: todo.notes ?? null,
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
export async function updateTodo(id: string, updates: TodoUpdate): Promise<Todo | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('todos')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
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
 * Toggle todo completion status
 */
export async function toggleTodoComplete(id: string, completed: boolean): Promise<Todo | null> {
  return updateTodo(id, { completed })
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
