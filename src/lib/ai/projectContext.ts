/**
 * Project Context Builder
 *
 * Builds comprehensive AI context from project data for the Project AI Assistant.
 * This enables the AI to have full knowledge of all tasks, notes, files, and events
 * in a project.
 */

import type {
  ProjectWithLinkedItems,
  ProjectLinkedTask,
  ProjectLinkedNote,
  ProjectFile,
  CalendarEvent
} from '@/types/projects'

// Maximum characters for note content to avoid token overflow
const MAX_NOTE_CONTENT_LENGTH = 5000
const MAX_TOTAL_NOTES_LENGTH = 50000
const MAX_TASK_NOTES_LENGTH = 500

/**
 * Truncate text with ellipsis if it exceeds max length
 */
function truncateText(text: string | null | undefined, maxLength: number): string {
  // Ensure we have a string
  const str = String(text || '')
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength - 3) + '...'
}

/**
 * Format a date string for display
 */
function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Not set'
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  } catch {
    return dateStr
  }
}

/**
 * Format task priority for display
 */
function formatPriority(priority: 'low' | 'medium' | 'high'): string {
  const icons: Record<string, string> = {
    high: '🔴 High',
    medium: '🟡 Medium',
    low: '🟢 Low'
  }
  return icons[priority] || priority
}

/**
 * Build the tasks section of the system prompt
 */
function buildTasksSection(tasks: ProjectLinkedTask[]): string {
  if (tasks.length === 0) {
    return '## Tasks\nNo tasks linked to this project yet.\n'
  }

  const pendingTasks = tasks.filter(t => !t.task.completed)
  const completedTasks = tasks.filter(t => t.task.completed)

  let section = `## Tasks (${tasks.length} total, ${completedTasks.length} completed)\n\n`

  // Pending tasks first (more relevant for AI assistance)
  if (pendingTasks.length > 0) {
    section += '### Pending Tasks\n'
    for (const { task } of pendingTasks) {
      section += `- **${task.title}**\n`
      section += `  - Priority: ${formatPriority(task.priority)}\n`
      section += `  - Due: ${formatDate(task.due_date)}${task.due_time ? ` at ${task.due_time}` : ''}\n`
      if (task.notes) {
        section += `  - Notes: ${truncateText(task.notes, MAX_TASK_NOTES_LENGTH)}\n`
      }
      section += '\n'
    }
  }

  // Completed tasks (summarized)
  if (completedTasks.length > 0) {
    section += '### Completed Tasks\n'
    for (const { task } of completedTasks) {
      section += `- ✅ ${task.title}\n`
    }
    section += '\n'
  }

  return section
}

/**
 * Build the notes section of the system prompt
 */
function buildNotesSection(notes: ProjectLinkedNote[]): string {
  if (notes.length === 0) {
    return '## Notes\nNo notes linked to this project yet.\n'
  }

  let section = `## Notes (${notes.length} total)\n\n`
  let totalLength = 0

  for (const { note } of notes) {
    const noteContent = note.content || 'No content'
    const truncatedContent = truncateText(noteContent, MAX_NOTE_CONTENT_LENGTH)

    // Check if we've hit the total length limit
    if (totalLength + truncatedContent.length > MAX_TOTAL_NOTES_LENGTH) {
      section += `\n*[${notes.length - notes.indexOf({ note, link_id: '', note_id: '', added_at: '', added_by: null } as ProjectLinkedNote)} more notes truncated for context limits]*\n`
      break
    }

    section += `### ${note.title}\n`
    section += `*Created: ${formatDate(note.created_at)}*\n\n`
    section += `${truncatedContent}\n\n`
    section += '---\n\n'

    totalLength += truncatedContent.length
  }

  return section
}

/**
 * Build the files section of the system prompt
 */
function buildFilesSection(files: ProjectFile[]): string {
  if (files.length === 0) {
    return '## Files\nNo files uploaded to this project yet.\n'
  }

  // Separate folders and files
  const folders = files.filter(f => f.is_folder)
  const actualFiles = files.filter(f => !f.is_folder)

  let section = `## Files (${actualFiles.length} files in ${folders.length} folders)\n\n`

  if (folders.length > 0) {
    section += '### Folders\n'
    for (const folder of folders) {
      section += `- 📁 ${folder.file_name}/\n`
    }
    section += '\n'
  }

  if (actualFiles.length > 0) {
    section += '### Files\n'
    for (const file of actualFiles) {
      const sizeStr = file.file_size
        ? `${(file.file_size / 1024).toFixed(1)} KB`
        : 'Unknown size'
      section += `- 📄 ${file.file_name} (${file.file_type || 'Unknown type'}, ${sizeStr})\n`
      if (file.description) {
        section += `  Description: ${file.description}\n`
      }
    }
  }

  return section + '\n'
}

/**
 * Build the calendar events section of the system prompt
 */
function buildEventsSection(events: CalendarEvent[]): string {
  if (events.length === 0) {
    return '## Calendar Events\nNo events scheduled for this project.\n'
  }

  // Sort by date
  const sortedEvents = [...events].sort((a, b) =>
    new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime()
  )

  const now = new Date()
  const upcomingEvents = sortedEvents.filter(e => new Date(e.start_datetime) >= now)
  const pastEvents = sortedEvents.filter(e => new Date(e.start_datetime) < now)

  let section = `## Calendar Events (${events.length} total)\n\n`

  if (upcomingEvents.length > 0) {
    section += '### Upcoming Events\n'
    for (const event of upcomingEvents) {
      const eventDate = new Date(event.start_datetime)
      const typeIcon: Record<string, string> = {
        deadline: '⏰',
        milestone: '🎯',
        meeting: '👥',
        event: '📅'
      }
      section += `- ${typeIcon[event.event_type] || '📅'} **${event.title}** - ${formatDate(event.start_datetime)}\n`
      if (event.description) {
        section += `  ${event.description}\n`
      }
    }
    section += '\n'
  }

  if (pastEvents.length > 0) {
    section += '### Past Events\n'
    for (const event of pastEvents.slice(-5)) { // Only show last 5 past events
      section += `- ✓ ${event.title} (${formatDate(event.start_datetime)})\n`
    }
  }

  return section + '\n'
}

/**
 * Build proactive insights based on project data
 */
function buildInsights(project: ProjectWithLinkedItems): string {
  const insights: string[] = []
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]

  // Check for overdue tasks
  const overdueTasks = project.tasks.filter(t =>
    !t.task.completed &&
    t.task.due_date &&
    t.task.due_date < todayStr
  )
  if (overdueTasks.length > 0) {
    insights.push(`⚠️ ${overdueTasks.length} task(s) are overdue and need attention`)
  }

  // Check for tasks due today
  const dueTodayTasks = project.tasks.filter(t =>
    !t.task.completed &&
    t.task.due_date === todayStr
  )
  if (dueTodayTasks.length > 0) {
    insights.push(`📅 ${dueTodayTasks.length} task(s) are due today`)
  }

  // Check for high priority pending tasks
  const highPriorityPending = project.tasks.filter(t =>
    !t.task.completed &&
    t.task.priority === 'high'
  )
  if (highPriorityPending.length > 0) {
    insights.push(`🔴 ${highPriorityPending.length} high-priority task(s) pending`)
  }

  // Check for upcoming deadlines
  const nextWeek = new Date(now)
  nextWeek.setDate(nextWeek.getDate() + 7)
  const upcomingDeadlines = project.events.filter(e =>
    e.event_type === 'deadline' &&
    new Date(e.start_datetime) >= now &&
    new Date(e.start_datetime) <= nextWeek
  )
  if (upcomingDeadlines.length > 0) {
    insights.push(`⏰ ${upcomingDeadlines.length} deadline(s) in the next 7 days`)
  }

  // Progress insight
  if (project.progress.total_tasks > 0) {
    const progressPercent = project.progress.progress_percent
    if (progressPercent === 100) {
      insights.push('🎉 All tasks completed! Project is 100% done.')
    } else if (progressPercent >= 75) {
      insights.push(`📊 Great progress! Project is ${progressPercent}% complete.`)
    } else if (progressPercent < 25 && project.tasks.length > 5) {
      insights.push(`📊 Project is only ${progressPercent}% complete. Consider prioritizing key tasks.`)
    }
  }

  if (insights.length === 0) {
    return ''
  }

  return `## Current Insights\n${insights.map(i => `- ${i}`).join('\n')}\n\n`
}

/**
 * Build the complete system prompt for project AI chat
 */
export function buildProjectSystemPrompt(project: ProjectWithLinkedItems): string {
  const statusLabels: Record<string, string> = {
    active: 'Active',
    on_hold: 'On Hold',
    completed: 'Completed',
    archived: 'Archived'
  }

  let prompt = `You are an expert AI assistant for the project "${project.name}".
You have complete knowledge of this project including all tasks, notes, files, and calendar events.
Your role is to help the user understand, manage, and make progress on this project.

Be helpful, concise, and proactive. If you notice issues (overdue tasks, approaching deadlines, blockers), mention them.
When discussing tasks or notes, reference them by name so the user can find them easily.

---

# Project: ${project.name}

## Overview
- **Status:** ${statusLabels[project.status] || project.status}
- **Description:** ${project.description || 'No description provided'}
- **Start Date:** ${formatDate(project.start_date)}
- **Target Date:** ${formatDate(project.target_date)}
- **Progress:** ${project.progress.completed_tasks}/${project.progress.total_tasks} tasks (${project.progress.progress_percent}%)
- **Created:** ${formatDate(project.created_at)}

`

  // Add insights section
  prompt += buildInsights(project)

  // Add all sections
  prompt += buildTasksSection(project.tasks)
  prompt += buildNotesSection(project.notes)
  prompt += buildFilesSection(project.files)
  prompt += buildEventsSection(project.events)

  prompt += `---

## Your Capabilities

### Information & Analysis
- Answer questions about this project's tasks, notes, files, and events
- Analyze project progress and identify potential issues
- Suggest task priorities based on deadlines and importance
- Find and summarize information from notes
- Help plan next steps and break down complex tasks
- Generate status reports and summaries

### Actions (AI Tools)
You have the ability to take actions on this project using tools:

1. **Create Task** - Add new tasks to the project
   - Use when the user says things like "add a task", "create a todo", "I need to...", "remind me to..."
   - Always confirm what you created

2. **Update Task Status** - Mark tasks as complete or incomplete
   - Use when the user says "mark as done", "complete", "finish", "reopen"
   - Reference tasks by name from the context above

3. **Create Note** - Add new notes to the project
   - Use when the user says "take a note", "write down", "document", "save this"
   - Good for meeting notes, decisions, ideas

4. **Search Content** - Search through tasks and notes
   - Use when the user says "find", "search", "look for", "where is"
   - Returns matching tasks and notes with snippets

### Guidelines for Tool Use
- When creating tasks/notes, always confirm what was created
- For task status updates, reference the task by its name
- If a request is ambiguous, ask for clarification before using a tool
- After using a tool, explain what action was taken
- If a tool fails, explain what went wrong and suggest alternatives

When the user asks a question, draw on all the project information above to provide helpful, accurate answers.
If you're unsure about something, say so rather than making up information.
`

  return prompt
}

/**
 * Estimate token count (rough approximation: 1 token ≈ 4 characters)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/**
 * Get context statistics for display in UI
 */
export function getContextStats(project: ProjectWithLinkedItems): {
  taskCount: number
  noteCount: number
  fileCount: number
  eventCount: number
  estimatedTokens: number
} {
  const systemPrompt = buildProjectSystemPrompt(project)

  return {
    taskCount: project.tasks.length,
    noteCount: project.notes.length,
    fileCount: project.files.filter(f => !f.is_folder).length,
    eventCount: project.events.length,
    estimatedTokens: estimateTokens(systemPrompt)
  }
}

/**
 * Quick suggestion prompts for the UI
 */
export const quickSuggestions = [
  { label: 'Summarize status', prompt: 'Give me a brief summary of this project\'s current status and progress.' },
  { label: 'Overdue tasks', prompt: 'What tasks are overdue and need immediate attention?' },
  { label: 'Today\'s priorities', prompt: 'What should I prioritize and focus on today?' },
  { label: 'Weekly report', prompt: 'Generate a weekly progress report for this project.' },
  { label: 'Find blockers', prompt: 'Are there any blockers or risks that could delay this project?' },
  { label: 'Due this week', prompt: 'What tasks and events are due this week?' },
  { label: 'Recent updates', prompt: 'What are the most recent changes or updates to this project?' },
  { label: 'Next steps', prompt: 'What should be the next steps to move this project forward?' },
]
