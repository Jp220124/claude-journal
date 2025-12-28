import { createClient } from '@/lib/supabase/client'
import type {
  TimeBlock,
  TimeBlockInsert,
  TimeBlockUpdate,
  TimeBlockWithTodo,
  ScheduleSettings,
  ScheduleSettingsInsert,
  ScheduleSettingsUpdate,
  DEFAULT_SCHEDULE_SETTINGS,
} from '@/types/schedule'
import { format, startOfDay, endOfDay, parseISO } from 'date-fns'

// =====================================================
// Time Block Operations
// =====================================================

/**
 * Fetch all time blocks for a specific date
 */
export async function fetchTimeBlocksByDate(date: Date): Promise<TimeBlockWithTodo[]> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const dayStart = startOfDay(date).toISOString()
  const dayEnd = endOfDay(date).toISOString()

  const { data, error } = await supabase
    .from('time_blocks')
    .select(`
      *,
      todo:todos(*)
    `)
    .eq('user_id', user.id)
    .gte('start_time', dayStart)
    .lt('start_time', dayEnd)
    .order('start_time', { ascending: true })

  if (error) {
    console.error('Error fetching time blocks:', error)
    return []
  }

  return data || []
}

/**
 * Fetch time blocks for a date range (for week view)
 */
export async function fetchTimeBlocksByRange(
  startDate: Date,
  endDate: Date
): Promise<TimeBlockWithTodo[]> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('time_blocks')
    .select(`
      *,
      todo:todos(*)
    `)
    .eq('user_id', user.id)
    .gte('start_time', startOfDay(startDate).toISOString())
    .lt('start_time', endOfDay(endDate).toISOString())
    .order('start_time', { ascending: true })

  if (error) {
    console.error('Error fetching time blocks:', error)
    return []
  }

  return data || []
}

/**
 * Create a new time block
 */
export async function createTimeBlock(block: TimeBlockInsert): Promise<TimeBlock | null> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    console.error('No authenticated user')
    return null
  }

  const { data, error } = await supabase
    .from('time_blocks')
    .insert({
      user_id: user.id,
      todo_id: block.todo_id ?? null,
      title: block.title,
      description: block.description ?? null,
      start_time: block.start_time,
      end_time: block.end_time,
      color: block.color ?? '#06b6d4',
      is_recurring: block.is_recurring ?? false,
      recurrence_pattern: block.recurrence_pattern ?? null,
      buffer_minutes: block.buffer_minutes ?? 0,
      block_type: block.block_type ?? 'task',
      energy_level: block.energy_level ?? null,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating time block:', JSON.stringify(error, null, 2))
    console.error('Error details - code:', error.code, 'message:', error.message, 'details:', error.details, 'hint:', error.hint)
    return null
  }

  return data
}

/**
 * Update a time block
 */
export async function updateTimeBlock(
  id: string,
  updates: TimeBlockUpdate
): Promise<TimeBlock | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('time_blocks')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating time block:', error)
    return null
  }

  return data
}

/**
 * Mark a time block as completed
 */
export async function completeTimeBlock(id: string): Promise<TimeBlock | null> {
  return updateTimeBlock(id, { completed_at: new Date().toISOString() })
}

/**
 * Uncomplete a time block
 */
export async function uncompleteTimeBlock(id: string): Promise<TimeBlock | null> {
  return updateTimeBlock(id, { completed_at: null })
}

/**
 * Delete a time block
 */
export async function deleteTimeBlock(id: string): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase
    .from('time_blocks')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting time block:', error)
    return false
  }

  return true
}

/**
 * Create a time block from a todo
 */
export async function createBlockFromTodo(
  todoId: string,
  todoTitle: string,
  startTime: Date,
  durationMinutes: number = 60
): Promise<TimeBlock | null> {
  const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000)

  return createTimeBlock({
    todo_id: todoId,
    title: todoTitle,
    start_time: startTime.toISOString(),
    end_time: endTime.toISOString(),
    block_type: 'task',
  })
}

/**
 * Create a recurring daily time block template and generate instances
 * Uses Template + Instance model: creates a template and 30 days of instances
 *
 * Note: This uses only the columns that exist in the base time_blocks table
 * to ensure compatibility even if the full recurring migration hasn't been applied.
 */
export async function createRecurringTimeBlock(
  block: TimeBlockInsert & { reminderMinutes?: number }
): Promise<{ success: boolean; template?: TimeBlock; instanceCount?: number; error?: string }> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'No authenticated user' }
  }

  // Parse time from the start_time to get hours/minutes
  const startDateTime = new Date(block.start_time)
  const endDateTime = new Date(block.end_time)
  const durationMs = endDateTime.getTime() - startDateTime.getTime()

  const hours = startDateTime.getHours()
  const minutes = startDateTime.getMinutes()

  // Generate 30 days of instances (without template model for simpler compatibility)
  // Each instance is a separate recurring block
  const instances = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let i = 0; i < 30; i++) {
    const instanceDate = new Date(today)
    instanceDate.setDate(instanceDate.getDate() + i)

    const instanceStart = new Date(instanceDate)
    instanceStart.setHours(hours, minutes, 0, 0)

    const instanceEnd = new Date(instanceStart.getTime() + durationMs)

    instances.push({
      user_id: user.id,
      title: block.title,
      description: block.description ?? null,
      start_time: instanceStart.toISOString(),
      end_time: instanceEnd.toISOString(),
      color: block.color ?? '#06b6d4',
      is_recurring: true,
      recurrence_pattern: { frequency: 'daily', interval: 1 },
      block_type: block.block_type ?? 'task',
      // Explicitly set to 0 to skip the reminder trigger until user_integrations table exists
      reminder_minutes_before: 0,
    })
  }

  const { data, error: instancesError } = await supabase
    .from('time_blocks')
    .insert(instances)
    .select()

  if (instancesError) {
    console.error('Error creating recurring instances:', instancesError)
    return { success: false, error: instancesError.message }
  }

  return {
    success: true,
    instanceCount: instances.length,
  }
}

/**
 * Delete a recurring time block template and all its instances
 */
export async function deleteRecurringTimeBlock(templateId: string): Promise<boolean> {
  const supabase = createClient()

  // Delete all instances first
  const { error: instancesError } = await supabase
    .from('time_blocks')
    .delete()
    .eq('parent_block_id', templateId)

  if (instancesError) {
    console.error('Error deleting recurring instances:', instancesError)
    return false
  }

  // Delete the template
  const { error: templateError } = await supabase
    .from('time_blocks')
    .delete()
    .eq('id', templateId)

  if (templateError) {
    console.error('Error deleting recurring template:', templateError)
    return false
  }

  return true
}

// =====================================================
// Schedule Settings Operations
// =====================================================

/**
 * Fetch user's schedule settings
 */
export async function fetchScheduleSettings(): Promise<ScheduleSettings | null> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('schedule_settings')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    console.error('Error fetching schedule settings:', error)
    return null
  }

  // No settings found, return null (will use defaults)

  return data
}

/**
 * Create or update schedule settings
 */
export async function upsertScheduleSettings(
  settings: ScheduleSettingsInsert | ScheduleSettingsUpdate
): Promise<ScheduleSettings | null> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    console.error('No authenticated user')
    return null
  }

  const { data, error } = await supabase
    .from('schedule_settings')
    .upsert({
      user_id: user.id,
      ...settings,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id',
    })
    .select()
    .single()

  if (error) {
    console.error('Error upserting schedule settings:', error)
    return null
  }

  return data
}

// =====================================================
// Daily Plan Operations
// =====================================================

export interface DailyPlan {
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

/**
 * Fetch daily plan for a specific date
 */
export async function fetchDailyPlan(date: Date): Promise<DailyPlan | null> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const dateStr = format(date, 'yyyy-MM-dd')

  const { data, error } = await supabase
    .from('daily_plans')
    .select('*')
    .eq('user_id', user.id)
    .eq('date', dateStr)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // No plan found for this date
      return null
    }
    console.error('Error fetching daily plan:', error)
    return null
  }

  return data
}

/**
 * Create or update daily plan
 */
export async function upsertDailyPlan(
  date: Date,
  updates: {
    top_priorities?: string[]
    intention?: string | null
    reflection?: string | null
    is_completed?: boolean
  }
): Promise<DailyPlan | null> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    console.error('No authenticated user')
    return null
  }

  const dateStr = format(date, 'yyyy-MM-dd')

  const { data, error } = await supabase
    .from('daily_plans')
    .upsert({
      user_id: user.id,
      date: dateStr,
      ...updates,
      completed_at: updates.is_completed ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,date',
    })
    .select()
    .single()

  if (error) {
    console.error('Error upserting daily plan:', error)
    return null
  }

  return data
}

// =====================================================
// Pomodoro Session Operations
// =====================================================

export interface PomodoroSession {
  id: string
  user_id: string
  time_block_id: string | null
  started_at: string
  ended_at: string | null
  phase: 'work' | 'break' | 'longBreak'
  duration_seconds: number
  was_completed: boolean
  created_at: string
}

/**
 * Create a pomodoro session
 */
export async function createPomodoroSession(
  phase: 'work' | 'break' | 'longBreak',
  durationSeconds: number,
  timeBlockId?: string
): Promise<PomodoroSession | null> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    console.error('No authenticated user')
    return null
  }

  const { data, error } = await supabase
    .from('pomodoro_sessions')
    .insert({
      user_id: user.id,
      time_block_id: timeBlockId ?? null,
      phase,
      duration_seconds: durationSeconds,
      started_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating pomodoro session:', error)
    return null
  }

  return data
}

/**
 * Complete a pomodoro session
 */
export async function completePomodoroSession(
  id: string,
  wasCompleted: boolean = true
): Promise<PomodoroSession | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('pomodoro_sessions')
    .update({
      ended_at: new Date().toISOString(),
      was_completed: wasCompleted,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error completing pomodoro session:', error)
    return null
  }

  return data
}

/**
 * Fetch pomodoro sessions for today
 */
export async function fetchTodaysPomodoroSessions(): Promise<PomodoroSession[]> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const today = startOfDay(new Date()).toISOString()

  const { data, error } = await supabase
    .from('pomodoro_sessions')
    .select('*')
    .eq('user_id', user.id)
    .gte('started_at', today)
    .order('started_at', { ascending: true })

  if (error) {
    console.error('Error fetching pomodoro sessions:', error)
    return []
  }

  return data || []
}

// =====================================================
// Helper Functions
// =====================================================

/**
 * Check for overlapping time blocks
 */
export async function checkBlockOverlap(
  startTime: Date,
  endTime: Date,
  excludeBlockId?: string
): Promise<TimeBlock[]> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  let query = supabase
    .from('time_blocks')
    .select('*')
    .eq('user_id', user.id)
    .lt('start_time', endTime.toISOString())
    .gt('end_time', startTime.toISOString())

  if (excludeBlockId) {
    query = query.neq('id', excludeBlockId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error checking block overlap:', error)
    return []
  }

  return data || []
}

/**
 * Get today's schedule summary
 */
export async function getTodaysScheduleSummary(): Promise<{
  totalBlocks: number
  completedBlocks: number
  totalMinutes: number
  focusMinutes: number
}> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { totalBlocks: 0, completedBlocks: 0, totalMinutes: 0, focusMinutes: 0 }
  }

  const today = new Date()
  const blocks = await fetchTimeBlocksByDate(today)

  let totalMinutes = 0
  let focusMinutes = 0

  blocks.forEach((block) => {
    const start = parseISO(block.start_time)
    const end = parseISO(block.end_time)
    const duration = (end.getTime() - start.getTime()) / (1000 * 60)
    totalMinutes += duration
    if (block.block_type === 'focus' || block.block_type === 'task') {
      focusMinutes += duration
    }
  })

  return {
    totalBlocks: blocks.length,
    completedBlocks: blocks.filter((b) => b.completed_at).length,
    totalMinutes,
    focusMinutes,
  }
}
