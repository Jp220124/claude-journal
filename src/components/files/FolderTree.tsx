'use client'

import { cn } from '@/lib/utils'
import { FolderTreeNode } from '@/lib/files/types'
import { FolderOpen, Plus } from 'lucide-react'

interface FolderTreeProps {
  folders: FolderTreeNode[]
  selectedFolderId: string | null
  expandedFolderIds: Set<string>
  rootFileCount: number
  onFolderSelect: (folderId: string | null) => void
  onFolderExpand: (folderId: string) => void
  onFolderCollapse: (folderId: string) => void
  onCreateFolder: (parentFolderId: string | null) => void
  onRenameFolder: (folder: FolderTreeNode) => void
  onDeleteFolder: (folderId: string) => void
  onFileDrop: (fileIds: string[], folderId: string | null) => void
  isDemo?: boolean
}

export function FolderTree({
  folders,
  selectedFolderId,
  expandedFolderIds,
  rootFileCount,
  onFolderSelect,
  onFolderExpand,
  onFolderCollapse,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onFileDrop,
  isDemo = false,
}: FolderTreeProps) {
  const handleToggleExpand = (folderId: string) => {
    if (expandedFolderIds.has(folderId)) {
      onFolderCollapse(folderId)
    } else {
      onFolderExpand(folderId)
    }
  }

  const handleRootDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    try {
      const data = e.dataTransfer.getData('application/json')
      if (data) {
        const parsed = JSON.parse(data)
        if (parsed.type === 'file' || parsed.type === 'files') {
          const fileIds = parsed.type === 'files' ? parsed.ids : [parsed.id]
          onFileDrop(fileIds, null)
        }
      }
    } catch (error) {
      console.error('Error parsing drop data:', error)
    }
  }

  const renderFolderItem = (folder: FolderTreeNode, depth: number = 0) => {
    const isSelected = selectedFolderId === folder.id
    const isExpanded = expandedFolderIds.has(folder.id)
    const hasChildren = folder.children.length > 0

    return (
      <div key={folder.id} className="select-none">
        <FolderRow
          folder={folder}
          isSelected={isSelected}
          isExpanded={isExpanded}
          hasChildren={hasChildren}
          depth={depth}
          onSelect={() => onFolderSelect(folder.id)}
          onToggleExpand={() => handleToggleExpand(folder.id)}
          onCreateSubfolder={() => onCreateFolder(folder.id)}
          onRename={() => onRenameFolder(folder)}
          onDelete={() => onDeleteFolder(folder.id)}
          onFileDrop={(fileIds) => onFileDrop(fileIds, folder.id)}
          isDemo={isDemo}
        />

        {/* Children */}
        {isExpanded && hasChildren && (
          <div>
            {folder.children.map((child) => renderFolderItem(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      {/* All Files (Root) */}
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors',
          selectedFolderId === null
            ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
            : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]'
        )}
        onClick={() => onFolderSelect(null)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleRootDrop}
      >
        <FolderOpen className="h-4 w-4 flex-shrink-0" />
        <span className="flex-1 text-sm font-medium">All Files</span>
        {rootFileCount > 0 && (
          <span
            className={cn(
              'text-xs px-1.5 rounded-full',
              selectedFolderId === null
                ? 'bg-white/20 text-[var(--primary-foreground)]'
                : 'bg-[var(--muted)] text-[var(--muted-foreground)]'
            )}
          >
            {rootFileCount}
          </span>
        )}
      </div>

      {/* Folder List */}
      {folders.length > 0 ? (
        <div className="mt-1">
          {folders.map((folder) => renderFolderItem(folder))}
        </div>
      ) : (
        <div className="px-3 py-4 text-center text-sm text-[var(--muted-foreground)]">
          <p>No folders yet</p>
          {!isDemo && (
            <button
              onClick={() => onCreateFolder(null)}
              className="mt-2 text-[var(--primary)] hover:underline"
            >
              Create your first folder
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// Internal component for folder row
interface FolderRowProps {
  folder: FolderTreeNode
  isSelected: boolean
  isExpanded: boolean
  hasChildren: boolean
  depth: number
  onSelect: () => void
  onToggleExpand: () => void
  onCreateSubfolder: () => void
  onRename: () => void
  onDelete: () => void
  onFileDrop: (fileIds: string[]) => void
  isDemo: boolean
}

import { useState } from 'react'
import {
  ChevronRight,
  ChevronDown,
  Folder,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react'

function FolderRow({
  folder,
  isSelected,
  isExpanded,
  hasChildren,
  depth,
  onSelect,
  onToggleExpand,
  onCreateSubfolder,
  onRename,
  onDelete,
  onFileDrop,
  isDemo,
}: FolderRowProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)

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
          onFileDrop(fileIds)
        }
      }
    } catch (error) {
      console.error('Error parsing drop data:', error)
    }
  }

  return (
    <div className="relative">
      <div
        className={cn(
          'group flex items-center gap-1 py-1.5 rounded-lg cursor-pointer transition-colors',
          isSelected
            ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
            : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]',
          isDragOver && 'ring-2 ring-[var(--primary)] bg-[var(--accent)]'
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px`, paddingRight: '8px' }}
        onClick={onSelect}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Expand/Collapse Button */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleExpand()
          }}
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
        {!isDemo && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowMenu(!showMenu)
            }}
            className={cn(
              'p-1 rounded hover:bg-black/10 transition-colors opacity-0 group-hover:opacity-100',
              showMenu && 'opacity-100'
            )}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Context Menu */}
      {showMenu && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
          <div className="absolute right-2 top-full mt-1 z-20 bg-[var(--popover)] border border-[var(--border)] rounded-lg shadow-lg py-1 min-w-[160px]">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowMenu(false)
                onCreateSubfolder()
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--muted)] transition-colors text-[var(--foreground)]"
            >
              <Plus className="h-4 w-4" />
              New Subfolder
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowMenu(false)
                onRename()
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--muted)] transition-colors text-[var(--foreground)]"
            >
              <Pencil className="h-4 w-4" />
              Rename
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowMenu(false)
                onDelete()
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  )
}
