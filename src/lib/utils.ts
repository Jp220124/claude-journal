import { clsx, type ClassValue } from 'clsx'
import React from 'react'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

// URL regex pattern - matches http:// and https:// URLs
const URL_REGEX = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/gi

/**
 * Converts text containing URLs into React elements with clickable links
 * Links open in new tab with security attributes
 */
export function linkifyText(text: string): React.ReactNode {
  if (!text) return text

  const parts = text.split(URL_REGEX)

  if (parts.length === 1) return text

  return parts.map((part, index) => {
    if (URL_REGEX.test(part)) {
      // Reset regex lastIndex since we're reusing it
      URL_REGEX.lastIndex = 0
      return React.createElement(
        'a',
        {
          key: index,
          href: part,
          target: '_blank',
          rel: 'noopener noreferrer',
          onClick: (e: React.MouseEvent) => e.stopPropagation(),
          className: 'text-blue-600 hover:text-blue-800 underline',
        },
        part
      )
    }
    return part
  })
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
