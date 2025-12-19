import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function formatDateShort(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

export function getDateString(date: Date = new Date()): string {
  return date.toISOString().split('T')[0]
}

export function isToday(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date
  const today = new Date()
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  )
}

export function getMoodEmoji(mood: string | null): string {
  const moodMap: Record<string, string> = {
    great: '😄',
    good: '🙂',
    okay: '😐',
    bad: '😕',
    terrible: '😢',
  }
  return moodMap[mood || ''] || ''
}

export function getPriorityColor(priority: string): string {
  const colorMap: Record<string, string> = {
    high: 'text-red-500',
    medium: 'text-yellow-500',
    low: 'text-green-500',
  }
  return colorMap[priority] || 'text-gray-500'
}
