'use client'

import { useState, useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { useScheduleStore } from '@/stores/scheduleStore'
import type { Todo } from '@/types/database'

interface DailyPlanningRitualProps {
  date: Date
  tasks: Todo[]
  onComplete: (priorities: string[], intention: string) => void
  onClose: () => void
}

const RITUAL_STEPS = [
  {
    title: 'Welcome',
    description: "Let's plan your day mindfully",
    icon: 'wb_sunny',
  },
  {
    title: 'Review',
    description: "Here's what's on your plate today",
    icon: 'list_alt',
  },
  {
    title: 'Prioritize',
    description: 'Choose your top 3 priorities',
    icon: 'priority_high',
  },
  {
    title: 'Intention',
    description: 'Set your focus for the day',
    icon: 'psychology',
  },
  {
    title: 'Ready',
    description: "You're all set!",
    icon: 'rocket_launch',
  },
]

export function DailyPlanningRitual({
  date,
  tasks,
  onComplete,
  onClose,
}: DailyPlanningRitualProps) {
  const ritualState = useScheduleStore(
    useShallow((state) => ({
      isOpen: state.isOpen,
      currentStep: state.currentStep,
      totalSteps: state.totalSteps,
      isCompleted: state.isCompleted,
      selectedPriorities: state.selectedPriorities,
      intention: state.intention,
    }))
  )
  const {
    nextStep,
    previousStep,
    goToStep,
    addPriority,
    removePriority,
    setIntention,
    closeRitual,
    completeRitual,
  } = useScheduleStore()

  const [localIntention, setLocalIntention] = useState('')
  const incompleteTasks = tasks.filter((t) => !t.completed)

  const handleComplete = () => {
    onComplete(ritualState.selectedPriorities, localIntention)
    completeRitual()
  }

  const handleClose = () => {
    closeRitual()
    onClose()
  }

  const canProceed = () => {
    if (ritualState.currentStep === 2) {
      return ritualState.selectedPriorities.length > 0
    }
    return true
  }

  const renderStepContent = () => {
    switch (ritualState.currentStep) {
      case 0:
        return <WelcomeStep date={date} />
      case 1:
        return <ReviewStep tasks={incompleteTasks} />
      case 2:
        return (
          <PrioritizeStep
            tasks={incompleteTasks}
            selectedPriorities={ritualState.selectedPriorities}
            onSelect={addPriority}
            onDeselect={removePriority}
          />
        )
      case 3:
        return (
          <IntentionStep
            intention={localIntention}
            onIntentionChange={setLocalIntention}
          />
        )
      case 4:
        return (
          <ReadyStep
            priorities={ritualState.selectedPriorities}
            tasks={tasks}
            intention={localIntention}
          />
        )
      default:
        return null
    }
  }

  if (!ritualState.isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 via-purple-500/20 to-pink-500/20 backdrop-blur-md" />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden">
        {/* Progress bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-zinc-200 dark:bg-zinc-800">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all duration-500"
            style={{
              width: `${((ritualState.currentStep + 1) / RITUAL_STEPS.length) * 100}%`,
            }}
          />
        </div>

        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors z-10"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
            close
          </span>
        </button>

        {/* Step indicator */}
        <div className="flex justify-center gap-2 pt-6 pb-2">
          {RITUAL_STEPS.map((step, index) => (
            <button
              key={index}
              onClick={() => index <= ritualState.currentStep && goToStep(index)}
              className={cn(
                'w-2 h-2 rounded-full transition-all',
                index === ritualState.currentStep
                  ? 'w-6 bg-cyan-500'
                  : index < ritualState.currentStep
                  ? 'bg-cyan-300 dark:bg-cyan-700 cursor-pointer'
                  : 'bg-zinc-200 dark:bg-zinc-700'
              )}
            />
          ))}
        </div>

        {/* Content */}
        <div className="px-8 py-6 min-h-[400px]">
          {/* Step header */}
          <div className="text-center mb-6">
            <div
              className={cn(
                'inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4',
                'bg-gradient-to-br from-cyan-100 to-purple-100 dark:from-cyan-900/30 dark:to-purple-900/30'
              )}
            >
              <span
                className="material-symbols-outlined text-cyan-600 dark:text-cyan-400"
                style={{ fontSize: '32px' }}
              >
                {RITUAL_STEPS[ritualState.currentStep].icon}
              </span>
            </div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              {RITUAL_STEPS[ritualState.currentStep].title}
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              {RITUAL_STEPS[ritualState.currentStep].description}
            </p>
          </div>

          {/* Step content */}
          <div className="flex-1">{renderStepContent()}</div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between px-8 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
          <button
            onClick={previousStep}
            disabled={ritualState.currentStep === 0}
            className={cn(
              'flex items-center gap-1 px-4 py-2 rounded-lg text-zinc-600 dark:text-zinc-400 transition-colors',
              ritualState.currentStep === 0
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
            )}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              arrow_back
            </span>
            Back
          </button>

          {ritualState.currentStep < RITUAL_STEPS.length - 1 ? (
            <button
              onClick={nextStep}
              disabled={!canProceed()}
              className={cn(
                'flex items-center gap-1 px-5 py-2 rounded-lg font-medium transition-colors',
                canProceed()
                  ? 'bg-cyan-500 hover:bg-cyan-600 text-white'
                  : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-400 cursor-not-allowed'
              )}
            >
              Continue
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                arrow_forward
              </span>
            </button>
          ) : (
            <button
              onClick={handleComplete}
              className="flex items-center gap-1 px-5 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white font-medium transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                check
              </span>
              Start My Day
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// Step 0: Welcome
function WelcomeStep({ date }: { date: Date }) {
  return (
    <div className="text-center">
      <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
        Good {getTimeOfDay()}!
      </p>
      <p className="text-lg text-zinc-600 dark:text-zinc-400 mb-6">
        It's {format(date, 'EEEE, MMMM d')}
      </p>
      <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-50 to-purple-50 dark:from-cyan-900/20 dark:to-purple-900/20 border border-cyan-100 dark:border-cyan-800/50">
        <p className="text-sm text-zinc-600 dark:text-zinc-400 italic">
          "The secret of getting ahead is getting started. The secret of getting started is
          breaking your complex overwhelming tasks into smaller manageable tasks."
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-2">— Mark Twain</p>
      </div>
    </div>
  )
}

// Step 1: Review
function ReviewStep({ tasks }: { tasks: Todo[] }) {
  return (
    <div>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
        You have <span className="font-semibold text-cyan-600">{tasks.length}</span> tasks to
        tackle today:
      </p>
      <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="flex items-center gap-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50"
          >
            <span
              className={cn(
                'w-2 h-2 rounded-full flex-shrink-0',
                task.priority === 'high'
                  ? 'bg-red-500'
                  : task.priority === 'medium'
                  ? 'bg-amber-500'
                  : 'bg-blue-500'
              )}
            />
            <span className="text-sm text-zinc-700 dark:text-zinc-300 truncate">
              {task.title}
            </span>
          </div>
        ))}
        {tasks.length === 0 && (
          <p className="text-center text-zinc-500 dark:text-zinc-400 py-4">
            No tasks for today. Add some to get started!
          </p>
        )}
      </div>
    </div>
  )
}

// Step 2: Prioritize
function PrioritizeStep({
  tasks,
  selectedPriorities,
  onSelect,
  onDeselect,
}: {
  tasks: Todo[]
  selectedPriorities: string[]
  onSelect: (id: string) => void
  onDeselect: (id: string) => void
}) {
  return (
    <div>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
        Select up to 3 tasks that are most important today:
      </p>
      <div className="space-y-2 max-h-56 overflow-y-auto pr-2">
        {tasks.map((task, index) => {
          const isSelected = selectedPriorities.includes(task.id)
          const priorityIndex = selectedPriorities.indexOf(task.id) + 1

          return (
            <button
              key={task.id}
              onClick={() => (isSelected ? onDeselect(task.id) : onSelect(task.id))}
              disabled={!isSelected && selectedPriorities.length >= 3}
              className={cn(
                'w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all',
                isSelected
                  ? 'bg-cyan-100 dark:bg-cyan-900/30 border-2 border-cyan-500'
                  : 'bg-zinc-50 dark:bg-zinc-800/50 border-2 border-transparent hover:border-zinc-200 dark:hover:border-zinc-700',
                !isSelected && selectedPriorities.length >= 3 && 'opacity-50 cursor-not-allowed'
              )}
            >
              {isSelected ? (
                <div className="w-6 h-6 rounded-full bg-cyan-500 text-white flex items-center justify-center text-sm font-bold">
                  {priorityIndex}
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full border-2 border-zinc-300 dark:border-zinc-600" />
              )}
              <span
                className={cn(
                  'text-sm truncate',
                  isSelected
                    ? 'text-cyan-700 dark:text-cyan-300 font-medium'
                    : 'text-zinc-700 dark:text-zinc-300'
                )}
              >
                {task.title}
              </span>
            </button>
          )
        })}
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-3 text-center">
        {selectedPriorities.length}/3 priorities selected
      </p>
    </div>
  )
}

// Step 3: Intention
function IntentionStep({
  intention,
  onIntentionChange,
}: {
  intention: string
  onIntentionChange: (value: string) => void
}) {
  return (
    <div>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
        What do you want to focus on or accomplish today?
      </p>
      <textarea
        value={intention}
        onChange={(e) => onIntentionChange(e.target.value)}
        placeholder="Today I will..."
        rows={4}
        className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
      />
      <div className="flex flex-wrap gap-2 mt-3">
        {['Stay focused', 'Be patient', 'Take breaks', 'Ask for help', 'Celebrate wins'].map(
          (suggestion) => (
            <button
              key={suggestion}
              onClick={() => onIntentionChange(intention ? `${intention} ${suggestion}` : suggestion)}
              className="px-3 py-1 text-xs rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              {suggestion}
            </button>
          )
        )}
      </div>
    </div>
  )
}

// Step 4: Ready
function ReadyStep({
  priorities,
  tasks,
  intention,
}: {
  priorities: string[]
  tasks: Todo[]
  intention: string
}) {
  const priorityTasks = priorities
    .map((id) => tasks.find((t) => t.id === id))
    .filter(Boolean) as Todo[]

  return (
    <div className="text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
        <span
          className="material-symbols-outlined text-green-600 dark:text-green-400"
          style={{ fontSize: '32px' }}
        >
          check_circle
        </span>
      </div>

      <p className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-4">
        Your day is planned!
      </p>

      <div className="text-left space-y-4">
        <div>
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">
            Top Priorities
          </p>
          <div className="space-y-2">
            {priorityTasks.map((task, index) => (
              <div
                key={task.id}
                className="flex items-center gap-2 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50"
              >
                <span className="w-5 h-5 rounded-full bg-cyan-500 text-white text-xs flex items-center justify-center font-bold">
                  {index + 1}
                </span>
                <span className="text-sm text-zinc-700 dark:text-zinc-300">{task.title}</span>
              </div>
            ))}
          </div>
        </div>

        {intention && (
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">
              Today's Intention
            </p>
            <p className="text-sm text-zinc-700 dark:text-zinc-300 italic">"{intention}"</p>
          </div>
        )}
      </div>
    </div>
  )
}

// Helper function
function getTimeOfDay() {
  const hour = new Date().getHours()
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'evening'
}
