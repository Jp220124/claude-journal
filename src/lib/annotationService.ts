import { createClient } from '@/lib/supabase/client'
import {
  NoteAnnotation,
  CreateAnnotationInput,
  UpdateAnnotationInput,
} from '@/types/annotations'

/**
 * Annotation Service - CRUD operations for note annotations (sticky notes)
 */

/**
 * Fetch all annotations for a specific note
 */
export async function getAnnotations(noteId: string): Promise<NoteAnnotation[]> {
  const supabase = createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('note_annotations')
    .select('*')
    .eq('note_id', noteId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching annotations:', error)
    return []
  }

  return (data || []) as NoteAnnotation[]
}

/**
 * Create a new annotation
 */
export async function createAnnotation(
  input: CreateAnnotationInput
): Promise<NoteAnnotation | null> {
  const supabase = createClient()

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    console.error('No authenticated user for annotation creation')
    return null
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('note_annotations')
    .insert({
      ...input,
      user_id: user.id,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating annotation:', error)
    return null
  }

  return data as NoteAnnotation
}

/**
 * Update an existing annotation
 */
export async function updateAnnotation(
  id: string,
  updates: UpdateAnnotationInput
): Promise<NoteAnnotation | null> {
  const supabase = createClient()

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    console.error('No authenticated user for annotation update')
    return null
  }

  // Filter to only valid fields
  const cleanUpdates: Record<string, unknown> = {}
  const allowedFields = ['content', 'color', 'position_x', 'position_y']

  for (const key of allowedFields) {
    if (key in updates && updates[key as keyof UpdateAnnotationInput] !== undefined) {
      cleanUpdates[key] = updates[key as keyof UpdateAnnotationInput]
    }
  }

  cleanUpdates.updated_at = new Date().toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('note_annotations')
    .update(cleanUpdates)
    .eq('id', id)
    .eq('user_id', user.id) // Ensure user owns this annotation
    .select()
    .single()

  if (error) {
    console.error('Error updating annotation:', error)
    return null
  }

  return data as NoteAnnotation
}

/**
 * Delete an annotation
 */
export async function deleteAnnotation(id: string): Promise<boolean> {
  const supabase = createClient()

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    console.error('No authenticated user for annotation deletion')
    return false
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('note_annotations')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id) // Ensure user owns this annotation

  if (error) {
    console.error('Error deleting annotation:', error)
    return false
  }

  return true
}

/**
 * Delete all annotations for a specific anchor ID
 * (Used when an anchor is removed from the document)
 */
export async function deleteAnnotationsByAnchor(
  noteId: string,
  anchorId: string
): Promise<boolean> {
  const supabase = createClient()

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    console.error('No authenticated user for annotation deletion')
    return false
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('note_annotations')
    .delete()
    .eq('note_id', noteId)
    .eq('anchor_id', anchorId)
    .eq('user_id', user.id)

  if (error) {
    console.error('Error deleting annotations by anchor:', error)
    return false
  }

  return true
}

/**
 * Batch update positions for multiple annotations
 * (Useful for saving positions after drag operations)
 */
export async function batchUpdatePositions(
  updates: Array<{ id: string; position_x: number; position_y: number }>
): Promise<boolean> {
  const supabase = createClient()

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    console.error('No authenticated user for batch position update')
    return false
  }

  // Update each annotation individually (Supabase doesn't support batch updates well)
  const promises = updates.map(async ({ id, position_x, position_y }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (supabase as any)
      .from('note_annotations')
      .update({
        position_x,
        position_y,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)
  })

  const results = await Promise.all(promises)
  const hasError = results.some(r => r.error)

  if (hasError) {
    console.error('Error in batch position update')
    return false
  }

  return true
}
