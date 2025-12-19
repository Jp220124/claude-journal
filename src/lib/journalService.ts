import { createClient } from '@/lib/supabase/client'
import type { JournalEntry, JournalEntryInsert, JournalEntryUpdate } from '@/types/database'

export interface JournalEntryData {
  title: string
  content: string
  mood: string | null
  tags: string[]
}

/**
 * Fetch a journal entry for a specific date
 */
export async function fetchJournalEntry(date: string): Promise<JournalEntry | null> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('user_id', user.id)
    .eq('date', date)
    .single()

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows returned, which is fine
    console.error('Error fetching journal entry:', error)
  }

  return data || null
}

/**
 * Save (create or update) a journal entry for a specific date
 */
export async function saveJournalEntry(
  date: string,
  entryData: JournalEntryData
): Promise<JournalEntry | null> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    console.error('No authenticated user')
    return null
  }

  // Check if entry exists
  const { data: existing } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('user_id', user.id)
    .eq('date', date)
    .single()

  if (existing) {
    // Update existing entry
    const updateData: JournalEntryUpdate = {
      title: entryData.title || null,
      content: entryData.content || null,
      mood: entryData.mood,
      tags: entryData.tags.length > 0 ? entryData.tags : null,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('journal_entries')
      .update(updateData)
      .eq('id', existing.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating journal entry:', error)
      return null
    }

    return data
  } else {
    // Create new entry
    const insertData: JournalEntryInsert = {
      user_id: user.id,
      date,
      title: entryData.title || null,
      content: entryData.content || null,
      mood: entryData.mood,
      tags: entryData.tags.length > 0 ? entryData.tags : null,
    }

    const { data, error } = await supabase
      .from('journal_entries')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      console.error('Error creating journal entry:', error)
      return null
    }

    return data
  }
}

/**
 * Delete a journal entry
 */
export async function deleteJournalEntry(entryId: string): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase
    .from('journal_entries')
    .delete()
    .eq('id', entryId)

  if (error) {
    console.error('Error deleting journal entry:', error)
    return false
  }

  return true
}

/**
 * Fetch all journal entries for a user (for calendar/search)
 */
export async function fetchAllJournalEntries(): Promise<JournalEntry[]> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: false })

  if (error) {
    console.error('Error fetching journal entries:', error)
    return []
  }

  return data || []
}

/**
 * Fetch journal entries for a date range
 */
export async function fetchJournalEntriesRange(
  startDate: string,
  endDate: string
): Promise<JournalEntry[]> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('user_id', user.id)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false })

  if (error) {
    console.error('Error fetching journal entries range:', error)
    return []
  }

  return data || []
}
