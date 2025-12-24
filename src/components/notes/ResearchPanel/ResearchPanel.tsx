'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { AIAssistantTab } from './AIAssistantTab'
import { WebSearchTab } from './WebSearchTab'

type TabType = 'ai' | 'search'

interface ResearchPanelProps {
  isOpen: boolean
  onClose: () => void
  noteId?: string
  noteContent?: string
  onInsertToNote?: (content: string) => void
  className?: string
}

export function ResearchPanel({
  isOpen,
  onClose,
  noteId,
  noteContent,
  onInsertToNote,
  className,
}: ResearchPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('ai')

  const handleInsertToNote = useCallback((content: string) => {
    onInsertToNote?.(content)
  }, [onInsertToNote])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%', opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.5 }}
            transition={{
              type: 'spring',
              damping: 30,
              stiffness: 300,
            }}
            className={cn(
              'fixed top-0 right-0 h-full w-full sm:w-[420px] lg:w-[480px]',
              'bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-700',
              'shadow-2xl z-50 flex flex-col',
              className
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
              <div className="flex items-center gap-1">
                {/* Tab Buttons */}
                <button
                  onClick={() => setActiveTab('ai')}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    activeTab === 'ai'
                      ? 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400'
                      : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  )}
                >
                  <span className="material-symbols-outlined text-[18px]">smart_toy</span>
                  AI Chat
                </button>
                <button
                  onClick={() => setActiveTab('search')}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    activeTab === 'search'
                      ? 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400'
                      : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  )}
                >
                  <span className="material-symbols-outlined text-[18px]">search</span>
                  Web Search
                </button>
              </div>

              {/* Close Button */}
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
              <AnimatePresence mode="wait">
                {activeTab === 'ai' ? (
                  <motion.div
                    key="ai"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.15 }}
                    className="h-full"
                  >
                    <AIAssistantTab
                      noteId={noteId}
                      noteContent={noteContent}
                      onInsertToNote={handleInsertToNote}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="search"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.15 }}
                    className="h-full"
                  >
                    <WebSearchTab onInsertToNote={handleInsertToNote} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
