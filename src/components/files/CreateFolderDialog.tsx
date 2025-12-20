'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { FolderTreeNode } from '@/lib/files/types'
import { X, FolderPlus, ChevronRight, ChevronDown, Folder } from 'lucide-react'

interface CreateFolderDialogProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (name: string, parentFolderId: string | null) => Promise<void>
  folders: FolderTreeNode[]
  initialParentId?: string | null
}

export function CreateFolderDialog({
  isOpen,
  onClose,
  onSubmit,
  folders,
  initialParentId = null,
}: CreateFolderDialogProps) {
  const [name, setName] = useState('')
  const [parentFolderId, setParentFolderId] = useState<string | null>(initialParentId)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setName('')
      setParentFolderId(initialParentId)
      setError(null)
    }
  }, [isOpen, initialParentId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      setError('Folder name is required')
      return
    }

    if (name.trim().length > 50) {
      setError('Folder name must be 50 characters or less')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await onSubmit(name.trim(), parentFolderId)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create folder')
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleExpand = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(folderId)) {
        next.delete(folderId)
      } else {
        next.add(folderId)
      }
      return next
    })
  }

  const renderFolderOption = (folder: FolderTreeNode, depth: number = 0) => {
    const isExpanded = expandedFolders.has(folder.id)
    const hasChildren = folder.children.length > 0
    const isSelected = parentFolderId === folder.id

    return (
      <div key={folder.id}>
        <div
          className={cn(
            'flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer transition-colors',
            isSelected
              ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
              : 'hover:bg-[var(--muted)]'
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => setParentFolderId(folder.id)}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                toggleExpand(folder.id)
              }}
              className="p-0.5 rounded hover:bg-black/10"
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
          ) : (
            <span className="w-4" />
          )}
          <Folder className="h-4 w-4 flex-shrink-0" />
          <span className="text-sm truncate">{folder.name}</span>
        </div>
        {isExpanded && hasChildren && (
          <div>
            {folder.children.map((child) => renderFolderOption(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <FolderPlus className="h-5 w-5 text-[var(--primary)]" />
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Create New Folder
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-[var(--muted)] transition-colors"
          >
            <X className="h-5 w-5 text-[var(--muted-foreground)]" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-4">
            {/* Folder Name */}
            <div>
              <label
                htmlFor="folder-name"
                className="block text-sm font-medium text-[var(--foreground)] mb-1.5"
              >
                Folder Name
              </label>
              <input
                id="folder-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter folder name"
                autoFocus
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
              />
            </div>

            {/* Parent Folder Selection */}
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                Location
              </label>
              <div className="border border-[var(--border)] rounded-lg max-h-48 overflow-y-auto">
                {/* Root option */}
                <div
                  className={cn(
                    'flex items-center gap-2 py-1.5 px-3 cursor-pointer transition-colors',
                    parentFolderId === null
                      ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                      : 'hover:bg-[var(--muted)]'
                  )}
                  onClick={() => setParentFolderId(null)}
                >
                  <Folder className="h-4 w-4" />
                  <span className="text-sm font-medium">Root (All Files)</span>
                </div>

                {/* Folder tree */}
                {folders.length > 0 && (
                  <div className="border-t border-[var(--border)]">
                    {folders.map((folder) => renderFolderOption(folder))}
                  </div>
                )}
              </div>
            </div>

            {/* Error */}
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--muted)] rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-4 py-2 text-sm font-medium bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating...' : 'Create Folder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
