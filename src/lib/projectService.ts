// =====================================================
// Projects Hub - API Service Functions
// =====================================================

import { createClient } from '@/lib/supabase/client'
import type {
  Project,
  ProjectInsert,
  ProjectUpdate,
  ProjectWithCounts,
  ProjectWithLinkedItems,
  ProjectMember,
  ProjectMemberInsert,
  ProjectMemberWithUser,
  ProjectTask,
  ProjectNote,
  ProjectEvent,
  ProjectFile,
  ProjectFileInsert,
  CalendarEvent,
  CalendarEventInsert,
  CalendarEventUpdate,
  ProjectLinkedTask,
  ProjectLinkedNote,
  ProjectFilters,
  ProjectSortOptions,
  ProjectStatus,
  ProjectMemberRole,
} from '@/types/projects'

// =====================================================
// PROJECT CRUD OPERATIONS
// =====================================================

/**
 * Fetch all projects for the current user (owned or member)
 */
export async function fetchProjects(
  filters?: ProjectFilters,
  sort?: ProjectSortOptions
): Promise<ProjectWithCounts[]> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  let query = supabase
    .from('projects')
    .select(`
      *,
      project_tasks(count),
      project_notes(count),
      project_events(count),
      project_files(count),
      project_members(count)
    `)

  // Apply status filter
  if (filters?.status && filters.status.length > 0) {
    query = query.in('status', filters.status)
  }

  // Apply search filter
  if (filters?.search) {
    query = query.ilike('name', `%${filters.search}%`)
  }

  // Apply sorting
  const sortField = sort?.field || 'updated_at'
  const sortDirection = sort?.direction === 'asc' ? true : false
  query = query.order(sortField, { ascending: sortDirection })

  const { data, error } = await query

  if (error) {
    console.error('Error fetching projects:', error)
    return []
  }

  // Get project IDs for fetching task completion data
  const projectIds = (data || []).map(p => p.id)

  // Fetch task completion data for all projects in one query
  const { data: taskData } = await supabase
    .from('project_tasks')
    .select(`
      project_id,
      todos (
        completed
      )
    `)
    .in('project_id', projectIds)

  // Build a map of project_id -> { total: number, completed: number }
  const progressMap: Record<string, { total: number; completed: number }> = {}
  for (const projectId of projectIds) {
    progressMap[projectId] = { total: 0, completed: 0 }
  }

  // Count tasks and completed tasks per project
  for (const task of (taskData || [])) {
    if (task.project_id && progressMap[task.project_id]) {
      progressMap[task.project_id].total++
      // Supabase returns nested todos object
      const todo = task.todos as unknown as { completed: boolean } | null
      if (todo?.completed) {
        progressMap[task.project_id].completed++
      }
    }
  }

  // Transform the count data with real progress
  return (data || []).map(project => {
    const progress = progressMap[project.id] || { total: 0, completed: 0 }
    const progressPercent = progress.total > 0
      ? Math.round((progress.completed / progress.total) * 100)
      : 0

    return {
      ...project,
      task_count: project.project_tasks?.[0]?.count || 0,
      note_count: project.project_notes?.[0]?.count || 0,
      event_count: project.project_events?.[0]?.count || 0,
      file_count: project.project_files?.[0]?.count || 0,
      member_count: project.project_members?.[0]?.count || 0,
      completed_task_count: progress.completed,
      progress_percent: progressPercent,
    }
  })
}

/**
 * Fetch a single project by ID with all linked items
 */
export async function fetchProject(projectId: string): Promise<ProjectWithLinkedItems | null> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Fetch project
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single()

  if (projectError || !project) {
    console.error('Error fetching project:', projectError)
    return null
  }

  // Fetch linked tasks
  const { data: taskLinks } = await supabase
    .from('project_tasks')
    .select(`
      id,
      task_id,
      added_at,
      added_by,
      todos (
        id,
        title,
        completed,
        priority,
        due_date,
        due_time,
        notes,
        category_id,
        created_at
      )
    `)
    .eq('project_id', projectId)

  // Fetch linked notes
  const { data: noteLinks } = await supabase
    .from('project_notes')
    .select(`
      id,
      note_id,
      added_at,
      added_by,
      notes (
        id,
        title,
        content,
        created_at,
        updated_at
      )
    `)
    .eq('project_id', projectId)

  // Fetch linked events
  const { data: eventLinks } = await supabase
    .from('project_events')
    .select(`
      id,
      event_id,
      added_at,
      added_by,
      calendar_events (*)
    `)
    .eq('project_id', projectId)

  // Fetch files
  const { data: files } = await supabase
    .from('project_files')
    .select('*')
    .eq('project_id', projectId)
    .order('uploaded_at', { ascending: false })

  // Fetch members
  const { data: members } = await supabase
    .from('project_members')
    .select('*')
    .eq('project_id', projectId)

  // Transform task links - Supabase returns nested objects
  // Cast through unknown to handle Supabase's dynamic typing
  const transformedTasks: ProjectLinkedTask[] = (taskLinks || [])
    .filter(link => link.todos) // Filter out null todos
    .map(link => ({
      link_id: link.id,
      task_id: link.task_id,
      added_at: link.added_at,
      added_by: link.added_by,
      task: link.todos as unknown as ProjectLinkedTask['task'],
    }))

  // Transform note links
  const transformedNotes: ProjectLinkedNote[] = (noteLinks || [])
    .filter(link => link.notes) // Filter out null notes
    .map(link => ({
      link_id: link.id,
      note_id: link.note_id,
      added_at: link.added_at,
      added_by: link.added_by,
      note: link.notes as unknown as ProjectLinkedNote['note'],
    }))

  // Transform events
  const transformedEvents: CalendarEvent[] = (eventLinks || [])
    .filter(link => link.calendar_events)
    .map(link => link.calendar_events as unknown as CalendarEvent)

  // Calculate progress
  const completedTasks = transformedTasks.filter(t => t.task?.completed).length
  const totalTasks = transformedTasks.length

  return {
    ...project,
    tasks: transformedTasks,
    notes: transformedNotes,
    events: transformedEvents,
    files: files || [],
    members: members || [],
    progress: {
      total_tasks: totalTasks,
      completed_tasks: completedTasks,
      progress_percent: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
    },
  }
}

/**
 * Create a new project
 */
export async function createProject(project: Omit<ProjectInsert, 'user_id'>): Promise<Project | null> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    console.error('No authenticated user')
    return null
  }

  // Create project
  const { data, error } = await supabase
    .from('projects')
    .insert({
      ...project,
      user_id: user.id,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating project:', error)
    return null
  }

  // Add creator as owner
  await supabase
    .from('project_members')
    .insert({
      project_id: data.id,
      user_id: user.id,
      role: 'owner',
      accepted_at: new Date().toISOString(),
      invited_by: user.id,
    })

  return data
}

/**
 * Update a project
 */
export async function updateProject(id: string, updates: ProjectUpdate): Promise<Project | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating project:', error)
    return null
  }

  return data
}

/**
 * Delete a project
 */
export async function deleteProject(id: string): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting project:', error)
    return false
  }

  return true
}

/**
 * Archive a project (soft delete)
 */
export async function archiveProject(id: string): Promise<boolean> {
  const result = await updateProject(id, { status: 'archived' })
  return result !== null
}

// =====================================================
// TASK LINKING OPERATIONS
// =====================================================

/**
 * Link a task to a project
 */
export async function linkTaskToProject(projectId: string, taskId: string): Promise<ProjectTask | null> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('project_tasks')
    .insert({
      project_id: projectId,
      task_id: taskId,
      added_by: user.id,
    })
    .select()
    .single()

  if (error) {
    // Handle duplicate link gracefully
    if (error.code === '23505') {
      console.log('Task already linked to project')
      return null
    }
    console.error('Error linking task to project:', error)
    return null
  }

  return data
}

/**
 * Unlink a task from a project
 */
export async function unlinkTaskFromProject(projectId: string, taskId: string): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase
    .from('project_tasks')
    .delete()
    .eq('project_id', projectId)
    .eq('task_id', taskId)

  if (error) {
    console.error('Error unlinking task from project:', error)
    return false
  }

  return true
}

/**
 * Get all projects a task is linked to
 */
export async function getProjectsForTask(taskId: string): Promise<Project[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('project_tasks')
    .select('projects(*)')
    .eq('task_id', taskId)

  if (error) {
    console.error('Error fetching projects for task:', error)
    return []
  }

  // Supabase returns projects as nested object, cast through unknown
  return (data || [])
    .map(item => item.projects as unknown as Project)
    .filter((p): p is Project => p !== null)
}

// =====================================================
// NOTE LINKING OPERATIONS
// =====================================================

/**
 * Link a note to a project
 */
export async function linkNoteToProject(projectId: string, noteId: string): Promise<ProjectNote | null> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('project_notes')
    .insert({
      project_id: projectId,
      note_id: noteId,
      added_by: user.id,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      console.log('Note already linked to project')
      return null
    }
    console.error('Error linking note to project:', error)
    return null
  }

  return data
}

/**
 * Unlink a note from a project
 */
export async function unlinkNoteFromProject(projectId: string, noteId: string): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase
    .from('project_notes')
    .delete()
    .eq('project_id', projectId)
    .eq('note_id', noteId)

  if (error) {
    console.error('Error unlinking note from project:', error)
    return false
  }

  return true
}

/**
 * Get all projects a note is linked to
 */
export async function getProjectsForNote(noteId: string): Promise<Project[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('project_notes')
    .select('projects(*)')
    .eq('note_id', noteId)

  if (error) {
    console.error('Error fetching projects for note:', error)
    return []
  }

  // Supabase returns projects as nested object, cast through unknown
  return (data || [])
    .map(item => item.projects as unknown as Project)
    .filter((p): p is Project => p !== null)
}

// =====================================================
// CALENDAR EVENT OPERATIONS
// =====================================================

/**
 * Create a calendar event
 */
export async function createCalendarEvent(event: Omit<CalendarEventInsert, 'user_id'>): Promise<CalendarEvent | null> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('calendar_events')
    .insert({
      ...event,
      user_id: user.id,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating calendar event:', error)
    return null
  }

  return data
}

/**
 * Update a calendar event
 */
export async function updateCalendarEvent(id: string, updates: CalendarEventUpdate): Promise<CalendarEvent | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('calendar_events')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating calendar event:', error)
    return null
  }

  return data
}

/**
 * Delete a calendar event
 */
export async function deleteCalendarEvent(id: string): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase
    .from('calendar_events')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting calendar event:', error)
    return false
  }

  return true
}

/**
 * Link an event to a project
 */
export async function linkEventToProject(projectId: string, eventId: string): Promise<ProjectEvent | null> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('project_events')
    .insert({
      project_id: projectId,
      event_id: eventId,
      added_by: user.id,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      console.log('Event already linked to project')
      return null
    }
    console.error('Error linking event to project:', error)
    return null
  }

  return data
}

/**
 * Unlink an event from a project
 */
export async function unlinkEventFromProject(projectId: string, eventId: string): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase
    .from('project_events')
    .delete()
    .eq('project_id', projectId)
    .eq('event_id', eventId)

  if (error) {
    console.error('Error unlinking event from project:', error)
    return false
  }

  return true
}

/**
 * Create event and link to project in one operation
 */
export async function createEventForProject(
  projectId: string,
  event: Omit<CalendarEventInsert, 'user_id'>
): Promise<CalendarEvent | null> {
  const newEvent = await createCalendarEvent(event)
  if (!newEvent) return null

  await linkEventToProject(projectId, newEvent.id)
  return newEvent
}

// =====================================================
// FILE OPERATIONS
// =====================================================

/**
 * Sanitize folder path to prevent path traversal attacks
 */
function sanitizeFolderPath(path: string): string {
  // Remove any path traversal attempts
  let sanitized = path
    .replace(/\.\./g, '') // Remove ..
    .replace(/\/\//g, '/') // Remove double slashes
    .replace(/^\//, '') // Remove leading slash
    .replace(/[<>:"|?*]/g, '_') // Replace invalid characters

  // Ensure it ends with / if not empty
  if (sanitized && !sanitized.endsWith('/')) {
    sanitized += '/'
  }

  return sanitized
}

/**
 * Create a folder in a project
 */
export async function createProjectFolder(
  projectId: string,
  folderName: string,
  parentPath: string = ''
): Promise<ProjectFile | null> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Sanitize folder name and parent path
  const sanitizedName = folderName.replace(/[<>:"/\\|?*]/g, '_').trim()
  const sanitizedParent = sanitizeFolderPath(parentPath)
  const folderPath = sanitizedParent + sanitizedName + '/'

  // Check if folder already exists
  const { data: existing } = await supabase
    .from('project_files')
    .select('id')
    .eq('project_id', projectId)
    .eq('is_folder', true)
    .eq('folder_path', sanitizedParent)
    .eq('file_name', sanitizedName)
    .single()

  if (existing) {
    console.log('Folder already exists')
    return null
  }

  // Create folder record (no actual storage upload needed for folders)
  const { data, error } = await supabase
    .from('project_files')
    .insert({
      project_id: projectId,
      user_id: user.id,
      file_name: sanitizedName,
      file_path: `${user.id}/${projectId}/${folderPath}`,
      file_size: 0,
      file_type: 'folder',
      folder_path: sanitizedParent,
      is_folder: true,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating folder:', error)
    return null
  }

  return data
}

/**
 * Upload a file to a project (with folder support)
 */
export async function uploadProjectFile(
  projectId: string,
  file: File,
  folderPath: string = ''
): Promise<ProjectFile | null> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Sanitize folder path
  const sanitizedFolderPath = sanitizeFolderPath(folderPath)

  // Generate unique file path
  const timestamp = Date.now()
  const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
  const storagePath = `${user.id}/${projectId}/${sanitizedFolderPath}${timestamp}_${sanitizedFileName}`

  // Upload to storage
  const { error: uploadError } = await supabase.storage
    .from('project-files')
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (uploadError) {
    console.error('Error uploading file:', uploadError)
    return null
  }

  // Create file record
  const { data, error } = await supabase
    .from('project_files')
    .insert({
      project_id: projectId,
      user_id: user.id,
      file_name: file.name,
      file_path: storagePath,
      file_size: file.size,
      file_type: file.type,
      folder_path: sanitizedFolderPath,
      is_folder: false,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating file record:', error)
    // Try to clean up uploaded file
    await supabase.storage.from('project-files').remove([storagePath])
    return null
  }

  return data
}

/**
 * Upload multiple files with folder structure preserved
 */
export async function uploadProjectFilesWithStructure(
  projectId: string,
  files: { file: File; relativePath: string }[],
  baseFolderPath: string = ''
): Promise<{ success: number; failed: number }> {
  const results = { success: 0, failed: 0 }

  // Create all needed folders first
  const folderPaths = new Set<string>()
  for (const { relativePath } of files) {
    const parts = relativePath.split('/')
    let currentPath = baseFolderPath
    for (let i = 0; i < parts.length - 1; i++) {
      currentPath += parts[i] + '/'
      folderPaths.add(currentPath)
    }
  }

  // Create folders in order (shortest paths first to ensure parents exist)
  const sortedFolders = Array.from(folderPaths).sort((a, b) => a.length - b.length)
  for (const folderPath of sortedFolders) {
    const parts = folderPath.split('/').filter(Boolean)
    const folderName = parts[parts.length - 1]
    const parentPath = parts.slice(0, -1).join('/') + (parts.length > 1 ? '/' : '')
    await createProjectFolder(projectId, folderName, baseFolderPath + parentPath)
  }

  // Upload all files
  for (const { file, relativePath } of files) {
    const folderPath = baseFolderPath + relativePath.split('/').slice(0, -1).join('/') + '/'
    const result = await uploadProjectFile(projectId, file, folderPath === '/' ? '' : folderPath)
    if (result) {
      results.success++
    } else {
      results.failed++
    }
  }

  return results
}

/**
 * Get files and folders in a specific folder path
 */
export async function getProjectFilesInFolder(
  projectId: string,
  folderPath: string = ''
): Promise<ProjectFile[]> {
  const supabase = createClient()

  const sanitizedPath = sanitizeFolderPath(folderPath) || ''

  const { data, error } = await supabase
    .from('project_files')
    .select('*')
    .eq('project_id', projectId)
    .eq('folder_path', sanitizedPath)
    .order('is_folder', { ascending: false }) // Folders first
    .order('file_name', { ascending: true })

  if (error) {
    console.error('Error fetching files in folder:', error)
    return []
  }

  return data || []
}

/**
 * Delete a folder and all its contents
 */
export async function deleteProjectFolder(
  projectId: string,
  folderPath: string
): Promise<boolean> {
  const supabase = createClient()

  const sanitizedPath = sanitizeFolderPath(folderPath)

  // Extract folder name and parent path from the full folder path
  // e.g., "Documents/" -> folderName = "Documents", parentPath = ""
  // e.g., "Documents/Subfolder/" -> folderName = "Subfolder", parentPath = "Documents/"
  const pathWithoutTrailingSlash = sanitizedPath.replace(/\/$/, '')
  const lastSlashIndex = pathWithoutTrailingSlash.lastIndexOf('/')
  const folderName = lastSlashIndex >= 0
    ? pathWithoutTrailingSlash.substring(lastSlashIndex + 1)
    : pathWithoutTrailingSlash
  const parentPath = lastSlashIndex >= 0
    ? pathWithoutTrailingSlash.substring(0, lastSlashIndex + 1)
    : ''

  // Get all files/folders within this folder (including nested)
  // Using filter instead of .or() for proper string handling
  const { data: files } = await supabase
    .from('project_files')
    .select('*')
    .eq('project_id', projectId)
    .or(`folder_path.eq."${sanitizedPath}",folder_path.like."${sanitizedPath}%"`)

  // Also get the folder record itself
  const { data: folderRecord } = await supabase
    .from('project_files')
    .select('*')
    .eq('project_id', projectId)
    .eq('folder_path', parentPath)
    .eq('file_name', folderName)
    .eq('is_folder', true)
    .single()

  const allRecords = [...(files || []), ...(folderRecord ? [folderRecord] : [])]

  if (allRecords.length === 0) return true

  // Delete from storage (only actual files, not folders)
  const storagePaths = allRecords
    .filter(f => !f.is_folder)
    .map(f => f.file_path)

  if (storagePaths.length > 0) {
    await supabase.storage.from('project-files').remove(storagePaths)
  }

  // Delete all records
  const fileIds = allRecords.map(f => f.id)
  const { error } = await supabase
    .from('project_files')
    .delete()
    .in('id', fileIds)

  if (error) {
    console.error('Error deleting folder:', error)
    return false
  }

  return true
}

/**
 * Get download URL for a project file
 */
export async function getFileDownloadUrl(filePath: string): Promise<string | null> {
  const supabase = createClient()

  const { data, error } = await supabase.storage
    .from('project-files')
    .createSignedUrl(filePath, 3600) // 1 hour expiry

  if (error) {
    console.error('Error creating signed URL:', error)
    return null
  }

  return data.signedUrl
}

/**
 * Delete a project file
 */
export async function deleteProjectFile(fileId: string, filePath: string): Promise<boolean> {
  const supabase = createClient()

  // Delete from storage
  const { error: storageError } = await supabase.storage
    .from('project-files')
    .remove([filePath])

  if (storageError) {
    console.error('Error deleting file from storage:', storageError)
    // Continue to delete record even if storage fails
  }

  // Delete record
  const { error } = await supabase
    .from('project_files')
    .delete()
    .eq('id', fileId)

  if (error) {
    console.error('Error deleting file record:', error)
    return false
  }

  return true
}

// =====================================================
// MEMBER OPERATIONS
// =====================================================

/**
 * Invite a user to a project by email
 */
export async function inviteProjectMember(
  projectId: string,
  email: string,
  role: ProjectMemberRole = 'member'
): Promise<ProjectMember | null> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Find user by email (this requires a profiles table or similar)
  // For now, we'll assume the email maps directly to user_id
  // In production, you'd look up the user or send an email invitation

  // This is a simplified version - in production you'd implement proper invitation flow
  console.warn('Invitation system not fully implemented - requires user lookup by email')
  return null
}

/**
 * Accept a project invitation
 */
export async function acceptProjectInvitation(memberId: string): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase
    .from('project_members')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', memberId)

  if (error) {
    console.error('Error accepting invitation:', error)
    return false
  }

  return true
}

/**
 * Update a member's role
 */
export async function updateMemberRole(memberId: string, role: ProjectMemberRole): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase
    .from('project_members')
    .update({ role })
    .eq('id', memberId)

  if (error) {
    console.error('Error updating member role:', error)
    return false
  }

  return true
}

/**
 * Remove a member from a project
 */
export async function removeProjectMember(memberId: string): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase
    .from('project_members')
    .delete()
    .eq('id', memberId)

  if (error) {
    console.error('Error removing member:', error)
    return false
  }

  return true
}

/**
 * Leave a project (remove self)
 */
export async function leaveProject(projectId: string): Promise<boolean> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { error } = await supabase
    .from('project_members')
    .delete()
    .eq('project_id', projectId)
    .eq('user_id', user.id)

  if (error) {
    console.error('Error leaving project:', error)
    return false
  }

  return true
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Check if user has access to a project
 */
export async function hasProjectAccess(projectId: string): Promise<boolean> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data, error } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .single()

  return !error && data !== null
}

/**
 * Check if user can edit a project
 */
export async function canEditProject(projectId: string): Promise<boolean> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  // Check if owner
  const { data: project } = await supabase
    .from('projects')
    .select('user_id')
    .eq('id', projectId)
    .single()

  if (project?.user_id === user.id) return true

  // Check if admin member
  const { data: member } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()

  return member?.role === 'admin' || member?.role === 'owner'
}

/**
 * Get project statistics
 */
export async function getProjectStats(projectId: string): Promise<{
  total_tasks: number
  completed_tasks: number
  overdue_tasks: number
  note_count: number
  file_count: number
  event_count: number
} | null> {
  const supabase = createClient()

  const today = new Date().toISOString().split('T')[0]

  // Get task stats
  const { data: tasks } = await supabase
    .from('project_tasks')
    .select(`
      todos (
        completed,
        due_date
      )
    `)
    .eq('project_id', projectId)

  // Supabase returns nested todos as objects, cast through unknown
  const taskList = (tasks || [])
    .map(t => (t as unknown as { todos: { completed: boolean; due_date: string | null } | null }).todos)
    .filter((todo): todo is { completed: boolean; due_date: string | null } => todo !== null)
  const total_tasks = taskList.length
  const completed_tasks = taskList.filter(t => t.completed).length
  const overdue_tasks = taskList.filter(t => !t.completed && t.due_date && t.due_date < today).length

  // Get counts
  const { count: note_count } = await supabase
    .from('project_notes')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', projectId)

  const { count: file_count } = await supabase
    .from('project_files')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', projectId)

  const { count: event_count } = await supabase
    .from('project_events')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', projectId)

  return {
    total_tasks,
    completed_tasks,
    overdue_tasks,
    note_count: note_count || 0,
    file_count: file_count || 0,
    event_count: event_count || 0,
  }
}
