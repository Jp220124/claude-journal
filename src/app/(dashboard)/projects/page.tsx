'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { format, isPast, isToday, isTomorrow, differenceInDays } from 'date-fns'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { isDemoAccount } from '@/lib/demo'
import {
  fetchProjects,
  createProject,
  updateProject,
  deleteProject,
} from '@/lib/projectService'
import type {
  Project,
  ProjectWithCounts,
  ProjectStatus,
  ProjectFilters,
  ProjectSortOptions,
  ProjectFormData,
  PROJECT_ICONS,
  PROJECT_COLORS,
  PROJECT_STATUS_INFO,
} from '@/types/projects'

// Status filter pills
const STATUS_FILTERS: { value: ProjectStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
]

// Status display info
const STATUS_INFO: Record<ProjectStatus, { label: string; color: string; bgColor: string; dotColor: string }> = {
  active: { label: 'Active', color: 'text-green-700 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/40', dotColor: 'bg-green-500' },
  on_hold: { label: 'On Hold', color: 'text-amber-700 dark:text-amber-400', bgColor: 'bg-amber-100 dark:bg-amber-900/40', dotColor: 'bg-amber-500' },
  completed: { label: 'Completed', color: 'text-blue-700 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/40', dotColor: 'bg-blue-500' },
  archived: { label: 'Archived', color: 'text-slate-500 dark:text-slate-400', bgColor: 'bg-slate-100 dark:bg-slate-700/50', dotColor: 'bg-slate-400' },
}

// Icon options
const ICON_OPTIONS = [
  'folder', 'work', 'school', 'home', 'favorite', 'star',
  'rocket_launch', 'lightbulb', 'code', 'design_services',
  'science', 'book', 'travel_explore', 'fitness_center',
  'restaurant', 'shopping_cart', 'account_balance', 'psychology',
  'group', 'celebration',
]

// Color options
const COLOR_OPTIONS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
  '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6',
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
  '#f43f5e', '#64748b',
]

// Demo projects
const demoProjects: ProjectWithCounts[] = [
  {
    id: 'demo-1',
    user_id: 'demo',
    name: 'Website Redesign',
    description: 'Complete overhaul of the company website with modern design',
    color: '#6366f1',
    icon: 'design_services',
    status: 'active',
    start_date: '2025-01-01',
    target_date: '2025-03-31',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    task_count: 12,
    completed_task_count: 5,
    progress_percent: 42,
    note_count: 5,
    event_count: 3,
    file_count: 8,
    member_count: 4,
  },
  {
    id: 'demo-2',
    user_id: 'demo',
    name: 'Mobile App Launch',
    description: 'Launch new mobile app for iOS and Android platforms',
    color: '#22c55e',
    icon: 'rocket_launch',
    status: 'active',
    start_date: '2025-02-01',
    target_date: '2025-06-15',
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date(Date.now() - 86400000).toISOString(),
    task_count: 24,
    completed_task_count: 8,
    progress_percent: 33,
    note_count: 12,
    event_count: 6,
    file_count: 15,
    member_count: 6,
  },
  {
    id: 'demo-3',
    user_id: 'demo',
    name: 'Q1 Marketing Campaign',
    description: 'Quarterly marketing initiatives and promotions',
    color: '#f59e0b',
    icon: 'campaign',
    status: 'completed',
    start_date: '2025-01-01',
    target_date: '2025-03-31',
    created_at: new Date(Date.now() - 172800000).toISOString(),
    updated_at: new Date(Date.now() - 172800000).toISOString(),
    task_count: 18,
    completed_task_count: 18,
    progress_percent: 100,
    note_count: 8,
    event_count: 4,
    file_count: 10,
    member_count: 3,
  },
]

// Default form data
const defaultFormData: ProjectFormData = {
  name: '',
  description: '',
  color: '#6366f1',
  icon: 'folder',
  status: 'active',
  start_date: '',
  target_date: '',
}

export default function ProjectsPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const isDemo = isDemoAccount(user?.email)

  // State
  const [projects, setProjects] = useState<ProjectWithCounts[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all')
  const [sortField, setSortField] = useState<'name' | 'created_at' | 'updated_at' | 'target_date'>('updated_at')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editingProject, setEditingProject] = useState<ProjectWithCounts | null>(null)
  const [formData, setFormData] = useState<ProjectFormData>(defaultFormData)

  // Load projects
  const loadProjects = useCallback(async () => {
    if (isDemo) {
      setProjects(demoProjects)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const filters: ProjectFilters = {}
      if (statusFilter !== 'all') {
        filters.status = [statusFilter]
      }
      if (searchQuery.trim()) {
        filters.search = searchQuery.trim()
      }

      const sort: ProjectSortOptions = {
        field: sortField as any,
        direction: sortDirection,
      }

      const data = await fetchProjects(filters, sort)
      setProjects(data)
    } catch (error) {
      console.error('Error loading projects:', error)
    } finally {
      setIsLoading(false)
    }
  }, [isDemo, statusFilter, searchQuery, sortField, sortDirection])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  // Filtered and sorted projects (client-side for search)
  const filteredProjects = useMemo(() => {
    let result = [...projects]

    // Client-side search (for demo mode)
    if (searchQuery.trim() && isDemo) {
      const query = searchQuery.toLowerCase()
      result = result.filter(p =>
        p.name.toLowerCase().includes(query) ||
        (p.description && p.description.toLowerCase().includes(query))
      )
    }

    // Client-side status filter (for demo mode)
    if (statusFilter !== 'all' && isDemo) {
      result = result.filter(p => p.status === statusFilter)
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0
      if (sortField === 'name') {
        comparison = a.name.localeCompare(b.name)
      } else if (sortField === 'created_at') {
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      } else if (sortField === 'updated_at') {
        comparison = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
      } else if (sortField === 'target_date') {
        const aDate = a.target_date ? new Date(a.target_date).getTime() : 0
        const bDate = b.target_date ? new Date(b.target_date).getTime() : 0
        comparison = aDate - bDate
      }
      return sortDirection === 'asc' ? comparison : -comparison
    })

    return result
  }, [projects, searchQuery, statusFilter, sortField, sortDirection, isDemo])

  // Open modal for create/edit
  const openModal = (project?: ProjectWithCounts) => {
    if (project) {
      setEditingProject(project)
      setFormData({
        name: project.name,
        description: project.description || '',
        color: project.color,
        icon: project.icon,
        status: project.status,
        start_date: project.start_date || '',
        target_date: project.target_date || '',
      })
    } else {
      setEditingProject(null)
      setFormData(defaultFormData)
    }
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingProject(null)
    setFormData(defaultFormData)
  }

  // Save project
  const handleSave = async () => {
    if (!formData.name.trim()) return

    setIsSaving(true)
    try {
      if (isDemo) {
        // Demo mode - just update local state
        if (editingProject) {
          setProjects(prev => prev.map(p =>
            p.id === editingProject.id
              ? { ...p, ...formData, updated_at: new Date().toISOString() }
              : p
          ))
        } else {
          const newProject: ProjectWithCounts = {
            id: `demo-${Date.now()}`,
            user_id: 'demo',
            ...formData,
            description: formData.description || null,
            start_date: formData.start_date || null,
            target_date: formData.target_date || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            task_count: 0,
            completed_task_count: 0,
            progress_percent: 0,
            note_count: 0,
            event_count: 0,
            file_count: 0,
            member_count: 1,
          }
          setProjects(prev => [newProject, ...prev])
        }
      } else {
        if (editingProject) {
          await updateProject(editingProject.id, {
            name: formData.name,
            description: formData.description || null,
            color: formData.color,
            icon: formData.icon,
            status: formData.status,
            start_date: formData.start_date || null,
            target_date: formData.target_date || null,
          })
        } else {
          await createProject({
            name: formData.name,
            description: formData.description || null,
            color: formData.color,
            icon: formData.icon,
            status: formData.status,
            start_date: formData.start_date || null,
            target_date: formData.target_date || null,
          })
        }
        await loadProjects()
      }
      closeModal()
    } catch (error) {
      console.error('Error saving project:', error)
    } finally {
      setIsSaving(false)
    }
  }

  // Delete project
  const handleDelete = async (projectId: string) => {
    if (!confirm('Are you sure you want to delete this project? All links to tasks, notes, and events will be removed.')) return

    try {
      if (isDemo) {
        setProjects(prev => prev.filter(p => p.id !== projectId))
      } else {
        await deleteProject(projectId)
        await loadProjects()
      }
    } catch (error) {
      console.error('Error deleting project:', error)
    }
  }

  // Get due date status
  const getDueDateStatus = (targetDate: string | null) => {
    if (!targetDate) return null
    const date = new Date(targetDate)
    if (isPast(date) && !isToday(date)) {
      return { label: 'Overdue', color: 'text-red-600 dark:text-red-400' }
    }
    if (isToday(date)) {
      return { label: 'Due today', color: 'text-amber-600 dark:text-amber-400' }
    }
    if (isTomorrow(date)) {
      return { label: 'Due tomorrow', color: 'text-amber-600 dark:text-amber-400' }
    }
    const days = differenceInDays(date, new Date())
    if (days <= 7) {
      return { label: `${days} days left`, color: 'text-cyan-600 dark:text-cyan-400' }
    }
    return null
  }

  // Get progress percentage from project data
  const getProgressPercent = (project: ProjectWithCounts) => {
    // Use real progress data from database
    // For completed/archived status, override to 100%/current
    if (project.status === 'completed') return 100
    return project.progress_percent
  }

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header skeleton */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div className="h-10 w-48 bg-zinc-200 dark:bg-zinc-700 rounded-lg animate-pulse" />
            <div className="h-10 w-32 bg-zinc-200 dark:bg-zinc-700 rounded-lg animate-pulse" />
          </div>

          {/* Filter skeleton */}
          <div className="flex gap-2 mb-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-9 w-20 bg-zinc-200 dark:bg-zinc-700 rounded-full animate-pulse" />
            ))}
          </div>

          {/* Grid skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-6 animate-pulse">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-zinc-200 dark:bg-zinc-700" />
                  <div className="flex-1">
                    <div className="h-5 w-32 bg-zinc-200 dark:bg-zinc-700 rounded mb-2" />
                    <div className="h-4 w-full bg-zinc-200 dark:bg-zinc-700 rounded" />
                  </div>
                </div>
                <div className="h-2 w-full bg-zinc-200 dark:bg-zinc-700 rounded-full mb-4" />
                <div className="flex gap-4">
                  <div className="h-4 w-16 bg-zinc-200 dark:bg-zinc-700 rounded" />
                  <div className="h-4 w-16 bg-zinc-200 dark:bg-zinc-700 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-zinc-900 dark:text-zinc-100">
              Projects
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1">
              Manage your projects and track progress
            </p>
          </div>
          <button
            onClick={() => openModal()}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl font-medium shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:scale-[1.02] transition-all"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            New Project
          </button>
        </header>

        {/* Filters & Search */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          {/* Status Filter Pills */}
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map(filter => (
              <button
                key={filter.value}
                onClick={() => setStatusFilter(filter.value)}
                className={cn(
                  'px-4 py-2 rounded-full text-sm font-medium transition-all',
                  statusFilter === filter.value
                    ? 'bg-cyan-500 text-white shadow-md'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {/* Search & View Toggle */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Search */}
            <div className="relative flex-1 sm:flex-none">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 material-symbols-outlined text-[20px]">
                search
              </span>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search projects..."
                className="w-full sm:w-64 pl-10 pr-4 py-2 bg-zinc-100 dark:bg-zinc-800 border border-transparent rounded-xl text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:bg-white dark:focus:bg-zinc-700 focus:border-cyan-300 dark:focus:border-cyan-500 focus:ring-1 focus:ring-cyan-300 dark:focus:ring-cyan-500 outline-none transition-all text-sm"
              />
            </div>

            {/* Sort Dropdown */}
            <select
              value={`${sortField}-${sortDirection}`}
              onChange={(e) => {
                const [field, dir] = e.target.value.split('-')
                setSortField(field as any)
                setSortDirection(dir as 'asc' | 'desc')
              }}
              className="px-3 py-2 bg-zinc-100 dark:bg-zinc-800 border border-transparent rounded-xl text-zinc-600 dark:text-zinc-300 text-sm focus:border-cyan-300 dark:focus:border-cyan-500 focus:ring-1 focus:ring-cyan-300 dark:focus:ring-cyan-500 outline-none"
            >
              <option value="updated_at-desc">Recently Updated</option>
              <option value="created_at-desc">Newest First</option>
              <option value="created_at-asc">Oldest First</option>
              <option value="name-asc">Name A-Z</option>
              <option value="name-desc">Name Z-A</option>
              <option value="target_date-asc">Due Date</option>
            </select>

            {/* View Toggle */}
            <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-zinc-700 text-cyan-600 dark:text-cyan-400 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'
                )}
              >
                <span className="material-symbols-outlined text-[20px]">grid_view</span>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  viewMode === 'list'
                    ? 'bg-white dark:bg-zinc-700 text-cyan-600 dark:text-cyan-400 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'
                )}
              >
                <span className="material-symbols-outlined text-[20px]">view_list</span>
              </button>
            </div>
          </div>
        </div>

        {/* Projects Grid/List */}
        {filteredProjects.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
              <span className="material-symbols-outlined text-[32px] text-zinc-400">folder_off</span>
            </div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
              No projects found
            </h3>
            <p className="text-zinc-500 dark:text-zinc-400 mb-6">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Create your first project to get started'}
            </p>
            {!searchQuery && statusFilter === 'all' && (
              <button
                onClick={() => openModal()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-xl font-medium hover:bg-cyan-600 transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">add</span>
                Create Project
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map((project) => {
              const statusInfo = STATUS_INFO[project.status]
              const dueStatus = getDueDateStatus(project.target_date)
              const progress = getProgressPercent(project)

              return (
                <div
                  key={project.id}
                  className="group bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 hover:shadow-lg transition-all cursor-pointer overflow-hidden"
                  onClick={() => router.push(`/projects/${project.id}`)}
                >
                  {/* Card Header */}
                  <div className="p-6 pb-4">
                    <div className="flex items-start gap-4">
                      {/* Icon */}
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${project.color}20` }}
                      >
                        <span
                          className="material-symbols-outlined text-[24px]"
                          style={{ color: project.color }}
                        >
                          {project.icon}
                        </span>
                      </div>

                      {/* Title & Description */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                            {project.name}
                          </h3>
                          <span className={cn(
                            'px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0',
                            statusInfo.bgColor,
                            statusInfo.color
                          )}>
                            {statusInfo.label}
                          </span>
                        </div>
                        {project.description && (
                          <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2">
                            {project.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="px-6">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-zinc-500 dark:text-zinc-400">Progress</span>
                      <span className="font-medium text-zinc-700 dark:text-zinc-300">{progress}%</span>
                    </div>
                    <div className="h-2 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${progress}%`,
                          backgroundColor: project.color,
                        }}
                      />
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="p-6 pt-4">
                    <div className="flex items-center justify-between">
                      {/* Stats */}
                      <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[16px]">check_box</span>
                          {project.task_count}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[16px]">description</span>
                          {project.note_count}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[16px]">group</span>
                          {project.member_count}
                        </span>
                      </div>

                      {/* Due Date */}
                      {project.target_date && (
                        <span className={cn(
                          'text-xs font-medium',
                          dueStatus?.color || 'text-zinc-400 dark:text-zinc-500'
                        )}>
                          {dueStatus?.label || format(new Date(project.target_date), 'MMM d')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Hover Actions */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex items-center gap-1 bg-white dark:bg-zinc-800 rounded-lg shadow-lg p-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          openModal(project)
                        }}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(project.id)
                        }}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* List View */
          <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
            <table className="w-full">
              <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Project</th>
                  <th className="text-left px-6 py-3 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Status</th>
                  <th className="text-left px-6 py-3 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Progress</th>
                  <th className="text-left px-6 py-3 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Due Date</th>
                  <th className="text-left px-6 py-3 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Items</th>
                  <th className="text-right px-6 py-3 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700">
                {filteredProjects.map((project) => {
                  const statusInfo = STATUS_INFO[project.status]
                  const dueStatus = getDueDateStatus(project.target_date)
                  const progress = getProgressPercent(project)

                  return (
                    <tr
                      key={project.id}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-700/50 cursor-pointer transition-colors"
                      onClick={() => router.push(`/projects/${project.id}`)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: `${project.color}20` }}
                          >
                            <span
                              className="material-symbols-outlined text-[20px]"
                              style={{ color: project.color }}
                            >
                              {project.icon}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-zinc-900 dark:text-zinc-100">{project.name}</p>
                            {project.description && (
                              <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate max-w-xs">
                                {project.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                          statusInfo.bgColor,
                          statusInfo.color
                        )}>
                          <span className={cn('w-1.5 h-1.5 rounded-full', statusInfo.dotColor)} />
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-24 h-2 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${progress}%`, backgroundColor: project.color }}
                            />
                          </div>
                          <span className="text-sm text-zinc-600 dark:text-zinc-300">{progress}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {project.target_date ? (
                          <span className={cn(
                            'text-sm',
                            dueStatus?.color || 'text-zinc-500 dark:text-zinc-400'
                          )}>
                            {format(new Date(project.target_date), 'MMM d, yyyy')}
                          </span>
                        ) : (
                          <span className="text-sm text-zinc-400">No due date</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[16px]">check_box</span>
                            {project.task_count}
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[16px]">description</span>
                            {project.note_count}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              openModal(project)
                            }}
                            className="p-2 rounded-lg text-zinc-400 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(project.id)
                            }}
                            className="p-2 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Demo Banner */}
        {isDemo && (
          <div className="fixed bottom-4 right-4 left-4 sm:left-auto px-4 py-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-xl text-amber-800 dark:text-amber-200 text-sm shadow-lg z-50">
            <span className="font-medium">Demo Mode:</span> Changes are not saved. Create an account to save your projects.
          </div>
        )}

        {/* Create/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="sticky top-0 bg-white dark:bg-zinc-800 px-6 py-4 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  {editingProject ? 'Edit Project' : 'New Project'}
                </h2>
                <button
                  onClick={closeModal}
                  className="p-2 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-6">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Project Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter project name..."
                    className="w-full px-4 py-3 border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none placeholder-zinc-400 dark:placeholder-zinc-500"
                    autoFocus
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe your project..."
                    rows={3}
                    className="w-full px-4 py-3 border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none placeholder-zinc-400 dark:placeholder-zinc-500 resize-none"
                  />
                </div>

                {/* Icon */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Icon
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {ICON_OPTIONS.map(icon => (
                      <button
                        key={icon}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, icon }))}
                        className={cn(
                          'p-2.5 rounded-lg transition-all',
                          formData.icon === icon
                            ? 'bg-cyan-100 dark:bg-cyan-900/50 text-cyan-600 dark:text-cyan-400 ring-2 ring-cyan-500'
                            : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600'
                        )}
                      >
                        <span className="material-symbols-outlined text-[20px]">{icon}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Color
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_OPTIONS.map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, color }))}
                        className={cn(
                          'w-8 h-8 rounded-lg transition-transform hover:scale-110',
                          formData.color === color && 'ring-2 ring-offset-2 ring-zinc-400 dark:ring-zinc-500 dark:ring-offset-zinc-800'
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as ProjectStatus }))}
                    className="w-full px-4 py-3 border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="on_hold">On Hold</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                      className="w-full px-4 py-3 border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                      Target Date
                    </label>
                    <input
                      type="date"
                      value={formData.target_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, target_date: e.target.value }))}
                      className="w-full px-4 py-3 border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="sticky bottom-0 bg-white dark:bg-zinc-800 px-6 py-4 border-t border-zinc-200 dark:border-zinc-700 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2.5 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving || !formData.name.trim()}
                  className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl font-medium shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isSaving ? 'Saving...' : editingProject ? 'Save Changes' : 'Create Project'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
