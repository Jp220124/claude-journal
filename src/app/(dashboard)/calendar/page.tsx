'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns'
import { useAuthStore } from '@/stores/authStore'
import { linkifyText } from '@/lib/utils'
import { isDemoAccount, demoCalendarData, demoCalendarSidebar } from '@/lib/demo'
import { fetchTodosForRange } from '@/lib/taskCategoryService'
import { fetchJournalEntriesRange } from '@/lib/journalService'
import type { Todo, JournalEntry } from '@/types/database'

// Helper function to strip HTML tags from content
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim()
}

export default function CalendarPage() {
  const { user } = useAuthStore()
  const isDemo = isDemoAccount(user?.email)

  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'list'>('month')
  const [todos, setTodos] = useState<Todo[]>([])
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calendarStart = startOfWeek(monthStart)
  const calendarEnd = endOfWeek(monthEnd)

  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  // Fetch real data for non-demo accounts
  const loadData = useCallback(async () => {
    if (isDemo) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const startStr = format(calendarStart, 'yyyy-MM-dd')
      const endStr = format(calendarEnd, 'yyyy-MM-dd')

      const [todosData, journalData] = await Promise.all([
        fetchTodosForRange(startStr, endStr),
        fetchJournalEntriesRange(startStr, endStr),
      ])

      setTodos(todosData)
      setJournalEntries(journalData)
    } catch (error) {
      console.error('Error loading calendar data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [isDemo, calendarStart, calendarEnd])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Today's date for showing recurring tasks
  const todayStr = format(new Date(), 'yyyy-MM-dd')

  // Build entries map from real data
  const entriesMap = useMemo(() => {
    if (isDemo) return demoCalendarData

    const map: Record<string, { hasEntry: boolean; hasTask: boolean; activityLevel?: number }> = {}

    // Add journal entries
    journalEntries.forEach(entry => {
      const key = entry.date
      if (!map[key]) map[key] = { hasEntry: false, hasTask: false }
      map[key].hasEntry = true
      // Calculate activity level based on content length (strip HTML first)
      const contentText = entry.content ? stripHtml(entry.content) : ''
      const wordCount = contentText.split(/\s+/).filter(Boolean).length
      map[key].activityLevel = Math.min(100, Math.round((wordCount / 500) * 100))
    })

    // Add todos - NULL due_date tasks show on today
    todos.forEach(todo => {
      const key = todo.due_date || todayStr
      if (!map[key]) map[key] = { hasEntry: false, hasTask: false }
      map[key].hasTask = true
    })

    return map
  }, [isDemo, journalEntries, todos, todayStr])

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1))
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1))
  const handleToday = () => {
    setCurrentDate(new Date())
    setSelectedDate(new Date())
  }

  const getEntryData = (date: Date) => {
    const key = format(date, 'yyyy-MM-dd')
    return entriesMap[key] || { hasEntry: false, hasTask: false }
  }

  const isToday = (date: Date) => isSameDay(date, new Date())
  const isSelected = (date: Date) => isSameDay(date, selectedDate)

  // Check if selected date has data
  const selectedDateKey = format(selectedDate, 'yyyy-MM-dd')
  const hasSelectedDateData = isDemo ? entriesMap[selectedDateKey] : entriesMap[selectedDateKey]

  // Get actual data for selected date
  const selectedDateJournal = useMemo(() => {
    if (isDemo) return null
    return journalEntries.find(e => e.date === selectedDateKey) || null
  }, [isDemo, journalEntries, selectedDateKey])

  const selectedDateTodos = useMemo(() => {
    if (isDemo) return []
    // Include tasks with matching due_date, OR NULL due_date if selected date is today
    const isSelectedToday = selectedDateKey === todayStr
    return todos.filter(t =>
      t.due_date === selectedDateKey || (isSelectedToday && t.due_date === null)
    )
  }, [isDemo, todos, selectedDateKey, todayStr])

  // Calculate stats for sidebar
  const completedTodosCount = selectedDateTodos.filter(t => t.completed).length
  const totalTodosCount = selectedDateTodos.length
  const tasksProgress = totalTodosCount > 0 ? Math.round((completedTodosCount / totalTodosCount) * 100) : 0

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-y-auto no-scrollbar relative p-6 lg:p-10 bg-slate-50 dark:bg-transparent">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl lg:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2">
              {format(currentDate, 'MMMM yyyy')}
            </h1>
            <p className="text-slate-500 dark:text-zinc-400 text-sm font-medium flex items-center gap-2">
              {isDemo ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  You&apos;re on a {demoCalendarSidebar.streak}-day streak! Keep it up.
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                  Start journaling to build your streak.
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 bg-white dark:bg-zinc-800 p-1 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-sm">
              <button
                onClick={handlePrevMonth}
                className="p-2 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-zinc-700 rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">chevron_left</span>
              </button>
              <button
                onClick={handleToday}
                className="px-4 py-1.5 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-700 rounded-lg text-sm font-bold"
              >
                Today
              </button>
              <button
                onClick={handleNextMonth}
                className="p-2 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-zinc-700 rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">chevron_right</span>
              </button>
            </div>
            <div className="flex p-1 bg-slate-100 dark:bg-zinc-800 rounded-xl border border-transparent dark:border-zinc-700">
              <button
                onClick={() => setViewMode('month')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'month'
                    ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-black/20'
                    : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Month
              </button>
              <button
                onClick={() => setViewMode('week')}
                className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  viewMode === 'week'
                    ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-black/20'
                    : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Week
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-black/20'
                    : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                List
              </button>
            </div>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="flex-1 flex flex-col bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-soft overflow-hidden">
          {/* Days of Week Header */}
          <div className="grid grid-cols-7 border-b border-slate-200 dark:border-zinc-700 bg-slate-50/50 dark:bg-zinc-800/50">
            {daysOfWeek.map((day) => (
              <div key={day} className="py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="flex-1 grid grid-cols-7 auto-rows-fr">
            {calendarDays.map((day, index) => {
              const entryData = getEntryData(day)
              const isCurrentMonth = isSameMonth(day, currentDate)
              const dayIsToday = isToday(day)
              const dayIsSelected = isSelected(day)

              return (
                <div
                  key={index}
                  onClick={() => setSelectedDate(day)}
                  className={`relative border-b border-r border-slate-100 dark:border-zinc-700 p-3 min-h-[100px] transition-colors cursor-pointer group ${
                    !isCurrentMonth
                      ? 'bg-slate-50/50 dark:bg-zinc-900/50'
                      : dayIsSelected
                      ? 'bg-cyan-50 dark:bg-cyan-900/30 ring-2 ring-inset ring-cyan-600 dark:ring-cyan-500 border-cyan-200 dark:border-cyan-700'
                      : 'hover:bg-slate-50 dark:hover:bg-zinc-700/50'
                  }`}
                >
                  {dayIsToday ? (
                    <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-900 dark:bg-cyan-600 shadow-md">
                      <span className="text-white font-bold text-sm">{format(day, 'd')}</span>
                    </div>
                  ) : (
                    <span className={`font-bold text-sm ${
                      !isCurrentMonth
                        ? 'text-slate-300 dark:text-zinc-600'
                        : dayIsSelected
                        ? 'text-cyan-700 dark:text-cyan-400 font-extrabold'
                        : 'text-slate-700 dark:text-zinc-300'
                    }`}>
                      {format(day, 'd')}
                    </span>
                  )}

                  {/* Entry indicator */}
                  {entryData.hasEntry && (
                    <div className={`absolute bottom-3 right-3 h-2 w-2 rounded-full ring-4 ${
                      dayIsSelected
                        ? 'bg-cyan-600 ring-white shadow-sm'
                        : 'bg-cyan-500 ring-cyan-200'
                    }`}></div>
                  )}

                  {/* Activity bars */}
                  {entryData.activityLevel && isCurrentMonth && (
                    <div className="mt-2 flex flex-col gap-1">
                      <div
                        className={`h-1.5 rounded-full transition-colors ${
                          dayIsSelected
                            ? 'bg-cyan-400'
                            : 'bg-slate-200 dark:bg-zinc-600 group-hover:bg-slate-300 dark:group-hover:bg-zinc-500'
                        }`}
                        style={{ width: `${entryData.activityLevel}%` }}
                      ></div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </main>

      {/* Daily Summary Sidebar */}
      <aside className="hidden xl:flex w-[400px] flex-col h-full bg-white dark:bg-zinc-900 border-l border-slate-200 dark:border-zinc-700 p-8 overflow-y-auto no-scrollbar shadow-xl shadow-slate-200/50 dark:shadow-black/20 z-10">
        {/* Date Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {format(selectedDate, 'EEEE, do')}
            </h2>
            <p className="text-slate-500 dark:text-zinc-400 text-sm font-medium mt-1">
              {format(selectedDate, 'MMMM yyyy')}
            </p>
          </div>
          <button className="flex items-center justify-center p-2 rounded-lg text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors">
            <span className="material-symbols-outlined">more_horiz</span>
          </button>
        </div>

        {/* Stats Cards */}
        <div className="flex gap-4 mb-8">
          <div className="flex-1 bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-900/20 dark:to-orange-900/10 p-4 rounded-2xl border border-orange-100 dark:border-orange-800/30 flex flex-col items-center justify-center text-center">
            <span className="material-symbols-outlined text-orange-500 dark:text-orange-400 mb-2 text-[28px] fill">local_fire_department</span>
            <span className="text-xl font-bold text-slate-800 dark:text-white">{isDemo ? `${demoCalendarSidebar.streak} Days` : '0 Days'}</span>
            <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mt-1">Streak</span>
          </div>
          <div className="flex-1 bg-white dark:bg-zinc-800 p-4 rounded-2xl border border-slate-100 dark:border-zinc-700 shadow-sm flex flex-col items-center justify-center text-center">
            <div className={`w-10 h-10 rounded-full border-[3px] border-slate-100 dark:border-zinc-600 mb-2 transform -rotate-45 ${
              (isDemo || tasksProgress > 0) ? 'border-t-cyan-600' : ''
            }`}></div>
            <span className="text-xl font-bold text-slate-800 dark:text-white">{isDemo ? `${demoCalendarSidebar.tasksProgress}%` : `${tasksProgress}%`}</span>
            <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mt-1">Tasks Done</span>
          </div>
        </div>

        {/* Journal Section */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">Journal</h3>
            {(hasSelectedDateData || selectedDateJournal) && (
              <button className="text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors">Edit</button>
            )}
          </div>
          {isDemo && hasSelectedDateData ? (
            <div className="group bg-white dark:bg-zinc-800 p-5 rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-sm hover:shadow-md hover:border-cyan-300 dark:hover:border-cyan-600 transition-all cursor-pointer">
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-700 px-2 py-1 rounded-md">{demoCalendarSidebar.journal.time}</span>
                <span className="text-xs font-medium text-slate-400 dark:text-zinc-500 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">sentiment_satisfied</span>
                  {demoCalendarSidebar.journal.mood}
                </span>
              </div>
              <p className="text-slate-600 dark:text-zinc-300 text-sm leading-relaxed line-clamp-4 mb-4">
                {demoCalendarSidebar.journal.content}
              </p>
              <div className="flex gap-2">
                {demoCalendarSidebar.journal.images.map((img, i) => (
                  <div
                    key={i}
                    className="h-14 w-14 rounded-lg bg-cover bg-center ring-1 ring-slate-100 dark:ring-zinc-700"
                    style={{ backgroundImage: `url(${img})` }}
                  ></div>
                ))}
                {demoCalendarSidebar.journal.moreImages > 0 && (
                  <div className="h-14 w-14 rounded-lg bg-slate-50 dark:bg-zinc-700 flex items-center justify-center text-slate-400 dark:text-zinc-500 text-xs font-bold ring-1 ring-slate-100 dark:ring-zinc-600">
                    +{demoCalendarSidebar.journal.moreImages}
                  </div>
                )}
              </div>
            </div>
          ) : !isDemo && selectedDateJournal ? (
            <div className="group bg-white dark:bg-zinc-800 p-5 rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-sm hover:shadow-md hover:border-cyan-300 dark:hover:border-cyan-600 transition-all cursor-pointer">
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-700 px-2 py-1 rounded-md">
                  {format(new Date(selectedDateJournal.created_at), 'h:mm a')}
                </span>
                {selectedDateJournal.mood && (
                  <span className="text-xs font-medium text-slate-400 dark:text-zinc-500 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">sentiment_satisfied</span>
                    {selectedDateJournal.mood}
                  </span>
                )}
              </div>
              {selectedDateJournal.title && (
                <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-2">{selectedDateJournal.title}</h4>
              )}
              <p className="text-slate-600 dark:text-zinc-300 text-sm leading-relaxed line-clamp-4">
                {selectedDateJournal.content ? stripHtml(selectedDateJournal.content) : ''}
              </p>
            </div>
          ) : (
            <div className="bg-slate-50 dark:bg-zinc-800 p-6 rounded-2xl border border-dashed border-slate-200 dark:border-zinc-700 text-center">
              <span className="material-symbols-outlined text-slate-300 dark:text-zinc-600 text-[40px] mb-2">edit_note</span>
              <p className="text-sm text-slate-500 dark:text-zinc-400">No journal entry for this day</p>
              <button className="mt-3 text-sm font-bold text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300">
                Create Entry
              </button>
            </div>
          )}
        </section>

        {/* Tasks Section */}
        <section className="flex-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">Tasks ({isDemo ? demoCalendarSidebar.tasks.length : selectedDateTodos.length})</h3>
            <button className="flex items-center justify-center h-6 w-6 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 dark:text-zinc-500 transition-colors">
              <span className="material-symbols-outlined text-[20px]">add</span>
            </button>
          </div>
          {isDemo ? (
            <div className="flex flex-col gap-3">
              {demoCalendarSidebar.tasks.map((task) => (
                <div
                  key={task.id}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                    task.completed
                      ? 'bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-700 opacity-70 hover:opacity-100'
                      : 'bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 shadow-sm hover:border-cyan-300 dark:hover:border-cyan-600 group'
                  }`}
                >
                  {task.completed ? (
                    <div className="flex-none flex items-center justify-center h-5 w-5 rounded bg-emerald-500 text-white shadow-sm">
                      <span className="material-symbols-outlined text-[14px] font-bold">check</span>
                    </div>
                  ) : (
                    <div className="flex-none h-5 w-5 rounded-md border-2 border-slate-300 dark:border-zinc-600 group-hover:border-cyan-600 cursor-pointer transition-colors bg-white dark:bg-zinc-700"></div>
                  )}
                  <span className={`text-sm font-medium ${
                    task.completed ? 'text-slate-500 dark:text-zinc-500 line-through decoration-slate-400 dark:decoration-zinc-500' : 'text-slate-700 dark:text-zinc-300'
                  }`}>
                    {linkifyText(task.title)}
                  </span>
                  {!task.completed && (
                    <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
                      <span className="material-symbols-outlined text-slate-300 dark:text-zinc-600 hover:text-slate-500 dark:hover:text-zinc-400 text-[18px]">drag_indicator</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : selectedDateTodos.length > 0 ? (
            <div className="flex flex-col gap-3">
              {selectedDateTodos.map((task) => (
                <div
                  key={task.id}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                    task.completed
                      ? 'bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-700 opacity-70 hover:opacity-100'
                      : 'bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 shadow-sm hover:border-cyan-300 dark:hover:border-cyan-600 group'
                  }`}
                >
                  {task.completed ? (
                    <div className="flex-none flex items-center justify-center h-5 w-5 rounded bg-emerald-500 text-white shadow-sm">
                      <span className="material-symbols-outlined text-[14px] font-bold">check</span>
                    </div>
                  ) : (
                    <div className="flex-none h-5 w-5 rounded-md border-2 border-slate-300 dark:border-zinc-600 group-hover:border-cyan-600 cursor-pointer transition-colors bg-white dark:bg-zinc-700"></div>
                  )}
                  <div className="flex-1">
                    <span className={`text-sm font-medium ${
                      task.completed ? 'text-slate-500 dark:text-zinc-500 line-through decoration-slate-400 dark:decoration-zinc-500' : 'text-slate-700 dark:text-zinc-300'
                    }`}>
                      {linkifyText(task.title)}
                    </span>
                    {task.priority === 'high' && !task.completed && (
                      <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold uppercase bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded">High</span>
                    )}
                  </div>
                  {!task.completed && (
                    <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
                      <span className="material-symbols-outlined text-slate-300 dark:text-zinc-600 hover:text-slate-500 dark:hover:text-zinc-400 text-[18px]">drag_indicator</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-slate-50 dark:bg-zinc-800 p-6 rounded-2xl border border-dashed border-slate-200 dark:border-zinc-700 text-center">
              <span className="material-symbols-outlined text-slate-300 dark:text-zinc-600 text-[40px] mb-2">task_alt</span>
              <p className="text-sm text-slate-500 dark:text-zinc-400">No tasks for this day</p>
              <button className="mt-3 text-sm font-bold text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300">
                Add Task
              </button>
            </div>
          )}
        </section>
      </aside>
    </div>
  )
}
