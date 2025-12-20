'use client'

import { cn, linkifyText } from '@/lib/utils'
import { Check } from 'lucide-react'
import type { TaskInstance } from '@/types/database'

interface TaskItemProps {
  task: TaskInstance
  onToggle: (taskId: string, isCompleted: boolean) => void
}

export function TaskItem({ task, onToggle }: TaskItemProps) {
  const priorityColors = {
    high: 'border-red-500',
    medium: 'border-yellow-500',
    low: 'border-green-500',
  }

  return (
    <div
      className={cn(
        'flex items-center gap-3 py-2 group cursor-pointer',
        task.is_completed && 'opacity-60'
      )}
      onClick={() => onToggle(task.id, !task.is_completed)}
    >
      <div
        className={cn(
          'flex items-center justify-center w-5 h-5 rounded border-2 transition-colors',
          priorityColors[task.priority as keyof typeof priorityColors] || 'border-[var(--border)]',
          task.is_completed ? 'bg-[var(--primary)] border-[var(--primary)]' : 'group-hover:border-[var(--primary)]'
        )}
      >
        {task.is_completed && <Check className="w-3 h-3 text-white" />}
      </div>
      <span
        className={cn(
          'flex-1 text-sm',
          task.is_completed && 'line-through text-[var(--muted-foreground)]'
        )}
      >
        {linkifyText(task.title)}
      </span>
    </div>
  )
}
