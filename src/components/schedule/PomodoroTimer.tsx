'use client'

import { useEffect, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { cn } from '@/lib/utils'
import { useScheduleStore } from '@/stores/scheduleStore'
import type { PomodoroPhase } from '@/types/schedule'

interface PomodoroTimerProps {
  className?: string
  showSettings?: boolean
  onSessionComplete?: () => void
}

const PHASE_COLORS = {
  idle: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400',
  work: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  break: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
  longBreak: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
}

const PHASE_LABELS = {
  idle: 'Ready',
  work: 'Focus Time',
  break: 'Short Break',
  longBreak: 'Long Break',
}

const PHASE_ICONS = {
  idle: 'timer',
  work: 'local_fire_department',
  break: 'coffee',
  longBreak: 'self_improvement',
}

export function PomodoroTimer({
  className,
  showSettings = false,
  onSessionComplete,
}: PomodoroTimerProps) {
  const pomodoroState = useScheduleStore(
    useShallow((state) => ({
      phase: state.phase,
      timeRemaining: state.timeRemaining,
      isRunning: state.isRunning,
      isPaused: state.isPaused,
      currentSession: state.currentSession,
      totalSessionsCompleted: state.totalSessionsCompleted,
      linkedBlockId: state.linkedBlockId,
      isMinimized: state.isMinimized,
    }))
  )
  const {
    startTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
    skipPhase,
    tick,
    setMinimized,
    resetTimer,
  } = useScheduleStore()

  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Calculate progress percentage
  const getProgress = () => {
    const {
      phase,
      timeRemaining,
    } = pomodoroState

    const store = useScheduleStore.getState()
    let totalTime = store.workDuration

    if (phase === 'break') totalTime = store.breakDuration
    if (phase === 'longBreak') totalTime = store.longBreakDuration
    if (phase === 'idle') return 0

    return ((totalTime - timeRemaining) / totalTime) * 100
  }

  // Timer tick effect
  useEffect(() => {
    if (pomodoroState.isRunning && !pomodoroState.isPaused) {
      intervalRef.current = setInterval(() => {
        tick()
      }, 1000)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [pomodoroState.isRunning, pomodoroState.isPaused, tick])

  // Play notification sound using Web Audio API as fallback
  const playNotificationSound = () => {
    // Try to play the audio file first
    if (audioRef.current) {
      audioRef.current.play().catch(() => {
        // Fallback to Web Audio API
        try {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
          const oscillator = audioContext.createOscillator()
          const gainNode = audioContext.createGain()

          oscillator.connect(gainNode)
          gainNode.connect(audioContext.destination)

          oscillator.frequency.value = 800 // Bell-like frequency
          oscillator.type = 'sine'

          gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)

          oscillator.start(audioContext.currentTime)
          oscillator.stop(audioContext.currentTime + 0.5)
        } catch (e) {
          // Silently fail if Web Audio API is not available
        }
      })
    }
  }

  // Phase change notification effect
  useEffect(() => {
    if (pomodoroState.phase !== 'idle' && pomodoroState.timeRemaining === 0) {
      // Play notification sound
      playNotificationSound()

      // Browser notification
      if (Notification.permission === 'granted') {
        new Notification('Pomodoro Timer', {
          body: `${PHASE_LABELS[pomodoroState.phase]} complete!`,
          icon: '/favicon.ico',
        })
      }

      if (pomodoroState.phase === 'work') {
        onSessionComplete?.()
      }
    }
  }, [pomodoroState.phase, pomodoroState.timeRemaining, onSessionComplete])

  // Request notification permission on mount
  useEffect(() => {
    if (Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  const handleStart = () => {
    if (pomodoroState.phase === 'idle') {
      startTimer()
    } else if (pomodoroState.isPaused) {
      resumeTimer()
    }
  }

  const handlePause = () => {
    pauseTimer()
  }

  const handleStop = () => {
    stopTimer()
  }

  const handleSkip = () => {
    skipPhase()
  }

  // Minimized view
  if (pomodoroState.isMinimized) {
    return (
      <div
        className={cn(
          'fixed bottom-4 right-4 z-50',
          'flex items-center gap-2 px-4 py-2 rounded-full shadow-lg',
          'bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700',
          'cursor-pointer hover:shadow-xl transition-shadow',
          className
        )}
        onClick={() => setMinimized(false)}
      >
        <span
          className={cn(
            'material-symbols-outlined',
            pomodoroState.phase === 'work' ? 'text-red-500' :
            pomodoroState.phase === 'break' ? 'text-green-500' :
            pomodoroState.phase === 'longBreak' ? 'text-blue-500' : 'text-zinc-500'
          )}
          style={{ fontSize: '20px' }}
        >
          {PHASE_ICONS[pomodoroState.phase]}
        </span>
        <span className="text-lg font-mono font-bold text-zinc-900 dark:text-zinc-100">
          {formatTime(pomodoroState.timeRemaining)}
        </span>
        {pomodoroState.isRunning && !pomodoroState.isPaused && (
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
        )}
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Hidden audio element for notifications */}
      <audio ref={audioRef} src="/sounds/bell.mp3" preload="auto" />

      {/* Timer Card */}
      <div className="bg-white dark:bg-zinc-800/50 rounded-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-red-500" style={{ fontSize: '20px' }}>
              timer
            </span>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Pomodoro Timer
            </h3>
          </div>
          <button
            onClick={() => setMinimized(true)}
            className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-500 transition-colors"
            title="Minimize"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              minimize
            </span>
          </button>
        </div>

        {/* Timer display */}
        <div className="p-6 flex flex-col items-center">
          {/* Phase indicator */}
          <div
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium mb-4',
              PHASE_COLORS[pomodoroState.phase]
            )}
          >
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                {PHASE_ICONS[pomodoroState.phase]}
              </span>
              {PHASE_LABELS[pomodoroState.phase]}
            </span>
          </div>

          {/* Circular progress timer */}
          <div className="relative w-40 h-40 mb-4">
            {/* Background circle */}
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="80"
                cy="80"
                r="70"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                className="text-zinc-200 dark:text-zinc-700"
              />
              {/* Progress circle */}
              <circle
                cx="80"
                cy="80"
                r="70"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                strokeLinecap="round"
                className={cn(
                  pomodoroState.phase === 'work' ? 'text-red-500' :
                  pomodoroState.phase === 'break' ? 'text-green-500' :
                  pomodoroState.phase === 'longBreak' ? 'text-blue-500' : 'text-zinc-400'
                )}
                style={{
                  strokeDasharray: `${2 * Math.PI * 70}`,
                  strokeDashoffset: `${2 * Math.PI * 70 * (1 - getProgress() / 100)}`,
                  transition: 'stroke-dashoffset 0.5s ease',
                }}
              />
            </svg>

            {/* Time display */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-mono font-bold text-zinc-900 dark:text-zinc-100">
                {formatTime(pomodoroState.timeRemaining)}
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Session {pomodoroState.currentSession}
              </span>
            </div>
          </div>

          {/* Session dots */}
          <div className="flex items-center gap-2 mb-6">
            {[1, 2, 3, 4].map((session) => (
              <div
                key={session}
                className={cn(
                  'w-2.5 h-2.5 rounded-full transition-colors',
                  session <= pomodoroState.totalSessionsCompleted
                    ? 'bg-red-500'
                    : session === pomodoroState.currentSession && pomodoroState.phase === 'work'
                    ? 'bg-red-300 animate-pulse'
                    : 'bg-zinc-200 dark:bg-zinc-700'
                )}
              />
            ))}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            {pomodoroState.phase === 'idle' ? (
              <button
                onClick={handleStart}
                className="flex items-center gap-2 px-6 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-full font-medium transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                  play_arrow
                </span>
                Start
              </button>
            ) : (
              <>
                {pomodoroState.isPaused ? (
                  <button
                    onClick={handleStart}
                    className="flex items-center gap-2 px-5 py-2 bg-green-500 hover:bg-green-600 text-white rounded-full font-medium transition-colors"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                      play_arrow
                    </span>
                    Resume
                  </button>
                ) : (
                  <button
                    onClick={handlePause}
                    className="flex items-center gap-2 px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-full font-medium transition-colors"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                      pause
                    </span>
                    Pause
                  </button>
                )}

                <button
                  onClick={handleSkip}
                  className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-500 transition-colors"
                  title="Skip to next phase"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                    skip_next
                  </span>
                </button>

                <button
                  onClick={handleStop}
                  className="p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-colors"
                  title="Stop timer"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                    stop
                  </span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Stats footer */}
        <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500 dark:text-zinc-400">
              Sessions completed today
            </span>
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {pomodoroState.totalSessionsCompleted}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// Floating minimized widget that stays visible during work
export function PomodoroFloatingWidget() {
  const pomodoroState = useScheduleStore(
    useShallow((state) => ({
      phase: state.phase,
      timeRemaining: state.timeRemaining,
      isRunning: state.isRunning,
      isPaused: state.isPaused,
      isMinimized: state.isMinimized,
    }))
  )
  const { setMinimized } = useScheduleStore()

  if (!pomodoroState.isMinimized || pomodoroState.phase === 'idle') {
    return null
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 z-50',
        'flex items-center gap-3 px-4 py-3 rounded-2xl shadow-lg',
        'bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700',
        'cursor-pointer hover:shadow-xl transition-all hover:scale-105'
      )}
      onClick={() => setMinimized(false)}
    >
      <div
        className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center',
          pomodoroState.phase === 'work' ? 'bg-red-100 dark:bg-red-900/30' :
          pomodoroState.phase === 'break' ? 'bg-green-100 dark:bg-green-900/30' :
          'bg-blue-100 dark:bg-blue-900/30'
        )}
      >
        <span
          className={cn(
            'material-symbols-outlined',
            pomodoroState.phase === 'work' ? 'text-red-500' :
            pomodoroState.phase === 'break' ? 'text-green-500' : 'text-blue-500'
          )}
          style={{ fontSize: '20px' }}
        >
          {PHASE_ICONS[pomodoroState.phase]}
        </span>
      </div>

      <div className="flex flex-col">
        <span className="text-xl font-mono font-bold text-zinc-900 dark:text-zinc-100">
          {formatTime(pomodoroState.timeRemaining)}
        </span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {PHASE_LABELS[pomodoroState.phase]}
        </span>
      </div>

      {pomodoroState.isRunning && !pomodoroState.isPaused && (
        <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
      )}
    </div>
  )
}
