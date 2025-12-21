'use client'

import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { triggerResearch, getResearchJob, getStatusDisplay } from '@/lib/researchService'

interface TaskResearchButtonProps {
  taskId: string
  taskName: string
  taskDescription?: string
  categoryId?: string
  variant?: 'button' | 'icon' | 'menu-item'
  size?: 'sm' | 'md'
  onResearchStarted?: (jobId: string) => void
  onResearchComplete?: (noteId: string) => void
  className?: string
}

interface ResearchProgress {
  jobId: string
  status: string
  stage: number
  noteId?: string
}

export function TaskResearchButton({
  taskId,
  taskName,
  taskDescription,
  categoryId,
  variant = 'button',
  size = 'sm',
  onResearchStarted,
  onResearchComplete,
  className,
}: TaskResearchButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<ResearchProgress | null>(null)

  // Poll for job status when research is in progress
  useEffect(() => {
    if (!progress?.jobId) return

    const activeStatuses = ['pending', 'understanding', 'researching', 'synthesizing']
    if (!activeStatuses.includes(progress.status)) return

    const pollInterval = setInterval(async () => {
      try {
        const result = await getResearchJob(progress.jobId)
        const job = result.job

        setProgress({
          jobId: job.id,
          status: job.status,
          stage: job.current_stage,
          noteId: job.generated_note_id,
        })

        // Check if completed
        if (job.status === 'completed' && job.generated_note_id) {
          clearInterval(pollInterval)
          setIsLoading(false)
          onResearchComplete?.(job.generated_note_id)
        } else if (job.status === 'failed') {
          clearInterval(pollInterval)
          setIsLoading(false)
          setError(job.error_message || 'Research failed')
        }
      } catch (err) {
        console.error('Error polling research status:', err)
      }
    }, 3000)

    return () => clearInterval(pollInterval)
  }, [progress?.jobId, progress?.status, onResearchComplete])

  const handleTriggerResearch = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    setProgress(null)

    try {
      const result = await triggerResearch({
        taskId,
        taskName,
        taskDescription,
        categoryId,
      })

      if (result.success && result.jobId) {
        setProgress({
          jobId: result.jobId,
          status: 'pending',
          stage: 1,
        })
        onResearchStarted?.(result.jobId)
      } else {
        setIsLoading(false)
        setError(result.message || 'Failed to start research')
      }
    } catch (err) {
      setIsLoading(false)
      setError(err instanceof Error ? err.message : 'Failed to trigger research')
    }
  }, [taskId, taskName, taskDescription, categoryId, onResearchStarted])

  const statusDisplay = progress ? getStatusDisplay(progress.status) : null

  // Menu item variant (for dropdown menus)
  if (variant === 'menu-item') {
    return (
      <button
        onClick={handleTriggerResearch}
        disabled={isLoading}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 transition-colors',
          isLoading && 'opacity-50 cursor-not-allowed',
          className
        )}
      >
        {isLoading ? (
          <>
            <div className="w-4 h-4 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin" />
            <span>{statusDisplay?.label || 'Starting...'}</span>
          </>
        ) : (
          <>
            <span className="material-symbols-outlined text-[18px] text-cyan-600">science</span>
            <span>Research Task</span>
          </>
        )}
      </button>
    )
  }

  // Icon variant (minimal, for tight spaces)
  if (variant === 'icon') {
    return (
      <button
        onClick={handleTriggerResearch}
        disabled={isLoading}
        title={isLoading ? statusDisplay?.label : 'Research this task'}
        className={cn(
          'p-1 rounded-lg transition-all',
          isLoading
            ? 'text-cyan-600 bg-cyan-50'
            : 'text-slate-400 hover:text-cyan-600 hover:bg-cyan-50',
          className
        )}
      >
        {isLoading ? (
          <div className="w-4 h-4 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin" />
        ) : (
          <span className="material-symbols-outlined text-[18px]">science</span>
        )}
      </button>
    )
  }

  // Default button variant
  return (
    <div className={cn('inline-flex flex-col', className)}>
      <button
        onClick={handleTriggerResearch}
        disabled={isLoading}
        className={cn(
          'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-all',
          size === 'sm' ? 'text-xs' : 'text-sm',
          isLoading
            ? 'bg-cyan-50 text-cyan-700 border border-cyan-200'
            : 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-600 hover:to-blue-600 shadow-sm'
        )}
      >
        {isLoading ? (
          <>
            <div className="w-3.5 h-3.5 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin" />
            <span>{statusDisplay?.label || 'Starting...'}</span>
          </>
        ) : (
          <>
            <span className="material-symbols-outlined text-[16px]">science</span>
            <span>Research</span>
          </>
        )}
      </button>

      {/* Error message */}
      {error && (
        <p className="text-[10px] text-red-500 mt-1">{error}</p>
      )}

      {/* Progress indicator */}
      {progress && isLoading && (
        <div className="mt-2 space-y-1">
          <div className="flex items-center gap-1.5">
            <span className={cn(
              'material-symbols-outlined text-[14px]',
              `text-${statusDisplay?.color}-600`
            )}>
              {statusDisplay?.icon}
            </span>
            <span className="text-[10px] text-slate-600">{statusDisplay?.label}</span>
          </div>
          <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500"
              style={{ width: `${(progress.stage / 6) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
