'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { flushSync } from 'react-dom'
import { useChat, type UIMessage } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface AIAssistantTabProps {
  noteId?: string
  noteContent?: string
  onInsertToNote?: (content: string) => void
}

// Helper to get text content from message parts
function getMessageText(message: UIMessage): string {
  return message.parts
    .map(part => (part.type === 'text' ? part.text : ''))
    .join('')
}


export function AIAssistantTab({
  noteId,
  noteContent,
  onInsertToNote,
}: AIAssistantTabProps) {
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null)
  const [configError, setConfigError] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [loadedMessages, setLoadedMessages] = useState<UIMessage[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const lastSavedMessagesRef = useRef<string>('')

  const {
    messages,
    sendMessage,
    setMessages,
    status,
    stop,
  } = useChat({
    id: noteId || 'default-chat',
    transport: new DefaultChatTransport({
      api: '/api/ai/chat',
      body: {
        noteContent,
        noteId,
      },
      // Normalize messages to ensure consistent format with simple text-only parts
      prepareSendMessagesRequest: ({ id, messages: msgs }) => {
        const normalizedMessages = msgs.map(msg => {
          // Extract text content from the message
          let textContent = ''
          if (msg.parts && Array.isArray(msg.parts)) {
            textContent = msg.parts
              .filter(p => p.type === 'text')
              .map(p => (p as { type: 'text'; text: string }).text || '')
              .join('')
          } else if (typeof (msg as unknown as { content?: string }).content === 'string') {
            textContent = (msg as unknown as { content: string }).content
          }

          return {
            id: msg.id,
            role: msg.role,
            parts: [{ type: 'text' as const, text: textContent }],
          }
        })

        return {
          body: {
            id,
            messages: normalizedMessages,
            noteContent,
            noteId,
          },
        }
      },
    }),
    onError: (error) => {
      console.error('Chat error:', error)
      setChatError(error.message || 'Something went wrong')
      // Check if it's a configuration error
      if (error.message?.includes('No API key configured')) {
        setHasApiKey(false)
        setConfigError('Please add an API key in Settings to use AI chat.')
      }
    },
    onFinish: () => {
      setHasApiKey(true)
      setConfigError(null)
      setChatError(null)
    },
  })

  const isLoading = status === 'submitted' || status === 'streaming'


  // Save chat history to database
  const saveChatHistory = useCallback(async (msgs: UIMessage[]) => {
    if (!noteId || msgs.length === 0) return

    // Convert messages to a serializable format
    const serializableMessages = msgs.map(m => ({
      id: m.id,
      role: m.role,
      content: getMessageText(m),
    }))

    const messagesJson = JSON.stringify(serializableMessages)
    // Only save if messages have changed
    if (messagesJson === lastSavedMessagesRef.current) return
    lastSavedMessagesRef.current = messagesJson

    try {
      await fetch('/api/ai/chat-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noteId,
          messages: serializableMessages,
        }),
      })
    } catch (err) {
      console.error('Failed to save chat history:', err)
    }
  }, [noteId])

  // Load chat history when noteId changes
  useEffect(() => {
    const loadChatHistory = async () => {
      if (!noteId) {
        setLoadedMessages([])
        return
      }

      setIsLoadingHistory(true)
      try {
        const response = await fetch(`/api/ai/chat-history?noteId=${noteId}`)
        if (response.ok) {
          const data = await response.json()
          if (data.messages && Array.isArray(data.messages) && data.messages.length > 0) {
            // Validate and convert stored messages to UIMessage format
            const validMessages: UIMessage[] = []

            for (const m of data.messages) {
              // Skip invalid messages
              if (!m || typeof m !== 'object') continue
              if (!m.role || (m.role !== 'user' && m.role !== 'assistant')) continue
              if (typeof m.content !== 'string') continue

              validMessages.push({
                id: (typeof m.id === 'string' && m.id) ? m.id : crypto.randomUUID(),
                role: m.role as 'user' | 'assistant',
                parts: [{ type: 'text' as const, text: m.content || '' }],
              })
            }

            if (validMessages.length > 0) {
              setLoadedMessages(validMessages)
              setMessages(validMessages)
              lastSavedMessagesRef.current = JSON.stringify(
                validMessages.map(m => ({
                  id: m.id,
                  role: m.role,
                  content: m.parts.map(p => p.type === 'text' ? p.text : '').join(''),
                }))
              )
            }
          }
        }
      } catch (err) {
        console.error('Failed to load chat history:', err)
      } finally {
        setIsLoadingHistory(false)
      }
    }

    loadChatHistory()
  }, [noteId, setMessages])

  // Normalize and save messages when streaming completes
  // This is critical: we must normalize assistant messages after streaming to ensure
  // they pass the SDK's internal validation on subsequent requests
  useEffect(() => {
    if (status === 'ready' && messages.length > 0) {
      // Check if any message needs normalization (has complex parts structure)
      const needsNormalization = messages.some(msg => {
        if (!msg.parts || msg.parts.length === 0) return true
        // Check for non-text parts or complex structures
        return msg.parts.some(p => p.type !== 'text') || msg.parts.length > 1
      })

      if (needsNormalization) {
        // Create normalized messages with simple text-only parts
        const normalizedMsgs: UIMessage[] = messages.map(msg => ({
          id: msg.id,
          role: msg.role,
          parts: [{ type: 'text' as const, text: getMessageText(msg) }],
        }))

        // Replace messages with normalized versions
        setMessages(normalizedMsgs)
        saveChatHistory(normalizedMsgs)
      } else {
        saveChatHistory(messages)
      }
    }
  }, [status]) // Only depend on status to avoid infinite loops

  // Clear chat history
  const clearChat = async () => {
    if (!noteId) {
      setMessages([])
      return
    }

    try {
      await fetch('/api/ai/chat-history', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteId }),
      })
      setMessages([])
      lastSavedMessagesRef.current = ''
    } catch (err) {
      console.error('Failed to clear chat history:', err)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Check if user has configured an API key on mount
  useEffect(() => {
    const checkApiKey = async () => {
      try {
        const response = await fetch('/api/ai/check-config')
        if (response.ok) {
          const data = await response.json()
          setHasApiKey(data.hasProvider)
        }
      } catch (e) {
        // Silently fail - will show error when user tries to chat
      }
    }
    checkApiKey()
  }, [])

  const handleInsert = (content: string) => {
    onInsertToNote?.(content)
  }

  const handleQuickAction = (prompt: string) => {
    setInput(prompt)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const textToSend = input.trim()
    setInput('')
    setChatError(null)

    // Normalize messages to simple text-only format before sending
    // This strips streaming metadata (providerMetadata, state) from assistant messages
    const normalizedMsgs: UIMessage[] = messages.map(msg => ({
      id: msg.id,
      role: msg.role,
      parts: [{ type: 'text' as const, text: getMessageText(msg) }],
    }))

    // Use flushSync to force synchronous React state update
    flushSync(() => {
      setMessages(normalizedMsgs)
    })

    // Defer sendMessage to next tick to ensure state propagation
    setTimeout(() => {
      sendMessage({ text: textToSend })
    }, 0)
  }

  const handleRetry = () => {
    // Remove last assistant message and resend
    if (messages.length > 0) {
      const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')
      if (lastUserMessage) {
        const text = getMessageText(lastUserMessage)
        // Filter out the last message and normalize remaining messages
        const filteredMessages = messages.filter(m => m.id !== messages[messages.length - 1].id)
        const normalizedMsgs: UIMessage[] = filteredMessages.map(msg => ({
          id: msg.id,
          role: msg.role,
          parts: [{ type: 'text' as const, text: getMessageText(msg) }],
        }))

        // Use flushSync to ensure state update, then defer sendMessage
        flushSync(() => {
          setMessages(normalizedMsgs)
        })

        // Defer to next event loop tick for state propagation
        setTimeout(() => {
          sendMessage({ text })
        }, 0)
      }
    }
    setChatError(null)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Connection Status Banner */}
      {hasApiKey === false && (
        <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
          <div className="flex items-start gap-3 text-sm">
            <span className="material-symbols-outlined text-[18px] text-amber-600 dark:text-amber-400 mt-0.5">info</span>
            <div>
              <p className="text-amber-800 dark:text-amber-300 font-medium">
                {configError || 'Add an AI provider API key to start chatting'}
              </p>
              <a
                href="/settings"
                className="inline-flex items-center gap-1 mt-2 text-cyan-600 dark:text-cyan-400 hover:underline text-xs font-medium"
              >
                <span className="material-symbols-outlined text-[14px]">settings</span>
                Go to Settings → AI Providers
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {chatError && hasApiKey !== false && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
          <div className="flex items-center justify-between text-sm text-red-700 dark:text-red-400">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">error</span>
              <span>Something went wrong. Please try again.</span>
            </div>
            <button
              onClick={handleRetry}
              className="px-2 py-1 text-xs bg-red-100 dark:bg-red-800 rounded-md hover:bg-red-200 dark:hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Header with Clear Button */}
      {messages.length > 0 && (
        <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {messages.length} message{messages.length !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-2">
            {isLoading && (
              <button
                onClick={() => stop()}
                className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 hover:text-orange-500 dark:hover:text-orange-400 transition-colors"
              >
                <span className="material-symbols-outlined text-[14px]">stop</span>
                Stop
              </button>
            )}
            <button
              onClick={clearChat}
              className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">delete</span>
              Clear chat
            </button>
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoadingHistory ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mb-2" />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading chat history...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-100 to-blue-100 dark:from-cyan-900/30 dark:to-blue-900/30 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-3xl text-cyan-600 dark:text-cyan-400">
                smart_toy
              </span>
            </div>
            <h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-200 mb-2">
              AI Research Assistant
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-[280px]">
              Ask questions, get summaries, or brainstorm ideas. Your AI assistant is ready to help with your notes.
            </p>

            {/* Quick Actions */}
            <div className="mt-6 space-y-2 w-full max-w-[280px]">
              <button
                onClick={() => handleQuickAction('Summarize my note')}
                className="w-full px-4 py-2 text-sm text-left text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                Summarize my note
              </button>
              <button
                onClick={() => handleQuickAction('What are the key points in my note?')}
                className="w-full px-4 py-2 text-sm text-left text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                Extract key points
              </button>
              <button
                onClick={() => handleQuickAction('Help me expand on the topics in my note')}
                className="w-full px-4 py-2 text-sm text-left text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                Expand on topic
              </button>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => {
              const messageText = getMessageText(message)
              return (
                <div
                  key={message.id}
                  className={cn(
                    'flex gap-3',
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  {message.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-100 to-blue-100 dark:from-cyan-900/30 dark:to-blue-900/30 flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-[16px] text-cyan-600 dark:text-cyan-400">
                        smart_toy
                      </span>
                    </div>
                  )}

                  <div
                    className={cn(
                      'max-w-[85%] rounded-2xl px-4 py-2.5',
                      message.role === 'user'
                        ? 'bg-cyan-600 text-white'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200'
                    )}
                  >
                    <div className="text-sm whitespace-pre-wrap prose prose-sm dark:prose-invert max-w-none">
                      {messageText}
                    </div>

                    {/* Insert to Note Action */}
                    {message.role === 'assistant' && onInsertToNote && messageText && (
                      <div className="mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-700 flex items-center gap-3">
                        <button
                          onClick={() => handleInsert(messageText)}
                          className="flex items-center gap-1.5 text-xs text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[14px]">add_notes</span>
                          Insert to note
                        </button>
                        <button
                          onClick={() => navigator.clipboard.writeText(messageText)}
                          className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[14px]">content_copy</span>
                          Copy
                        </button>
                      </div>
                    )}
                  </div>

                  {message.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-[16px] text-zinc-600 dark:text-zinc-400">
                        person
                      </span>
                    </div>
                  )}
                </div>
              )
            })}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-100 to-blue-100 dark:from-cyan-900/30 dark:to-blue-900/30 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-[16px] text-cyan-600 dark:text-cyan-400">
                    smart_toy
                  </span>
                </div>
                <div className="bg-zinc-100 dark:bg-zinc-800 rounded-2xl px-4 py-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <form
        onSubmit={handleSubmit}
        className="p-4 border-t border-zinc-200 dark:border-zinc-700"
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything..."
            className="flex-1 px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:focus:ring-cyan-400"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input?.trim() || isLoading}
            className={cn(
              'px-4 py-2.5 rounded-xl text-white font-medium text-sm transition-all',
              input?.trim() && !isLoading
                ? 'bg-cyan-600 hover:bg-cyan-700'
                : 'bg-zinc-300 dark:bg-zinc-700 cursor-not-allowed'
            )}
          >
            <span className="material-symbols-outlined text-[20px]">send</span>
          </button>
        </div>
      </form>
    </div>
  )
}
