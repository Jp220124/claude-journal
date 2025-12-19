import { create } from 'zustand'
import { createClient } from '@/lib/supabase/client'
import type {
  TemplateSection,
  TemplateTask,
  DailyEntry,
  SectionEntry,
  TaskInstance,
  TemplateSectionWithTasks,
} from '@/types/database'

interface JournalState {
  // Template data
  templateSections: TemplateSectionWithTasks[]
  loadingTemplates: boolean

  // Daily entry data
  currentDate: string
  dailyEntry: DailyEntry | null
  sectionEntries: (SectionEntry & { task_instances: TaskInstance[] })[]
  loadingEntry: boolean

  // Actions
  setCurrentDate: (date: string) => void
  fetchTemplateSections: () => Promise<void>
  fetchDailyEntry: (date: string) => Promise<void>
  createOrGetDailyEntry: (date: string) => Promise<DailyEntry>
  updateSectionContent: (sectionEntryId: string, content: string) => Promise<void>
  updateSectionMood: (sectionEntryId: string, mood: string) => Promise<void>
  toggleTask: (taskInstanceId: string, isCompleted: boolean) => Promise<void>
  addCustomTask: (sectionEntryId: string, title: string) => Promise<void>
}

export const useJournalStore = create<JournalState>((set, get) => ({
  templateSections: [],
  loadingTemplates: false,
  currentDate: new Date().toISOString().split('T')[0],
  dailyEntry: null,
  sectionEntries: [],
  loadingEntry: false,

  setCurrentDate: (date) => set({ currentDate: date }),

  fetchTemplateSections: async () => {
    set({ loadingTemplates: true })
    const supabase = createClient()

    const { data: sections, error: sectionsError } = await supabase
      .from('template_sections')
      .select('*')
      .eq('is_active', true)
      .order('order_index')

    if (sectionsError) {
      console.error('Error fetching sections:', sectionsError)
      set({ loadingTemplates: false })
      return
    }

    const { data: tasks, error: tasksError } = await supabase
      .from('template_tasks')
      .select('*')
      .eq('is_active', true)
      .order('order_index')

    if (tasksError) {
      console.error('Error fetching tasks:', tasksError)
      set({ loadingTemplates: false })
      return
    }

    const sectionsWithTasks: TemplateSectionWithTasks[] = (sections || []).map((section) => ({
      ...section,
      template_tasks: (tasks || []).filter((task) => task.section_id === section.id),
    }))

    set({ templateSections: sectionsWithTasks, loadingTemplates: false })
  },

  fetchDailyEntry: async (date) => {
    set({ loadingEntry: true })
    const supabase = createClient()

    // Fetch daily entry
    const { data: entry } = await supabase
      .from('daily_entries')
      .select('*')
      .eq('date', date)
      .single()

    if (!entry) {
      set({ dailyEntry: null, sectionEntries: [], loadingEntry: false })
      return
    }

    // Fetch section entries with task instances
    const { data: sections } = await supabase
      .from('section_entries')
      .select('*, task_instances(*)')
      .eq('daily_entry_id', entry.id)

    set({
      dailyEntry: entry,
      sectionEntries: sections || [],
      loadingEntry: false,
    })
  },

  createOrGetDailyEntry: async (date) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Not authenticated')

    // Check if entry exists
    const { data: existing } = await supabase
      .from('daily_entries')
      .select('*')
      .eq('date', date)
      .single()

    if (existing) {
      return existing
    }

    // Create new daily entry
    const { data: newEntry, error: entryError } = await supabase
      .from('daily_entries')
      .insert({ user_id: user.id, date })
      .select()
      .single()

    if (entryError || !newEntry) {
      throw entryError || new Error('Failed to create entry')
    }

    // Get template sections with tasks
    const { templateSections } = get()

    // Create section entries and task instances for each template section
    for (const section of templateSections) {
      const { data: sectionEntry, error: sectionError } = await supabase
        .from('section_entries')
        .insert({
          daily_entry_id: newEntry.id,
          section_id: section.id,
          section_name: section.name,
          section_icon: section.icon,
          section_color: section.color,
        })
        .select()
        .single()

      if (sectionError || !sectionEntry) continue

      // Create task instances from template tasks
      const taskInstances = section.template_tasks.map((task) => ({
        daily_entry_id: newEntry.id,
        template_task_id: task.id,
        section_entry_id: sectionEntry.id,
        title: task.title,
        priority: task.priority,
      }))

      if (taskInstances.length > 0) {
        await supabase.from('task_instances').insert(taskInstances)
      }
    }

    // Refresh the daily entry data
    await get().fetchDailyEntry(date)

    return newEntry
  },

  updateSectionContent: async (sectionEntryId, content) => {
    const supabase = createClient()

    await supabase
      .from('section_entries')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('id', sectionEntryId)

    // Update local state
    set((state) => ({
      sectionEntries: state.sectionEntries.map((s) =>
        s.id === sectionEntryId ? { ...s, content } : s
      ),
    }))
  },

  updateSectionMood: async (sectionEntryId, mood) => {
    const supabase = createClient()

    await supabase
      .from('section_entries')
      .update({ mood })
      .eq('id', sectionEntryId)

    set((state) => ({
      sectionEntries: state.sectionEntries.map((s) =>
        s.id === sectionEntryId ? { ...s, mood } : s
      ),
    }))
  },

  toggleTask: async (taskInstanceId, isCompleted) => {
    const supabase = createClient()

    await supabase
      .from('task_instances')
      .update({
        is_completed: isCompleted,
        completed_at: isCompleted ? new Date().toISOString() : null,
      })
      .eq('id', taskInstanceId)

    set((state) => ({
      sectionEntries: state.sectionEntries.map((section) => ({
        ...section,
        task_instances: section.task_instances.map((task) =>
          task.id === taskInstanceId
            ? { ...task, is_completed: isCompleted, completed_at: isCompleted ? new Date().toISOString() : null }
            : task
        ),
      })),
    }))
  },

  addCustomTask: async (sectionEntryId, title) => {
    const supabase = createClient()
    const { dailyEntry } = get()

    if (!dailyEntry) return

    const { data: newTask } = await supabase
      .from('task_instances')
      .insert({
        daily_entry_id: dailyEntry.id,
        section_entry_id: sectionEntryId,
        title,
        priority: 'medium',
      })
      .select()
      .single()

    if (newTask) {
      set((state) => ({
        sectionEntries: state.sectionEntries.map((section) =>
          section.id === sectionEntryId
            ? { ...section, task_instances: [...section.task_instances, newTask] }
            : section
        ),
      }))
    }
  },
}))
