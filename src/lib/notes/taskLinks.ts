import { createClient } from '@/lib/supabase/client'
import type { TaskNoteLink, Todo, Note } from '@/types/database'

// =====================================================
// Task-Note Linking Operations
// =====================================================

export interface LinkedTask extends Todo {
  link_type: string
  linked_at: string
}

export interface LinkedNote extends Note {
  link_type: string
  linked_at: string
}

/**
 * Link a task to a note
 */
export async function linkTaskToNote(
  taskId: string,
  noteId: string,
  linkType: 'reference' | 'checklist' | 'attachment' = 'reference'
): Promise<TaskNoteLink | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('task_note_links')
    .insert({
      task_id: taskId,
      note_id: noteId,
      link_type: linkType,
    })
    .select()
    .single()

  if (error) {
    // Ignore duplicate key errors
    if (error.code === '23505') {
      console.log('Task-note link already exists')
      return null
    }
    console.error('Error linking task to note:', error)
    return null
  }

  return data
}

/**
 * Unlink a task from a note
 */
export async function unlinkTaskFromNote(
  taskId: string,
  noteId: string
): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase
    .from('task_note_links')
    .delete()
    .eq('task_id', taskId)
    .eq('note_id', noteId)

  if (error) {
    console.error('Error unlinking task from note:', error)
    return false
  }

  return true
}

/**
 * Get all tasks linked to a note
 */
export async function getLinkedTasks(noteId: string): Promise<LinkedTask[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('task_note_links')
    .select(`
      task_id,
      link_type,
      created_at,
      todos (*)
    `)
    .eq('note_id', noteId)

  if (error) {
    console.error('Error fetching linked tasks:', error)
    return []
  }

  // Transform the data to include link info with task
  return (data || [])
    .filter(d => d.todos)
    .map(d => ({
      ...(d.todos as unknown as Todo),
      link_type: d.link_type,
      linked_at: d.created_at,
    }))
}

/**
 * Get all notes linked to a task
 */
export async function getLinkedNotes(taskId: string): Promise<LinkedNote[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('task_note_links')
    .select(`
      note_id,
      link_type,
      created_at,
      notes (*)
    `)
    .eq('task_id', taskId)

  if (error) {
    console.error('Error fetching linked notes:', error)
    return []
  }

  // Transform the data to include link info with note
  return (data || [])
    .filter(d => d.notes)
    .map(d => ({
      ...(d.notes as unknown as Note),
      link_type: d.link_type,
      linked_at: d.created_at,
    }))
}

/**
 * Get count of linked tasks for a note
 */
export async function getLinkedTaskCount(noteId: string): Promise<number> {
  const supabase = createClient()

  const { count, error } = await supabase
    .from('task_note_links')
    .select('*', { count: 'exact', head: true })
    .eq('note_id', noteId)

  if (error) {
    console.error('Error counting linked tasks:', error)
    return 0
  }

  return count || 0
}

/**
 * Get count of linked notes for a task
 */
export async function getLinkedNoteCount(taskId: string): Promise<number> {
  const supabase = createClient()

  const { count, error } = await supabase
    .from('task_note_links')
    .select('*', { count: 'exact', head: true })
    .eq('task_id', taskId)

  if (error) {
    console.error('Error counting linked notes:', error)
    return 0
  }

  return count || 0
}

/**
 * Search tasks by title (for task linker modal)
 */
export async function searchTasks(query: string, limit: number = 10): Promise<Todo[]> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('todos')
    .select('*')
    .eq('user_id', user.id)
    .ilike('title', `%${query}%`)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error searching tasks:', error)
    return []
  }

  return data || []
}

/**
 * Get recent tasks (for task linker modal when no search query)
 */
export async function getRecentTasks(limit: number = 10): Promise<Todo[]> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('todos')
    .select('*')
    .eq('user_id', user.id)
    .eq('completed', false)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching recent tasks:', error)
    return []
  }

  return data || []
}

/**
 * Create a new task and link it to a note
 */
export async function createTaskAndLink(
  noteId: string,
  taskTitle: string,
  linkType: 'reference' | 'checklist' | 'attachment' = 'reference'
): Promise<{ task: Todo | null; link: TaskNoteLink | null }> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { task: null, link: null }

  // Create the task
  const { data: task, error: taskError } = await supabase
    .from('todos')
    .insert({
      user_id: user.id,
      title: taskTitle,
      completed: false,
      priority: 'medium',
    })
    .select()
    .single()

  if (taskError) {
    console.error('Error creating task:', taskError)
    return { task: null, link: null }
  }

  // Link the task to the note
  const link = await linkTaskToNote(task.id, noteId, linkType)

  return { task, link }
}
