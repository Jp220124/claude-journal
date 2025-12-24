'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'

interface ThemeToggleProps {
  className?: string
  variant?: 'dropdown' | 'segmented' | 'icon'
}

// Helper function to toggle theme with ripple transition effect
function toggleThemeWithTransition(
  setTheme: (theme: string) => void,
  newTheme: string
) {
  // Check if View Transitions API is supported
  if (
    typeof document !== 'undefined' &&
    'startViewTransition' in document &&
    typeof (document as any).startViewTransition === 'function'
  ) {
    // Use View Transitions API for ripple effect
    (document as any).startViewTransition(() => {
      setTheme(newTheme)
    })
  } else {
    // Fallback for unsupported browsers - just change theme directly
    setTheme(newTheme)
  }
}

export function ThemeToggle({ className, variant = 'segmented' }: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className={cn('h-9 w-[140px] rounded-lg bg-zinc-100 dark:bg-zinc-800 animate-pulse', className)} />
    )
  }

  if (variant === 'icon') {
    return (
      <button
        onClick={() => toggleThemeWithTransition(setTheme, resolvedTheme === 'dark' ? 'light' : 'dark')}
        className={cn(
          'p-2 rounded-lg transition-all duration-200',
          'bg-zinc-100 dark:bg-zinc-800',
          'hover:bg-zinc-200 dark:hover:bg-zinc-700',
          'text-zinc-600 dark:text-zinc-400',
          'hover:text-zinc-900 dark:hover:text-zinc-100',
          className
        )}
        aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
      >
        {resolvedTheme === 'dark' ? (
          <SunIcon className="h-5 w-5" />
        ) : (
          <MoonIcon className="h-5 w-5" />
        )}
      </button>
    )
  }

  if (variant === 'dropdown') {
    return (
      <div className={cn('relative', className)}>
        <select
          value={theme}
          onChange={(e) => toggleThemeWithTransition(setTheme, e.target.value)}
          className={cn(
            'appearance-none px-3 py-2 pr-8 rounded-lg text-sm font-medium',
            'bg-zinc-100 dark:bg-zinc-800',
            'text-zinc-700 dark:text-zinc-300',
            'border border-zinc-200 dark:border-zinc-700',
            'hover:bg-zinc-200 dark:hover:bg-zinc-700',
            'focus:outline-none focus:ring-2 focus:ring-cyan-500/50',
            'cursor-pointer transition-colors'
          )}
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="system">System</option>
        </select>
        <ChevronDownIcon className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none" />
      </div>
    )
  }

  // Segmented control (default)
  return (
    <div
      className={cn(
        'inline-flex items-center p-1 rounded-lg',
        'bg-zinc-100 dark:bg-zinc-800/80',
        'border border-zinc-200/50 dark:border-zinc-700/50',
        className
      )}
      role="radiogroup"
      aria-label="Theme selection"
    >
      <ThemeButton
        active={theme === 'light'}
        onClick={() => toggleThemeWithTransition(setTheme, 'light')}
        icon={<SunIcon className="h-4 w-4" />}
        label="Light"
        ariaLabel="Light theme"
      />
      <ThemeButton
        active={theme === 'dark'}
        onClick={() => toggleThemeWithTransition(setTheme, 'dark')}
        icon={<MoonIcon className="h-4 w-4" />}
        label="Dark"
        ariaLabel="Dark theme"
      />
      <ThemeButton
        active={theme === 'system'}
        onClick={() => toggleThemeWithTransition(setTheme, 'system')}
        icon={<MonitorIcon className="h-4 w-4" />}
        label="Auto"
        ariaLabel="System theme"
      />
    </div>
  )
}

interface ThemeButtonProps {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  ariaLabel: string
}

function ThemeButton({ active, onClick, icon, label, ariaLabel }: ThemeButtonProps) {
  return (
    <button
      role="radio"
      aria-checked={active}
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium',
        'transition-all duration-200 ease-out',
        active
          ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm'
          : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
      )}
    >
      <span className={cn(
        'transition-transform duration-200',
        active && 'scale-110'
      )}>
        {icon}
      </span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

// Compact toggle for smaller spaces
export function ThemeToggleCompact({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div className={cn('h-8 w-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 animate-pulse', className)} />
  }

  return (
    <button
      onClick={() => toggleThemeWithTransition(setTheme, resolvedTheme === 'dark' ? 'light' : 'dark')}
      className={cn(
        'relative p-2 rounded-lg transition-all duration-300',
        'bg-zinc-100 dark:bg-zinc-800',
        'hover:bg-zinc-200 dark:hover:bg-zinc-700',
        'text-zinc-600 dark:text-zinc-300',
        'hover:text-zinc-900 dark:hover:text-zinc-100',
        'focus:outline-none focus:ring-2 focus:ring-cyan-500/50',
        'group overflow-hidden',
        className
      )}
      aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
    >
      <div className="relative h-5 w-5">
        {/* Sun icon */}
        <SunIcon
          className={cn(
            'absolute inset-0 h-5 w-5 transition-all duration-300',
            resolvedTheme === 'dark'
              ? 'rotate-0 scale-100 opacity-100'
              : '-rotate-90 scale-0 opacity-0'
          )}
        />
        {/* Moon icon */}
        <MoonIcon
          className={cn(
            'absolute inset-0 h-5 w-5 transition-all duration-300',
            resolvedTheme === 'dark'
              ? 'rotate-90 scale-0 opacity-0'
              : 'rotate-0 scale-100 opacity-100'
          )}
        />
      </div>
    </button>
  )
}

// Icons
function SunIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  )
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  )
}

function MonitorIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <line x1="8" x2="16" y1="21" y2="21" />
      <line x1="12" x2="12" y1="17" y2="21" />
    </svg>
  )
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}
