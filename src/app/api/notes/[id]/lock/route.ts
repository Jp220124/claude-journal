import { createClient } from '@/lib/supabase/server'
import bcrypt from 'bcryptjs'
import { NextRequest } from 'next/server'

export const runtime = 'nodejs'

/**
 * POST /api/notes/[id]/lock
 * Lock a note with a password
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: noteId } = await params
    const { password } = await request.json()

    // Validate password
    if (!password || typeof password !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Password is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (password.length < 4) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 4 characters' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: noteData, error: fetchError } = await (supabase as any)
      .from('notes')
      .select('id, user_id, is_locked')
      .eq('id', noteId)
      .single()

    const note = noteData as { id: string; user_id: string; is_locked: boolean } | null

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

    if (note.is_locked) {
      return new Response(
        JSON.stringify({ error: 'Note is already locked' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Hash the password with bcrypt (cost factor 12)
    const passwordHash = await bcrypt.hash(password, 12)

    // Update the note
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: updatedNote, error: updateError } = await (supabase as any)
      .from('notes')
      .update({
        is_locked: true,
        password_hash: passwordHash,
        locked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', noteId)
      .select('id, title, is_locked, locked_at, updated_at')
      .single()

    if (updateError) {
      console.error('Error locking note:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to lock note' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, note: updatedNote }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Lock note error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
