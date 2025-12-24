'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useChat, type UIMessage } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import ReactMarkdown from 'react-markdown'
import { cn } from '@/lib/utils'
import { quickSuggestions } from '@/lib/ai/projectContext'
import { formatDistanceToNow } from 'date-fns'

interface ContextStats {
  taskCount: number
  noteCount: number
  fileCount: number
  eventCount: number
  estimatedTokens: number
}

interface ProjectAIChatProps {
  projectId: string
  projectName: string
  className?: string
}

// LocalStorage key for chat history
const getChatStorageKey = (projectId: string) => `project-ai-chat-${projectId}`
const getContextRefreshKey = (projectId: string) => `project-ai-context-refresh-${projectId}`

// Helper to get text content from message parts
function getMessageText(message: UIMessage): string {
  return message.parts
    .map(part => (part.type === 'text' ? part.text : ''))
    .join('')
}

// Helper to check if message has tool invocations
function hasToolInvocations(message: UIMessage): boolean {
  return message.parts.some(part => part.type === 'tool-invocation')
}

// Render tool invocation status
function ToolInvocationDisplay({ part }: { part: { type: 'tool-invocation'; toolInvocation: { toolName: string; state: string; result?: unknown } } }) {
  const { toolName, state, result } = part.toolInvocation

  const toolIcons: Record<string, string> = {
    createTask: 'add_task',
    updateTaskStatus: 'task_alt',
    createNote: 'note_add',
    searchContent: 'search',
  }

  const toolLabels: Record<string, string> = {
    createTask: 'Creating task',
    updateTaskStatus: 'Updating task',
    createNote: 'Creating note',
    searchContent: 'Searching',
  }

  const icon = toolIcons[toolName] || 'build'
  const label = toolLabels[toolName] || toolName

  // Show loading state
  if (state === 'call' || state === 'partial-call') {
    return (
      <div className="flex items-center gap-2 p-3 my-2 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-xl animate-pulse">
        <span className="material-symbols-outlined text-violet-500 animate-spin">hourglass_empty</span>
        <span className="text-sm text-violet-700 dark:text-violet-300">{label}...</span>
      </div>
    )
  }

  // Show result state
  if (state === 'result' && result) {
    const resultData = result as { success?: boolean; error?: string; task?: { title?: string }; note?: { title?: string }; results?: Array<{ type: string; title: string; snippet: string }> }
    const isSuccess = resultData.success

    if (toolName === 'createTask' && isSuccess && resultData.task) {
      return (
        <div className="flex items-center gap-2 p-3 my-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
          <span className="material-symbols-outlined text-emerald-500">{icon}</span>
          <div className="flex-1">
            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Task created</span>
            <span className="text-sm text-emerald-600 dark:text-emerald-400 ml-2">&quot;{resultData.task.title}&quot;</span>
          </div>
          <span className="material-symbols-outlined text-emerald-500 text-lg">check_circle</span>
        </div>
      )
    }

    if (toolName === 'updateTaskStatus' && isSuccess && resultData.task) {
      const taskData = resultData.task as { title?: string; completed?: boolean }
      return (
        <div className="flex items-center gap-2 p-3 my-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
          <span className="material-symbols-outlined text-blue-500">{taskData.completed ? 'task_alt' : 'radio_button_unchecked'}</span>
          <div className="flex-1">
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Task {taskData.completed ? 'completed' : 'reopened'}
            </span>
            <span className="text-sm text-blue-600 dark:text-blue-400 ml-2">&quot;{taskData.title}&quot;</span>
          </div>
          <span className="material-symbols-outlined text-blue-500 text-lg">check_circle</span>
        </div>
      )
    }

    if (toolName === 'createNote' && isSuccess && resultData.note) {
      return (
        <div className="flex items-center gap-2 p-3 my-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
          <span className="material-symbols-outlined text-amber-500">{icon}</span>
          <div className="flex-1">
            <span className="text-sm font-medium text-amber-700 dark:text-amber-300">Note created</span>
            <span className="text-sm text-amber-600 dark:text-amber-400 ml-2">&quot;{resultData.note.title}&quot;</span>
          </div>
          <span className="material-symbols-outlined text-amber-500 text-lg">check_circle</span>
        </div>
      )
    }

    if (toolName === 'searchContent' && isSuccess) {
      const searchResults = resultData.results || []
      return (
        <div className="p-3 my-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-slate-500">{icon}</span>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Found {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
            </span>
          </div>
          {searchResults.length > 0 && (
            <div className="space-y-1 mt-2">
              {searchResults.slice(0, 5).map((item, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 p-2 rounded-lg">
                  <span className="material-symbols-outlined text-sm mt-0.5">
                    {item.type === 'task' ? 'task' : 'description'}
                  </span>
                  <div>
                    <div className="font-medium">{item.title}</div>
                    <div className="text-slate-500 dark:text-slate-500 line-clamp-1">{item.snippet}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }

    // Error state
    if (!isSuccess && resultData.error) {
      return (
        <div className="flex items-center gap-2 p-3 my-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <span className="material-symbols-outlined text-red-500">error</span>
          <span className="text-sm text-red-700 dark:text-red-300">{resultData.error}</span>
        </div>
      )
    }
  }

  // Default fallback
  return null
}

// Convert messages to markdown for export
function messagesToMarkdown(messages: UIMessage[], projectName: string): string {
  const now = new Date().toISOString().split('T')[0]
  let markdown = `# AI Chat Export - ${projectName}\n`
  markdown += `**Date:** ${now}\n\n---\n\n`

  for (const message of messages) {
    const role = message.role === 'user' ? '👤 **You**' : '🤖 **AI Assistant**'
    const text = getMessageText(message)
    markdown += `${role}\n\n${text}\n\n---\n\n`
  }

  return markdown
}

// Download markdown file
function downloadMarkdown(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function ProjectAIChat({ projectId, projectName, className }: ProjectAIChatProps) {
  const [contextStats, setContextStats] = useState<ContextStats | null>(null)
  const [isLoadingStats, setIsLoadingStats] = useState(true)
  const [statsError, setStatsError] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [chatError, setChatError] = useState<string | null>(null)
  const [lastContextRefresh, setLastContextRefresh] = useState<Date | null>(null)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const exportMenuRef = useRef<HTMLDivElement>(null)

  // Load saved context refresh time
  useEffect(() => {
    const saved = localStorage.getItem(getContextRefreshKey(projectId))
    if (saved) {
      setLastContextRefresh(new Date(saved))
    }
  }, [projectId])

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch context stats on mount
  const loadContextStats = useCallback(async () => {
    setIsLoadingStats(true)
    setStatsError(null)
    try {
      const response = await fetch(`/api/ai/project-chat?projectId=${projectId}`)
      if (response.ok) {
        const data = await response.json()
        setContextStats(data.stats)
        // Update last refresh time
        const now = new Date()
        setLastContextRefresh(now)
        localStorage.setItem(getContextRefreshKey(projectId), now.toISOString())
      } else {
        const error = await response.json()
        setStatsError(error.message || 'Failed to load context')
      }
    } catch (error) {
      setStatsError('Failed to connect to AI service')
      console.error('Error loading context stats:', error)
    } finally {
      setIsLoadingStats(false)
    }
  }, [projectId])

  useEffect(() => {
    loadContextStats()
  }, [loadContextStats])

  // Chat hook with AI SDK v6 API
  const {
    messages,
    sendMessage,
    setMessages,
    status,
    stop,
  } = useChat({
    id: `project-${projectId}`,
    transport: new DefaultChatTransport({
      api: '/api/ai/project-chat',
      body: {
        projectId
      },
    }),
    onError: (error) => {
      console.error('Chat error:', error)
      setChatError(error.message || 'Something went wrong')
    },
    onFinish: () => {
      setChatError(null)
    },
  })

  const isLoading = status === 'submitted' || status === 'streaming'

  // Load chat history from localStorage on mount
  useEffect(() => {
    const savedMessages = localStorage.getItem(getChatStorageKey(projectId))
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed)
        }
      } catch (e) {
        console.error('Failed to parse saved chat history:', e)
      }
    }
  }, [projectId, setMessages])

  // Save chat history to localStorage when messages change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(getChatStorageKey(projectId), JSON.stringify(messages))
    }
  }, [messages, projectId])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Handle quick suggestion click
  const handleSuggestionClick = (prompt: string) => {
    setInput(prompt)
    // Focus the input after setting
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  // Handle send message
  const handleSend = async () => {
    if (!input.trim() || isLoading) return
    const messageText = input.trim()
    setInput('')
    setChatError(null)
    await sendMessage({ text: messageText })
  }

  // Handle form submit with Enter key
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Clear chat history
  const handleClearHistory = () => {
    setMessages([])
    localStorage.removeItem(getChatStorageKey(projectId))
    setShowExportMenu(false)
  }

  // Export conversation as markdown
  const handleExportMarkdown = () => {
    if (messages.length === 0) return
    const markdown = messagesToMarkdown(messages, projectName)
    const filename = `${projectName.replace(/[^a-zA-Z0-9]/g, '-')}-AI-Chat-${new Date().toISOString().split('T')[0]}.md`
    downloadMarkdown(markdown, filename)
    setShowExportMenu(false)
  }

  // Copy conversation to clipboard
  const handleCopyToClipboard = async () => {
    if (messages.length === 0) return
    const markdown = messagesToMarkdown(messages, projectName)
    await navigator.clipboard.writeText(markdown)
    setShowExportMenu(false)
  }

  return (
    <div className={cn("flex flex-col h-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden", className)}>
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-violet-500/10 to-purple-500/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
              <span className="material-symbols-outlined text-white text-xl">smart_toy</span>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">Project AI Assistant</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Full context of {projectName}
              </p>
            </div>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-2">
            {/* Context Stats */}
            {isLoadingStats ? (
              <div className="animate-pulse flex items-center gap-2">
                <div className="w-16 h-4 bg-slate-200 dark:bg-slate-700 rounded"></div>
              </div>
            ) : contextStats ? (
              <div className="flex items-center gap-2 text-xs">
                <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">
                  <span className="material-symbols-outlined text-sm">task_alt</span>
                  {contextStats.taskCount}
                </span>
                <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">
                  <span className="material-symbols-outlined text-sm">description</span>
                  {contextStats.noteCount}
                </span>
                <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">
                  <span className="material-symbols-outlined text-sm">folder</span>
                  {contextStats.fileCount}
                </span>
              </div>
            ) : statsError ? (
              <span className="text-xs text-red-500">{statsError}</span>
            ) : null}

            {/* Context Refresh Button with Timestamp */}
            <div className="flex items-center gap-1">
              <button
                onClick={loadContextStats}
                disabled={isLoadingStats}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors group relative"
                title={lastContextRefresh ? `Last refresh: ${formatDistanceToNow(lastContextRefresh, { addSuffix: true })}` : 'Refresh context'}
              >
                <span className={cn(
                  "material-symbols-outlined text-sm text-slate-400 group-hover:text-violet-500",
                  isLoadingStats && "animate-spin"
                )}>refresh</span>
              </button>
              {lastContextRefresh && (
                <span className="text-[10px] text-slate-400 dark:text-slate-500 hidden sm:block">
                  {formatDistanceToNow(lastContextRefresh, { addSuffix: true })}
                </span>
              )}
            </div>

            {/* Export Menu */}
            {messages.length > 0 && (
              <div className="relative" ref={exportMenuRef}>
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  title="Export options"
                >
                  <span className="material-symbols-outlined text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">more_vert</span>
                </button>

                {showExportMenu && (
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg py-1 z-50">
                    <button
                      onClick={handleExportMarkdown}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      <span className="material-symbols-outlined text-lg">download</span>
                      Export as Markdown
                    </button>
                    <button
                      onClick={handleCopyToClipboard}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      <span className="material-symbols-outlined text-lg">content_copy</span>
                      Copy to Clipboard
                    </button>
                    <hr className="my-1 border-slate-200 dark:border-slate-700" />
                    <button
                      onClick={handleClearHistory}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <span className="material-symbols-outlined text-lg">delete</span>
                      Clear History
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          // Welcome state with suggestions
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-xl mb-4">
              <span className="material-symbols-outlined text-white text-3xl">psychology</span>
            </div>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
              How can I help with {projectName}?
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-md">
              I have full knowledge of this project&apos;s tasks, notes, files, and events.
              Ask me anything or try a quick action below.
            </p>

            {/* Quick Suggestions Grid */}
            <div className="grid grid-cols-2 gap-2 w-full max-w-lg">
              {quickSuggestions.slice(0, 6).map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSuggestionClick(suggestion.prompt)}
                  className="flex items-center gap-2 p-3 text-left text-sm bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 transition-all hover:scale-[1.02] hover:shadow-md"
                >
                  <span className="material-symbols-outlined text-violet-500 text-lg">
                    {idx === 0 ? 'summarize' :
                     idx === 1 ? 'warning' :
                     idx === 2 ? 'priority_high' :
                     idx === 3 ? 'assessment' :
                     idx === 4 ? 'block' : 'event'}
                  </span>
                  <span className="text-slate-700 dark:text-slate-300">{suggestion.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          // Message list
          <>
            {messages.map((message: UIMessage, idx: number) => (
              <div
                key={message.id || idx}
                className={cn(
                  "flex gap-3",
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {message.role === 'assistant' && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                    <span className="material-symbols-outlined text-white text-sm">smart_toy</span>
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-3",
                    message.role === 'user'
                      ? 'bg-violet-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                  )}
                >
                  {message.role === 'assistant' ? (
                    <div className="markdown-content text-sm [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_li]:my-0.5 [&_strong]:text-violet-700 dark:[&_strong]:text-violet-400 [&_h3]:text-base [&_h3]:mt-3 [&_h3]:mb-1.5">
                      {/* Render text parts */}
                      {getMessageText(message) && (
                        <ReactMarkdown>{getMessageText(message)}</ReactMarkdown>
                      )}
                      {/* Render tool invocations */}
                      {message.parts
                        .filter(part => part.type === 'tool-invocation')
                        .map((part, idx) => (
                          <ToolInvocationDisplay
                            key={idx}
                            part={part as unknown as { type: 'tool-invocation'; toolInvocation: { toolName: string; state: string; result?: unknown } }}
                          />
                        ))
                      }
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{getMessageText(message)}</p>
                  )}
                </div>
                {message.role === 'user' && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                    <span className="material-symbols-outlined text-slate-600 dark:text-slate-300 text-sm">person</span>
                  </div>
                )}
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-white text-sm animate-pulse">smart_toy</span>
                </div>
                <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                    <span className="text-sm text-slate-500 dark:text-slate-400">Thinking...</span>
                    <button
                      onClick={() => stop()}
                      className="ml-2 text-xs text-red-500 hover:text-red-700"
                    >
                      Stop
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Error message */}
            {chatError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                <span className="material-symbols-outlined text-red-500">error</span>
                <span className="text-sm text-red-700 dark:text-red-300">{chatError}</span>
                <button
                  onClick={() => setMessages([])}
                  className="ml-auto text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200 underline"
                >
                  Clear & Retry
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Quick suggestions (when there are messages) */}
      {messages.length > 0 && (
        <div className="flex-shrink-0 px-4 py-2 border-t border-slate-100 dark:border-slate-800 overflow-x-auto">
          <div className="flex gap-2">
            {quickSuggestions.slice(0, 4).map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => handleSuggestionClick(suggestion.prompt)}
                disabled={isLoading}
                className="flex-shrink-0 px-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-violet-100 dark:hover:bg-violet-900/30 text-slate-600 dark:text-slate-400 hover:text-violet-700 dark:hover:text-violet-300 rounded-full transition-colors disabled:opacity-50"
              >
                {suggestion.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="flex-shrink-0 p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about this project..."
              rows={1}
              className="w-full px-4 py-3 pr-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
              style={{ minHeight: '48px', maxHeight: '120px' }}
              disabled={isLoading}
            />
          </div>
          <button
            type="button"
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="flex-shrink-0 w-12 h-12 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white rounded-xl flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:scale-105"
          >
            <span className="material-symbols-outlined">
              {isLoading ? 'hourglass_empty' : 'send'}
            </span>
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-400 text-center">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}
