'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { ThemeToggleCompact } from '@/components/ThemeToggle'

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { href: '/today', label: 'Today', icon: 'check_box' },
  { href: '/projects', label: 'Projects', icon: 'rocket_launch' },
  { href: '/journal', label: 'Journal', icon: 'book' },
  { href: '/notes', label: 'Notes', icon: 'edit_note' },
  { href: '/research', label: 'Research', icon: 'science' },
  { href: '/files', label: 'Files', icon: 'folder_open' },
  { href: '/templates', label: 'Templates', icon: 'style' },
  { href: '/calendar', label: 'Calendar', icon: 'calendar_month' },
  { href: '/search', label: 'Search', icon: 'search' },
]

export function Sidebar({ isOpen = true, onClose, isCollapsed = false, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname()
  const { user, signOut } = useAuthStore()

  const handleSignOut = async () => {
    await signOut()
    window.location.href = '/login'
  }

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-screen bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 transition-all duration-300 ease-in-out lg:translate-x-0 lg:relative lg:z-10 flex flex-col justify-between shadow-sm dark:shadow-none overflow-visible',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          isCollapsed ? 'w-20 p-4' : 'w-72 p-6'
        )}
      >
        {/* Collapse/Expand Toggle - Half circle on right edge */}
        <button
          onClick={onToggleCollapse}
          className="hidden lg:flex absolute top-24 right-0 translate-x-full w-5 h-10 items-center justify-center bg-zinc-800 dark:bg-zinc-800 border border-zinc-700 dark:border-zinc-600 border-l-0 rounded-r-full hover:bg-zinc-700 dark:hover:bg-zinc-700 transition-all z-50"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <span
            className="material-symbols-outlined text-zinc-400 transition-transform duration-300"
            style={{
              fontSize: '14px',
              transform: isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)'
            }}
          >
            chevron_left
          </span>
        </button>

        <div className="flex flex-col gap-8">
          {/* User Profile Header */}
          <div className={cn(
            "flex items-center",
            isCollapsed ? "justify-center" : "gap-4"
          )}>
            <div
              className={cn(
                "bg-gradient-to-br from-cyan-400 to-cyan-600 rounded-full ring-2 ring-zinc-200 dark:ring-zinc-700 flex items-center justify-center text-white font-bold flex-shrink-0 transition-all duration-300",
                isCollapsed ? "w-10 h-10 text-sm" : "w-12 h-12 text-lg"
              )}
            >
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <h1 className="text-zinc-900 dark:text-zinc-100 text-lg font-bold leading-tight truncate">My Journal</h1>
                <p className="text-zinc-500 dark:text-zinc-400 text-xs font-normal">Daily Planner</p>
              </div>
            )}
          </div>

          {/* Mobile close button */}
          <button
            onClick={onClose}
            className="lg:hidden absolute top-4 right-4 p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-400"
          >
            <span className="material-symbols-outlined">close</span>
          </button>

          {/* Navigation */}
          <nav className="flex flex-col gap-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  title={isCollapsed ? item.label : undefined}
                  className={cn(
                    'group flex items-center rounded-xl transition-all',
                    isCollapsed ? 'justify-center px-3 py-3' : 'gap-3 px-4 py-3',
                    isActive
                      ? 'bg-cyan-500/10 dark:bg-cyan-500/15 border border-cyan-500/20 dark:border-cyan-500/30 text-cyan-600 dark:text-cyan-400'
                      : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100'
                  )}
                >
                  <span
                    className={cn(
                      "material-symbols-outlined flex-shrink-0",
                      isActive ? "text-cyan-600 dark:text-cyan-400" : ""
                    )}
                    style={{ fontSize: '24px' }}
                  >
                    {item.icon}
                  </span>
                  {!isCollapsed && (
                    <p className={cn(
                      "text-sm leading-normal truncate",
                      isActive ? "font-bold" : "font-medium"
                    )}>
                      {item.label}
                    </p>
                  )}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Bottom Section */}
        <div className="flex flex-col gap-2 pt-4 border-t border-zinc-200 dark:border-zinc-700/50">
          {/* Theme Toggle */}
          <div className={cn(
            "flex items-center rounded-xl transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800",
            isCollapsed ? "justify-center px-3 py-3" : "gap-3 px-4 py-3"
          )}>
            {!isCollapsed && (
              <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">Theme</span>
            )}
            <ThemeToggleCompact className={isCollapsed ? "" : "ml-auto"} />
          </div>

          <Link
            href="/settings"
            title={isCollapsed ? 'Settings' : undefined}
            className={cn(
              "flex items-center rounded-xl text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors",
              isCollapsed ? "justify-center px-3 py-3" : "gap-3 px-4 py-3"
            )}
          >
            <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '24px' }}>settings</span>
            {!isCollapsed && (
              <p className="text-sm font-medium leading-normal">Settings</p>
            )}
          </Link>

          <button
            onClick={handleSignOut}
            title={isCollapsed ? 'Sign Out' : undefined}
            className={cn(
              "flex items-center rounded-xl text-zinc-500 dark:text-zinc-400 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 transition-colors w-full",
              isCollapsed ? "justify-center px-3 py-3" : "gap-3 px-4 py-3"
            )}
          >
            <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '24px' }}>logout</span>
            {!isCollapsed && (
              <p className="text-sm font-medium leading-normal">Sign Out</p>
            )}
          </button>
        </div>
      </aside>
    </>
  )
}
