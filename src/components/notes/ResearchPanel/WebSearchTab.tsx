'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface WebSearchTabProps {
  onInsertToNote?: (content: string) => void
}

interface SearchResult {
  id: string
  title: string
  url: string
  snippet: string
  favicon?: string
}

export function WebSearchTab({ onInsertToNote }: WebSearchTabProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const [error, setError] = useState<string | null>(null)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim() || isSearching) return

    setIsSearching(true)
    setHasSearched(true)
    setError(null)

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: query.trim(), numResults: 8 }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Search failed')
      }

      setResults(data.results || [])
    } catch (err) {
      console.error('Search error:', err)
      setError(err instanceof Error ? err.message : 'Failed to search. Please try again.')
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const handleInsert = (result: SearchResult) => {
    const content = `[${result.title}](${result.url})\n\n${result.snippet}`
    onInsertToNote?.(content)
  }

  const handleOpenUrl = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search Input */}
      <form onSubmit={handleSearch} className="p-4 border-b border-zinc-200 dark:border-zinc-700">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[20px] text-zinc-400">
            search
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the web..."
            className="w-full pl-10 pr-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:focus:ring-cyan-400"
            disabled={isSearching}
          />
          {query.trim() && (
            <button
              type="submit"
              disabled={isSearching}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-cyan-600 text-white hover:bg-cyan-700 transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          )}
        </div>
      </form>

      {/* Error Banner */}
      {error && (
        <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
          <div className="flex items-start justify-between text-sm">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-[18px] text-amber-600 dark:text-amber-400 mt-0.5">info</span>
              <div>
                <p className="text-amber-800 dark:text-amber-300 font-medium">{error}</p>
                {error.includes('Settings') && (
                  <a
                    href="/settings"
                    className="inline-flex items-center gap-1 mt-2 text-cyan-600 dark:text-cyan-400 hover:underline text-xs font-medium"
                  >
                    <span className="material-symbols-outlined text-[14px]">settings</span>
                    Go to Settings
                  </a>
                )}
              </div>
            </div>
            <button
              onClick={() => setError(null)}
              className="p-1 hover:bg-amber-100 dark:hover:bg-amber-800 rounded text-amber-500"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        </div>
      )}

      {/* Results Area */}
      <div className="flex-1 overflow-y-auto">
        {!hasSearched ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-3xl text-purple-600 dark:text-purple-400">
                travel_explore
              </span>
            </div>
            <h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-200 mb-2">
              Web Search
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-[280px]">
              Search the web for information and insert relevant content directly into your notes.
            </p>

            {/* Quick Search Suggestions */}
            <div className="mt-6 space-y-2 w-full max-w-[280px]">
              <button
                onClick={() => setQuery('Latest news on ')}
                className="w-full px-4 py-2 text-sm text-left text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                📰 Latest news on...
              </button>
              <button
                onClick={() => setQuery('How to ')}
                className="w-full px-4 py-2 text-sm text-left text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                🔧 How to...
              </button>
              <button
                onClick={() => setQuery('Research on ')}
                className="w-full px-4 py-2 text-sm text-left text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                🔬 Research on...
              </button>
            </div>
          </div>
        ) : isSearching ? (
          /* Loading State */
          <div className="p-4 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-5 h-5 bg-zinc-200 dark:bg-zinc-700 rounded" />
                  <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-3/4" />
                </div>
                <div className="h-3 bg-zinc-200 dark:bg-zinc-700 rounded w-1/2 mb-2" />
                <div className="space-y-1.5">
                  <div className="h-3 bg-zinc-200 dark:bg-zinc-700 rounded w-full" />
                  <div className="h-3 bg-zinc-200 dark:bg-zinc-700 rounded w-5/6" />
                </div>
              </div>
            ))}
          </div>
        ) : results.length === 0 ? (
          /* No Results */
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <span className="material-symbols-outlined text-5xl text-zinc-300 dark:text-zinc-600 mb-4">
              search_off
            </span>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No results found for "{query}"
            </p>
          </div>
        ) : (
          /* Results List */
          <div className="p-4 space-y-4">
            <AnimatePresence>
              {results.map((result, index) => (
                <motion.div
                  key={result.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: index * 0.05, duration: 0.2 }}
                  className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:border-cyan-300 dark:hover:border-cyan-700 transition-colors"
                >
                {/* Title & URL */}
                <div className="flex items-start gap-3 mb-2">
                  {result.favicon && (
                    <img
                      src={result.favicon}
                      alt=""
                      className="w-5 h-5 rounded mt-0.5"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-zinc-800 dark:text-zinc-200 text-sm line-clamp-2">
                      {result.title}
                    </h4>
                    <p className="text-xs text-cyan-600 dark:text-cyan-400 truncate">
                      {result.url}
                    </p>
                  </div>
                </div>

                {/* Snippet */}
                <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-3 mb-3">
                  {result.snippet}
                </p>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleInsert(result)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-900/30 rounded-lg hover:bg-cyan-100 dark:hover:bg-cyan-900/50 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[14px]">add_notes</span>
                    Insert to note
                  </button>
                  <button
                    onClick={() => handleOpenUrl(result.url)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-700 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                    Open
                  </button>
                  <button
                    onClick={() => navigator.clipboard.writeText(result.url)}
                    className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                    title="Copy URL"
                  >
                    <span className="material-symbols-outlined text-[16px]">content_copy</span>
                  </button>
                </div>
              </motion.div>
            ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="px-4 py-2 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
        <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center">
          Powered by Exa AI Search
        </p>
      </div>
    </div>
  )
}
