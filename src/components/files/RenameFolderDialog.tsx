'use client'

import { useState, useEffect } from 'react'
import { FolderTreeNode } from '@/lib/files/types'
import { X, Pencil } from 'lucide-react'

interface RenameFolderDialogProps {
  isOpen: boolean
  folder: FolderTreeNode | null
  onClose: () => void
  onSubmit: (folderId: string, newName: string) => Promise<void>
}

export function RenameFolderDialog({
  isOpen,
  folder,
  onClose,
  onSubmit,
}: RenameFolderDialogProps) {
  const [name, setName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && folder) {
      setName(folder.name)
      setError(null)
    }
  }, [isOpen, folder])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!folder) return

    if (!name.trim()) {
      setError('Folder name is required')
      return
    }

    if (name.trim().length > 50) {
      setError('Folder name must be 50 characters or less')
      return
    }

    if (name.trim() === folder.name) {
      onClose()
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await onSubmit(folder.id, name.trim())
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename folder')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen || !folder) return null

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
            <Pencil className="h-5 w-5 text-[var(--primary)]" />
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Rename Folder
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
              {isSubmitting ? 'Renaming...' : 'Rename'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
