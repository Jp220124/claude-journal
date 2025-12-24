/**
 * Project AI Chat API
 *
 * Provides AI chat functionality with full project context.
 * The AI has knowledge of all tasks, notes, files, and events in the project.
 * Supports AI tools for creating tasks, updating task status, creating notes, and searching.
 */

import { streamText, convertToModelMessages, UIMessage, tool } from 'ai'
import { google } from '@ai-sdk/google'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAIProvider, type AIProviderType } from '@/lib/ai/providers'
import { buildProjectSystemPrompt, getContextStats } from '@/lib/ai/projectContext'
import type { ProjectWithLinkedItems } from '@/types/projects'

export const runtime = 'nodejs'
export const maxDuration = 120 // Allow longer for comprehensive responses

interface ProjectChatRequest {
  projectId: string
  messages: UIMessage[]
  provider?: AIProviderType
  model?: string
}

/**
 * Load complete project data with all linked items
 */
async function loadProjectWithContext(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  projectId: string,
  userId: string
): Promise<ProjectWithLinkedItems | null> {
  // First, verify the user has access to this project
  const { data: projectData, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single()

  if (projectError || !projectData) {
    console.error('Project not found or access denied:', projectError)
    return null
  }

  // Type the project data
  const project = projectData as {
    id: string
    user_id: string
    name: string
    description: string | null
    color: string
    icon: string
    status: string
    start_date: string | null
    target_date: string | null
    created_at: string
    updated_at: string
  }

  // Load all linked data in parallel
  const [tasksResult, notesResult, filesResult, eventsResult] = await Promise.all([
    // Load linked tasks with full task data
    supabase
      .from('project_tasks')
      .select(`
        id,
        task_id,
        added_at,
        added_by,
        todos:task_id (
          id,
          title,
          completed,
          priority,
          due_date,
          due_time,
          notes,
          category_id,
          created_at
        )
      `)
      .eq('project_id', projectId),

    // Load linked notes with full note data
    supabase
      .from('project_notes')
      .select(`
        id,
        note_id,
        added_at,
        added_by,
        notes:note_id (
          id,
          title,
          content,
          created_at,
          updated_at
        )
      `)
      .eq('project_id', projectId),

    // Load project files
    supabase
      .from('project_files')
      .select('*')
      .eq('project_id', projectId)
      .order('uploaded_at', { ascending: false }),

    // Load linked calendar events
    supabase
      .from('project_events')
      .select(`
        id,
        event_id,
        added_at,
        added_by,
        calendar_events:event_id (*)
      `)
      .eq('project_id', projectId)
  ])

  // Define types for the query results
  type TaskQueryResult = {
    id: string
    task_id: string
    added_at: string
    added_by: string | null
    todos: {
      id: string
      title: string
      completed: boolean
      priority: 'low' | 'medium' | 'high'
      due_date: string | null
      due_time: string | null
      notes: string | null
      category_id: string | null
      created_at: string
    } | null
  }

  type NoteQueryResult = {
    id: string
    note_id: string
    added_at: string
    added_by: string | null
    notes: {
      id: string
      title: string
      content: string | null
      created_at: string
      updated_at: string
    } | null
  }

  type EventQueryResult = {
    id: string
    event_id: string
    added_at: string
    added_by: string | null
    calendar_events: ProjectWithLinkedItems['events'][0] | null
  }

  // Transform the data into the expected format
  const tasksData = (tasksResult.data || []) as TaskQueryResult[]
  const tasks = tasksData
    .filter(t => t.todos)
    .map(t => ({
      link_id: t.id,
      task_id: t.task_id,
      added_at: t.added_at,
      added_by: t.added_by,
      task: t.todos!
    }))

  const notesData = (notesResult.data || []) as NoteQueryResult[]
  const notes = notesData
    .filter(n => n.notes)
    .map(n => ({
      link_id: n.id,
      note_id: n.note_id,
      added_at: n.added_at,
      added_by: n.added_by,
      note: n.notes!
    }))

  const files = (filesResult.data || []) as ProjectWithLinkedItems['files']

  const eventsData = (eventsResult.data || []) as EventQueryResult[]
  const events = eventsData
    .filter(e => e.calendar_events)
    .map(e => e.calendar_events!) as ProjectWithLinkedItems['events']

  // Calculate progress
  const completedTasks = tasks.filter(t => t.task.completed).length
  const totalTasks = tasks.length
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  return {
    ...project,
    tasks,
    notes,
    files,
    events,
    members: [], // Not needed for AI context
    progress: {
      total_tasks: totalTasks,
      completed_tasks: completedTasks,
      progress_percent: progressPercent
    }
  } as ProjectWithLinkedItems
}

// =====================================================
// AI TOOL DEFINITIONS
// =====================================================

/**
 * Create a task and link it to the current project
 */
async function executeCreateTask(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  userId: string,
  projectId: string,
  params: { title: string; priority?: string; dueDate?: string; notes?: string }
) {
  try {
    // Create the task
    const { data: task, error: taskError } = await supabase
      .from('todos')
      .insert({
        user_id: userId,
        title: params.title,
        priority: params.priority || 'medium',
        due_date: params.dueDate || null,
        notes: params.notes || null,
        completed: false,
      })
      .select()
      .single()

    if (taskError || !task) {
      console.error('Error creating task:', taskError)
      return { success: false, error: 'Failed to create task' }
    }

    // Link task to project
    const { error: linkError } = await supabase
      .from('project_tasks')
      .insert({
        project_id: projectId,
        task_id: task.id,
        added_by: userId,
      })

    if (linkError) {
      console.error('Error linking task to project:', linkError)
      // Task was created but not linked - still report success
    }

    return {
      success: true,
      task: {
        id: task.id,
        title: task.title,
        priority: task.priority,
        dueDate: task.due_date,
      },
    }
  } catch (error) {
    console.error('executeCreateTask error:', error)
    return { success: false, error: 'Failed to create task' }
  }
}

/**
 * Update task completion status
 */
async function executeUpdateTaskStatus(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  taskId: string,
  completed: boolean
) {
  try {
    const { data, error } = await supabase
      .from('todos')
      .update({
        completed,
        completed_date: completed ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId)
      .select('id, title, completed')
      .single()

    if (error || !data) {
      console.error('Error updating task status:', error)
      return { success: false, error: 'Failed to update task status' }
    }

    return {
      success: true,
      task: data,
    }
  } catch (error) {
    console.error('executeUpdateTaskStatus error:', error)
    return { success: false, error: 'Failed to update task status' }
  }
}

/**
 * Create a note and link it to the current project
 */
async function executeCreateNote(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  userId: string,
  projectId: string,
  params: { title: string; content: string }
) {
  try {
    // Create TipTap-compatible content structure
    const contentJson = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: params.content }],
        },
      ],
    }

    // Create the note
    const { data: note, error: noteError } = await supabase
      .from('notes')
      .insert({
        user_id: userId,
        title: params.title,
        content: contentJson,
        content_text: params.content,
        word_count: params.content.split(/\s+/).filter(Boolean).length,
      })
      .select()
      .single()

    if (noteError || !note) {
      console.error('Error creating note:', noteError)
      return { success: false, error: 'Failed to create note' }
    }

    // Link note to project
    const { error: linkError } = await supabase
      .from('project_notes')
      .insert({
        project_id: projectId,
        note_id: note.id,
        added_by: userId,
      })

    if (linkError) {
      console.error('Error linking note to project:', linkError)
      // Note was created but not linked - still report success
    }

    return {
      success: true,
      note: {
        id: note.id,
        title: note.title,
      },
    }
  } catch (error) {
    console.error('executeCreateNote error:', error)
    return { success: false, error: 'Failed to create note' }
  }
}

/**
 * Search across project content (tasks, notes)
 */
async function executeSearchContent(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  projectId: string,
  query: string
) {
  try {
    const searchLower = query.toLowerCase()
    const results: Array<{
      type: 'task' | 'note'
      id: string
      title: string
      snippet: string
      relevance: number
    }> = []

    // Search tasks linked to this project
    const { data: taskLinks } = await supabase
      .from('project_tasks')
      .select(`
        task_id,
        todos (
          id,
          title,
          notes,
          completed,
          priority
        )
      `)
      .eq('project_id', projectId)

    // Search through tasks
    if (taskLinks) {
      for (const link of taskLinks) {
        const task = link.todos as unknown as {
          id: string
          title: string
          notes: string | null
          completed: boolean
          priority: string
        }
        if (!task) continue

        const titleMatch = task.title?.toLowerCase().includes(searchLower)
        const notesMatch = task.notes?.toLowerCase().includes(searchLower)

        if (titleMatch || notesMatch) {
          results.push({
            type: 'task',
            id: task.id,
            title: task.title,
            snippet: task.notes
              ? task.notes.substring(0, 100) + (task.notes.length > 100 ? '...' : '')
              : `Priority: ${task.priority}, Status: ${task.completed ? 'Completed' : 'Pending'}`,
            relevance: titleMatch ? 2 : 1,
          })
        }
      }
    }

    // Search notes linked to this project
    const { data: noteLinks } = await supabase
      .from('project_notes')
      .select(`
        note_id,
        notes (
          id,
          title,
          content_text
        )
      `)
      .eq('project_id', projectId)

    // Search through notes
    if (noteLinks) {
      for (const link of noteLinks) {
        const note = link.notes as unknown as {
          id: string
          title: string
          content_text: string | null
        }
        if (!note) continue

        const titleMatch = note.title?.toLowerCase().includes(searchLower)
        const contentMatch = note.content_text?.toLowerCase().includes(searchLower)

        if (titleMatch || contentMatch) {
          results.push({
            type: 'note',
            id: note.id,
            title: note.title,
            snippet: note.content_text
              ? note.content_text.substring(0, 150) + (note.content_text.length > 150 ? '...' : '')
              : 'No content preview available',
            relevance: titleMatch ? 2 : 1,
          })
        }
      }
    }

    // Sort by relevance
    results.sort((a, b) => b.relevance - a.relevance)

    return {
      success: true,
      query,
      results: results.slice(0, 10), // Limit to 10 results
      totalFound: results.length,
    }
  } catch (error) {
    console.error('executeSearchContent error:', error)
    return { success: false, error: 'Failed to search content', results: [] }
  }
}

/**
 * Build AI tools with access to project context
 * Note: Using simple required parameters to ensure Gemini API compatibility
 */
function buildProjectTools(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  userId: string,
  projectId: string
) {
  // Define schemas separately for clarity
  const createTaskSchema = z.object({
    title: z.string().min(1).describe('The title/name of the task (required)'),
    priority: z.string().describe('Task priority: "low", "medium", or "high". Defaults to "medium" if not specified.'),
    dueDate: z.string().describe('Due date in YYYY-MM-DD format. Use empty string "" if no date specified.'),
    notes: z.string().describe('Additional notes or description. Use empty string "" if none.'),
  })

  const updateTaskStatusSchema = z.object({
    taskId: z.string().min(1).describe('The ID of the task to update (from the project context)'),
    completed: z.boolean().describe('Set to true to mark complete, false to mark incomplete'),
  })

  const createNoteSchema = z.object({
    title: z.string().min(1).describe('The title of the note (required)'),
    content: z.string().min(1).describe('The content/body of the note (required)'),
  })

  const searchContentSchema = z.object({
    query: z.string().min(1).describe('The search query to look for in tasks and notes'),
  })

  return {
    createTask: tool({
      description: 'Create a new task and link it to this project. Use when the user asks to add a task, todo, or action item. Always provide all parameters - use empty string for optional fields if not specified.',
      inputSchema: createTaskSchema,
      execute: async (params) => {
        console.log('AI Tool: createTask called with', params)
        // Clean and normalize parameters
        const cleanParams = {
          title: params.title,
          priority: ['low', 'medium', 'high'].includes(params.priority) ? params.priority : 'medium',
          dueDate: params.dueDate && params.dueDate.trim() !== '' ? params.dueDate : undefined,
          notes: params.notes && params.notes.trim() !== '' ? params.notes : undefined,
        }
        return executeCreateTask(supabase, userId, projectId, cleanParams)
      },
    }),

    updateTaskStatus: tool({
      description: 'Mark a task as complete or incomplete. Use when the user asks to complete, finish, check off, or reopen a task. You must reference a task by its ID from the project context.',
      inputSchema: updateTaskStatusSchema,
      execute: async ({ taskId, completed }) => {
        console.log('AI Tool: updateTaskStatus called with', { taskId, completed })
        return executeUpdateTaskStatus(supabase, taskId, completed)
      },
    }),

    createNote: tool({
      description: 'Create a new note and link it to this project. Use when the user asks to add a note, write something down, document information, or save text.',
      inputSchema: createNoteSchema,
      execute: async (params) => {
        console.log('AI Tool: createNote called with', params)
        return executeCreateNote(supabase, userId, projectId, params)
      },
    }),

    searchContent: tool({
      description: 'Search through project tasks and notes to find relevant content. Use when the user asks to find, search, or look up information in the project.',
      inputSchema: searchContentSchema,
      execute: async ({ query }) => {
        console.log('AI Tool: searchContent called with', query)
        return executeSearchContent(supabase, projectId, query)
      },
    }),
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const body: ProjectChatRequest = await request.json()
    const { projectId, messages, provider: requestedProvider, model } = body

    if (!projectId) {
      return new Response(JSON.stringify({ error: 'Project ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Messages are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Load project with full context
    const project = await loadProjectWithContext(supabase, projectId, user.id)

    if (!project) {
      return new Response(JSON.stringify({
        error: 'Project not found',
        message: 'The project does not exist or you do not have access to it.'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Log context stats for debugging
    const stats = getContextStats(project)
    console.log(`Project AI Chat - Context loaded:`, {
      projectName: project.name,
      tasks: stats.taskCount,
      notes: stats.noteCount,
      files: stats.fileCount,
      events: stats.eventCount,
      estimatedTokens: stats.estimatedTokens
    })

    // Build the comprehensive system prompt with project context
    const systemPrompt = buildProjectSystemPrompt(project)

    // Use Google Gemini API
    const geminiApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY

    if (!geminiApiKey) {
      return new Response(JSON.stringify({
        error: 'No AI provider configured',
        message: 'Please configure the Gemini API key to use Project AI chat.',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Create Google Gemini model - using gemini-2.0-flash for fast responses
    const aiModel = google('gemini-2.0-flash', {
      apiKey: geminiApiKey,
    })

    // Build AI tools with project context
    const projectTools = buildProjectTools(supabase, user.id, projectId)

    // Convert messages
    const modelMessages = await convertToModelMessages(messages)

    // Stream the response with tools
    const result = streamText({
      model: aiModel,
      system: systemPrompt,
      messages: modelMessages,
      tools: projectTools,
      maxSteps: 5, // Allow up to 5 tool calls per request
      onError({ error }) {
        console.error('Project AI Stream error:', error)
      },
    })

    return result.toUIMessageStreamResponse({
      onError: (error) => {
        if (error instanceof Error) {
          return error.message
        }
        return 'An error occurred while generating the response.'
      },
    })
  } catch (error) {
    console.error('Project AI chat error:', error)
    return new Response(JSON.stringify({
      error: 'AI request failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

/**
 * GET endpoint to fetch context stats without starting a chat
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const url = new URL(request.url)
    const projectId = url.searchParams.get('projectId')

    if (!projectId) {
      return new Response(JSON.stringify({ error: 'Project ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Load project with context
    const project = await loadProjectWithContext(supabase, projectId, user.id)

    if (!project) {
      return new Response(JSON.stringify({ error: 'Project not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const stats = getContextStats(project)

    return new Response(JSON.stringify({
      success: true,
      stats,
      projectName: project.name
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error fetching context stats:', error)
    return new Response(JSON.stringify({
      error: 'Failed to fetch context stats',
      message: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
