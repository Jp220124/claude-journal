'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { TaskImage } from '@/lib/tasks/taskImageUpload'

interface TaskImageIndicatorProps {
  image: TaskImage
  size?: 'sm' | 'md' | 'lg'
  onClick?: () => void
  className?: string
}

const sizeClasses = {
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
  lg: 'w-10 h-10',
}

export function TaskImageIndicator({
  image,
  size = 'md',
  onClick,
  className,
}: TaskImageIndicatorProps) {
  const [imageError, setImageError] = useState(false)

  if (imageError || !image.url) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation()
          onClick?.()
        }}
        className={cn(
          "shrink-0 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center",
          "hover:ring-2 hover:ring-cyan-400 hover:ring-offset-1 transition-all",
          sizeClasses[size],
          className
        )}
        title="View attachment"
      >
        <span className="material-symbols-outlined text-zinc-400 dark:text-zinc-500 text-[14px]">
          image
        </span>
      </button>
    )
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      className={cn(
        "shrink-0 rounded-full overflow-hidden",
        "hover:ring-2 hover:ring-cyan-400 hover:ring-offset-1 transition-all",
        "border border-zinc-200 dark:border-zinc-700",
        sizeClasses[size],
        className
      )}
      title="View attachment"
    >
      <img
        src={image.url}
        alt="Task attachment"
        className="w-full h-full object-cover"
        onError={() => setImageError(true)}
      />
    </button>
  )
}
