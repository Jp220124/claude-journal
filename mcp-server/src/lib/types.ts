// Types for Claude Journal MCP Server
// Derived from the main application's database types

// =====================================================
// Notes System Types
// =====================================================

export interface Note {
  id: string;
  user_id: string;
  title: string;
  content: Record<string, unknown>; // TipTap JSON content
  content_text: string; // Plain text for search
  folder_id: string | null;
  is_pinned: boolean;
  is_archived: boolean;
  word_count: number;
  created_at: string;
  updated_at: string;
  is_locked?: boolean;
}

export interface NoteFolder {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  parent_folder_id: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface NoteTag {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}

// =====================================================
// Tasks System Types
// =====================================================

export interface Todo {
  id: string;
  user_id: string;
  title: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  due_date: string | null;
  due_time: string | null;
  category: string | null;
  category_id: string | null;
  recurrence: string | null;
  notes: string | null;
  completed_date: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface TaskCategory {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  is_recurring: boolean;
  order_index: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// =====================================================
// Journal Entry Types
// =====================================================

export interface JournalEntry {
  id: string;
  user_id: string;
  date: string;
  title: string | null;
  content: string | null;
  mood: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface DailyEntry {
  id: string;
  user_id: string;
  date: string;
  overall_mood: string | null;
  overall_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SectionEntry {
  id: string;
  daily_entry_id: string;
  section_id: string | null;
  section_name: string | null;
  section_icon: string | null;
  section_color: string | null;
  content: string | null;
  mood: string | null;
  created_at: string;
  updated_at: string;
}

// =====================================================
// MCP Response Types
// =====================================================

// MCP SDK expects an index signature for tool results
export interface MCPToolResult {
  [key: string]: unknown;
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}

export function createTextResult(text: string, isError = false): MCPToolResult {
  return {
    content: [{ type: 'text' as const, text }],
    isError,
  };
}

export function createJsonResult(data: unknown, isError = false): MCPToolResult {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
    isError,
  };
}

export function createErrorResult(message: string): MCPToolResult {
  return createTextResult(`Error: ${message}`, true);
}
