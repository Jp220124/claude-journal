'use client'

import { cn } from '@/lib/utils'

/**
 * Animated skeleton pulse component
 */
function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700',
        className
      )}
    />
  )
}

/**
 * Loading skeleton for the sidebar panel
 */
export function SidebarSkeleton() {
  return (
    <div className="h-full flex flex-col">
      {/* Panel Header Skeleton */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center h-16 flex-shrink-0">
        <Skeleton className="h-6 w-24" />
        <div className="flex gap-1">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
      </div>

      {/* Collections Section Skeleton */}
      <div className="flex-1 overflow-hidden px-2 py-4 space-y-6">
        <div className="space-y-1">
          <div className="px-3 mb-2">
            <Skeleton className="h-3 w-20" />
          </div>
          <ul className="space-y-1">
            {[1, 2, 3, 4].map((i) => (
              <li key={i} className="px-3 py-2">
                <div className="flex items-center gap-2.5">
                  <Skeleton className="h-5 w-5 rounded" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Recent Section Skeleton */}
        <div className="space-y-1 pt-4 border-t border-slate-100 dark:border-slate-700">
          <div className="px-3 mb-2">
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="px-1 space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3"
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <Skeleton className="h-4 w-3/4 mb-2" />
                    <Skeleton className="h-3 w-full mb-2" />
                    <Skeleton className="h-2 w-16" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* New Note Button Skeleton */}
      <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
    </div>
  )
}

/**
 * Loading skeleton for the editor area
 */
export function EditorSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-8 py-6 h-full flex flex-col">
      {/* Title Skeleton */}
      <Skeleton className="h-8 w-2/3 mb-3" />

      {/* Tags & Folder Row Skeleton */}
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-6 rounded-full" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-7 w-28 rounded-md" />
        </div>
      </div>

      {/* Editor Toolbar Skeleton */}
      <div className="flex items-center gap-1 p-2 border border-slate-200 dark:border-slate-700 rounded-t-xl bg-slate-50 dark:bg-slate-800">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-8 w-8 rounded" />
        ))}
        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />
        {[7, 8, 9].map((i) => (
          <Skeleton key={i} className="h-8 w-8 rounded" />
        ))}
      </div>

      {/* Editor Content Skeleton */}
      <div className="flex-1 border border-t-0 border-slate-200 dark:border-slate-700 rounded-b-xl p-4 min-h-[300px]">
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <div className="pt-4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>

      {/* Footer Skeleton */}
      <div className="border-t border-slate-100 dark:border-slate-700 mt-8 pt-4">
        <div className="flex justify-between">
          <Skeleton className="h-3 w-40" />
          <div className="flex gap-4">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Full page loading skeleton for Notes
 */
export function NotesLoadingSkeleton() {
  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar Skeleton */}
      <aside className="flex-shrink-0 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 w-[clamp(280px,22vw,360px)]">
        <SidebarSkeleton />
      </aside>

      {/* Main Content Skeleton */}
      <main className="flex-1 flex flex-col h-full bg-white dark:bg-slate-900 overflow-hidden min-w-0">
        {/* Header Skeleton */}
        <header className="h-16 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-6 bg-white dark:bg-slate-900 flex-shrink-0 gap-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="flex-1 max-w-xl">
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
          <div className="flex items-center gap-1">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 mx-2" />
            <Skeleton className="h-9 w-9 rounded-lg" />
          </div>
        </header>

        {/* Editor Area Skeleton */}
        <div className="flex-1 overflow-hidden">
          <EditorSkeleton />
        </div>
      </main>
    </div>
  )
}

export { Skeleton }
