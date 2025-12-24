'use client'

import { useState, useEffect } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { useAuthStore } from '@/stores/authStore'
import { ResearchPanelProvider } from '@/contexts/ResearchPanelContext'

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const { initialize, initialized, user } = useAuthStore()

  // Load collapsed state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
    if (saved !== null) {
      setSidebarCollapsed(saved === 'true')
    }
  }, [])

  const toggleSidebarCollapsed = () => {
    const newValue = !sidebarCollapsed
    setSidebarCollapsed(newValue)
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(newValue))
  }

  useEffect(() => {
    if (!initialized) {
      initialize()
    }
  }, [initialize, initialized])

  return (
    <div className="flex h-screen w-full bg-[var(--background)]">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapsed}
      />

      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-cyan-400 to-cyan-600 rounded-full w-8 h-8 flex items-center justify-center text-white font-bold text-sm">
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            <span className="font-bold text-zinc-900 dark:text-zinc-100">Journal</span>
          </div>
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-zinc-900 dark:text-zinc-100 p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto">
          <ResearchPanelProvider>
            {children}
          </ResearchPanelProvider>
        </div>
      </main>
    </div>
  )
}
