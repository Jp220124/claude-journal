'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { FileRecord, getFileCategory, formatFileSize } from '@/lib/files/types'
import { createSignedUrl, getDownloadUrl, incrementDownloadCount } from '@/lib/files/fileService'
import { X, Download, Share2, ExternalLink, Loader2 } from 'lucide-react'

interface FilePreviewModalProps {
  file: FileRecord | null
  isOpen: boolean
  onClose: () => void
  onShare?: (file: FileRecord) => void
}

export function FilePreviewModal({
  file,
  isOpen,
  onClose,
  onShare,
}: FilePreviewModalProps) {
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (file && isOpen) {
      setLoading(true)
      setError(null)
      createSignedUrl(file.storage_path, 3600)
        .then(url => {
          setFileUrl(url)
          setLoading(false)
        })
        .catch(() => {
          setError('Failed to load file')
          setLoading(false)
        })
    }
  }, [file, isOpen])

  const handleDownload = async () => {
    if (!file) return

    const url = await getDownloadUrl(file.id)
    if (url) {
      // Increment download count
      await incrementDownloadCount(file.id)

      // Trigger download
      const a = document.createElement('a')
      a.href = url
      a.download = file.original_name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen || !file) return null

  const category = getFileCategory(file.mime_type)

  const renderPreview = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--muted-foreground)]" />
        </div>
      )
    }

    if (error || !fileUrl) {
      return (
        <div className="flex items-center justify-center h-full text-[var(--muted-foreground)]">
          <p>{error || 'Unable to preview file'}</p>
        </div>
      )
    }

    switch (category) {
      case 'image':
        return (
          <img
            src={fileUrl}
            alt={file.name}
            className="max-w-full max-h-full object-contain"
          />
        )

      case 'video':
        return (
          <video
            src={fileUrl}
            controls
            autoPlay
            className="max-w-full max-h-full"
          >
            Your browser does not support the video tag.
          </video>
        )

      case 'audio':
        return (
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="w-24 h-24 rounded-full bg-[var(--muted)] flex items-center justify-center">
              <svg className="w-12 h-12 text-[var(--muted-foreground)]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
              </svg>
            </div>
            <audio src={fileUrl} controls autoPlay className="w-full max-w-md">
              Your browser does not support the audio tag.
            </audio>
          </div>
        )

      case 'pdf':
        return (
          <iframe
            src={fileUrl}
            className="w-full h-full border-0"
            title={file.name}
          />
        )

      case 'document':
        // For text/markdown files, we could fetch and render
        // For now, show a download prompt
        return (
          <div className="flex flex-col items-center justify-center gap-4 text-[var(--muted-foreground)]">
            <p>Preview not available for this file type</p>
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg hover:opacity-90 transition-opacity"
            >
              <Download className="h-4 w-4" />
              Download to view
            </button>
          </div>
        )

      default:
        return (
          <div className="flex flex-col items-center justify-center gap-4 text-[var(--muted-foreground)]">
            <p>Preview not available for this file type</p>
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg hover:opacity-90 transition-opacity"
            >
              <Download className="h-4 w-4" />
              Download to view
            </button>
          </div>
        )
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative z-10 w-full h-full max-w-6xl max-h-[90vh] m-4 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-[var(--card)] rounded-t-lg border-b border-[var(--border)]">
          <div className="flex-1 min-w-0 mr-4">
            <h3 className="font-medium truncate text-[var(--foreground)]">
              {file.name}
            </h3>
            <p className="text-sm text-[var(--muted-foreground)]">
              {formatFileSize(file.size)} - {file.mime_type}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="p-2 hover:bg-[var(--muted)] rounded-lg transition-colors"
              title="Download"
            >
              <Download className="h-5 w-5 text-[var(--foreground)]" />
            </button>
            <button
              onClick={() => onShare?.(file)}
              className="p-2 hover:bg-[var(--muted)] rounded-lg transition-colors"
              title="Share"
            >
              <Share2 className="h-5 w-5 text-[var(--foreground)]" />
            </button>
            {fileUrl && (
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 hover:bg-[var(--muted)] rounded-lg transition-colors"
                title="Open in new tab"
              >
                <ExternalLink className="h-5 w-5 text-[var(--foreground)]" />
              </a>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-[var(--muted)] rounded-lg transition-colors ml-2"
              title="Close"
            >
              <X className="h-5 w-5 text-[var(--foreground)]" />
            </button>
          </div>
        </div>

        {/* Preview Area */}
        <div className="flex-1 bg-[var(--background)] flex items-center justify-center overflow-auto p-4 rounded-b-lg">
          {renderPreview()}
        </div>
      </div>
    </div>
  )
}
