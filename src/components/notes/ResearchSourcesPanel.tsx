'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { ResearchSource } from '@/types/database'

interface ResearchSourcesPanelProps {
  sources: ResearchSource[]
  sourceType: 'manual' | 'research' | 'import' | null
  researchJobId?: string | null
  isCollapsible?: boolean
  defaultExpanded?: boolean
  className?: string
}

export function ResearchSourcesPanel({
  sources,
  sourceType,
  researchJobId,
  isCollapsible = true,
  defaultExpanded = true,
  className,
}: ResearchSourcesPanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  if (!sources || sources.length === 0) {
    return null
  }

  const isResearchGenerated = sourceType === 'research'

  return (
    <div className={cn('rounded-xl border', isResearchGenerated ? 'border-cyan-200 bg-gradient-to-r from-cyan-50/50 to-blue-50/50' : 'border-slate-200 bg-slate-50', className)}>
      {/* Header */}
      <button
        onClick={() => isCollapsible && setIsExpanded(!isExpanded)}
        disabled={!isCollapsible}
        className={cn(
          'w-full flex items-center justify-between px-4 py-3',
          isCollapsible && 'cursor-pointer hover:bg-white/50 transition-colors'
        )}
      >
        <div className="flex items-center gap-2">
          <span className={cn(
            'material-symbols-outlined text-[18px]',
            isResearchGenerated ? 'text-cyan-600' : 'text-slate-500'
          )}>
            {isResearchGenerated ? 'science' : 'link'}
          </span>
          <span className={cn(
            'text-sm font-semibold',
            isResearchGenerated ? 'text-cyan-800' : 'text-slate-700'
          )}>
            {isResearchGenerated ? 'Research Sources' : 'Sources'}
          </span>
          <span className={cn(
            'text-xs px-2 py-0.5 rounded-full font-medium',
            isResearchGenerated ? 'bg-cyan-100 text-cyan-700' : 'bg-slate-200 text-slate-600'
          )}>
            {sources.length}
          </span>
        </div>

        {isCollapsible && (
          <span className={cn(
            'material-symbols-outlined text-[18px] text-slate-400 transition-transform',
            isExpanded && 'rotate-180'
          )}>
            expand_more
          </span>
        )}
      </button>

      {/* Sources List */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-2">
          {/* Research badge */}
          {isResearchGenerated && (
            <div className="flex items-center gap-2 text-xs text-cyan-600 mb-3 px-2 py-1.5 bg-cyan-100/50 rounded-lg">
              <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
              <span>AI-generated research from {sources.length} sources</span>
            </div>
          )}

          {/* Sources */}
          {sources.map((source, index) => (
            <a
              key={index}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'block p-3 rounded-lg transition-all group',
                isResearchGenerated
                  ? 'bg-white/70 hover:bg-white border border-cyan-100 hover:border-cyan-200'
                  : 'bg-white hover:bg-slate-50 border border-slate-100 hover:border-slate-200'
              )}
            >
              <div className="flex items-start gap-3">
                {/* Favicon/Icon */}
                <div className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                  isResearchGenerated ? 'bg-cyan-100' : 'bg-slate-100'
                )}>
                  <span className={cn(
                    'material-symbols-outlined text-[16px]',
                    isResearchGenerated ? 'text-cyan-600' : 'text-slate-500'
                  )}>
                    article
                  </span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h4 className={cn(
                    'text-sm font-medium line-clamp-2 group-hover:underline',
                    isResearchGenerated ? 'text-cyan-800' : 'text-slate-700'
                  )}>
                    {source.title || 'Untitled Source'}
                  </h4>

                  {/* URL preview */}
                  <p className="text-xs text-slate-400 truncate mt-0.5">
                    {new URL(source.url).hostname}
                  </p>

                  {/* Author & Date */}
                  {(source.author || source.publishedDate) && (
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500">
                      {source.author && (
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[12px]">person</span>
                          {source.author}
                        </span>
                      )}
                      {source.publishedDate && (
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[12px]">calendar_today</span>
                          {new Date(source.publishedDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* External link icon */}
                <span className="material-symbols-outlined text-[16px] text-slate-300 group-hover:text-cyan-500 transition-colors shrink-0">
                  open_in_new
                </span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

// Compact badge for showing on note cards
export function ResearchBadge({
  sourceType,
  sourcesCount = 0,
  className,
}: {
  sourceType?: 'manual' | 'research' | 'import' | null
  sourcesCount?: number
  className?: string
}) {
  if (sourceType !== 'research') return null

  return (
    <div className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full',
      'bg-gradient-to-r from-cyan-100 to-blue-100 border border-cyan-200',
      'text-cyan-700 text-[10px] font-semibold',
      className
    )}>
      <span className="material-symbols-outlined text-[12px]">science</span>
      <span>Research</span>
      {sourcesCount > 0 && (
        <>
          <span className="text-cyan-400">•</span>
          <span>{sourcesCount} sources</span>
        </>
      )}
    </div>
  )
}
