'use client'

import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Error boundary component for the Notes feature
 * Catches JavaScript errors in child components and displays a fallback UI
 */
export class NotesErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Notes Error Boundary caught an error:', error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
              <span className="material-symbols-outlined text-3xl text-red-500 dark:text-red-400">
                error
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
              Something went wrong
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mb-6">
              We encountered an error while loading your notes. This might be a
              temporary issue.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className="px-4 py-2 bg-cyan-600 text-white rounded-lg font-medium hover:bg-cyan-700 transition-colors flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">
                  refresh
                </span>
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Reload Page
              </button>
            </div>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-6 text-left p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <summary className="cursor-pointer text-sm font-medium text-slate-600 dark:text-slate-400">
                  Error Details
                </summary>
                <pre className="mt-2 text-xs text-red-600 dark:text-red-400 overflow-auto">
                  {this.state.error.message}
                  {'\n\n'}
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Inline error display component for non-critical errors
 */
export function NotesErrorAlert({
  message,
  onRetry,
  onDismiss,
}: {
  message: string
  onRetry?: () => void
  onDismiss?: () => void
}) {
  return (
    <div
      role="alert"
      className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-800 dark:text-red-200"
    >
      <span className="material-symbols-outlined text-[20px] flex-shrink-0">
        warning
      </span>
      <p className="flex-1 text-sm">{message}</p>
      <div className="flex gap-2">
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-xs font-medium text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-red-100 underline"
          >
            Retry
          </button>
        )}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="p-1 text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-200"
            aria-label="Dismiss error"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Empty state component when no notes exist
 */
export function NotesEmptyState({
  onCreateNote,
  isArchive = false,
}: {
  onCreateNote?: () => void
  isArchive?: boolean
}) {
  if (isArchive) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 dark:text-slate-500">
        <div className="text-center">
          <span className="material-symbols-outlined text-6xl mb-4 block">
            archive
          </span>
          <p className="text-lg font-medium">No archived notes</p>
          <p className="text-sm mt-1">
            Notes you archive will appear here
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex items-center justify-center text-slate-400 dark:text-slate-500">
      <div className="text-center">
        <span className="material-symbols-outlined text-6xl mb-4 block">
          note_add
        </span>
        <p className="text-lg font-medium">No notes yet</p>
        <p className="text-sm mt-1 mb-4">
          Create your first note to get started
        </p>
        {onCreateNote && (
          <button
            onClick={onCreateNote}
            className="px-4 py-2 bg-cyan-600 text-white rounded-lg font-medium hover:bg-cyan-700 transition-colors inline-flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Note
          </button>
        )}
      </div>
    </div>
  )
}
