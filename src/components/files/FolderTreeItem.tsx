'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { FolderTreeNode } from '@/lib/files/types'
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  MoreHorizontal,
  Plus,
  Pencil,
  Trash2,
} from 'lucide-react'

interface FolderTreeItemProps {
  folder: FolderTreeNode
  isSelected: boolean
  isExpanded: boolean
  onSelect: (folderId: string) => void
  onToggleExpand: (folderId: string) => void
  onCreateSubfolder: (parentFolderId: string) => void
  onRename: (folder: FolderTreeNode) => void
  onDelete: (folderId: string) => void
  onFileDrop: (fileIds: string[], folderId: string) => void
  depth?: number
}

export function FolderTreeItem({
  folder,
  isSelected,
  isExpanded,
  onSelect,
  onToggleExpand,
  onCreateSubfolder,
  onRename,
  onDelete,
  onFileDrop,
  depth = 0,
}: FolderTreeItemProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)

  const hasChildren = folder.children.length > 0

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect(folder.id)
  }

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation()
    onToggleExpand(folder.id)
  }

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowMenu(!showMenu)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    try {
      const data = e.dataTransfer.getData('application/json')
      if (data) {
        const parsed = JSON.parse(data)
        if (parsed.type === 'file' || parsed.type === 'files') {
          const fileIds = parsed.type === 'files' ? parsed.ids : [parsed.id]
          onFileDrop(fileIds, folder.id)
        }
      }
    } catch (error) {
      console.error('Error parsing drop data:', error)
    }
  }

  return (
    <div className="select-none">
      {/* Folder Row */}
      <div
        className={cn(
          'group flex items-center gap-1 px-2 py-1.5 rounded-lg cursor-pointer transition-colors',
          isSelected
            ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
            : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]',
          isDragOver && 'ring-2 ring-[var(--primary)] bg-[var(--accent)]'
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Expand/Collapse Button */}
        <button
          onClick={handleToggleExpand}
          className={cn(
            'p-0.5 rounded hover:bg-black/10 transition-colors flex-shrink-0',
            !hasChildren && 'invisible'
          )}
        >
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>

        {/* Folder Icon */}
        {isExpanded ? (
          <FolderOpen className="h-4 w-4 flex-shrink-0" />
        ) : (
          <Folder className="h-4 w-4 flex-shrink-0" />
        )}

        {/* Folder Name */}
        <span className="flex-1 truncate text-sm font-medium">{folder.name}</span>

        {/* File Count Badge */}
        {folder.file_count > 0 && (
          <span
            className={cn(
              'text-xs px-1.5 rounded-full flex-shrink-0',
              isSelected
                ? 'bg-white/20 text-[var(--primary-foreground)]'
                : 'bg-[var(--muted)] text-[var(--muted-foreground)]'
            )}
          >
            {folder.file_count}
          </span>
        )}

        {/* Menu Button */}
        <button
          onClick={handleMenuClick}
          className={cn(
            'p-1 rounded hover:bg-black/10 transition-colors opacity-0 group-hover:opacity-100',
            showMenu && 'opacity-100'
          )}
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Context Menu */}
      {showMenu && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
          <div
            className="absolute right-2 z-20 bg-[var(--popover)] border border-[var(--border)] rounded-lg shadow-lg py-1 min-w-[160px]"
            style={{ marginTop: '-32px' }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowMenu(false)
                onCreateSubfolder(folder.id)
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--muted)] transition-colors"
            >
              <Plus className="h-4 w-4" />
              New Subfolder
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowMenu(false)
                onRename(folder)
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--muted)] transition-colors"
            >
              <Pencil className="h-4 w-4" />
              Rename
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowMenu(false)
                onDelete(folder.id)
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        </>
      )}

      {/* Children (recursive) */}
      {isExpanded && hasChildren && (
        <div>
          {folder.children.map((child) => (
            <FolderTreeItem
              key={child.id}
              folder={child}
              isSelected={isSelected && false} // Need to pass correct isSelected from parent
              isExpanded={false} // Need to pass from parent
              onSelect={onSelect}
              onToggleExpand={onToggleExpand}
              onCreateSubfolder={onCreateSubfolder}
              onRename={onRename}
              onDelete={onDelete}
              onFileDrop={onFileDrop}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}
