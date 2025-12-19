'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useAuthStore } from '@/stores/authStore'
import { format } from 'date-fns'
import { isDemoAccount, demoDashboardData } from '@/lib/demo'
import { fetchTodosForDate } from '@/lib/taskCategoryService'
import { fetchJournalEntry } from '@/lib/journalService'
import type { Todo, JournalEntry } from '@/types/database'

// Helper function to strip HTML tags from content
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim()
}

export default function DashboardPage() {
  const { user } = useAuthStore()
  const [greeting, setGreeting] = useState('Good Morning')
  const [isLoading, setIsLoading] = useState(true)
  const [todaysTodos, setTodaysTodos] = useState<Todo[]>([])
  const [journalEntry, setJournalEntry] = useState<JournalEntry | null>(null)
  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')

  const isDemo = isDemoAccount(user?.email)

  // Fetch real data for non-demo accounts
  const loadData = useCallback(async () => {
    if (isDemo) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const [todos, journal] = await Promise.all([
        fetchTodosForDate(todayStr),
        fetchJournalEntry(todayStr),
      ])
      setTodaysTodos(todos)
      setJournalEntry(journal)
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [isDemo, todayStr])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting('Good Morning')
    else if (hour < 17) setGreeting('Good Afternoon')
    else setGreeting('Good Evening')
  }, [])

  const firstName = user?.email?.split('@')[0] || 'User'
  const displayName = firstName.charAt(0).toUpperCase() + firstName.slice(1)

  // Calculate values from real data or use demo data
  const pendingTasksCount = isDemo
    ? demoDashboardData.pendingTasksCount
    : todaysTodos.filter(t => !t.completed).length

  const completedTasksCount = isDemo
    ? demoDashboardData.tasks.filter(t => t.completed).length
    : todaysTodos.filter(t => t.completed).length

  const totalTasksCount = isDemo
    ? demoDashboardData.tasks.length
    : todaysTodos.length

  const progress = isDemo
    ? demoDashboardData.progress
    : totalTasksCount > 0
      ? Math.round((completedTasksCount / totalTasksCount) * 100)
      : 0

  // Calculate words written from journal content (strip HTML first)
  const journalContentText = journalEntry?.content ? stripHtml(journalEntry.content) : ''
  const wordsWritten = isDemo
    ? demoDashboardData.wordsWritten
    : journalContentText
      ? journalContentText.split(/\s+/).filter(Boolean).length
      : 0

  const wordsChange = isDemo ? demoDashboardData.wordsChange : 0
  const focusTime = isDemo ? demoDashboardData.focusTime : '0h 0m'

  // Map todos to task format for display - only show INCOMPLETE tasks in Priority Tasks
  const tasks = isDemo
    ? demoDashboardData.tasks.filter(t => !t.completed)
    : todaysTodos
        .filter(todo => !todo.completed)
        .map(todo => ({
          id: todo.id,
          title: todo.title,
          completed: todo.completed,
          priority: todo.priority,
          dueTime: todo.due_time || undefined,
          completedAt: undefined,
        }))

  // Show reflection if there's a journal entry (even if content is empty but has title)
  const hasReflection = isDemo ? true : !!(journalEntry && (journalContentText || journalEntry.title))

  return (
    <div className="max-w-[1200px] mx-auto p-6 md:p-10 flex flex-col gap-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex flex-col gap-1">
          <p className="text-cyan-600 font-bold text-sm uppercase tracking-wider">
            {format(today, 'EEEE, MMMM do')}
          </p>
          <h1 className="text-slate-900 text-3xl md:text-4xl font-extrabold tracking-tight">
            {greeting}, {displayName}
          </h1>
          <p className="text-slate-500 mt-1 text-base">
            {pendingTasksCount > 0 ? (
              <>You have <span className="text-slate-900 font-bold">{pendingTasksCount} pending tasks</span> today.</>
            ) : (
              <>You&apos;re all caught up! No pending tasks.</>
            )}
          </p>
        </div>
        <div className="relative w-full md:w-80">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 material-symbols-outlined" style={{ fontSize: '20px' }}>
            search
          </span>
          <input
            className="w-full bg-white text-slate-900 pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600 focus:outline-none transition-all placeholder-gray-400 text-sm shadow-sm"
            placeholder="Search entries or tasks..."
            type="text"
          />
        </div>
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* New Entry Button */}
        <Link
          href="/journal"
          className="col-span-1 group flex flex-col items-start justify-between gap-4 p-5 rounded-2xl bg-cyan-600 hover:bg-cyan-700 text-white transition-all cursor-pointer h-32 relative overflow-hidden shadow-sm hover:shadow-md"
        >
          <div className="absolute right-[-10px] top-[-10px] opacity-20 scale-150 rotate-12">
            <span className="material-symbols-outlined text-white" style={{ fontSize: '100px' }}>edit_note</span>
          </div>
          <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
            <span className="material-symbols-outlined text-white" style={{ fontSize: '24px' }}>edit_note</span>
          </div>
          <span className="font-bold text-lg">New Entry</span>
        </Link>

        {/* Add Task Button */}
        <Link
          href="/today"
          className="col-span-1 group flex flex-col items-start justify-between gap-4 p-5 rounded-2xl bg-white border border-slate-200 hover:border-cyan-600 hover:ring-1 hover:ring-cyan-200 text-slate-900 transition-all cursor-pointer h-32 shadow-sm hover:shadow-md"
        >
          <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-cyan-50 group-hover:text-cyan-600 transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>add_task</span>
          </div>
          <span className="font-bold text-lg">Add Task</span>
        </Link>

        {/* Words Written Stat */}
        <div className="col-span-1 p-5 rounded-2xl bg-white border border-slate-200 flex flex-col justify-between h-32 shadow-sm">
          <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Words Written</span>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold text-slate-900">{wordsWritten.toLocaleString()}</span>
            {wordsChange > 0 && (
              <span className="text-green-600 text-xs font-bold mb-1 flex items-center bg-green-50 px-1.5 py-0.5 rounded-md">
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>arrow_upward</span> {wordsChange}%
              </span>
            )}
          </div>
        </div>

        {/* Focus Time Stat */}
        <div className="col-span-1 p-5 rounded-2xl bg-white border border-slate-200 flex flex-col justify-between h-32 shadow-sm">
          <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Focus Time</span>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold text-slate-900">{focusTime}</span>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-10">
        {/* Today's Reflection */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="text-slate-900 text-xl font-bold tracking-tight flex items-center gap-2">
              <span className="material-symbols-outlined text-cyan-600">auto_stories</span>
              TODAY&apos;S REFLECTION
            </h2>
            {hasReflection && (
              <button className="text-slate-500 hover:text-cyan-600 text-sm font-medium transition-colors">
                View All
              </button>
            )}
          </div>

          {hasReflection ? (
            <div className="flex-1 bg-white border border-slate-200 rounded-2xl p-6 md:p-8 relative overflow-hidden group shadow-sm hover:shadow-md transition-shadow">
              <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-600/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
              <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-center gap-3 text-sm text-slate-500 mb-4">
                  <span className="px-2 py-1 bg-slate-100 rounded text-xs font-mono text-slate-600">
                    {isDemo ? demoDashboardData.todaysReflection.time : format(new Date(journalEntry?.created_at || new Date()), 'h:mm a')}
                  </span>
                  {(isDemo || journalEntry?.mood) && (
                    <>
                      <span>-</span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                          {isDemo ? 'cloud' : 'sentiment_satisfied'}
                        </span>
                        {isDemo ? demoDashboardData.todaysReflection.weather : journalEntry?.mood}
                      </span>
                    </>
                  )}
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-4">
                  {isDemo ? demoDashboardData.todaysReflection.title : (journalEntry?.title || 'Today\'s Entry')}
                </h3>
                <div className="prose prose-slate max-w-none mb-6">
                  <p className="text-slate-600 leading-relaxed text-lg">
                    {isDemo
                      ? demoDashboardData.todaysReflection.content
                      : (journalContentText.slice(0, 300) || '')}
                    {!isDemo && journalContentText.length > 300 && '...'}
                  </p>
                  {isDemo && (
                    <p className="text-slate-400 leading-relaxed mt-4">
                      {demoDashboardData.todaysReflection.preview}
                    </p>
                  )}
                </div>
                <div className="mt-auto pt-6 border-t border-slate-200 flex gap-4">
                  <Link
                    href="/journal"
                    className="flex items-center gap-2 text-cyan-600 font-bold text-sm hover:underline hover:text-cyan-700"
                  >
                    Continue Writing
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_forward</span>
                  </Link>
                  <button className="flex items-center gap-2 text-slate-500 font-medium text-sm hover:text-slate-900 transition-colors">
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>share</span>
                    Share
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 bg-white border border-slate-200 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center min-h-[300px]">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-slate-400" style={{ fontSize: '32px' }}>edit_note</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">No entries yet</h3>
              <p className="text-slate-500 mb-6 max-w-sm">Start your journaling journey by creating your first entry.</p>
              <Link
                href="/journal"
                className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-600 text-white font-bold rounded-xl hover:bg-cyan-700 transition-colors shadow-lg shadow-cyan-600/20"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>add</span>
                Create First Entry
              </Link>
            </div>
          )}

          {/* Daily Quote */}
          <div className="bg-gradient-to-r from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-6 flex items-center justify-between shadow-md">
            <div>
              <p className="text-slate-400 text-sm font-mono mb-1">DAILY QUOTE</p>
              <p className="text-white font-medium italic">&quot;{demoDashboardData.dailyQuote.text}&quot;</p>
            </div>
            <div className="h-10 w-1 bg-cyan-600 rounded-full mx-4 hidden md:block"></div>
            <div className="text-right hidden md:block">
              <p className="text-slate-300 text-sm">{demoDashboardData.dailyQuote.author}</p>
            </div>
          </div>
        </div>

        {/* Priority Tasks */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="text-slate-900 text-xl font-bold tracking-tight flex items-center gap-2">
              <span className="material-symbols-outlined text-cyan-600">check_circle</span>
              PRIORITY TASKS
            </h2>
            <Link
              href="/today"
              className="size-8 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>add</span>
            </Link>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col h-full min-h-[400px] shadow-sm">
            {/* Progress Bar */}
            <div className="p-5 border-b border-slate-200 bg-slate-50">
              <div className="flex justify-between items-end mb-2">
                <span className="text-sm font-medium text-slate-600">Daily Progress</span>
                <span className="text-sm font-bold text-cyan-600">{progress}%</span>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div className="bg-cyan-600 h-full rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
              </div>
            </div>

            {/* Task List */}
            {tasks.length > 0 ? (
              <div className="flex flex-col divide-y divide-slate-200">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className={`group p-4 flex gap-3 hover:bg-slate-50 transition-colors cursor-pointer ${
                      task.completed ? 'bg-slate-50/50 opacity-70' : ''
                    }`}
                  >
                    <div className="relative flex items-start pt-1">
                      <input
                        type="checkbox"
                        defaultChecked={task.completed}
                        className={`peer appearance-none size-5 border-2 border-slate-300 rounded bg-white cursor-pointer transition-all ${
                          task.completed ? 'checked:bg-slate-400 checked:border-slate-400' : 'checked:bg-cyan-600 checked:border-cyan-600'
                        }`}
                      />
                      <span className="material-symbols-outlined text-white absolute left-0 top-1 pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" style={{ fontSize: '20px' }}>
                        check
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-medium leading-tight ${
                        task.completed ? 'text-slate-500 line-through' : 'text-slate-900 group-hover:text-cyan-600 transition-colors'
                      }`}>
                        {task.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        {!task.completed && task.priority && (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                            task.priority === 'high' ? 'bg-red-50 text-red-600 border-red-100' :
                            task.priority === 'medium' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                            'bg-slate-100 text-slate-500 border-slate-200'
                          }`}>
                            {task.priority}
                          </span>
                        )}
                        {task.completed && task.completedAt && (
                          <span className="text-xs text-slate-400">Completed {task.completedAt}</span>
                        )}
                        {!task.completed && task.dueTime && (
                          <span className="text-xs text-slate-500">Due {task.dueTime}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-slate-400" style={{ fontSize: '28px' }}>task_alt</span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">No tasks yet</h3>
                <p className="text-slate-500 text-sm mb-4">Add your first task to get started</p>
                <Link
                  href="/today"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white font-bold text-sm rounded-lg hover:bg-cyan-700 transition-colors"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
                  Add Task
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
