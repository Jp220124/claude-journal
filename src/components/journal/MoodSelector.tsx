'use client'

import { cn } from '@/lib/utils'
import { MOOD_OPTIONS } from '@/lib/constants'

interface MoodSelectorProps {
  value: string | null
  onChange: (mood: string) => void
  size?: 'sm' | 'md'
}

export function MoodSelector({ value, onChange, size = 'md' }: MoodSelectorProps) {
  return (
    <div className="flex items-center gap-1">
      {MOOD_OPTIONS.map((mood) => (
        <button
          key={mood.value}
          onClick={() => onChange(mood.value)}
          className={cn(
            'rounded-full transition-all',
            size === 'sm' ? 'text-lg p-1' : 'text-2xl p-1.5',
            value === mood.value
              ? 'bg-[var(--primary)]/20 scale-110'
              : 'opacity-50 hover:opacity-100 hover:scale-105'
          )}
          title={mood.label}
        >
          {mood.emoji}
        </button>
      ))}
    </div>
  )
}
