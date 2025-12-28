import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

export const runtime = 'nodejs'

/**
 * POST /api/notes/[id]/remove-lock
 * Remove password protection from a note
 * Note: The caller should verify they have the password before calling this
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: noteId } = await params

    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Verify the note exists and belongs to this user
    const { data: note, error: fetchError } = await supabase
      .from('notes')
      .select('id, user_id, is_locked')
      .eq('id', noteId)
      .single()

    if (fetchError || !note) {
      return new Response(
        JSON.stringify({ error: 'Note not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (note.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!note.is_locked) {
      return new Response(
        JSON.stringify({ error: 'Note is not locked' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Remove the lock
    const { data: updatedNote, error: updateError } = await supabase
      .from('notes')
      .update({
        is_locked: false,
        password_hash: null,
        locked_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', noteId)
      .select('id, title, is_locked, updated_at')
      .single()

    if (updateError) {
      console.error('Error removing lock:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to remove lock' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, note: updatedNote }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Remove lock error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
