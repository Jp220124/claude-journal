// =====================================================
// Time Management / Schedule System Types
// =====================================================

import type { Todo } from './database'

// Block type for categorizing time blocks
export type TimeBlockType = 'task' | 'focus' | 'break' | 'meeting' | 'personal'

// Energy level for time blocks (optional tracking)
export type EnergyLevel = 'high' | 'medium' | 'low'

// Recurrence pattern for recurring blocks
export interface RecurrencePattern {
  frequency: 'daily' | 'weekly' | 'monthly'
  interval: number // e.g., every 2 weeks
  daysOfWeek?: number[] // 0-6 for Sunday-Saturday
  endDate?: string // ISO date string
  occurrences?: number // Number of occurrences
}

// =====================================================
// Time Block Types
// =====================================================

export interface TimeBlock {
  id: string
  user_id: string
  todo_id: string | null
  title: string
  description: string | null
  start_time: string // ISO datetime string
  end_time: string // ISO datetime string
  color: string
  is_recurring: boolean
  recurrence_pattern: RecurrencePattern | null
  buffer_minutes: number
  block_type: TimeBlockType
  energy_level: EnergyLevel | null
  completed_at: string | null
  created_at: string
  updated_at: string
  // Recurring block fields
  parent_block_id?: string | null
  is_template?: boolean
  instance_date?: string | null
  reminder_minutes_before?: number
  reminder_sent?: boolean
}

export interface TimeBlockInsert {
  todo_id?: string | null
  title: string
  description?: string | null
  start_time: string
  end_time: string
  color?: string
  is_recurring?: boolean
  recurrence_pattern?: RecurrencePattern | null
  buffer_minutes?: number
  block_type?: TimeBlockType
  energy_level?: EnergyLevel | null
}

export interface TimeBlockUpdate {
  todo_id?: string | null
  title?: string
  description?: string | null
  start_time?: string
  end_time?: string
  color?: string
  is_recurring?: boolean
  recurrence_pattern?: RecurrencePattern | null
  buffer_minutes?: number
  block_type?: TimeBlockType
  energy_level?: EnergyLevel | null
  completed_at?: string | null
}

// Extended type with linked todo
export interface TimeBlockWithTodo extends TimeBlock {
  todo?: Todo | null
}

// =====================================================
// Schedule Settings Types
// =====================================================

export interface ScheduleSettings {
  id: string
  user_id: string
  work_start_time: string // TIME format 'HH:MM'
  work_end_time: string
  default_block_duration: number // in minutes
  show_24_hours: boolean
  default_view: 'day' | 'week' | 'timeline'
  // Pomodoro settings
  pomodoro_work_minutes: number
  pomodoro_break_minutes: number
  pomodoro_long_break_minutes: number
  pomodoro_sessions_before_long: number
  // Planning ritual
  planning_ritual_enabled: boolean
  planning_ritual_time: string // TIME format
  // Advanced settings
  energy_tracking_enabled: boolean
  auto_schedule_enabled: boolean
  buffer_between_blocks: number // in minutes
  created_at: string
  updated_at: string
}

export interface ScheduleSettingsInsert {
  work_start_time?: string
  work_end_time?: string
  default_block_duration?: number
  show_24_hours?: boolean
  default_view?: 'day' | 'week' | 'timeline'
  pomodoro_work_minutes?: number
  pomodoro_break_minutes?: number
  pomodoro_long_break_minutes?: number
  pomodoro_sessions_before_long?: number
  planning_ritual_enabled?: boolean
  planning_ritual_time?: string
  energy_tracking_enabled?: boolean
  auto_schedule_enabled?: boolean
  buffer_between_blocks?: number
}

export interface ScheduleSettingsUpdate extends ScheduleSettingsInsert {}

// Default settings values
export const DEFAULT_SCHEDULE_SETTINGS: Omit<ScheduleSettings, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
  work_start_time: '09:00',
  work_end_time: '17:00',
  default_block_duration: 60,
  show_24_hours: true,
  default_view: 'day',
  pomodoro_work_minutes: 25,
  pomodoro_break_minutes: 5,
  pomodoro_long_break_minutes: 15,
  pomodoro_sessions_before_long: 4,
  planning_ritual_enabled: true,
  planning_ritual_time: '08:00',
  energy_tracking_enabled: false,
  auto_schedule_enabled: false,
  buffer_between_blocks: 5,
}

// =====================================================
// Pomodoro Timer Types
// =====================================================

export type PomodoroPhase = 'work' | 'break' | 'longBreak' | 'idle'

export interface PomodoroState {
  phase: PomodoroPhase
  timeRemaining: number // in seconds
  isRunning: boolean
  currentSession: number // 1-4
  totalSessionsCompleted: number
  linkedBlockId: string | null
}

export interface PomodoroSession {
  id: string
  user_id: string
  time_block_id: string | null
  started_at: string
  ended_at: string | null
  phase: PomodoroPhase
  duration_seconds: number
  was_completed: boolean
  created_at: string
}

// =====================================================
// Daily Planning Ritual Types
// =====================================================

export interface PlanningRitualStep {
  step: number
  title: string
  description: string
  icon: string
  isCompleted: boolean
}

export interface DailyPlan {
  id: string
  user_id: string
  date: string
  top_priorities: string[] // Array of todo IDs
  intention: string | null
  reflection: string | null
  is_completed: boolean
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface DailyPlanInsert {
  date: string
  top_priorities?: string[]
  intention?: string | null
  reflection?: string | null
}

// =====================================================
// UI Helper Types
// =====================================================

// For drag and drop
export interface DraggedItem {
  type: 'task' | 'block'
  id: string
  title: string
  duration?: number // in minutes
}

// Time slot for the grid
export interface TimeSlot {
  time: Date
  hour: number
  minute: number
  isHourMark: boolean
  isCurrentTime: boolean
}

// Block position for rendering
export interface BlockPosition {
  top: number // in pixels or percentage
  height: number
  left?: number // for overlapping blocks
  width?: number
}

// Block color presets
export const BLOCK_COLORS = {
  task: '#06b6d4', // cyan
  focus: '#3b82f6', // blue
  break: '#22c55e', // green
  meeting: '#8b5cf6', // purple
  personal: '#f59e0b', // amber
} as const

export const BLOCK_TYPE_ICONS = {
  task: 'check_circle',
  focus: 'center_focus_strong',
  break: 'coffee',
  meeting: 'groups',
  personal: 'person',
} as const

// =====================================================
// Schedule View Types
// =====================================================

export type ScheduleView = 'day' | 'week' | 'timeline'

export interface ScheduleViewState {
  currentDate: Date
  view: ScheduleView
  selectedBlockId: string | null
  isCreatingBlock: boolean
  dragStartTime: Date | null
}

// Time range for filtering
export interface TimeRange {
  start: Date
  end: Date
}

// Day schedule summary
export interface DayScheduleSummary {
  date: string
  totalBlocks: number
  completedBlocks: number
  totalMinutesScheduled: number
  focusMinutes: number
  breakMinutes: number
  meetingMinutes: number
}
