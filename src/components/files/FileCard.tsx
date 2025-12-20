'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { FileRecord, getFileCategory, formatFileSize, getFileIcon } from '@/lib/files/types'
import { createSignedUrl } from '@/lib/files/fileService'
import {
  MoreVertical,
  Download,
  Share2,
  Trash2,
  Eye,
  Image as ImageIcon,
  Video,
  Music,
  FileText,
  File,
  FolderInput,
} from 'lucide-react'

interface FileCardProps {
  file: FileRecord
  onPreview?: (file: FileRecord) => void
  onShare?: (file: FileRecord) => void
  onDelete?: (file: FileRecord) => void
  onDownload?: (file: FileRecord) => void
  onMove?: (file: FileRecord) => void
}

export function FileCard({
  file,
  onPreview,
  onShare,
  onDelete,
  onDownload,
  onMove,
}: FileCardProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
  const [showMenu, setShowMenu] = useState(false)
  const category = getFileCategory(file.mime_type)

  useEffect(() => {
    // Load thumbnail for images
    if (category === 'image') {
      createSignedUrl(file.storage_path, 3600).then(url => {
        if (url) setThumbnailUrl(url)
      })
    }
  }, [file.storage_path, category])

  const getCategoryIcon = () => {
    switch (category) {
      case 'image':
        return <ImageIcon className="h-8 w-8" />
      case 'video':
        return <Video className="h-8 w-8" />
      case 'audio':
        return <Music className="h-8 w-8" />
      case 'pdf':
      case 'document':
        return <FileText className="h-8 w-8" />
      default:
        return <File className="h-8 w-8" />
    }
  }

  const handleDownload = async () => {
    setShowMenu(false)
    onDownload?.(file)
  }

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'file',
      id: file.id,
    }))
    e.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div
      className={cn(
        'group relative rounded-lg border border-[var(--border)]',
        'bg-[var(--card)] overflow-hidden',
        'hover:border-[var(--primary)] transition-colors cursor-grab active:cursor-grabbing'
      )}
      draggable
      onDragStart={handleDragStart}
    >
      {/* Thumbnail / Preview Area */}
      <div
        className={cn(
          'relative aspect-square bg-[var(--muted)] cursor-pointer',
          'flex items-center justify-center'
        )}
        onClick={() => onPreview?.(file)}
      >
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={file.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-[var(--muted-foreground)]">
            {getCategoryIcon()}
          </div>
        )}

        {/* Hover Overlay */}
        <div
          className={cn(
            'absolute inset-0 bg-black/50 opacity-0',
            'group-hover:opacity-100 transition-opacity',
            'flex items-center justify-center'
          )}
        >
          <Eye className="h-8 w-8 text-white" />
        </div>
      </div>

      {/* File Info */}
      <div className="p-3">
        <p className="font-medium text-sm truncate text-[var(--foreground)]" title={file.name}>
          {file.name}
        </p>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-[var(--muted-foreground)]">
            {formatFileSize(file.size)}
          </span>

          {/* Actions Menu */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowMenu(!showMenu)
              }}
              className={cn(
                'p-1 rounded hover:bg-[var(--muted)] transition-colors',
                'opacity-0 group-hover:opacity-100'
              )}
            >
              <MoreVertical className="h-4 w-4 text-[var(--muted-foreground)]" />
            </button>

            {/* Dropdown Menu */}
            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div
                  className={cn(
                    'absolute right-0 bottom-full mb-1 z-20',
                    'bg-[var(--popover)] border border-[var(--border)]',
                    'rounded-lg shadow-lg py-1 min-w-[140px]'
                  )}
                >
                  <button
                    onClick={() => {
                      setShowMenu(false)
                      onPreview?.(file)
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--muted)] flex items-center gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    Preview
                  </button>
                  <button
                    onClick={handleDownload}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--muted)] flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </button>
                  <button
                    onClick={() => {
                      setShowMenu(false)
                      onShare?.(file)
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--muted)] flex items-center gap-2"
                  >
                    <Share2 className="h-4 w-4" />
                    Share
                  </button>
                  {onMove && (
                    <button
                      onClick={() => {
                        setShowMenu(false)
                        onMove(file)
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--muted)] flex items-center gap-2"
                    >
                      <FolderInput className="h-4 w-4" />
                      Move to Folder
                    </button>
                  )}
                  <hr className="my-1 border-[var(--border)]" />
                  <button
                    onClick={() => {
                      setShowMenu(false)
                      onDelete?.(file)
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--muted)] flex items-center gap-2 text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
