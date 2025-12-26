export default function ScheduleLoading() {
  return (
    <div className="flex flex-col h-full">
      {/* Header skeleton */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="flex items-center gap-4">
          <div className="h-8 w-28 bg-zinc-200 dark:bg-zinc-700 rounded-lg animate-pulse" />
          <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1">
            <div className="w-10 h-10 bg-zinc-200 dark:bg-zinc-700 rounded-lg animate-pulse" />
            <div className="w-16 h-8 bg-zinc-200 dark:bg-zinc-700 rounded-lg animate-pulse" />
            <div className="w-10 h-10 bg-zinc-200 dark:bg-zinc-700 rounded-lg animate-pulse" />
          </div>
          <div className="h-5 w-40 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-10 w-32 bg-zinc-200 dark:bg-zinc-700 rounded-xl animate-pulse" />
          <div className="h-10 w-10 bg-zinc-200 dark:bg-zinc-700 rounded-xl animate-pulse" />
          <div className="h-10 w-28 bg-zinc-200 dark:bg-zinc-700 rounded-xl animate-pulse" />
        </div>
      </div>

      {/* Main content skeleton */}
      <div className="flex-1 flex overflow-hidden">
        {/* Schedule view skeleton */}
        <div className="flex-1 p-4">
          <div className="h-full bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            {/* Day header skeleton */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse" />
                <div className="flex flex-col gap-1">
                  <div className="h-4 w-24 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse" />
                  <div className="h-3 w-20 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse" />
                </div>
              </div>
              <div className="h-4 w-16 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse" />
            </div>

            {/* Time grid skeleton */}
            <div className="p-4 space-y-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="w-12 h-4 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse" />
                  <div className="flex-1 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right sidebar skeleton */}
        <div className="w-80 border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse" />
            <div className="h-5 w-32 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse" />
          </div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}
