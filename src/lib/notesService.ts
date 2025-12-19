import { createClient } from '@/lib/supabase/client'
import type {
  Note,
  NoteInsert,
  NoteUpdate,
  NoteFolder,
  NoteFolderInsert,
  NoteFolderUpdate,
  NoteTag,
  NoteTagInsert,
  NoteTagUpdate,
  NoteWithTags,
  NoteFolderWithNotes,
} from '@/types/database'

// =====================================================
// Notes CRUD Operations
// =====================================================

// Default empty TipTap document structure
const DEFAULT_NOTE_CONTENT = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
}

/**
 * Fetch all notes for the current user
 */
export async function fetchNotes(options?: {
  folderId?: string | null
  includeArchived?: boolean
  searchQuery?: string
}): Promise<Note[]> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  let query = supabase
    .from('notes')
    .select('*')
    .eq('user_id', user.id)
    .order('is_pinned', { ascending: false })
    .order('updated_at', { ascending: false })

  // Filter by folder
  if (options?.folderId !== undefined) {
    if (options.folderId === null) {
      query = query.is('folder_id', null)
    } else {
      query = query.eq('folder_id', options.folderId)
    }
  }

  // Filter archived
  if (!options?.includeArchived) {
    query = query.eq('is_archived', false)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching notes:', error)
    return []
  }

  return data || []
}

/**
 * Search notes using full-text search
 */
export async function searchNotes(
  searchQuery: string,
  limit: number = 20
): Promise<Note[]> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase.rpc('search_notes', {
    p_user_id: user.id,
    p_query: searchQuery,
    p_limit: limit,
    p_offset: 0,
  })

  if (error) {
    console.error('Error searching notes:', error)
    return []
  }

  return data || []
}

/**
 * Fetch a single note by ID
 */
export async function fetchNoteById(noteId: string): Promise<Note | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('id', noteId)
    .single()

  if (error) {
    console.error('Error fetching note:', error)
    return null
  }

  return data
}

/**
 * Fetch a note with its tags
 */
export async function fetchNoteWithTags(noteId: string): Promise<NoteWithTags | null> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase.rpc('get_notes_with_tags', {
    p_user_id: user.id,
    p_folder_id: null,
    p_limit: 1,
    p_offset: 0,
  })

  if (error) {
    console.error('Error fetching note with tags:', error)
    return null
  }

  const note = data?.find((n: NoteWithTags) => n.id === noteId)
  return note || null
}

/**
 * Create a new note
 */
export async function createNote(note: NoteInsert): Promise<Note | null> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    console.error('No authenticated user')
    return null
  }

  const { data, error } = await supabase
    .from('notes')
    .insert({
      user_id: user.id,
      title: note.title || 'Untitled',
      content: note.content || DEFAULT_NOTE_CONTENT,
      content_text: note.content_text || '',
      folder_id: note.folder_id || null,
      is_pinned: note.is_pinned || false,
      is_archived: note.is_archived || false,
      word_count: note.word_count || 0,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating note:', error)
    return null
  }

  return data
}

/**
 * Update a note
 */
export async function updateNote(noteId: string, updates: NoteUpdate): Promise<Note | null> {
  const supabase = createClient()

  // Clean up updates - remove undefined values that might cause issues
  const cleanUpdates: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      cleanUpdates[key] = value
    }
  }

  const { data, error } = await supabase
    .from('notes')
    .update({
      ...cleanUpdates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', noteId)
    .select()
    .single()

  if (error) {
    console.error('Error updating note:', error.message || error.code || JSON.stringify(error))
    return null
  }

  return data
}

/**
 * Toggle note pinned status
 */
export async function toggleNotePin(noteId: string, isPinned: boolean): Promise<Note | null> {
  return updateNote(noteId, { is_pinned: isPinned })
}

/**
 * Archive/Unarchive a note
 */
export async function toggleNoteArchive(noteId: string, isArchived: boolean): Promise<Note | null> {
  return updateNote(noteId, { is_archived: isArchived })
}

/**
 * Move note to folder
 */
export async function moveNoteToFolder(noteId: string, folderId: string | null): Promise<Note | null> {
  return updateNote(noteId, { folder_id: folderId })
}

/**
 * Delete a note permanently
 */
export async function deleteNote(noteId: string): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('id', noteId)

  if (error) {
    console.error('Error deleting note:', error)
    return false
  }

  return true
}

// =====================================================
// Folders CRUD Operations
// =====================================================

/**
 * Fetch all folders for the current user
 */
export async function fetchFolders(): Promise<NoteFolder[]> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('note_folders')
    .select('*')
    .eq('user_id', user.id)
    .order('order_index', { ascending: true })

  if (error) {
    console.error('Error fetching folders:', error)
    return []
  }

  return data || []
}

/**
 * Fetch folders with note counts
 */
export async function fetchFoldersWithCounts(): Promise<NoteFolderWithNotes[]> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // Fetch folders
  const { data: folders, error: foldersError } = await supabase
    .from('note_folders')
    .select('*')
    .eq('user_id', user.id)
    .order('order_index', { ascending: true })

  if (foldersError) {
    console.error('Error fetching folders:', foldersError)
    return []
  }

  // Fetch note counts per folder
  const { data: notes, error: notesError } = await supabase
    .from('notes')
    .select('folder_id')
    .eq('user_id', user.id)
    .eq('is_archived', false)

  if (notesError) {
    console.error('Error fetching note counts:', notesError)
    return folders?.map(f => ({ ...f, notes: [], note_count: 0 })) || []
  }

  // Count notes per folder
  const countMap = new Map<string | null, number>()
  notes?.forEach(n => {
    const key = n.folder_id
    countMap.set(key, (countMap.get(key) || 0) + 1)
  })

  return folders?.map(f => ({
    ...f,
    notes: [],
    note_count: countMap.get(f.id) || 0,
  })) || []
}

/**
 * Check if user has any folders
 */
export async function hasNoteFolders(): Promise<boolean> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  try {
    const { count, error } = await supabase
      .from('note_folders')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if (error) {
      // Silently fail if table doesn't exist
      return true // Return true to skip creating starter folders
    }

    return (count || 0) > 0
  } catch {
    return true // Return true to skip creating starter folders
  }
}

/**
 * Create starter folders for new users
 */
export async function createStarterFolders(): Promise<boolean> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  try {
    const starterFolders = [
      { name: 'Personal', icon: 'person', color: '#0ea5e9', order_index: 0 },
      { name: 'Work', icon: 'work', color: '#f59e0b', order_index: 1 },
      { name: 'Ideas', icon: 'lightbulb', color: '#a855f7', order_index: 2 },
    ]

    const { error } = await supabase
      .from('note_folders')
      .insert(
        starterFolders.map(folder => ({
          user_id: user.id,
          ...folder,
        }))
      )

    if (error) {
      // Ignore if folders already exist (duplicate key) or table doesn't exist
      if (error.code === '23505' || error.code === '42P01') return true
      // Silently fail - don't spam console with errors if table doesn't exist
      return false
    }

    return true
  } catch {
    // Silently fail if table doesn't exist
    return false
  }
}

/**
 * Create a new folder
 */
export async function createFolder(folder: NoteFolderInsert): Promise<NoteFolder | null> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    console.error('No authenticated user')
    return null
  }

  // Get max order_index
  const { data: maxData } = await supabase
    .from('note_folders')
    .select('order_index')
    .eq('user_id', user.id)
    .order('order_index', { ascending: false })
    .limit(1)
    .single()

  const newOrderIndex = (maxData?.order_index || 0) + 1

  const { data, error } = await supabase
    .from('note_folders')
    .insert({
      user_id: user.id,
      name: folder.name,
      icon: folder.icon || 'folder',
      color: folder.color || '#6366f1',
      parent_folder_id: folder.parent_id || null,
      order_index: folder.order_index ?? newOrderIndex,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating folder:', error.message || error.code || JSON.stringify(error))
    return null
  }

  return data
}

/**
 * Update a folder
 */
export async function updateFolder(folderId: string, updates: NoteFolderUpdate): Promise<NoteFolder | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('note_folders')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', folderId)
    .select()
    .single()

  if (error) {
    console.error('Error updating folder:', error)
    return null
  }

  return data
}

/**
 * Delete a folder (moves notes to null folder)
 */
export async function deleteFolder(folderId: string): Promise<boolean> {
  const supabase = createClient()

  // First, move all notes to no folder
  const { error: moveError } = await supabase
    .from('notes')
    .update({ folder_id: null })
    .eq('folder_id', folderId)

  if (moveError) {
    console.error('Error moving notes:', moveError)
    return false
  }

  // Then delete the folder
  const { error } = await supabase
    .from('note_folders')
    .delete()
    .eq('id', folderId)

  if (error) {
    console.error('Error deleting folder:', error)
    return false
  }

  return true
}

// =====================================================
// Tags CRUD Operations
// =====================================================

/**
 * Fetch all tags for the current user
 */
export async function fetchTags(): Promise<NoteTag[]> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('note_tags')
    .select('*')
    .eq('user_id', user.id)
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching tags:', error)
    return []
  }

  return data || []
}

/**
 * Create starter tags for new users
 */
export async function createStarterTags(): Promise<boolean> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { error } = await supabase.rpc('create_starter_note_tags', {
    p_user_id: user.id,
  })

  if (error) {
    console.error('Error creating starter tags:', error)
    return false
  }

  return true
}

/**
 * Create a new tag
 */
export async function createTag(tag: NoteTagInsert): Promise<NoteTag | null> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    console.error('No authenticated user')
    return null
  }

  const { data, error } = await supabase
    .from('note_tags')
    .insert({
      user_id: user.id,
      name: tag.name,
      color: tag.color || '#6366f1',
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating tag:', error)
    return null
  }

  return data
}

/**
 * Update a tag
 */
export async function updateTag(tagId: string, updates: NoteTagUpdate): Promise<NoteTag | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('note_tags')
    .update(updates)
    .eq('id', tagId)
    .select()
    .single()

  if (error) {
    console.error('Error updating tag:', error)
    return null
  }

  return data
}

/**
 * Delete a tag
 */
export async function deleteTag(tagId: string): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase
    .from('note_tags')
    .delete()
    .eq('id', tagId)

  if (error) {
    console.error('Error deleting tag:', error)
    return false
  }

  return true
}

/**
 * Add tag to a note
 */
export async function addTagToNote(noteId: string, tagId: string): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase
    .from('note_tag_links')
    .insert({ note_id: noteId, tag_id: tagId })

  if (error) {
    // Ignore duplicate key errors
    if (error.code === '23505') return true
    console.error('Error adding tag to note:', error)
    return false
  }

  return true
}

/**
 * Remove tag from a note
 */
export async function removeTagFromNote(noteId: string, tagId: string): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase
    .from('note_tag_links')
    .delete()
    .eq('note_id', noteId)
    .eq('tag_id', tagId)

  if (error) {
    console.error('Error removing tag from note:', error)
    return false
  }

  return true
}

/**
 * Get tags for a specific note
 */
export async function getNoteTags(noteId: string): Promise<NoteTag[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('note_tag_links')
    .select('tag_id, note_tags(*)')
    .eq('note_id', noteId)

  if (error) {
    console.error('Error fetching note tags:', error)
    return []
  }

  return data?.map(d => d.note_tags as unknown as NoteTag).filter(Boolean) || []
}

// =====================================================
// Statistics
// =====================================================

/**
 * Get note statistics for the current user
 */
export async function getNoteStats(): Promise<{
  total_notes: number
  total_folders: number
  total_tags: number
  pinned_notes: number
  archived_notes: number
  total_words: number
} | null> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase.rpc('get_note_stats', {
    p_user_id: user.id,
  })

  if (error) {
    console.error('Error fetching note stats:', error)
    return null
  }

  return data?.[0] || null
}
