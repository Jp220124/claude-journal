'use client'

import { useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import type { TaskImage } from '@/lib/tasks/taskImageUpload'

interface TaskImagePreviewModalProps {
  image: TaskImage
  isOpen: boolean
  onClose: () => void
}

export function TaskImagePreviewModal({
  image,
  isOpen,
  onClose,
}: TaskImagePreviewModalProps) {
  // Handle escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }, [onClose])

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, handleKeyDown])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
        title="Close (Esc)"
      >
        <span className="material-symbols-outlined text-[28px]">close</span>
      </button>

      {/* Image container */}
      <div
        className="relative max-w-[90vw] max-h-[85vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={image.url}
          alt={image.file_name}
          className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
        />

        {/* Image info bar */}
        <div className="absolute bottom-0 left-0 right-0 px-4 py-3 bg-gradient-to-t from-black/70 to-transparent rounded-b-lg">
          <div className="flex items-center justify-between text-white">
            <span className="text-sm font-medium truncate max-w-[70%]">
              {image.file_name}
            </span>
            <div className="flex items-center gap-3 text-xs text-white/70">
              {image.width && image.height && (
                <span>{image.width} × {image.height}</span>
              )}
              {image.file_size && (
                <span>{formatFileSize(image.file_size)}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/50 text-white/70 text-xs rounded-full">
        Press <kbd className="px-1.5 py-0.5 bg-white/20 rounded mx-1">Esc</kbd> or click outside to close
      </div>
    </div>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
