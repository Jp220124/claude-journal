'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Check, Circle, Trash2, Search, MoreHorizontal,
  ChevronDown, ChevronRight, Plus, Calendar, Clock,
  Repeat, Sparkles, Sun, Moon, Star
} from 'lucide-react'

// Sample data for mockups
const sampleTasks = [
  { id: 1, title: 'Review quarterly financial reports', priority: 'high', time: '9:00 AM', category: 'Work' },
  { id: 2, title: 'Call mom for her birthday', priority: 'medium', time: '2:00 PM', category: 'Personal' },
  { id: 3, title: 'Prepare presentation slides', priority: 'high', recurrence: 'Weekly', category: 'Work' },
  { id: 4, title: 'Go for a 30-minute run', priority: 'low', time: '6:00 PM', category: 'Health' },
  { id: 5, title: 'Read 20 pages of current book', priority: 'low', category: 'Personal' },
]

const completedTasks = [
  { id: 6, title: 'Send project proposal', priority: 'high' },
  { id: 7, title: 'Buy groceries', priority: 'medium' },
]

// ============================================
// OPTION A: Ultra-Minimal (Things 3 inspired)
// ============================================
function OptionA() {
  const [hoveredTask, setHoveredTask] = useState<number | null>(null)

  return (
    <div className="bg-white min-h-[600px] p-8">
      {/* Minimal header */}
      <div className="mb-8">
        <h1 className="text-2xl font-light text-gray-900">Today</h1>
        <p className="text-sm text-gray-400 mt-1">5 tasks</p>
      </div>

      {/* Task list - pure minimal */}
      <div className="space-y-1">
        {sampleTasks.map((task) => (
          <motion.div
            key={task.id}
            className="group flex items-center py-3 px-2 -mx-2 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
            onMouseEnter={() => setHoveredTask(task.id)}
            onMouseLeave={() => setHoveredTask(null)}
          >
            {/* Simple circle checkbox */}
            <button className="w-5 h-5 rounded-full border-2 border-gray-300 hover:border-blue-500 transition-colors mr-4 flex-shrink-0" />

            {/* Task title only */}
            <span className="text-gray-800 flex-1">{task.title}</span>

            {/* Minimal metadata - dot separated */}
            <div className="flex items-center gap-2 text-xs text-gray-400">
              {task.time && <span>{task.time}</span>}
              {task.time && task.recurrence && <span>·</span>}
              {task.recurrence && <span>{task.recurrence}</span>}
            </div>

            {/* Actions only on hover */}
            <AnimatePresence>
              {hoveredTask === task.id && (
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="flex items-center gap-1 ml-4"
                >
                  <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>

      {/* Completed section - collapsed by default */}
      <div className="mt-8 pt-6 border-t border-gray-100">
        <button className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600">
          <ChevronRight className="w-4 h-4" />
          <span>Completed · 2</span>
        </button>
      </div>
    </div>
  )
}

// ============================================
// OPTION B: Clean Modern (Linear inspired)
// ============================================
function OptionB() {
  const [hoveredTask, setHoveredTask] = useState<number | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['Work']))

  const toggleCategory = (category: string) => {
    const newSet = new Set(expandedCategories)
    if (newSet.has(category)) {
      newSet.delete(category)
    } else {
      newSet.add(category)
    }
    setExpandedCategories(newSet)
  }

  const groupedTasks = sampleTasks.reduce((acc, task) => {
    if (!acc[task.category]) acc[task.category] = []
    acc[task.category].push(task)
    return acc
  }, {} as Record<string, typeof sampleTasks>)

  const priorityBorder = {
    high: 'border-l-red-400',
    medium: 'border-l-amber-400',
    low: 'border-l-gray-300',
  }

  return (
    <div className="bg-gray-50 min-h-[600px] p-6">
      {/* Clean header with filter chips */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-gray-900">Today</h1>
          <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition-colors">
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Filter chips instead of tabs */}
        <div className="flex gap-2">
          <button className="px-3 py-1.5 text-sm bg-white text-gray-900 rounded-full shadow-sm font-medium">
            All
          </button>
          <button className="px-3 py-1.5 text-sm text-gray-500 hover:bg-white rounded-full transition-colors">
            High Priority
          </button>
          <button className="px-3 py-1.5 text-sm text-gray-500 hover:bg-white rounded-full transition-colors">
            Completed
          </button>
        </div>
      </div>

      {/* Categorized tasks with collapsible sections */}
      <div className="space-y-4">
        {Object.entries(groupedTasks).map(([category, tasks]) => (
          <div key={category} className="bg-white rounded-xl shadow-sm overflow-hidden">
            {/* Category header - actions on hover */}
            <button
              onClick={() => toggleCategory(category)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{ rotate: expandedCategories.has(category) ? 90 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </motion.div>
                <span className="font-medium text-gray-900">{category}</span>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  {tasks.length}
                </span>
              </div>

              {/* Hidden actions - show on hover */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                <button className="p-1 text-gray-400 hover:text-gray-600 rounded">
                  <Plus className="w-4 h-4" />
                </button>
                <button className="p-1 text-gray-400 hover:text-gray-600 rounded">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
            </button>

            {/* Task list */}
            <AnimatePresence>
              {expandedCategories.has(category) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="border-t border-gray-100"
                >
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className={`group flex items-center p-4 border-l-4 ${priorityBorder[task.priority as keyof typeof priorityBorder]} hover:bg-gray-50 transition-colors cursor-pointer`}
                      onMouseEnter={() => setHoveredTask(task.id)}
                      onMouseLeave={() => setHoveredTask(null)}
                    >
                      {/* Checkbox */}
                      <button className="w-5 h-5 rounded-md border-2 border-gray-300 hover:border-blue-500 hover:bg-blue-50 transition-colors mr-4 flex-shrink-0 flex items-center justify-center">
                        <Check className="w-3 h-3 text-transparent group-hover:text-blue-500" />
                      </button>

                      {/* Task content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-800 truncate">{task.title}</p>
                      </div>

                      {/* Metadata - muted */}
                      <div className="flex items-center gap-3 text-xs text-gray-400 mr-4">
                        {task.time && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {task.time}
                          </span>
                        )}
                        {task.recurrence && (
                          <span className="flex items-center gap-1">
                            <Repeat className="w-3 h-3" />
                            {task.recurrence}
                          </span>
                        )}
                      </div>

                      {/* Actions on hover */}
                      <div className={`flex items-center gap-1 transition-opacity ${hoveredTask === task.id ? 'opacity-100' : 'opacity-0'}`}>
                        <button className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-md transition-colors">
                          <Search className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================
// OPTION C: Progressive Enhancement (Current + Polish)
// ============================================
function OptionC() {
  const [hoveredTask, setHoveredTask] = useState<number | null>(null)

  return (
    <div className="bg-gradient-to-br from-slate-50 to-slate-100 min-h-[600px] p-6">
      {/* Simplified welcome - one line */}
      <div className="bg-white rounded-xl p-4 mb-6 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
            <Sun className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-gray-900 font-medium">Good morning!</p>
            <p className="text-xs text-gray-500">Sunday, December 22</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
            + Add Task
          </button>
        </div>
      </div>

      {/* Tabs - kept but simplified */}
      <div className="flex gap-1 mb-6 bg-white p-1 rounded-lg shadow-sm w-fit">
        <button className="px-4 py-2 text-sm bg-blue-500 text-white rounded-md font-medium">
          To Do (5)
        </button>
        <button className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md transition-colors">
          Completed (2)
        </button>
        <button className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md transition-colors">
          High Priority
        </button>
      </div>

      {/* Task list - cards with better spacing */}
      <div className="space-y-3">
        {sampleTasks.map((task) => (
          <motion.div
            key={task.id}
            className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer group"
            onMouseEnter={() => setHoveredTask(task.id)}
            onMouseLeave={() => setHoveredTask(null)}
            whileHover={{ scale: 1.01 }}
          >
            <div className="flex items-center gap-4">
              {/* Checkbox */}
              <button className="w-6 h-6 rounded-lg border-2 border-gray-300 hover:border-blue-500 hover:bg-blue-50 transition-colors flex-shrink-0 flex items-center justify-center">
                <Check className="w-4 h-4 text-transparent group-hover:text-blue-500" />
              </button>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-gray-800 font-medium">{task.title}</p>
                  {/* Priority as small colored dot instead of badge */}
                  <span className={`w-2 h-2 rounded-full ${
                    task.priority === 'high' ? 'bg-red-400' :
                    task.priority === 'medium' ? 'bg-amber-400' : 'bg-gray-300'
                  }`} />
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                  {task.category && <span>{task.category}</span>}
                  {task.time && (
                    <>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {task.time}
                      </span>
                    </>
                  )}
                  {task.recurrence && (
                    <>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Repeat className="w-3 h-3" />
                        {task.recurrence}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Actions - fade in on hover */}
              <div className={`flex items-center gap-2 transition-opacity duration-200 ${hoveredTask === task.id ? 'opacity-100' : 'opacity-0'}`}>
                <button className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors">
                  <Sparkles className="w-4 h-4" />
                </button>
                <button className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// ============================================
// Main Mockup Page
// ============================================
export default function TodoRedesignMockups() {
  const [activeOption, setActiveOption] = useState<'A' | 'B' | 'C'>('B')

  const options = {
    A: {
      name: 'Ultra-Minimal',
      inspiration: 'Things 3 / TeuxDeux',
      description: 'Pure white, no cards, maximum whitespace. Focus on content only.',
      pros: ['Maximum clarity', 'Zen-like focus', 'Timeless design'],
      cons: ['May feel too sparse', 'Less visual hierarchy', 'Harder to scan priorities'],
    },
    B: {
      name: 'Clean Modern',
      inspiration: 'Linear / Notion',
      description: 'Subtle cards, hover reveals, organized categories. Best of both worlds.',
      pros: ['Clear organization', 'Progressive disclosure', 'Feature-rich but clean'],
      cons: ['Slightly more complex', 'More animations needed'],
    },
    C: {
      name: 'Progressive Enhancement',
      inspiration: 'Current + Polish',
      description: 'Keep familiar structure but refine spacing, hide actions, add polish.',
      pros: ['Low risk', 'Familiar to users', 'Fast to implement'],
      cons: ['Less dramatic improvement', 'Still somewhat busy'],
    },
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 p-6">
        <h1 className="text-2xl font-bold mb-2">Todo Page Redesign Options</h1>
        <p className="text-gray-400">Hover over tasks to see hidden actions appear</p>
      </div>

      <div className="flex">
        {/* Sidebar - Option selector */}
        <div className="w-80 border-r border-gray-800 p-6 space-y-4">
          {(['A', 'B', 'C'] as const).map((option) => (
            <button
              key={option}
              onClick={() => setActiveOption(option)}
              className={`w-full text-left p-4 rounded-xl transition-all ${
                activeOption === option
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold">Option {option}</span>
                {option === 'B' && (
                  <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">
                    Recommended
                  </span>
                )}
              </div>
              <p className="font-medium">{options[option].name}</p>
              <p className="text-xs opacity-70 mt-1">{options[option].inspiration}</p>
            </button>
          ))}

          {/* Details panel */}
          <div className="mt-6 p-4 bg-gray-800 rounded-xl">
            <h3 className="font-semibold mb-2">{options[activeOption].name}</h3>
            <p className="text-sm text-gray-400 mb-4">{options[activeOption].description}</p>

            <div className="space-y-3">
              <div>
                <p className="text-xs text-green-400 font-medium mb-1">Pros</p>
                <ul className="text-sm text-gray-300 space-y-1">
                  {options[activeOption].pros.map((pro, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <Check className="w-3 h-3 text-green-400" />
                      {pro}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs text-amber-400 font-medium mb-1">Cons</p>
                <ul className="text-sm text-gray-300 space-y-1">
                  {options[activeOption].cons.map((con, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <Circle className="w-3 h-3 text-amber-400" />
                      {con}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Main preview area */}
        <div className="flex-1 p-8">
          <div className="bg-white rounded-2xl overflow-hidden shadow-2xl max-w-3xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeOption}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                {activeOption === 'A' && <OptionA />}
                {activeOption === 'B' && <OptionB />}
                {activeOption === 'C' && <OptionC />}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Instructions */}
          <div className="text-center mt-6 text-gray-400 text-sm">
            <p>Hover over tasks to see the progressive disclosure in action</p>
            <p className="mt-2">Click category headers in Option B to collapse/expand</p>
          </div>
        </div>
      </div>
    </div>
  )
}
