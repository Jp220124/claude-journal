'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import {
  getProjectCollaborators,
  updateCollaboratorRole,
  removeCollaborator,
  leaveProject,
} from '@/lib/projectSharingService'
import type { Collaborator } from '@/types/sharing'
import type { ProjectMemberRole } from '@/types/projects'
import { MEMBER_ROLE_INFO } from '@/types/projects'

interface CollaboratorsListProps {
  projectId: string
  onCollaboratorRemoved?: () => void
  className?: string
}

export function CollaboratorsList({
  projectId,
  onCollaboratorRemoved,
  className,
}: CollaboratorsListProps) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    loadCollaborators()
  }, [projectId])

  const loadCollaborators = async () => {
    setIsLoading(true)
    try {
      const data = await getProjectCollaborators(projectId)
      setCollaborators(data)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRoleChange = async (memberId: string, newRole: ProjectMemberRole) => {
    if (await updateCollaboratorRole(memberId, newRole)) {
      await loadCollaborators()
    }
    setEditingId(null)
  }

  const handleRemove = async (memberId: string, email?: string) => {
    const confirmed = confirm(
      `Are you sure you want to remove ${email || 'this collaborator'} from the project?`
    )
    if (confirmed) {
      if (await removeCollaborator(memberId)) {
        await loadCollaborators()
        onCollaboratorRemoved?.()
      }
    }
  }

  const handleLeave = async () => {
    const confirmed = confirm(
      'Are you sure you want to leave this project? You will lose access to all project content.'
    )
    if (confirmed) {
      if (await leaveProject(projectId)) {
        // Redirect or notify parent
        window.location.href = '/projects'
      }
    }
  }

  const getRoleBadgeColor = (role: ProjectMemberRole) => {
    switch (role) {
      case 'owner':
        return 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
      case 'admin':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
      case 'member':
        return 'bg-green-500/10 text-green-600 dark:text-green-400'
      case 'viewer':
        return 'bg-gray-500/10 text-gray-600 dark:text-gray-400'
      default:
        return 'bg-gray-500/10 text-gray-500'
    }
  }

  const getInitials = (email?: string, name?: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    }
    if (email) {
      return email.slice(0, 2).toUpperCase()
    }
    return '?'
  }

  if (isLoading) {
    return (
      <div className={cn('animate-pulse space-y-3', className)}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 p-3 bg-[var(--muted)] rounded-lg">
            <div className="w-10 h-10 rounded-full bg-[var(--border)]" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 bg-[var(--border)] rounded" />
              <div className="h-3 w-24 bg-[var(--border)] rounded" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[var(--foreground)]">
          Collaborators ({collaborators.length})
        </h3>
      </div>

      {/* Collaborator List */}
      <div className="space-y-2">
        {collaborators.map((collab) => (
          <div
            key={collab.id}
            className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border)] hover:bg-[var(--muted)]/50 transition-colors"
          >
            {/* Avatar */}
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium text-white"
              style={{
                background: `linear-gradient(135deg, ${getAvatarColor(collab.user_id)})`,
              }}
            >
              {collab.user?.avatar_url ? (
                <img
                  src={collab.user.avatar_url}
                  alt=""
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                getInitials(collab.user?.email, collab.user?.full_name)
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-[var(--foreground)] truncate">
                  {collab.user?.full_name || collab.user?.email || 'Unknown User'}
                </span>
                {collab.is_current_user && (
                  <span className="text-xs text-[var(--muted-foreground)]">(you)</span>
                )}
              </div>
              <div className="text-xs text-[var(--muted-foreground)] truncate">
                {collab.user?.email}
              </div>
            </div>

            {/* Role Badge / Selector */}
            {editingId === collab.id && collab.role !== 'owner' ? (
              <select
                value={collab.role}
                onChange={(e) => handleRoleChange(collab.id, e.target.value as ProjectMemberRole)}
                onBlur={() => setEditingId(null)}
                autoFocus
                className="px-2 py-1 text-xs bg-[var(--background)] border border-[var(--border)] rounded"
              >
                <option value="admin">Admin</option>
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
              </select>
            ) : (
              <button
                onClick={() => collab.can_remove && collab.role !== 'owner' && setEditingId(collab.id)}
                className={cn(
                  'px-2 py-1 text-xs font-medium rounded',
                  getRoleBadgeColor(collab.role),
                  collab.can_remove && collab.role !== 'owner' && 'cursor-pointer hover:opacity-80'
                )}
                title={collab.can_remove && collab.role !== 'owner' ? 'Click to change role' : undefined}
              >
                {MEMBER_ROLE_INFO[collab.role].label}
              </button>
            )}

            {/* Actions */}
            {collab.is_current_user && collab.role !== 'owner' ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleLeave}
                className="text-red-500 hover:text-red-600"
                title="Leave project"
              >
                <span className="material-icons text-sm">logout</span>
              </Button>
            ) : collab.can_remove ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleRemove(collab.id, collab.user?.email)}
                className="text-red-500 hover:text-red-600"
                title="Remove collaborator"
              >
                <span className="material-icons text-sm">person_remove</span>
              </Button>
            ) : null}
          </div>
        ))}
      </div>

      {/* Empty State */}
      {collaborators.length === 1 && (
        <div className="text-center py-4 text-sm text-[var(--muted-foreground)]">
          <p>No other collaborators yet.</p>
          <p>Share your project link to invite others!</p>
        </div>
      )}
    </div>
  )
}

// Helper function to generate consistent avatar colors
function getAvatarColor(userId: string): string {
  const colors = [
    '#6366f1, #8b5cf6', // indigo to violet
    '#3b82f6, #06b6d4', // blue to cyan
    '#10b981, #22c55e', // emerald to green
    '#f59e0b, #ef4444', // amber to red
    '#ec4899, #8b5cf6', // pink to violet
    '#14b8a6, #3b82f6', // teal to blue
  ]

  // Generate a consistent index from the user ID
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i)
    hash = hash & hash
  }

  return colors[Math.abs(hash) % colors.length]
}
