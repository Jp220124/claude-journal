import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  ScheduleView,
  TimeBlockType,
  PomodoroPhase,
  PomodoroState,
} from '@/types/schedule'
import { addDays, subDays, startOfWeek, endOfWeek } from 'date-fns'

// =====================================================
// Schedule View State
// =====================================================

interface ScheduleViewState {
  currentDate: Date
  view: ScheduleView
  selectedBlockId: string | null
  hoveredBlockId: string | null
  isCreatingBlock: boolean
  isEditingBlock: boolean
  dragStartTime: Date | null
  dragEndTime: Date | null
}

interface ScheduleViewActions {
  setCurrentDate: (date: Date) => void
  goToToday: () => void
  goToNextDay: () => void
  goToPreviousDay: () => void
  goToNextWeek: () => void
  goToPreviousWeek: () => void
  setView: (view: ScheduleView) => void
  selectBlock: (id: string | null) => void
  hoverBlock: (id: string | null) => void
  startCreatingBlock: (startTime?: Date) => void
  stopCreatingBlock: () => void
  startEditingBlock: (id: string) => void
  stopEditingBlock: () => void
  setDragTimes: (start: Date | null, end: Date | null) => void
}

// =====================================================
// Pomodoro Timer State
// =====================================================

interface PomodoroTimerState {
  phase: PomodoroPhase
  timeRemaining: number
  isRunning: boolean
  isPaused: boolean
  currentSession: number
  totalSessionsCompleted: number
  linkedBlockId: string | null
  isMinimized: boolean
  // Settings (cached for quick access)
  workDuration: number
  breakDuration: number
  longBreakDuration: number
  sessionsBeforeLongBreak: number
}

interface PomodoroTimerActions {
  startTimer: (blockId?: string) => void
  pauseTimer: () => void
  resumeTimer: () => void
  stopTimer: () => void
  skipPhase: () => void
  tick: () => void
  setMinimized: (minimized: boolean) => void
  updateSettings: (settings: {
    workDuration?: number
    breakDuration?: number
    longBreakDuration?: number
    sessionsBeforeLongBreak?: number
  }) => void
  linkToBlock: (blockId: string | null) => void
  resetTimer: () => void
}

// =====================================================
// Daily Planning Ritual State
// =====================================================

interface PlanningRitualState {
  isOpen: boolean
  currentStep: number
  totalSteps: number
  isCompleted: boolean
  selectedPriorities: string[]
  intention: string
}

interface PlanningRitualActions {
  openRitual: () => void
  closeRitual: () => void
  nextStep: () => void
  previousStep: () => void
  goToStep: (step: number) => void
  setSelectedPriorities: (priorities: string[]) => void
  addPriority: (todoId: string) => void
  removePriority: (todoId: string) => void
  setIntention: (intention: string) => void
  completeRitual: () => void
  resetRitual: () => void
}

// =====================================================
// Combined Store Type
// =====================================================

type ScheduleStore = ScheduleViewState &
  ScheduleViewActions &
  PomodoroTimerState &
  PomodoroTimerActions &
  PlanningRitualState &
  PlanningRitualActions

// =====================================================
// Store Implementation
// =====================================================

export const useScheduleStore = create<ScheduleStore>()(
  persist(
    (set, get) => ({
      // =====================================================
      // Schedule View State
      // =====================================================
      currentDate: new Date(),
      view: 'day' as ScheduleView,
      selectedBlockId: null,
      hoveredBlockId: null,
      isCreatingBlock: false,
      isEditingBlock: false,
      dragStartTime: null,
      dragEndTime: null,

      setCurrentDate: (date) => set({ currentDate: date }),

      goToToday: () => set({ currentDate: new Date() }),

      goToNextDay: () =>
        set((state) => ({ currentDate: addDays(state.currentDate, 1) })),

      goToPreviousDay: () =>
        set((state) => ({ currentDate: subDays(state.currentDate, 1) })),

      goToNextWeek: () =>
        set((state) => ({ currentDate: addDays(state.currentDate, 7) })),

      goToPreviousWeek: () =>
        set((state) => ({ currentDate: subDays(state.currentDate, 7) })),

      setView: (view) => set({ view }),

      selectBlock: (id) => set({ selectedBlockId: id }),

      hoverBlock: (id) => set({ hoveredBlockId: id }),

      startCreatingBlock: (startTime) =>
        set({
          isCreatingBlock: true,
          dragStartTime: startTime || null,
          selectedBlockId: null,
        }),

      stopCreatingBlock: () =>
        set({
          isCreatingBlock: false,
          dragStartTime: null,
          dragEndTime: null,
        }),

      startEditingBlock: (id) =>
        set({
          selectedBlockId: id,
          isEditingBlock: true,
        }),

      stopEditingBlock: () =>
        set({
          isEditingBlock: false,
        }),

      setDragTimes: (start, end) =>
        set({
          dragStartTime: start,
          dragEndTime: end,
        }),

      // =====================================================
      // Pomodoro Timer State
      // =====================================================
      phase: 'idle' as PomodoroPhase,
      timeRemaining: 25 * 60, // 25 minutes in seconds
      isRunning: false,
      isPaused: false,
      currentSession: 1,
      totalSessionsCompleted: 0,
      linkedBlockId: null,
      isMinimized: false,
      workDuration: 25 * 60,
      breakDuration: 5 * 60,
      longBreakDuration: 15 * 60,
      sessionsBeforeLongBreak: 4,

      startTimer: (blockId) => {
        const { workDuration } = get()
        set({
          phase: 'work',
          timeRemaining: workDuration,
          isRunning: true,
          isPaused: false,
          linkedBlockId: blockId || null,
        })
      },

      pauseTimer: () => set({ isPaused: true, isRunning: false }),

      resumeTimer: () => set({ isPaused: false, isRunning: true }),

      stopTimer: () => {
        const { workDuration } = get()
        set({
          phase: 'idle',
          timeRemaining: workDuration,
          isRunning: false,
          isPaused: false,
          linkedBlockId: null,
        })
      },

      skipPhase: () => {
        const {
          phase,
          currentSession,
          sessionsBeforeLongBreak,
          workDuration,
          breakDuration,
          longBreakDuration,
        } = get()

        if (phase === 'work') {
          const newSession = currentSession + 1
          const isLongBreak = currentSession % sessionsBeforeLongBreak === 0

          set({
            phase: isLongBreak ? 'longBreak' : 'break',
            timeRemaining: isLongBreak ? longBreakDuration : breakDuration,
            currentSession: newSession,
            totalSessionsCompleted: get().totalSessionsCompleted + 1,
          })
        } else {
          set({
            phase: 'work',
            timeRemaining: workDuration,
          })
        }
      },

      tick: () => {
        const { timeRemaining, isRunning } = get()

        if (!isRunning || timeRemaining <= 0) return

        const newTime = timeRemaining - 1

        if (newTime <= 0) {
          // Phase complete, auto-advance
          get().skipPhase()
        } else {
          set({ timeRemaining: newTime })
        }
      },

      setMinimized: (minimized) => set({ isMinimized: minimized }),

      updateSettings: (settings) => {
        const updates: Partial<PomodoroTimerState> = {}

        if (settings.workDuration !== undefined) {
          updates.workDuration = settings.workDuration * 60
        }
        if (settings.breakDuration !== undefined) {
          updates.breakDuration = settings.breakDuration * 60
        }
        if (settings.longBreakDuration !== undefined) {
          updates.longBreakDuration = settings.longBreakDuration * 60
        }
        if (settings.sessionsBeforeLongBreak !== undefined) {
          updates.sessionsBeforeLongBreak = settings.sessionsBeforeLongBreak
        }

        set(updates)
      },

      linkToBlock: (blockId) => set({ linkedBlockId: blockId }),

      resetTimer: () => {
        const { workDuration } = get()
        set({
          phase: 'idle',
          timeRemaining: workDuration,
          isRunning: false,
          isPaused: false,
          currentSession: 1,
          totalSessionsCompleted: 0,
          linkedBlockId: null,
        })
      },

      // =====================================================
      // Daily Planning Ritual State
      // =====================================================
      isOpen: false,
      currentStep: 0,
      totalSteps: 5,
      isCompleted: false,
      selectedPriorities: [],
      intention: '',

      openRitual: () =>
        set({
          isOpen: true,
          currentStep: 0,
          isCompleted: false,
        }),

      closeRitual: () => set({ isOpen: false }),

      nextStep: () =>
        set((state) => ({
          currentStep: Math.min(state.currentStep + 1, state.totalSteps - 1),
        })),

      previousStep: () =>
        set((state) => ({
          currentStep: Math.max(state.currentStep - 1, 0),
        })),

      goToStep: (step) =>
        set((state) => ({
          currentStep: Math.max(0, Math.min(step, state.totalSteps - 1)),
        })),

      setSelectedPriorities: (priorities) =>
        set({ selectedPriorities: priorities }),

      addPriority: (todoId) =>
        set((state) => ({
          selectedPriorities: state.selectedPriorities.includes(todoId)
            ? state.selectedPriorities
            : [...state.selectedPriorities, todoId].slice(0, 3), // Max 3 priorities
        })),

      removePriority: (todoId) =>
        set((state) => ({
          selectedPriorities: state.selectedPriorities.filter((id) => id !== todoId),
        })),

      setIntention: (intention) => set({ intention }),

      completeRitual: () =>
        set({
          isCompleted: true,
          isOpen: false,
        }),

      resetRitual: () =>
        set({
          isOpen: false,
          currentStep: 0,
          isCompleted: false,
          selectedPriorities: [],
          intention: '',
        }),
    }),
    {
      name: 'schedule-store',
      partialize: (state) => ({
        // Only persist these fields
        view: state.view,
        workDuration: state.workDuration,
        breakDuration: state.breakDuration,
        longBreakDuration: state.longBreakDuration,
        sessionsBeforeLongBreak: state.sessionsBeforeLongBreak,
      }),
    }
  )
)

// =====================================================
// Selectors for optimized re-renders
// =====================================================

export const selectCurrentDate = (state: ScheduleStore) => state.currentDate
export const selectView = (state: ScheduleStore) => state.view
export const selectSelectedBlockId = (state: ScheduleStore) => state.selectedBlockId
export const selectIsCreatingBlock = (state: ScheduleStore) => state.isCreatingBlock
export const selectPomodoroState = (state: ScheduleStore) => ({
  phase: state.phase,
  timeRemaining: state.timeRemaining,
  isRunning: state.isRunning,
  isPaused: state.isPaused,
  currentSession: state.currentSession,
  totalSessionsCompleted: state.totalSessionsCompleted,
  linkedBlockId: state.linkedBlockId,
  isMinimized: state.isMinimized,
})
export const selectPlanningRitualState = (state: ScheduleStore) => ({
  isOpen: state.isOpen,
  currentStep: state.currentStep,
  totalSteps: state.totalSteps,
  isCompleted: state.isCompleted,
  selectedPriorities: state.selectedPriorities,
  intention: state.intention,
})
