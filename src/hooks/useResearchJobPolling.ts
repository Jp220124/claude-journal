'use client'

import { useState, useEffect, useCallback } from 'react'
import { getResearchJob, getStatusDisplay } from '@/lib/researchService'

interface ResearchJobData {
  id: string
  task_id: string
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
}

interface UseResearchJobPollingResult {
  job: ResearchJobData | null
  isPolling: boolean
  isLoading: boolean
  error: string | null
  statusDisplay: { label: string; color: string; icon: string } | null
  progress: number
  refetch: () => Promise<void>
}

const ACTIVE_STATUSES = ['pending', 'understanding', 'awaiting_clarification', 'researching', 'synthesizing']
const TOTAL_STAGES = 6

/**
 * Hook for polling research job status
 * Automatically polls while job is active, stops when completed/failed
 */
export function useResearchJobPolling(
  jobId: string | null,
  options: {
    intervalMs?: number
    enabled?: boolean
    onComplete?: (noteId: string) => void
    onError?: (error: string) => void
  } = {}
): UseResearchJobPollingResult {
  const {
    intervalMs = 3000,
    enabled = true,
    onComplete,
    onError,
  } = options

  const [job, setJob] = useState<ResearchJobData | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchJob = useCallback(async () => {
    if (!jobId) return

    try {
      setIsLoading(true)
      const result = await getResearchJob(jobId)
      setJob(result.job)
      setError(null)

      // Check for completion
      if (result.job.status === 'completed' && result.job.generated_note_id) {
        onComplete?.(result.job.generated_note_id)
      } else if (result.job.status === 'failed') {
        onError?.(result.job.error_message || 'Research failed')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch job'
      setError(errorMessage)
      onError?.(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [jobId, onComplete, onError])

  // Initial fetch and polling setup
  useEffect(() => {
    if (!jobId || !enabled) {
      setJob(null)
      setIsPolling(false)
      return
    }

    // Initial fetch
    fetchJob()

    // Set up polling if job is active
    const shouldPoll = job ? ACTIVE_STATUSES.includes(job.status) : true
    if (!shouldPoll) {
      setIsPolling(false)
      return
    }

    setIsPolling(true)
    const intervalId = setInterval(fetchJob, intervalMs)

    return () => {
      clearInterval(intervalId)
      setIsPolling(false)
    }
  }, [jobId, enabled, intervalMs, fetchJob, job?.status])

  // Stop polling when job is no longer active
  useEffect(() => {
    if (job && !ACTIVE_STATUSES.includes(job.status)) {
      setIsPolling(false)
    }
  }, [job?.status])

  const statusDisplay = job ? getStatusDisplay(job.status) : null
  const progress = job ? (job.current_stage / TOTAL_STAGES) * 100 : 0

  return {
    job,
    isPolling,
    isLoading,
    error,
    statusDisplay,
    progress,
    refetch: fetchJob,
  }
}

/**
 * Hook for checking if a task has active research
 */
export function useTaskResearchStatus(taskId: string | null) {
  const [hasActiveResearch, setHasActiveResearch] = useState(false)
  const [activeJobId, setActiveJobId] = useState<string | null>(null)

  // This would need an API endpoint to check for active research jobs for a task
  // For now, this is a placeholder that can be implemented later

  return {
    hasActiveResearch,
    activeJobId,
  }
}
