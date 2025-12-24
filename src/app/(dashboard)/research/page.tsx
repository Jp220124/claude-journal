'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { isDemoAccount } from '@/lib/demo'
import {
  getResearchStatus,
  getResearchJobs,
  getResearchJob,
  getResearchQuota,
  getQueueStats,
  getStatusDisplay,
  getCategoryAutomations,
  type CategoryAutomation,
} from '@/lib/researchService'

const ACTIVE_STATUSES = ['pending', 'understanding', 'awaiting_clarification', 'researching', 'synthesizing']
const POLLING_INTERVAL = 5000 // 5 seconds

interface ResearchJob {
  id: string
  task_id: string
  status: string
  current_stage: number
  interpreted_topic?: string
  focus_areas?: string[]
  sources_used?: Array<{ title: string; url: string }>
  generated_note_id?: string
  error_message?: string
  created_at: string
  started_at?: string
  completed_at?: string
  todos?: { id: string; title: string; category_id?: string }
  notes?: { id: string; title: string; content_text?: string }
}

export default function ResearchPage() {
  const { user } = useAuthStore()
  const isDemo = isDemoAccount(user?.email)

  const [isLoading, setIsLoading] = useState(true)
  const [researchEnabled, setResearchEnabled] = useState(false)
  const [researchColdStart, setResearchColdStart] = useState(false)
  const [jobs, setJobs] = useState<ResearchJob[]>([])
  const [selectedJob, setSelectedJob] = useState<ResearchJob | null>(null)
  const [quota, setQuota] = useState({ jobs_today: 0, max_jobs_per_day: 10, total_jobs_all_time: 0 })
  const [canStartNew, setCanStartNew] = useState(true)
  const [queueStats, setQueueStats] = useState<{ waiting: number; active: number; completed: number; failed: number } | null>(null)
  const [automations, setAutomations] = useState<CategoryAutomation[]>([])
  const [error, setError] = useState<string | null>(null)

  // Fetch initial data
  const loadData = useCallback(async () => {
    if (isDemo) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Check if research is enabled
      const status = await getResearchStatus()
      setResearchEnabled(status.enabled)

      // Handle cold start scenario
      if (status.coldStart) {
        setResearchColdStart(true)
        setError('Research service is waking up. This may take up to a minute. Please refresh the page.')
        setIsLoading(false)
        return
      } else {
        setResearchColdStart(false)
      }

      if (!status.enabled) {
        setIsLoading(false)
        return
      }

      // Fetch jobs, quota, stats, and automations in parallel
      const [jobsData, quotaData, statsData, automationsData] = await Promise.all([
        getResearchJobs(),
        getResearchQuota(),
        getQueueStats(),
        getCategoryAutomations().catch(() => []), // Gracefully handle if endpoint fails
      ])

      setJobs(jobsData)
      setQuota(quotaData.quota)
      setCanStartNew(quotaData.canStartNew)
      if (statsData.stats) {
        setQueueStats(statsData.stats)
      }
      setAutomations(automationsData.filter((a: CategoryAutomation) => a.is_active))
    } catch (err) {
      console.error('Error loading research data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load research data')
    } finally {
      setIsLoading(false)
    }
  }, [isDemo])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Auto-poll when there are active jobs
  const hasActiveJobs = jobs.some(j => ACTIVE_STATUSES.includes(j.status))
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Clear any existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }

    // Start polling if there are active jobs
    if (hasActiveJobs && !isDemo) {
      pollingIntervalRef.current = setInterval(() => {
        loadData()
      }, POLLING_INTERVAL)
    }

    // Cleanup on unmount
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [hasActiveJobs, isDemo, loadData])

  // View job details
  const viewJobDetails = async (jobId: string) => {
    try {
      const data = await getResearchJob(jobId)
      setSelectedJob(data.job)
    } catch (err) {
      console.error('Error loading job details:', err)
    }
  }

  // Filter jobs by status
  const activeJobs = jobs.filter(j => ['pending', 'understanding', 'researching', 'synthesizing', 'awaiting_clarification'].includes(j.status))
  const completedJobs = jobs.filter(j => j.status === 'completed')
  const failedJobs = jobs.filter(j => j.status === 'failed')

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-cyan-600 border-t-transparent"></div>
          <p className="text-slate-500 dark:text-slate-400">Loading research data...</p>
        </div>
      </div>
    )
  }

  if (isDemo) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 dark:bg-slate-900 p-6">
        <div className="text-center max-w-md">
          <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-600 mb-4 block">science</span>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Research Automation</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            Create an account to use the AI-powered research automation feature.
            It will research your tasks and create comprehensive notes with sources.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 bg-cyan-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-cyan-700 transition-colors"
          >
            <span className="material-symbols-outlined">person_add</span>
            Create Account
          </Link>
        </div>
      </div>
    )
  }

  if (!researchEnabled) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 dark:bg-slate-900 p-6">
        <div className="text-center max-w-md">
          <span className="material-symbols-outlined text-6xl text-amber-400 mb-4 block">warning</span>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Research Not Available</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            The research automation feature is not currently enabled on the server.
            Please check back later or contact support.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden bg-slate-50 dark:bg-transparent">
      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Research Automation</h1>
              <p className="text-slate-500 dark:text-slate-400 mt-1">
                AI-powered research for your tasks
              </p>
            </div>
            <div className="flex items-center gap-3 self-start md:self-auto">
              {/* Auto-refresh indicator */}
              {hasActiveJobs && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-cyan-50 dark:bg-cyan-900/30 border border-cyan-200 dark:border-cyan-700 rounded-full">
                  <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse" />
                  <span className="text-xs font-medium text-cyan-700 dark:text-cyan-300">Auto-refreshing</span>
                </div>
              )}
              <button
                onClick={loadData}
                disabled={isLoading}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors",
                  isLoading && "opacity-50 cursor-not-allowed"
                )}
              >
                <span className={cn("material-symbols-outlined text-lg", isLoading && "animate-spin")}>refresh</span>
                Refresh
              </button>
            </div>
          </div>

          {/* Error/Warning Banner */}
          {error && (
            <div className={cn(
              "rounded-xl p-4 flex items-start gap-3",
              researchColdStart
                ? "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
                : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
            )}>
              <span className={cn(
                "material-symbols-outlined",
                researchColdStart ? "text-amber-500 animate-pulse" : "text-red-500"
              )}>
                {researchColdStart ? "schedule" : "error"}
              </span>
              <div className="flex-1">
                <p className={cn(
                  "font-medium",
                  researchColdStart
                    ? "text-amber-800 dark:text-amber-200"
                    : "text-red-800 dark:text-red-200"
                )}>
                  {researchColdStart ? "Service Starting Up" : "Error"}
                </p>
                <p className={cn(
                  "text-sm",
                  researchColdStart
                    ? "text-amber-600 dark:text-amber-300"
                    : "text-red-600 dark:text-red-300"
                )}>{error}</p>
              </div>
              {researchColdStart && (
                <button
                  onClick={loadData}
                  className="px-3 py-1.5 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 rounded-lg text-sm font-medium hover:bg-amber-200 dark:hover:bg-amber-800/50 transition-colors"
                >
                  Retry
                </button>
              )}
            </div>
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Quota Card */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-cyan-100 dark:bg-cyan-900/50 p-2 rounded-lg">
                  <span className="material-symbols-outlined text-cyan-600 dark:text-cyan-400">analytics</span>
                </div>
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Daily Quota</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">{quota.jobs_today}</span>
                <span className="text-slate-400">/ {quota.max_jobs_per_day}</span>
              </div>
              <div className="mt-2 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-500 rounded-full transition-all"
                  style={{ width: `${(quota.jobs_today / quota.max_jobs_per_day) * 100}%` }}
                />
              </div>
            </div>

            {/* Active Jobs Card */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-amber-100 dark:bg-amber-900/50 p-2 rounded-lg">
                  <span className="material-symbols-outlined text-amber-600 dark:text-amber-400">pending_actions</span>
                </div>
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Active</span>
              </div>
              <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">{activeJobs.length}</span>
            </div>

            {/* Completed Card */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-green-100 dark:bg-green-900/50 p-2 rounded-lg">
                  <span className="material-symbols-outlined text-green-600 dark:text-green-400">check_circle</span>
                </div>
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Completed</span>
              </div>
              <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">{completedJobs.length}</span>
            </div>

            {/* Total Card */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-purple-100 dark:bg-purple-900/50 p-2 rounded-lg">
                  <span className="material-symbols-outlined text-purple-600 dark:text-purple-400">history</span>
                </div>
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">All Time</span>
              </div>
              <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">{quota.total_jobs_all_time}</span>
            </div>
          </div>

          {/* How to Use Section */}
          <div className="bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 rounded-xl border border-cyan-200 dark:border-cyan-800 p-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-cyan-600">lightbulb</span>
              How to Use Research Automation
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex gap-3">
                <div className="bg-white dark:bg-slate-800 rounded-full w-8 h-8 flex items-center justify-center font-bold text-cyan-600 shrink-0">1</div>
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">Create a Task</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Add a task with a clear research topic</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="bg-white dark:bg-slate-800 rounded-full w-8 h-8 flex items-center justify-center font-bold text-cyan-600 shrink-0">2</div>
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">Trigger Research</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Click the research button on any task</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="bg-white dark:bg-slate-800 rounded-full w-8 h-8 flex items-center justify-center font-bold text-cyan-600 shrink-0">3</div>
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">Get Results</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">A research note will be linked to your task</p>
                </div>
              </div>
            </div>
          </div>

          {/* Automation Overview Section */}
          {automations.length > 0 && (
            <section>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-purple-500">smart_toy</span>
                Auto-Research Categories ({automations.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {automations.map(automation => (
                  <div
                    key={automation.id}
                    className="bg-white dark:bg-slate-800 rounded-xl border border-purple-100 dark:border-purple-900 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate flex items-center gap-2">
                          {automation.task_categories?.icon && (
                            <span>{automation.task_categories.icon}</span>
                          )}
                          {automation.task_categories?.name || 'Unknown Category'}
                        </h3>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <span className={cn(
                            'text-xs px-2 py-0.5 rounded-full font-medium capitalize',
                            automation.research_depth === 'quick' && 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
                            automation.research_depth === 'medium' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
                            automation.research_depth === 'deep' && 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
                          )}>
                            {automation.research_depth || 'medium'}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                            {automation.max_sources || 5} sources
                          </span>
                        </div>
                      </div>
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" title="Active" />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-3">
                Configure auto-research in the <Link href="/today" className="text-cyan-600 hover:underline">Today page</Link> by editing a category
              </p>
            </section>
          )}

          {/* Active Jobs Section */}
          {activeJobs.length > 0 && (
            <section>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-500">pending_actions</span>
                Active Research ({activeJobs.length})
              </h2>
              <div className="space-y-3">
                {activeJobs.map(job => {
                  const status = getStatusDisplay(job.status)
                  return (
                    <div
                      key={job.id}
                      onClick={() => viewJobDetails(job.id)}
                      className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 hover:border-cyan-300 dark:hover:border-cyan-600 cursor-pointer transition-all"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {job.todos?.title || job.interpreted_topic || 'Research Job'}
                          </h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            Started {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                          </p>
                        </div>
                        <div className={cn(
                          'flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium',
                          status.color === 'blue' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
                          status.color === 'amber' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
                          status.color === 'cyan' && 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300',
                          status.color === 'purple' && 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
                        )}>
                          <span className="material-symbols-outlined text-sm animate-pulse">{status.icon}</span>
                          {status.label}
                        </div>
                      </div>
                      {/* Progress bar */}
                      <div className="mt-3 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-cyan-500 rounded-full transition-all duration-500"
                          style={{ width: `${(job.current_stage / 5) * 100}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* Completed Jobs Section */}
          <section>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-green-500">check_circle</span>
              Completed Research ({completedJobs.length})
            </h2>
            {completedJobs.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
                <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 mb-2 block">science</span>
                <p className="text-slate-500 dark:text-slate-400">No completed research yet</p>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                  Trigger research on a task to get started
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {completedJobs.slice(0, 10).map(job => (
                  <div
                    key={job.id}
                    onClick={() => viewJobDetails(job.id)}
                    className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 hover:border-green-300 dark:hover:border-green-600 cursor-pointer transition-all group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 truncate transition-colors">
                          {job.todos?.title || job.interpreted_topic || 'Research Job'}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                          {format(new Date(job.completed_at || job.created_at), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <span className="material-symbols-outlined text-green-500">check_circle</span>
                    </div>
                    {job.sources_used && job.sources_used.length > 0 && (
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                        {job.sources_used.length} sources
                      </p>
                    )}
                    {job.generated_note_id && (
                      <Link
                        href={`/notes?note=${job.generated_note_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-xs text-cyan-600 hover:text-cyan-700 mt-2"
                      >
                        <span className="material-symbols-outlined text-sm">description</span>
                        View Note
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Failed Jobs Section */}
          {failedJobs.length > 0 && (
            <section>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-red-500">error</span>
                Failed ({failedJobs.length})
              </h2>
              <div className="space-y-3">
                {failedJobs.slice(0, 5).map(job => (
                  <div
                    key={job.id}
                    className="bg-white dark:bg-slate-800 rounded-xl border border-red-200 dark:border-red-800 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {job.todos?.title || 'Research Job'}
                        </h3>
                        <p className="text-sm text-red-500 dark:text-red-400 mt-1">
                          {job.error_message || 'Unknown error'}
                        </p>
                      </div>
                      <span className="material-symbols-outlined text-red-500">error</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      {/* Job Details Sidebar */}
      {selectedJob && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSelectedJob(null)}
          />

          {/* Sidebar */}
          <aside className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 z-50 overflow-y-auto">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Job Details</h2>
                <button
                  onClick={() => setSelectedJob(null)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {/* Status Badge */}
              {(() => {
                const status = getStatusDisplay(selectedJob.status)
                return (
                  <div className={cn(
                    'inline-flex items-center gap-2 px-4 py-2 rounded-full font-medium mb-6',
                    status.color === 'green' && 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
                    status.color === 'red' && 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
                    status.color === 'amber' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
                    status.color === 'cyan' && 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300',
                    status.color === 'blue' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
                    status.color === 'purple' && 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
                    status.color === 'slate' && 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
                  )}>
                    <span className="material-symbols-outlined">{status.icon}</span>
                    {status.label}
                  </div>
                )
              })()}

              {/* Task Info */}
              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Task</label>
                  <p className="text-slate-900 dark:text-slate-100 font-medium mt-1">
                    {selectedJob.todos?.title || 'Unknown Task'}
                  </p>
                </div>

                {selectedJob.interpreted_topic && (
                  <div>
                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Interpreted Topic</label>
                    <p className="text-slate-900 dark:text-slate-100 mt-1">{selectedJob.interpreted_topic}</p>
                  </div>
                )}

                <div>
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Created</label>
                  <p className="text-slate-900 dark:text-slate-100 mt-1">
                    {format(new Date(selectedJob.created_at), 'PPpp')}
                  </p>
                </div>

                {selectedJob.completed_at && (
                  <div>
                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Completed</label>
                    <p className="text-slate-900 dark:text-slate-100 mt-1">
                      {format(new Date(selectedJob.completed_at), 'PPpp')}
                    </p>
                  </div>
                )}
              </div>

              {/* Focus Areas */}
              {selectedJob.focus_areas && selectedJob.focus_areas.length > 0 && (
                <div className="mb-6">
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Focus Areas</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedJob.focus_areas.map((area, i) => (
                      <span key={i} className="px-3 py-1 bg-slate-100 dark:bg-slate-700 rounded-full text-sm text-slate-700 dark:text-slate-300">
                        {area}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Sources */}
              {selectedJob.sources_used && selectedJob.sources_used.length > 0 && (
                <div className="mb-6">
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Sources ({selectedJob.sources_used.length})
                  </label>
                  <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                    {selectedJob.sources_used.map((source, i) => (
                      <a
                        key={i}
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-3 bg-slate-50 dark:bg-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
                      >
                        <p className="text-sm text-slate-900 dark:text-slate-100 line-clamp-2">{source.title}</p>
                        <p className="text-xs text-cyan-600 dark:text-cyan-400 truncate mt-1">{source.url}</p>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Error Message */}
              {selectedJob.error_message && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <label className="text-xs font-medium text-red-600 dark:text-red-400 uppercase tracking-wider">Error</label>
                  <p className="text-red-700 dark:text-red-300 mt-1">{selectedJob.error_message}</p>
                </div>
              )}

              {/* Generated Note Link */}
              {selectedJob.generated_note_id && (
                <Link
                  href={`/notes?note=${selectedJob.generated_note_id}`}
                  className="flex items-center justify-center gap-2 w-full bg-cyan-600 text-white py-3 px-4 rounded-xl font-semibold hover:bg-cyan-700 transition-colors"
                >
                  <span className="material-symbols-outlined">description</span>
                  View Research Note
                </Link>
              )}
            </div>
          </aside>
        </>
      )}
    </div>
  )
}
