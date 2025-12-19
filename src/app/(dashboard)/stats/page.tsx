'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Loader2, Flame, CheckCircle, TrendingUp, Calendar } from 'lucide-react'
import { format, subDays, eachDayOfInterval, startOfWeek, endOfWeek } from 'date-fns'
import { MOOD_OPTIONS } from '@/lib/constants'

interface StatsData {
  totalEntries: number
  currentStreak: number
  tasksCompleted: number
  totalTasks: number
  weeklyMoods: { date: string; mood: string | null }[]
  weeklyCompletion: { date: string; rate: number }[]
}

export default function StatsPage() {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    setLoading(true)
    const supabase = createClient()

    const today = new Date()
    const weekStart = startOfWeek(today)
    const weekEnd = endOfWeek(today)
    const thirtyDaysAgo = subDays(today, 30)

    // Fetch daily entries
    const { data: entries } = await supabase
      .from('daily_entries')
      .select('id, date, overall_mood')
      .gte('date', format(thirtyDaysAgo, 'yyyy-MM-dd'))
      .order('date', { ascending: false })

    // Fetch task instances
    const { data: tasks } = await supabase
      .from('task_instances')
      .select('is_completed, daily_entry_id')

    // Calculate streak
    let streak = 0
    const sortedDates = (entries || [])
      .map((e) => e.date)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())

    for (let i = 0; i < sortedDates.length; i++) {
      const expectedDate = format(subDays(today, i), 'yyyy-MM-dd')
      if (sortedDates.includes(expectedDate)) {
        streak++
      } else {
        break
      }
    }

    // Calculate completion rates for the week
    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })
    const weeklyCompletion = weekDays.map((day) => {
      const dateStr = format(day, 'yyyy-MM-dd')
      const entry = (entries || []).find((e) => e.date === dateStr)
      if (!entry) return { date: dateStr, rate: 0 }

      const dayTasks = (tasks || []).filter((t) => t.daily_entry_id === entry.id)
      const completed = dayTasks.filter((t) => t.is_completed).length
      const rate = dayTasks.length > 0 ? (completed / dayTasks.length) * 100 : 0

      return { date: dateStr, rate }
    })

    // Weekly moods from section entries
    const { data: sectionEntries } = await supabase
      .from('section_entries')
      .select('mood, created_at')
      .gte('created_at', format(weekStart, 'yyyy-MM-dd'))
      .lte('created_at', format(weekEnd, 'yyyy-MM-dd'))

    const weeklyMoods = weekDays.map((day) => {
      const dateStr = format(day, 'yyyy-MM-dd')
      const entry = (entries || []).find((e) => e.date === dateStr)
      return { date: dateStr, mood: entry?.overall_mood || null }
    })

    setStats({
      totalEntries: (entries || []).length,
      currentStreak: streak,
      tasksCompleted: (tasks || []).filter((t) => t.is_completed).length,
      totalTasks: (tasks || []).length,
      weeklyMoods,
      weeklyCompletion,
    })

    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
      </div>
    )
  }

  if (!stats) return null

  const completionRate = stats.totalTasks > 0
    ? Math.round((stats.tasksCompleted / stats.totalTasks) * 100)
    : 0

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Statistics</h1>
        <p className="text-[var(--muted-foreground)]">
          Track your journaling progress and habits
        </p>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <Flame className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.currentStreak}</p>
                <p className="text-sm text-[var(--muted-foreground)]">Day Streak</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{completionRate}%</p>
                <p className="text-sm text-[var(--muted-foreground)]">Tasks Done</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Calendar className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalEntries}</p>
                <p className="text-sm text-[var(--muted-foreground)]">Entries</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <TrendingUp className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.tasksCompleted}</p>
                <p className="text-sm text-[var(--muted-foreground)]">Tasks</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Weekly completion chart */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Weekly Task Completion</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between gap-2 h-40">
            {stats.weeklyCompletion.map((day) => (
              <div key={day.date} className="flex-1 flex flex-col items-center">
                <div className="w-full flex-1 flex items-end">
                  <div
                    className="w-full bg-[var(--primary)] rounded-t"
                    style={{ height: `${Math.max(day.rate, 5)}%` }}
                  />
                </div>
                <p className="text-xs text-[var(--muted-foreground)] mt-2">
                  {format(new Date(day.date), 'EEE')}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Weekly mood tracker */}
      <Card>
        <CardHeader>
          <CardTitle>Weekly Mood</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between">
            {stats.weeklyMoods.map((day) => {
              const mood = MOOD_OPTIONS.find((m) => m.value === day.mood)
              return (
                <div key={day.date} className="flex flex-col items-center">
                  <span className="text-2xl mb-1">
                    {mood?.emoji || '⚪'}
                  </span>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {format(new Date(day.date), 'EEE')}
                  </p>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
