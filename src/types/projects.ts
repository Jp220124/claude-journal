// =====================================================
// Projects Hub Feature - TypeScript Types
// =====================================================

// =====================================================
// PROJECT TYPES
// =====================================================

export type ProjectStatus = 'active' | 'on_hold' | 'completed' | 'archived'
export type ProjectMemberRole = 'owner' | 'admin' | 'member' | 'viewer'
export type CalendarEventType = 'event' | 'milestone' | 'deadline' | 'meeting'

export interface Project {
  id: string
  user_id: string
  name: string
  description: string | null
  color: string
  icon: string
  status: ProjectStatus
  start_date: string | null
  target_date: string | null
  created_at: string
  updated_at: string
}

export interface ProjectInsert {
  id?: string
  user_id?: string
  name: string
  description?: string | null
  color?: string
  icon?: string
  status?: ProjectStatus
  start_date?: string | null
  target_date?: string | null
  created_at?: string
  updated_at?: string
}

export interface ProjectUpdate {
  name?: string
  description?: string | null
  color?: string
  icon?: string
  status?: ProjectStatus
  start_date?: string | null
  target_date?: string | null
}

// =====================================================
// PROJECT MEMBER TYPES
// =====================================================

export interface ProjectMember {
  id: string
  project_id: string
  user_id: string
  role: ProjectMemberRole
  invited_at: string
  accepted_at: string | null
  invited_by: string | null
}

export interface ProjectMemberInsert {
  id?: string
  project_id: string
  user_id: string
  role?: ProjectMemberRole
  invited_at?: string
  accepted_at?: string | null
  invited_by?: string | null
}

export interface ProjectMemberWithUser extends ProjectMember {
  user?: {
    id: string
    email: string
    full_name?: string
    avatar_url?: string
  }
}

// =====================================================
// PROJECT LINK TYPES
// =====================================================

export interface ProjectTask {
  id: string
  project_id: string
  task_id: string
  added_at: string
  added_by: string | null
}

export interface ProjectNote {
  id: string
  project_id: string
  note_id: string
  added_at: string
  added_by: string | null
}

export interface ProjectEvent {
  id: string
  project_id: string
  event_id: string
  added_at: string
  added_by: string | null
}

// =====================================================
// CALENDAR EVENT TYPES
// =====================================================

export interface CalendarEvent {
  id: string
  user_id: string
  title: string
  description: string | null
  event_type: CalendarEventType
  start_datetime: string
  end_datetime: string | null
  all_day: boolean
  color: string | null
  location: string | null
  created_at: string
  updated_at: string
}

export interface CalendarEventInsert {
  id?: string
  user_id?: string
  title: string
  description?: string | null
  event_type?: CalendarEventType
  start_datetime: string
  end_datetime?: string | null
  all_day?: boolean
  color?: string | null
  location?: string | null
  created_at?: string
  updated_at?: string
}

export interface CalendarEventUpdate {
  title?: string
  description?: string | null
  event_type?: CalendarEventType
  start_datetime?: string
  end_datetime?: string | null
  all_day?: boolean
  color?: string | null
  location?: string | null
}

// =====================================================
// PROJECT FILE TYPES
// =====================================================

export interface ProjectFile {
  id: string
  project_id: string
  user_id: string
  file_name: string
  file_path: string
  file_size: number | null
  file_type: string | null
  description: string | null
  uploaded_at: string
  folder_path: string // Folder location within project (empty = root, "Documents/" = inside Documents)
  is_folder: boolean // True if this is a folder, false if it's a file
}

export interface ProjectFileInsert {
  id?: string
  project_id: string
  user_id?: string
  file_name: string
  file_path: string
  file_size?: number | null
  file_type?: string | null
  description?: string | null
  uploaded_at?: string
  folder_path?: string
  is_folder?: boolean
}

// Folder structure for UI
export interface ProjectFolder {
  id: string
  name: string
  path: string // Full path including this folder name
  parent_path: string // Parent folder path
  created_at: string
  file_count: number
  subfolder_count: number
}

// =====================================================
// EXTENDED/COMPOSITE TYPES
// =====================================================

export interface ProjectWithProgress extends Project {
  total_tasks: number
  completed_tasks: number
  progress_percent: number
}

export interface ProjectWithCounts extends Project {
  task_count: number
  note_count: number
  event_count: number
  file_count: number
  member_count: number
  // Progress tracking
  completed_task_count: number
  progress_percent: number
}

export interface ProjectWithLinkedItems extends Project {
  tasks: ProjectLinkedTask[]
  notes: ProjectLinkedNote[]
  events: CalendarEvent[]
  files: ProjectFile[]
  members: ProjectMemberWithUser[]
  progress: {
    total_tasks: number
    completed_tasks: number
    progress_percent: number
  }
}

// Linked item types with full item data
export interface ProjectLinkedTask {
  link_id: string
  task_id: string
  added_at: string
  added_by: string | null
  task: {
    id: string
    title: string
    completed: boolean
    priority: 'low' | 'medium' | 'high'
    due_date: string | null
    due_time: string | null
    notes: string | null
    category_id: string | null
    created_at: string
  }
}

export interface ProjectLinkedNote {
  link_id: string
  note_id: string
  added_at: string
  added_by: string | null
  note: {
    id: string
    title: string
    content: string | null
    created_at: string
    updated_at: string
  }
}

// =====================================================
// API RESPONSE TYPES
// =====================================================

export interface ProjectsListResponse {
  projects: ProjectWithCounts[]
  total: number
}

export interface ProjectDetailResponse {
  project: ProjectWithLinkedItems
}

export interface ProjectProgressResponse {
  total_tasks: number
  completed_tasks: number
  progress_percent: number
}

// =====================================================
// FILTER & SORT TYPES
// =====================================================

export type ProjectSortField = 'name' | 'created_at' | 'updated_at' | 'target_date' | 'status'
export type SortDirection = 'asc' | 'desc'

export interface ProjectFilters {
  status?: ProjectStatus[]
  search?: string
  hasOverdueTasks?: boolean
}

export interface ProjectSortOptions {
  field: ProjectSortField
  direction: SortDirection
}

// =====================================================
// FORM TYPES FOR UI
// =====================================================

export interface ProjectFormData {
  name: string
  description: string
  color: string
  icon: string
  status: ProjectStatus
  start_date: string
  target_date: string
}

export interface CalendarEventFormData {
  title: string
  description: string
  event_type: CalendarEventType
  start_datetime: string
  end_datetime: string
  all_day: boolean
  color: string
  location: string
}

export interface InviteMemberFormData {
  email: string
  role: ProjectMemberRole
}

// =====================================================
// ICON OPTIONS
// =====================================================

export const PROJECT_ICONS = [
  'folder',
  'work',
  'school',
  'home',
  'favorite',
  'star',
  'rocket_launch',
  'lightbulb',
  'code',
  'design_services',
  'science',
  'book',
  'travel_explore',
  'fitness_center',
  'restaurant',
  'shopping_cart',
  'account_balance',
  'psychology',
  'group',
  'celebration',
] as const

export type ProjectIcon = typeof PROJECT_ICONS[number]

// =====================================================
// COLOR OPTIONS
// =====================================================

export const PROJECT_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#84cc16', // lime
  '#22c55e', // green
  '#10b981', // emerald
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#0ea5e9', // sky
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#d946ef', // fuchsia
  '#ec4899', // pink
  '#f43f5e', // rose
  '#64748b', // slate
] as const

export type ProjectColor = typeof PROJECT_COLORS[number]

// =====================================================
// STATUS DISPLAY INFO
// =====================================================

export const PROJECT_STATUS_INFO: Record<ProjectStatus, { label: string; color: string; bgColor: string }> = {
  active: { label: 'Active', color: 'text-green-700', bgColor: 'bg-green-100' },
  on_hold: { label: 'On Hold', color: 'text-amber-700', bgColor: 'bg-amber-100' },
  completed: { label: 'Completed', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  archived: { label: 'Archived', color: 'text-slate-500', bgColor: 'bg-slate-100' },
}

export const EVENT_TYPE_INFO: Record<CalendarEventType, { label: string; color: string; icon: string }> = {
  event: { label: 'Event', color: '#3b82f6', icon: 'event' },
  milestone: { label: 'Milestone', color: '#8b5cf6', icon: 'flag' },
  deadline: { label: 'Deadline', color: '#ef4444', icon: 'alarm' },
  meeting: { label: 'Meeting', color: '#22c55e', icon: 'groups' },
}

export const MEMBER_ROLE_INFO: Record<ProjectMemberRole, { label: string; description: string }> = {
  owner: { label: 'Owner', description: 'Full control over the project' },
  admin: { label: 'Admin', description: 'Can manage members and settings' },
  member: { label: 'Member', description: 'Can add and edit items' },
  viewer: { label: 'Viewer', description: 'Can only view items' },
}
