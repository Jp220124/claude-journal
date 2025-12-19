'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { isDemoAccount, demoSidebarData } from '@/lib/demo'

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { href: '/today', label: 'Today', icon: 'check_box' },
  { href: '/journal', label: 'Journal', icon: 'book' },
  { href: '/notes', label: 'Notes', icon: 'edit_note' },
  { href: '/templates', label: 'Templates', icon: 'style' },
  { href: '/calendar', label: 'Calendar', icon: 'calendar_month' },
  { href: '/search', label: 'Search', icon: 'search' },
]

export function Sidebar({ isOpen = true, onClose, isCollapsed = false, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname()
  const { user, signOut } = useAuthStore()
  const isDemo = isDemoAccount(user?.email)

  // Get streak data based on demo status
  const streakDays = isDemo ? demoSidebarData.streak : 0
  const streakProgress = isDemo ? demoSidebarData.streakProgress : 0

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
          'fixed top-0 left-0 z-50 h-screen bg-white border-r border-slate-200 transition-all duration-300 ease-in-out lg:translate-x-0 lg:static lg:z-0 flex flex-col justify-between shadow-sm',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          isCollapsed ? 'w-20 p-4' : 'w-72 p-6'
        )}
      >
        <div className="flex flex-col gap-8">
          {/* User Profile Header */}
          <div className={cn(
            "flex items-center",
            isCollapsed ? "justify-center" : "gap-4"
          )}>
            <div
              className={cn(
                "bg-gradient-to-br from-cyan-400 to-cyan-600 rounded-full ring-2 ring-slate-200 flex items-center justify-center text-white font-bold flex-shrink-0 transition-all duration-300",
                isCollapsed ? "w-10 h-10 text-sm" : "w-12 h-12 text-lg"
              )}
            >
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <h1 className="text-slate-900 text-lg font-bold leading-tight truncate">My Journal</h1>
                <p className="text-slate-500 text-xs font-normal">Daily Planner</p>
              </div>
            )}
          </div>

          {/* Mobile close button */}
          <button
            onClick={onClose}
            className="lg:hidden absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-lg"
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
                      ? 'bg-cyan-50 border border-cyan-200/50 text-cyan-600'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                  )}
                >
                  <span
                    className={cn(
                      "material-symbols-outlined flex-shrink-0",
                      isActive ? "text-cyan-600" : ""
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

          {/* Streak Card */}
          {!isCollapsed ? (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-2 mb-3">
                <span className={cn(
                  "material-symbols-outlined",
                  streakDays > 0 ? "text-orange-500" : "text-slate-400"
                )} style={{ fontSize: '20px' }}>
                  local_fire_department
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Current Streak
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-slate-900">{streakDays}</span>
                <span className="text-sm text-slate-500">{streakDays === 1 ? 'day' : 'days'}</span>
              </div>
              <div className="mt-2 h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    streakDays > 0 ? "bg-orange-400" : "bg-slate-300"
                  )}
                  style={{ width: `${streakProgress}%` }}
                ></div>
              </div>
              {streakDays === 0 && (
                <p className="text-xs text-slate-400 mt-2">Start journaling to build your streak!</p>
              )}
            </div>
          ) : (
            <div
              className="flex justify-center p-3 rounded-xl bg-slate-50 border border-slate-200"
              title={`${streakDays} day streak`}
            >
              <div className="flex flex-col items-center">
                <span className={cn(
                  "material-symbols-outlined",
                  streakDays > 0 ? "text-orange-500" : "text-slate-400"
                )} style={{ fontSize: '20px' }}>
                  local_fire_department
                </span>
                <span className="text-sm font-bold text-slate-900 mt-1">{streakDays}</span>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Section */}
        <div className="flex flex-col gap-2">
          {/* Collapse Toggle Button - Desktop only */}
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex items-center justify-center px-3 py-3 rounded-xl text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <span
              className="material-symbols-outlined transition-transform duration-300"
              style={{
                fontSize: '24px',
                transform: isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)'
              }}
            >
              chevron_left
            </span>
            {!isCollapsed && (
              <span className="text-sm font-medium ml-2">Collapse</span>
            )}
          </button>

          <Link
            href="/settings"
            title={isCollapsed ? 'Settings' : undefined}
            className={cn(
              "flex items-center rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors",
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
              "flex items-center rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors w-full",
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
