'use client'

import { useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { isDemoAccount, demoSearchResults } from '@/lib/demo'

type ResultType = 'all' | 'results' | 'tasks'
type EntryType = 'task' | 'journal' | 'done'

interface SearchResult {
  id: string
  type: EntryType
  title: string
  content: string
  date: string
  priority?: 'high' | 'medium' | 'low'
  tags: string[]
  completed?: boolean
}

export default function SearchPage() {
  const { user } = useAuthStore()
  const isDemo = isDemoAccount(user?.email)

  const [searchQuery, setSearchQuery] = useState(isDemo ? 'Project Alpha' : '')
  const [filterType, setFilterType] = useState<ResultType>('results')

  // Only show results for demo account or when there's a search query
  const searchResults: SearchResult[] = isDemo ? demoSearchResults : []

  const relatedTags = isDemo ? ['#ProjectAlpha', '#Design', '#UI/UX', '#MeetingNotes'] : []

  const highlightSearchTerm = (text: string) => {
    if (!searchQuery) return text
    const regex = new RegExp(`(${searchQuery})`, 'gi')
    const parts = text.split(regex)
    return parts.map((part, i) =>
      regex.test(part) ? (
        <span key={i} className="bg-cyan-600/10 text-cyan-800 px-1 rounded">{part}</span>
      ) : (
        part
      )
    )
  }

  const getPriorityBadge = (priority?: string) => {
    switch (priority) {
      case 'high':
        return (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-red-50 border border-red-100">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            <span className="text-xs font-semibold text-red-700">High Priority</span>
          </div>
        )
      case 'medium':
        return (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-orange-50 border border-orange-100">
            <span className="w-2 h-2 rounded-full bg-orange-500"></span>
            <span className="text-xs font-semibold text-orange-700">Medium Priority</span>
          </div>
        )
      case 'low':
        return (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-50 border border-slate-200">
            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
            <span className="text-xs font-semibold text-slate-600">Low Priority</span>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="min-h-full flex-1 overflow-y-auto bg-slate-50 dark:bg-transparent">
      <div className="max-w-[1000px] w-full mx-auto px-6 md:px-12 py-8 flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white">Search Archives</h1>
          <p className="text-slate-500 dark:text-zinc-400 text-base md:text-lg">Find past thoughts, reflections, and completed tasks</p>
        </div>

        {/* Search Input */}
        <div className="sticky top-0 z-20 bg-slate-50 py-2 -my-2">
          <label className="flex flex-col w-full group">
            <div className="flex w-full items-center rounded-xl h-14 bg-white shadow-sm border border-slate-200 focus-within:ring-2 focus-within:ring-cyan-600 focus-within:border-cyan-600 transition-all overflow-hidden hover:border-slate-300">
              <div className="flex items-center justify-center pl-4 pr-3 text-slate-400">
                <span className="material-symbols-outlined text-2xl">search</span>
              </div>
              <input
                className="flex-1 bg-transparent border-none text-slate-900 placeholder:text-slate-400 text-lg font-medium focus:ring-0 h-full w-full outline-none"
                placeholder="Search entries, tasks, or tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="pr-4 text-slate-400 hover:text-cyan-600 transition-colors"
                >
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              )}
            </div>
          </label>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Type Filter Tabs */}
            <div className="flex p-1 bg-slate-200 rounded-lg h-10">
              <label className={`cursor-pointer px-4 flex items-center justify-center rounded-md transition-all ${
                filterType === 'all' ? 'bg-white shadow-sm ring-1 ring-black/5' : 'hover:bg-slate-300/50'
              }`}>
                <input
                  className="hidden"
                  name="type"
                  type="radio"
                  checked={filterType === 'all'}
                  onChange={() => setFilterType('all')}
                />
                <span className={`text-sm font-semibold ${filterType === 'all' ? 'text-cyan-800' : 'text-slate-500'}`}>All</span>
              </label>
              <label className={`cursor-pointer px-4 flex items-center justify-center rounded-md transition-all ${
                filterType === 'results' ? 'bg-white shadow-sm ring-1 ring-black/5' : 'hover:bg-slate-300/50'
              }`}>
                <input
                  className="hidden"
                  name="type"
                  type="radio"
                  checked={filterType === 'results'}
                  onChange={() => setFilterType('results')}
                />
                <span className={`text-sm font-semibold ${filterType === 'results' ? 'text-cyan-800' : 'text-slate-500'}`}>Results</span>
              </label>
              <label className={`cursor-pointer px-4 flex items-center justify-center rounded-md transition-all ${
                filterType === 'tasks' ? 'bg-white shadow-sm ring-1 ring-black/5' : 'hover:bg-slate-300/50'
              }`}>
                <input
                  className="hidden"
                  name="type"
                  type="radio"
                  checked={filterType === 'tasks'}
                  onChange={() => setFilterType('tasks')}
                />
                <span className={`text-sm font-semibold ${filterType === 'tasks' ? 'text-cyan-800' : 'text-slate-500'}`}>Tasks</span>
              </label>
            </div>

            {/* Date and Status Filters */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              <button className="flex items-center gap-2 h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-cyan-600 hover:text-cyan-600 transition-colors whitespace-nowrap shadow-sm">
                <span className="text-sm font-medium">Any Date</span>
                <span className="material-symbols-outlined text-sm">keyboard_arrow_down</span>
              </button>
              <button className="flex items-center gap-2 h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-cyan-600 hover:text-cyan-600 transition-colors whitespace-nowrap shadow-sm">
                <span className="text-sm font-medium">Status</span>
                <span className="material-symbols-outlined text-sm">keyboard_arrow_down</span>
              </button>
            </div>
          </div>

          {/* Related Tags */}
          {relatedTags.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-1">Related Tags:</span>
              {relatedTags.map((tag, index) => (
                <button
                  key={tag}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors shadow-sm ${
                    index === 0
                      ? 'font-semibold bg-cyan-600/10 text-cyan-600 border border-cyan-600/20 hover:bg-cyan-600/20'
                      : 'bg-white border border-slate-200 text-slate-600 hover:border-cyan-600/50 hover:text-cyan-600'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="h-px w-full bg-slate-200"></div>

        {/* Results */}
        <div className="flex flex-col gap-4 pb-20">
          {searchQuery && searchResults.length > 0 ? (
            <>
              <p className="text-sm text-slate-500 font-medium mb-2 pl-1">
                Found {searchResults.length} results for &quot;{searchQuery}&quot;
              </p>

              {searchResults.map((result) => (
                <div
                  key={result.id}
                  className={`group flex flex-col md:flex-row gap-4 p-5 rounded-xl border transition-all shadow-sm cursor-pointer ${
                    result.completed
                      ? 'bg-slate-50 border-slate-200 opacity-75 hover:opacity-100'
                      : 'bg-white border-slate-200 hover:border-cyan-600 hover:ring-1 hover:ring-cyan-600/10 hover:shadow-md'
                  }`}
                >
                  {/* Icon/Checkbox */}
                  <div className="flex items-center justify-center shrink-0 mt-1">
                    {result.type === 'task' && !result.completed && (
                      <button className="text-slate-300 hover:text-cyan-600 transition-colors">
                        <span className="material-symbols-outlined text-2xl">check_box_outline_blank</span>
                      </button>
                    )}
                    {result.type === 'done' && (
                      <button className="text-cyan-600 transition-colors">
                        <span className="material-symbols-outlined text-2xl">check_box</span>
                      </button>
                    )}
                    {result.type === 'journal' && (
                      <div className="w-6 h-6 flex items-center justify-center">
                        <span className="material-symbols-outlined text-2xl text-amber-500">article</span>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex flex-col gap-1 flex-1">
                    <div className="flex justify-between items-start">
                      <h3 className={`text-lg font-bold transition-colors ${
                        result.completed
                          ? 'text-slate-500 line-through decoration-slate-400'
                          : 'text-slate-900 group-hover:text-cyan-600'
                      }`}>
                        {highlightSearchTerm(result.title)}
                      </h3>
                      <div className="hidden md:flex flex-col items-end gap-1">
                        <span className="text-xs font-medium text-slate-400">{result.date}</span>
                      </div>
                    </div>
                    <p className={`text-sm leading-relaxed line-clamp-2 ${
                      result.completed ? 'text-slate-400' : 'text-slate-600'
                    }`}>
                      {highlightSearchTerm(result.content)}
                    </p>
                    <div className="flex items-center gap-3 mt-3">
                      {result.priority && !result.completed && getPriorityBadge(result.priority)}
                      {result.tags.map((tag) => (
                        <span
                          key={tag}
                          className={`text-xs font-medium ${
                            result.completed ? 'text-slate-400' : tag === '#ProjectAlpha' ? 'text-cyan-600' : 'text-slate-400'
                          }`}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}

              {/* End of Results */}
              <div className="flex justify-center pt-8">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-widest">End of results</p>
              </div>
            </>
          ) : searchQuery && searchResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-slate-400" style={{ fontSize: '40px' }}>search_off</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">No results found</h3>
              <p className="text-slate-500 max-w-sm">
                We couldn&apos;t find any entries or tasks matching &quot;{searchQuery}&quot;. Try a different search term.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-slate-400" style={{ fontSize: '40px' }}>search</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Search your archives</h3>
              <p className="text-slate-500 max-w-sm">
                Find past journal entries, tasks, and reflections by typing in the search box above.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
