export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      template_sections: {
        Row: {
          id: string
          user_id: string
          name: string
          icon: string | null
          color: string | null
          order_index: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          icon?: string | null
          color?: string | null
          order_index?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          icon?: string | null
          color?: string | null
          order_index?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      template_tasks: {
        Row: {
          id: string
          section_id: string
          user_id: string
          title: string
          priority: 'high' | 'medium' | 'low'
          order_index: number
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          section_id: string
          user_id: string
          title: string
          priority?: 'high' | 'medium' | 'low'
          order_index?: number
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          section_id?: string
          user_id?: string
          title?: string
          priority?: 'high' | 'medium' | 'low'
          order_index?: number
          is_active?: boolean
          created_at?: string
        }
      }
      daily_entries: {
        Row: {
          id: string
          user_id: string
          date: string
          overall_mood: string | null
          overall_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          overall_mood?: string | null
          overall_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          overall_mood?: string | null
          overall_notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      section_entries: {
        Row: {
          id: string
          daily_entry_id: string
          section_id: string | null
          section_name: string | null
          section_icon: string | null
          section_color: string | null
          content: string | null
          mood: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          daily_entry_id: string
          section_id?: string | null
          section_name?: string | null
          section_icon?: string | null
          section_color?: string | null
          content?: string | null
          mood?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          daily_entry_id?: string
          section_id?: string | null
          section_name?: string | null
          section_icon?: string | null
          section_color?: string | null
          content?: string | null
          mood?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      task_instances: {
        Row: {
          id: string
          daily_entry_id: string
          template_task_id: string | null
          section_entry_id: string
          title: string
          is_completed: boolean
          completed_at: string | null
          notes: string | null
          priority: 'high' | 'medium' | 'low'
        }
        Insert: {
          id?: string
          daily_entry_id: string
          template_task_id?: string | null
          section_entry_id: string
          title: string
          is_completed?: boolean
          completed_at?: string | null
          notes?: string | null
          priority?: 'high' | 'medium' | 'low'
        }
        Update: {
          id?: string
          daily_entry_id?: string
          template_task_id?: string | null
          section_entry_id?: string
          title?: string
          is_completed?: boolean
          completed_at?: string | null
          notes?: string | null
          priority?: 'high' | 'medium' | 'low'
        }
      }
      tags: {
        Row: {
          id: string
          user_id: string
          name: string
          color: string | null
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          color?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          color?: string | null
        }
      }
      entry_tags: {
        Row: {
          entry_id: string
          tag_id: string
        }
        Insert: {
          entry_id: string
          tag_id: string
        }
        Update: {
          entry_id?: string
          tag_id?: string
        }
      }
      attachments: {
        Row: {
          id: string
          user_id: string
          section_entry_id: string
          file_url: string
          file_name: string | null
          file_type: string | null
          file_size: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          section_entry_id: string
          file_url: string
          file_name?: string | null
          file_type?: string | null
          file_size?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          section_entry_id?: string
          file_url?: string
          file_name?: string | null
          file_type?: string | null
          file_size?: number | null
          created_at?: string
        }
      }
      user_settings: {
        Row: {
          user_id: string
          theme: 'light' | 'dark' | 'system'
          reminder_time: string | null
          reminder_enabled: boolean
          streak_count: number
          last_entry_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          theme?: 'light' | 'dark' | 'system'
          reminder_time?: string | null
          reminder_enabled?: boolean
          streak_count?: number
          last_entry_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          theme?: 'light' | 'dark' | 'system'
          reminder_time?: string | null
          reminder_enabled?: boolean
          streak_count?: number
          last_entry_date?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      journal_entries: {
        Row: {
          id: string
          user_id: string
          date: string
          title: string | null
          content: string | null
          mood: string | null
          tags: string[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          title?: string | null
          content?: string | null
          mood?: string | null
          tags?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          title?: string | null
          content?: string | null
          mood?: string | null
          tags?: string[] | null
          created_at?: string
          updated_at?: string
        }
      }
      todos: {
        Row: {
          id: string
          user_id: string
          title: string
          completed: boolean
          priority: 'low' | 'medium' | 'high'
          due_date: string | null
          due_time: string | null
          category: string | null
          category_id: string | null
          recurrence: string | null
          notes: string | null
          completed_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          completed?: boolean
          priority?: 'low' | 'medium' | 'high'
          due_date?: string | null
          due_time?: string | null
          category?: string | null
          category_id?: string | null
          recurrence?: string | null
          notes?: string | null
          completed_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          completed?: boolean
          priority?: 'low' | 'medium' | 'high'
          due_date?: string | null
          due_time?: string | null
          category?: string | null
          category_id?: string | null
          recurrence?: string | null
          notes?: string | null
          completed_date?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      // =====================================================
      // Task Categories System
      // =====================================================
      task_categories: {
        Row: {
          id: string
          user_id: string
          name: string
          icon: string
          color: string
          is_recurring: boolean
          order_index: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          icon?: string
          color?: string
          is_recurring?: boolean
          order_index?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          icon?: string
          color?: string
          is_recurring?: boolean
          order_index?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      // =====================================================
      // Journal Templates System Tables
      // =====================================================
      journal_templates: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          icon: string
          color: string
          is_default: boolean
          is_active: boolean
          order_index: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          icon?: string
          color?: string
          is_default?: boolean
          is_active?: boolean
          order_index?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          icon?: string
          color?: string
          is_default?: boolean
          is_active?: boolean
          order_index?: number
          created_at?: string
          updated_at?: string
        }
      }
      journal_template_sections: {
        Row: {
          id: string
          template_id: string
          user_id: string
          name: string
          description: string | null
          icon: string
          color: string
          order_index: number
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          template_id: string
          user_id: string
          name: string
          description?: string | null
          icon?: string
          color?: string
          order_index?: number
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          template_id?: string
          user_id?: string
          name?: string
          description?: string | null
          icon?: string
          color?: string
          order_index?: number
          is_active?: boolean
          created_at?: string
        }
      }
      journal_template_entries: {
        Row: {
          id: string
          user_id: string
          template_id: string
          date: string
          overall_mood: string | null
          overall_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          template_id: string
          date: string
          overall_mood?: string | null
          overall_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          template_id?: string
          date?: string
          overall_mood?: string | null
          overall_notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      journal_template_section_entries: {
        Row: {
          id: string
          entry_id: string
          section_id: string | null
          section_name: string | null
          section_icon: string | null
          section_color: string | null
          content: string | null
          mood: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          entry_id: string
          section_id?: string | null
          section_name?: string | null
          section_icon?: string | null
          section_color?: string | null
          content?: string | null
          mood?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          entry_id?: string
          section_id?: string | null
          section_name?: string | null
          section_icon?: string | null
          section_color?: string | null
          content?: string | null
          mood?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}

// Helper types
export type TemplateSection = Database['public']['Tables']['template_sections']['Row']
export type TemplateTask = Database['public']['Tables']['template_tasks']['Row']
export type DailyEntry = Database['public']['Tables']['daily_entries']['Row']
export type SectionEntry = Database['public']['Tables']['section_entries']['Row']
export type TaskInstance = Database['public']['Tables']['task_instances']['Row']
export type Tag = Database['public']['Tables']['tags']['Row']
export type Attachment = Database['public']['Tables']['attachments']['Row']
export type UserSettings = Database['public']['Tables']['user_settings']['Row']
export type JournalEntry = Database['public']['Tables']['journal_entries']['Row']
export type JournalEntryInsert = Database['public']['Tables']['journal_entries']['Insert']
export type JournalEntryUpdate = Database['public']['Tables']['journal_entries']['Update']

// Journal Template System Types
export type JournalTemplate = Database['public']['Tables']['journal_templates']['Row']
export type JournalTemplateInsert = Database['public']['Tables']['journal_templates']['Insert']
export type JournalTemplateUpdate = Database['public']['Tables']['journal_templates']['Update']

export type JournalTemplateSection = Database['public']['Tables']['journal_template_sections']['Row']
export type JournalTemplateSectionInsert = Database['public']['Tables']['journal_template_sections']['Insert']
export type JournalTemplateSectionUpdate = Database['public']['Tables']['journal_template_sections']['Update']

export type JournalTemplateEntry = Database['public']['Tables']['journal_template_entries']['Row']
export type JournalTemplateEntryInsert = Database['public']['Tables']['journal_template_entries']['Insert']
export type JournalTemplateEntryUpdate = Database['public']['Tables']['journal_template_entries']['Update']

export type JournalTemplateSectionEntry = Database['public']['Tables']['journal_template_section_entries']['Row']
export type JournalTemplateSectionEntryInsert = Database['public']['Tables']['journal_template_section_entries']['Insert']
export type JournalTemplateSectionEntryUpdate = Database['public']['Tables']['journal_template_section_entries']['Update']

// Extended types with relations
export interface TemplateSectionWithTasks extends TemplateSection {
  template_tasks: TemplateTask[]
}

export interface SectionEntryWithTasks extends SectionEntry {
  task_instances: TaskInstance[]
  attachments: Attachment[]
}

export interface DailyEntryWithSections extends DailyEntry {
  section_entries: SectionEntryWithTasks[]
  tags: Tag[]
}

// Journal Template Extended Types
export interface JournalTemplateWithSections extends JournalTemplate {
  journal_template_sections: JournalTemplateSection[]
}

export interface JournalTemplateEntryWithSections extends JournalTemplateEntry {
  journal_template_section_entries: JournalTemplateSectionEntry[]
  journal_templates?: JournalTemplate
}

// Task Category Types
export type TaskCategory = Database['public']['Tables']['task_categories']['Row']
export type TaskCategoryInsert = Database['public']['Tables']['task_categories']['Insert']
export type TaskCategoryUpdate = Database['public']['Tables']['task_categories']['Update']

// Todo type alias
export type Todo = Database['public']['Tables']['todos']['Row']
export type TodoInsert = Database['public']['Tables']['todos']['Insert']
export type TodoUpdate = Database['public']['Tables']['todos']['Update']

// Extended types with relations
export interface TodoWithCategory extends Todo {
  task_categories?: TaskCategory | null
}

export interface TaskCategoryWithTodos extends TaskCategory {
  todos: Todo[]
}

// =====================================================
// Notes System Types
// =====================================================

export interface NoteFolder {
  id: string
  user_id: string
  name: string
  icon: string
  color: string
  parent_folder_id: string | null
  order_index: number
  created_at: string
  updated_at: string
}

// Research source reference type
export interface ResearchSource {
  title: string
  url: string
  author?: string
  publishedDate?: string
}

export interface Note {
  id: string
  user_id: string
  title: string
  content: Record<string, unknown> // TipTap JSON content
  content_text: string // Plain text for search
  folder_id: string | null
  is_pinned: boolean
  is_archived: boolean
  word_count: number
  created_at: string
  updated_at: string
  // Research automation fields
  research_job_id?: string | null
  source_type?: 'manual' | 'research' | 'import' | null
  sources?: ResearchSource[] | null
}

export interface NoteTag {
  id: string
  user_id: string
  name: string
  color: string
  created_at: string
}

export interface NoteTagLink {
  note_id: string
  tag_id: string
  created_at: string
}

export interface TaskNoteLink {
  id: string
  task_id: string
  note_id: string
  link_type: 'reference' | 'checklist' | 'attachment' | 'research'
  created_at: string
}

export interface NoteImage {
  id: string
  note_id: string
  user_id: string
  storage_path: string
  file_name: string
  file_size: number
  mime_type: string
  width: number | null
  height: number | null
  created_at: string
}

// Insert types
export interface NoteFolderInsert {
  name: string
  icon?: string
  color?: string
  parent_id?: string | null  // Maps to parent_folder_id in database
  order_index?: number
}

export interface NoteInsert {
  title?: string
  content?: Record<string, unknown>
  content_text?: string
  folder_id?: string | null
  is_pinned?: boolean
  is_archived?: boolean
  word_count?: number
}

export interface NoteTagInsert {
  name: string
  color?: string
}

// Update types
export interface NoteFolderUpdate {
  name?: string
  icon?: string
  color?: string
  parent_folder_id?: string | null
  order_index?: number
}

export interface NoteUpdate {
  title?: string
  content?: Record<string, unknown>
  content_text?: string
  folder_id?: string | null
  is_pinned?: boolean
  is_archived?: boolean
  word_count?: number
}

export interface NoteTagUpdate {
  name?: string
  color?: string
}

// Extended types with relations
export interface NoteWithTags extends Note {
  tags: NoteTag[]
}

export interface NoteWithLinkedTasks extends Note {
  linked_tasks: Array<{
    task_id: string
    link_type: string
    task: Todo
  }>
}

export interface NoteFolderWithNotes extends NoteFolder {
  notes: Note[]
  note_count?: number
}

// =====================================================
// Note Folder Tree Types (for hierarchical display)
// =====================================================

export interface NoteFolderTreeNode extends NoteFolder {
  children: NoteFolderTreeNode[]
  note_count: number
  depth: number
  isExpanded?: boolean
}

export interface NoteBreadcrumbSegment {
  id: string
  name: string
}

// =====================================================
// Note Sharing Types
// =====================================================

export interface NoteShare {
  id: string
  note_id: string
  share_token: string
  created_by: string
  expires_at: string | null
  is_active: boolean
  password_hash: string | null
  view_count: number
  allow_copy: boolean
  created_at: string
  updated_at: string
}

export interface NoteShareInsert {
  note_id: string
  expires_at?: string | null
  password?: string | null
  allow_copy?: boolean
}

export interface NoteShareUpdate {
  expires_at?: string | null
  is_active?: boolean
  password?: string | null
  allow_copy?: boolean
}

export interface PublicNote {
  note_id: string
  title: string
  content: Record<string, unknown>
  allow_copy: boolean
  has_password: boolean
  created_at: string
}
