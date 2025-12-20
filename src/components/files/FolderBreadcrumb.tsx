'use client'

import { cn } from '@/lib/utils'
import { BreadcrumbSegment } from '@/lib/files/types'
import { ChevronRight, FolderOpen, Home } from 'lucide-react'

interface FolderBreadcrumbProps {
  path: BreadcrumbSegment[]
  onNavigate: (folderId: string | null) => void
  className?: string
}

export function FolderBreadcrumb({
  path,
  onNavigate,
  className,
}: FolderBreadcrumbProps) {
  return (
    <nav
      className={cn('flex items-center gap-1 text-sm overflow-x-auto', className)}
      aria-label="Folder navigation"
    >
      {/* Root / All Files */}
      <button
        onClick={() => onNavigate(null)}
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors whitespace-nowrap',
          path.length === 0
            ? 'text-[var(--foreground)] font-medium'
            : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]'
        )}
      >
        <Home className="h-4 w-4" />
        <span>All Files</span>
      </button>

      {/* Path segments */}
      {path.map((segment, index) => {
        const isLast = index === path.length - 1

        return (
          <div key={segment.id} className="flex items-center gap-1">
            <ChevronRight className="h-4 w-4 text-[var(--muted-foreground)] flex-shrink-0" />
            <button
              onClick={() => onNavigate(segment.id)}
              className={cn(
                'flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors whitespace-nowrap max-w-[200px]',
                isLast
                  ? 'text-[var(--foreground)] font-medium'
                  : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]'
              )}
            >
              <FolderOpen className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{segment.name}</span>
            </button>
          </div>
        )
      })}
    </nav>
  )
}
