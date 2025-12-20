'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { FolderTreeNode, FileRecord } from '@/lib/files/types'
import { X, FolderInput, ChevronRight, ChevronDown, Folder, FolderOpen, File } from 'lucide-react'

interface MoveToFolderDialogProps {
  isOpen: boolean
  files: FileRecord[]
  folders: FolderTreeNode[]
  currentFolderId: string | null
  onClose: () => void
  onSubmit: (fileIds: string[], folderId: string | null) => Promise<void>
}

export function MoveToFolderDialog({
  isOpen,
  files,
  folders,
  currentFolderId,
  onClose,
  onSubmit,
}: MoveToFolderDialogProps) {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setSelectedFolderId(null)
      setError(null)
      // Expand the path to current folder
      if (currentFolderId) {
        expandPathToFolder(currentFolderId, folders)
      }
    }
  }, [isOpen, currentFolderId, folders])

  const expandPathToFolder = (targetId: string, folderList: FolderTreeNode[]) => {
    const findPath = (nodes: FolderTreeNode[], path: string[] = []): string[] | null => {
      for (const node of nodes) {
        if (node.id === targetId) {
          return path
        }
        if (node.children.length > 0) {
          const found = findPath(node.children, [...path, node.id])
          if (found) return found
        }
      }
      return null
    }

    const path = findPath(folderList)
    if (path) {
      setExpandedFolders(new Set(path))
    }
  }

  const handleSubmit = async () => {
    if (files.length === 0) return

    // Don't move if selecting the same folder
    if (selectedFolderId === currentFolderId) {
      setError('Files are already in this folder')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const fileIds = files.map((f) => f.id)
      await onSubmit(fileIds, selectedFolderId)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to move files')
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
    const isSelected = selectedFolderId === folder.id
    const isCurrent = currentFolderId === folder.id

    return (
      <div key={folder.id}>
        <div
          className={cn(
            'flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer transition-colors',
            isSelected
              ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
              : isCurrent
              ? 'bg-[var(--muted)] text-[var(--muted-foreground)]'
              : 'hover:bg-[var(--muted)]'
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => setSelectedFolderId(folder.id)}
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
          {isExpanded ? (
            <FolderOpen className="h-4 w-4 flex-shrink-0" />
          ) : (
            <Folder className="h-4 w-4 flex-shrink-0" />
          )}
          <span className="text-sm truncate flex-1">{folder.name}</span>
          {isCurrent && (
            <span className="text-xs px-1.5 py-0.5 bg-[var(--muted)] rounded text-[var(--muted-foreground)]">
              Current
            </span>
          )}
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
            <FolderInput className="h-5 w-5 text-[var(--primary)]" />
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Move to Folder
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-[var(--muted)] transition-colors"
          >
            <X className="h-5 w-5 text-[var(--muted-foreground)]" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {/* Files being moved */}
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
              Moving {files.length} {files.length === 1 ? 'file' : 'files'}
            </label>
            <div className="border border-[var(--border)] rounded-lg p-2 max-h-24 overflow-y-auto bg-[var(--muted)]/30">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-2 py-1 text-sm text-[var(--muted-foreground)]"
                >
                  <File className="h-3.5 w-3.5" />
                  <span className="truncate">{file.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Destination folder */}
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
              Destination
            </label>
            <div className="border border-[var(--border)] rounded-lg max-h-64 overflow-y-auto">
              {/* Root option */}
              <div
                className={cn(
                  'flex items-center gap-2 py-1.5 px-3 cursor-pointer transition-colors',
                  selectedFolderId === null
                    ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                    : currentFolderId === null
                    ? 'bg-[var(--muted)] text-[var(--muted-foreground)]'
                    : 'hover:bg-[var(--muted)]'
                )}
                onClick={() => setSelectedFolderId(null)}
              >
                <FolderOpen className="h-4 w-4" />
                <span className="text-sm font-medium flex-1">Root (All Files)</span>
                {currentFolderId === null && (
                  <span className="text-xs px-1.5 py-0.5 bg-[var(--muted)] rounded text-[var(--muted-foreground)]">
                    Current
                  </span>
                )}
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
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || selectedFolderId === currentFolderId}
            className="px-4 py-2 text-sm font-medium bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Moving...' : 'Move Here'}
          </button>
        </div>
      </div>
    </div>
  )
}
