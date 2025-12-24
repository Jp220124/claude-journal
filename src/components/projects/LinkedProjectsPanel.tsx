'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  getProjectsForTask,
  unlinkTaskFromProject,
  linkTaskToProject,
  fetchProjects,
} from '@/lib/projectService'
import type { Project, ProjectWithCounts } from '@/types/projects'

interface LinkedProjectsPanelProps {
  taskId: string
  isDemo?: boolean
  className?: string
}

// Demo projects for non-authenticated users
const demoLinkedProjects: Project[] = [
  {
    id: 'demo-project-1',
    user_id: 'demo',
    name: 'Website Redesign',
    description: 'Complete overhaul of the company website',
    status: 'active',
    color: '#22c55e',
    icon: 'rocket_launch',
    start_date: new Date().toISOString(),
    target_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
]

export function LinkedProjectsPanel({
  taskId,
  isDemo = false,
  className,
}: LinkedProjectsPanelProps) {
  const router = useRouter()
  const [linkedProjects, setLinkedProjects] = useState<Project[]>([])
  const [allProjects, setAllProjects] = useState<ProjectWithCounts[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isExpanded, setIsExpanded] = useState(true)
  const [showPicker, setShowPicker] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Load linked projects
  useEffect(() => {
    const loadLinkedProjects = async () => {
      if (isDemo) {
        setLinkedProjects(demoLinkedProjects)
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      try {
        const projects = await getProjectsForTask(taskId)
        setLinkedProjects(projects)
      } catch (error) {
        console.error('Error loading linked projects:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadLinkedProjects()
  }, [taskId, isDemo])

  // Load all projects for picker
  const loadAllProjects = useCallback(async () => {
    if (isDemo) return

    try {
      const projects = await fetchProjects()
      setAllProjects(projects)
    } catch (error) {
      console.error('Error loading projects:', error)
    }
  }, [isDemo])

  const handleUnlink = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation()

    if (isDemo) {
      setLinkedProjects(prev => prev.filter(p => p.id !== projectId))
      return
    }

    try {
      const success = await unlinkTaskFromProject(projectId, taskId)
      if (success) {
        setLinkedProjects(prev => prev.filter(p => p.id !== projectId))
      }
    } catch (error) {
      console.error('Error unlinking project:', error)
    }
  }

  const handleLinkProject = async (projectId: string) => {
    if (isDemo) {
      const project = allProjects.find(p => p.id === projectId)
      if (project) {
        setLinkedProjects(prev => [...prev, project])
      }
      setShowPicker(false)
      return
    }

    try {
      const result = await linkTaskToProject(projectId, taskId)
      if (result) {
        const project = allProjects.find(p => p.id === projectId)
        if (project) {
          setLinkedProjects(prev => [...prev, project])
        }
      }
      setShowPicker(false)
    } catch (error) {
      console.error('Error linking project:', error)
    }
  }

  const handleOpenPicker = () => {
    setShowPicker(true)
    loadAllProjects()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      case 'on_hold':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
      case 'completed':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
      case 'archived':
        return 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
      default:
        return 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
    }
  }

  // Filter projects for picker (exclude already linked)
  const linkedIds = new Set(linkedProjects.map(p => p.id))
  const availableProjects = allProjects.filter(
    p => !linkedIds.has(p.id) && p.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className={cn('mt-3', className)}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left group"
      >
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-zinc-400 dark:text-zinc-500 text-[16px]">
            rocket_launch
          </span>
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Linked Projects
          </span>
          {linkedProjects.length > 0 && (
            <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-1.5 py-0.5 rounded-full">
              {linkedProjects.length}
            </span>
          )}
        </div>
        <span
          className={cn(
            'material-symbols-outlined text-zinc-400 dark:text-zinc-500 text-[16px] transition-transform',
            isExpanded ? 'rotate-180' : ''
          )}
        >
          expand_more
        </span>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="mt-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-3">
              <div className="w-4 h-4 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <>
              {linkedProjects.length === 0 ? (
                <p className="text-xs text-zinc-400 dark:text-zinc-500 py-2">No linked projects</p>
              ) : (
                <div className="space-y-2">
                  {linkedProjects.map(project => (
                    <div
                      key={project.id}
                      onClick={() => router.push(`/projects/${project.id}`)}
                      className="flex items-start gap-2 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 group/project transition-colors"
                    >
                      {/* Project icon */}
                      <div
                        className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: project.color || '#6366f1' }}
                      >
                        <span className="material-symbols-outlined text-white text-[14px]">
                          {project.icon || 'folder'}
                        </span>
                      </div>

                      {/* Project info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 truncate">
                            {project.name}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span
                            className={cn(
                              'text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize',
                              getStatusColor(project.status)
                            )}
                          >
                            {project.status.replace('_', ' ')}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover/project:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => handleUnlink(project.id, e)}
                          className="p-1 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                          title="Unlink project"
                        >
                          <span className="material-symbols-outlined text-[14px]">link_off</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add project button */}
              <button
                onClick={handleOpenPicker}
                className="w-full mt-2 py-2 text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 border border-dashed border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors flex items-center justify-center gap-1"
              >
                <span className="material-symbols-outlined text-[14px]">add</span>
                Link to Project
              </button>
            </>
          )}
        </div>
      )}

      {/* Project Picker Modal */}
      {showPicker && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowPicker(false)}
        >
          <div
            className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[80vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Link to Project
              </h3>
              <button
                onClick={() => setShowPicker(false)}
                className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Search */}
            <div className="relative mb-4">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-zinc-400 text-[18px]">
                search
              </span>
              <input
                type="text"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
              />
            </div>

            {/* Projects list */}
            <div className="flex-1 overflow-y-auto space-y-2">
              {availableProjects.length === 0 ? (
                <p className="text-sm text-zinc-400 dark:text-zinc-500 text-center py-8">
                  {searchQuery ? 'No projects found' : 'All projects are already linked'}
                </p>
              ) : (
                availableProjects.map(project => (
                  <button
                    key={project.id}
                    onClick={() => handleLinkProject(project.id)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left"
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: project.color || '#6366f1' }}
                    >
                      <span className="material-symbols-outlined text-white text-[16px]">
                        {project.icon || 'folder'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                        {project.name}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 capitalize">
                        {project.status.replace('_', ' ')} • {project.task_count || 0} tasks
                      </p>
                    </div>
                    <span className="material-symbols-outlined text-zinc-300 dark:text-zinc-600 text-[20px]">
                      add_circle
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
