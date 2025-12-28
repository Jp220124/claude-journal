import { createClient } from '@/lib/supabase/server'
import bcrypt from 'bcryptjs'
import { NextRequest } from 'next/server'

export const runtime = 'nodejs'

/**
 * POST /api/notes/[id]/unlock
 * Verify password and unlock a note for the session
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

    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Fetch the note with password hash
    const { data: note, error: fetchError } = await supabase
      .from('notes')
      .select('*')
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

    if (!note.password_hash) {
      return new Response(
        JSON.stringify({ error: 'Note has no password set' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Verify password
    const isValid = await bcrypt.compare(password, note.password_hash)

    if (!isValid) {
      return new Response(
        JSON.stringify({ error: 'Incorrect password' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Return the note content (excluding password_hash)
    const { password_hash: _, ...noteWithoutHash } = note

    return new Response(
      JSON.stringify({ success: true, note: noteWithoutHash }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Unlock note error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
