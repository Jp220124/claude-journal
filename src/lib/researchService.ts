/**
 * Research Service
 * Handles API calls to the research automation backend
 */

import { createClient } from '@/lib/supabase/client'

// Research API base URL - uses the Telegram Bot backend
const RESEARCH_API_URL = process.env.NEXT_PUBLIC_RESEARCH_API_URL || 'https://journal-telegram-bot.onrender.com'

interface ResearchJob {
  id: string
  task_id: string
  user_id: string
  status: string
  current_stage: number
  interpreted_topic?: string
  focus_areas?: string[]
  search_queries?: string[]
  sources_used?: Array<{ title: string; url: string }>
  generated_note_id?: string
  error_message?: string
  created_at: string
  started_at?: string
  completed_at?: string
  todos?: { id: string; title: string; category_id?: string }
  notes?: { id: string; title: string; content_text?: string; sources?: any[] }
}

interface ResearchQuota {
  jobs_today: number
  max_jobs_per_day: number
  total_jobs_all_time: number
}

export interface CategoryAutomation {
  id: string
  user_id: string
  category_id: string
  automation_type: string
  llm_model: string
  research_depth: string
  ask_clarification: boolean
  notification_enabled: boolean
  max_sources: number
  is_active: boolean
  created_at: string
  updated_at: string
  task_categories?: { id: string; name: string; color: string; icon?: string }
}

interface QueueStats {
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
}

/**
 * Get auth token from Supabase
 */
async function getAuthToken(): Promise<string | null> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token || null
}

/**
 * Make authenticated API request to research backend
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAuthToken()
  if (!token) {
    throw new Error('Not authenticated')
  }

  const response = await fetch(`${RESEARCH_API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(error.error || 'Request failed')
  }

  return response.json()
}

/**
 * Check if research is enabled on the backend
 */
export async function getResearchStatus(): Promise<{
  enabled: boolean
  features: { exa: boolean; tavily: boolean }
}> {
  const response = await fetch(`${RESEARCH_API_URL}/api/research/status`)
  return response.json()
}

/**
 * Get all research jobs for the current user
 */
export async function getResearchJobs(): Promise<ResearchJob[]> {
  const data = await apiRequest<{ jobs: ResearchJob[] }>('/api/research/jobs')
  return data.jobs
}

/**
 * Get a specific research job by ID
 */
export async function getResearchJob(jobId: string): Promise<{
  job: ResearchJob
  queueStatus?: {
    state: string
    progress: number
    error?: string
  }
}> {
  return apiRequest(`/api/research/jobs/${jobId}`)
}

/**
 * Trigger research for a task
 */
export async function triggerResearch(params: {
  taskId: string
  taskName: string
  taskDescription?: string
  categoryId?: string
}): Promise<{ success: boolean; jobId: string; message: string }> {
  return apiRequest('/api/research/trigger', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

/**
 * Get user's research quota
 */
export async function getResearchQuota(): Promise<{
  quota: ResearchQuota
  canStartNew: boolean
}> {
  return apiRequest('/api/research/quota')
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<{
  enabled: boolean
  stats?: QueueStats
}> {
  return apiRequest('/api/research/queue-stats')
}

/**
 * Get research notes linked to a task
 */
export async function getTaskResearchNotes(taskId: string): Promise<{
  notes: Array<{
    id: string
    title: string
    content_text?: string
    source_type?: string
    sources?: any[]
    research_job_id?: string
    created_at: string
    link_type: string
    linked_at: string
  }>
}> {
  return apiRequest(`/api/research/task/${taskId}/notes`)
}

/**
 * Get all category automations for the user
 */
export async function getCategoryAutomations(): Promise<CategoryAutomation[]> {
  const data = await apiRequest<{ automations: CategoryAutomation[] }>('/api/research/automations')
  return data.automations
}

/**
 * Create a new category automation
 */
export async function createCategoryAutomation(params: {
  categoryId: string
  automationType?: string
  llmModel?: string
  researchDepth?: string
  askClarification?: boolean
  notificationEnabled?: boolean
  maxSources?: number
}): Promise<CategoryAutomation> {
  const data = await apiRequest<{ automation: CategoryAutomation }>('/api/research/automations', {
    method: 'POST',
    body: JSON.stringify(params),
  })
  return data.automation
}

/**
 * Update a category automation
 */
export async function updateCategoryAutomation(
  id: string,
  updates: Partial<{
    llm_model: string
    research_depth: string
    ask_clarification: boolean
    notification_enabled: boolean
    max_sources: number
    is_active: boolean
  }>
): Promise<CategoryAutomation> {
  const data = await apiRequest<{ automation: CategoryAutomation }>(`/api/research/automations/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  })
  return data.automation
}

/**
 * Delete a category automation
 */
export async function deleteCategoryAutomation(id: string): Promise<boolean> {
  const data = await apiRequest<{ success: boolean }>(`/api/research/automations/${id}`, {
    method: 'DELETE',
  })
  return data.success
}

/**
 * Get status label and color for a research job status
 */
export function getStatusDisplay(status: string): { label: string; color: string; icon: string } {
  const statusMap: Record<string, { label: string; color: string; icon: string }> = {
    pending: { label: 'Pending', color: 'slate', icon: 'schedule' },
    understanding: { label: 'Understanding', color: 'blue', icon: 'psychology' },
    awaiting_clarification: { label: 'Awaiting Input', color: 'amber', icon: 'help' },
    researching: { label: 'Researching', color: 'cyan', icon: 'search' },
    synthesizing: { label: 'Synthesizing', color: 'purple', icon: 'auto_awesome' },
    completed: { label: 'Completed', color: 'green', icon: 'check_circle' },
    failed: { label: 'Failed', color: 'red', icon: 'error' },
  }
  return statusMap[status] || { label: status, color: 'slate', icon: 'help' }
}
