import { createClient } from '@/lib/supabase/client'
import type {
  JournalTemplate,
  JournalTemplateInsert,
  JournalTemplateUpdate,
  JournalTemplateSection,
  JournalTemplateSectionInsert,
  JournalTemplateSectionUpdate,
  JournalTemplateEntry,
  JournalTemplateEntryInsert,
  JournalTemplateEntryUpdate,
  JournalTemplateSectionEntry,
  JournalTemplateSectionEntryInsert,
  JournalTemplateSectionEntryUpdate,
  JournalTemplateWithSections,
  JournalTemplateEntryWithSections,
} from '@/types/database'

// =====================================================
// JOURNAL TEMPLATES CRUD
// =====================================================

/**
 * Fetch all templates for the current user
 */
export async function fetchTemplates(): Promise<JournalTemplate[]> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('journal_templates')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('order_index', { ascending: true })

  if (error) {
    console.error('Error fetching templates:', error)
    return []
  }

  return data || []
}

/**
 * Fetch a single template with its sections
 */
export async function fetchTemplateWithSections(templateId: string): Promise<JournalTemplateWithSections | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('journal_templates')
    .select(`
      *,
      journal_template_sections (*)
    `)
    .eq('id', templateId)
    .single()

  if (error) {
    console.error('Error fetching template with sections:', error)
    return null
  }

  // Sort sections by order_index
  if (data?.journal_template_sections) {
    data.journal_template_sections.sort((a: JournalTemplateSection, b: JournalTemplateSection) =>
      a.order_index - b.order_index
    )
  }

  return data as JournalTemplateWithSections
}

/**
 * Create a new template
 */
export async function createTemplate(template: Omit<JournalTemplateInsert, 'user_id'>): Promise<JournalTemplate | null> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    console.error('No authenticated user')
    return null
  }

  const { data, error } = await supabase
    .from('journal_templates')
    .insert({
      ...template,
      user_id: user.id,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating template:', error)
    return null
  }

  return data
}

/**
 * Update a template
 */
export async function updateTemplate(id: string, updates: JournalTemplateUpdate): Promise<JournalTemplate | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('journal_templates')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating template:', error)
    return null
  }

  return data
}

/**
 * Archive a template (soft delete)
 */
export async function archiveTemplate(id: string): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase
    .from('journal_templates')
    .update({ is_active: false })
    .eq('id', id)

  if (error) {
    console.error('Error archiving template:', error)
    return false
  }

  return true
}

/**
 * Delete a template permanently
 */
export async function deleteTemplate(id: string): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase
    .from('journal_templates')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting template:', error)
    return false
  }

  return true
}

/**
 * Set a template as default
 */
export async function setDefaultTemplate(id: string): Promise<boolean> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  // First, unset all defaults for this user
  await supabase
    .from('journal_templates')
    .update({ is_default: false })
    .eq('user_id', user.id)

  // Then set the new default
  const { error } = await supabase
    .from('journal_templates')
    .update({ is_default: true })
    .eq('id', id)

  if (error) {
    console.error('Error setting default template:', error)
    return false
  }

  return true
}

// =====================================================
// TEMPLATE SECTIONS CRUD
// =====================================================

/**
 * Create a new section
 */
export async function createSection(section: Omit<JournalTemplateSectionInsert, 'user_id'>): Promise<JournalTemplateSection | null> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    console.error('No authenticated user')
    return null
  }

  const { data, error } = await supabase
    .from('journal_template_sections')
    .insert({
      ...section,
      user_id: user.id,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating section:', error)
    return null
  }

  return data
}

/**
 * Update a section
 */
export async function updateSection(id: string, updates: JournalTemplateSectionUpdate): Promise<JournalTemplateSection | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('journal_template_sections')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating section:', error)
    return null
  }

  return data
}

/**
 * Delete a section
 */
export async function deleteSection(id: string): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase
    .from('journal_template_sections')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting section:', error)
    return false
  }

  return true
}

/**
 * Reorder sections within a template
 */
export async function reorderSections(templateId: string, sectionIds: string[]): Promise<boolean> {
  const supabase = createClient()

  // Update each section's order_index
  const updates = sectionIds.map((id, index) =>
    supabase
      .from('journal_template_sections')
      .update({ order_index: index })
      .eq('id', id)
      .eq('template_id', templateId)
  )

  const results = await Promise.all(updates)
  const hasError = results.some(result => result.error)

  if (hasError) {
    console.error('Error reordering sections')
    return false
  }

  return true
}

// =====================================================
// TEMPLATE ENTRIES CRUD
// =====================================================

/**
 * Get or create entry for a specific template and date
 * Uses upsert to handle race conditions (e.g., React StrictMode double execution)
 */
export async function getOrCreateTemplateEntry(
  templateId: string,
  date: string
): Promise<JournalTemplateEntry | null> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Use upsert to handle race conditions - if entry exists, just return it
  // onConflict targets the UNIQUE(user_id, template_id, date) constraint
  const { data, error } = await supabase
    .from('journal_template_entries')
    .upsert(
      {
        user_id: user.id,
        template_id: templateId,
        date,
      },
      {
        onConflict: 'user_id,template_id,date',
        ignoreDuplicates: true,
      }
    )
    .select()
    .single()

  if (error) {
    // If upsert with ignoreDuplicates returns no rows, fetch the existing entry
    if (error.code === 'PGRST116') {
      const { data: existing } = await supabase
        .from('journal_template_entries')
        .select('*')
        .eq('user_id', user.id)
        .eq('template_id', templateId)
        .eq('date', date)
        .single()

      return existing
    }
    console.error('Error creating template entry:', error.message, error.code, error.details)
    return null
  }

  return data
}

/**
 * Fetch entry with all section entries for a specific date
 */
export async function fetchTemplateEntryWithSections(
  templateId: string,
  date: string
): Promise<JournalTemplateEntryWithSections | null> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('journal_template_entries')
    .select(`
      *,
      journal_template_section_entries (*),
      journal_templates (*)
    `)
    .eq('user_id', user.id)
    .eq('template_id', templateId)
    .eq('date', date)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching template entry:', error)
    return null
  }

  return data as JournalTemplateEntryWithSections | null
}

/**
 * Update template entry overall mood/notes
 */
export async function updateTemplateEntry(
  id: string,
  updates: JournalTemplateEntryUpdate
): Promise<JournalTemplateEntry | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('journal_template_entries')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating template entry:', error)
    return null
  }

  return data
}

// =====================================================
// SECTION ENTRIES CRUD
// =====================================================

/**
 * Get or create section entry for a specific entry and section
 * Uses upsert pattern to handle race conditions
 */
export async function getOrCreateSectionEntry(
  entryId: string,
  section: JournalTemplateSection
): Promise<JournalTemplateSectionEntry | null> {
  const supabase = createClient()

  // First, try to get existing
  const { data: existing } = await supabase
    .from('journal_template_section_entries')
    .select('*')
    .eq('entry_id', entryId)
    .eq('section_id', section.id)
    .single()

  if (existing) return existing

  // Create new with denormalized section info
  const { data, error } = await supabase
    .from('journal_template_section_entries')
    .insert({
      entry_id: entryId,
      section_id: section.id,
      section_name: section.name,
      section_icon: section.icon,
      section_color: section.color,
    })
    .select()
    .single()

  if (error) {
    // Handle race condition - if insert fails due to duplicate, try fetching again
    if (error.code === '23505') { // Unique violation
      const { data: retryExisting } = await supabase
        .from('journal_template_section_entries')
        .select('*')
        .eq('entry_id', entryId)
        .eq('section_id', section.id)
        .single()

      return retryExisting
    }
    console.error('Error creating section entry:', error.message, error.code, error.details)
    return null
  }

  return data
}

/**
 * Update section entry content and mood
 */
export async function updateSectionEntry(
  id: string,
  updates: JournalTemplateSectionEntryUpdate
): Promise<JournalTemplateSectionEntry | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('journal_template_section_entries')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating section entry:', error)
    return null
  }

  return data
}

/**
 * Batch upsert section entries for auto-save
 */
export async function upsertSectionEntries(
  entryId: string,
  sections: JournalTemplateSection[],
  contentMap: Record<string, { content: string; mood?: string }>
): Promise<boolean> {
  const supabase = createClient()

  for (const section of sections) {
    const sectionContent = contentMap[section.id]
    if (!sectionContent) continue

    // Check if entry exists
    const { data: existing } = await supabase
      .from('journal_template_section_entries')
      .select('id')
      .eq('entry_id', entryId)
      .eq('section_id', section.id)
      .single()

    if (existing) {
      // Update existing
      await supabase
        .from('journal_template_section_entries')
        .update({
          content: sectionContent.content,
          mood: sectionContent.mood,
        })
        .eq('id', existing.id)
    } else {
      // Insert new
      await supabase
        .from('journal_template_section_entries')
        .insert({
          entry_id: entryId,
          section_id: section.id,
          section_name: section.name,
          section_icon: section.icon,
          section_color: section.color,
          content: sectionContent.content,
          mood: sectionContent.mood,
        })
    }
  }

  return true
}

// =====================================================
// STARTER TEMPLATES
// =====================================================

/**
 * Create starter templates for a new user
 */
export async function createStarterTemplates(): Promise<boolean> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  // Call the database function to create starter templates
  const { error } = await supabase.rpc('create_starter_templates', {
    p_user_id: user.id
  })

  if (error) {
    console.error('Error creating starter templates:', error)
    return false
  }

  return true
}

/**
 * Check if user has any templates
 */
export async function hasTemplates(): Promise<boolean> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { count, error } = await supabase
    .from('journal_templates')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_active', true)

  if (error) {
    console.error('Error checking templates:', error)
    return false
  }

  return (count || 0) > 0
}

// =====================================================
// HISTORY & STATS
// =====================================================

/**
 * Fetch entry history for a template
 */
export async function fetchTemplateHistory(
  templateId: string,
  limit: number = 30
): Promise<JournalTemplateEntry[]> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('journal_template_entries')
    .select('*')
    .eq('user_id', user.id)
    .eq('template_id', templateId)
    .order('date', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching template history:', error)
    return []
  }

  return data || []
}

/**
 * Get dates with entries for a template (for calendar view)
 */
export async function getEntryDatesForTemplate(
  templateId: string,
  startDate: string,
  endDate: string
): Promise<string[]> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('journal_template_entries')
    .select('date')
    .eq('user_id', user.id)
    .eq('template_id', templateId)
    .gte('date', startDate)
    .lte('date', endDate)

  if (error) {
    console.error('Error fetching entry dates:', error)
    return []
  }

  return data?.map(d => d.date) || []
}
