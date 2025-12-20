'use client'

import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { cn } from '@/lib/utils'
import { ALL_ALLOWED_TYPES, formatFileSize, getFileCategory } from '@/lib/files/types'
import { UploadProgress } from '@/lib/files/types'
import {
  Upload,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  File as FileIcon,
  Image as ImageIcon,
  Video,
  Music,
  FileText,
  FileCode,
} from 'lucide-react'

interface FileUploaderProps {
  onFilesSelected: (files: File[]) => void
  uploads?: UploadProgress[]
  onRemoveUpload?: (file: File) => void
  disabled?: boolean
  maxFiles?: number
  className?: string
}

export function FileUploader({
  onFilesSelected,
  uploads = [],
  onRemoveUpload,
  disabled = false,
  maxFiles = 10,
  className,
}: FileUploaderProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (!disabled && acceptedFiles.length > 0) {
        onFilesSelected(acceptedFiles)
      }
    },
    [onFilesSelected, disabled]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ALL_ALLOWED_TYPES.reduce((acc, type) => {
      acc[type] = []
      return acc
    }, {} as Record<string, string[]>),
    maxFiles,
    disabled,
  })

  const getStatusIcon = (status: UploadProgress['status']) => {
    switch (status) {
      case 'pending':
        return <Loader2 className="h-4 w-4 animate-spin text-[var(--muted-foreground)]" />
      case 'uploading':
        return <Loader2 className="h-4 w-4 animate-spin text-[var(--primary)]" />
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
    }
  }

  const getFileIconComponent = (mimeType: string) => {
    const category = getFileCategory(mimeType)
    switch (category) {
      case 'image':
        return <ImageIcon className="h-5 w-5 text-[var(--muted-foreground)]" />
      case 'video':
        return <Video className="h-5 w-5 text-[var(--muted-foreground)]" />
      case 'audio':
        return <Music className="h-5 w-5 text-[var(--muted-foreground)]" />
      case 'pdf':
        return <FileText className="h-5 w-5 text-[var(--muted-foreground)]" />
      case 'document':
        return <FileCode className="h-5 w-5 text-[var(--muted-foreground)]" />
      default:
        return <FileIcon className="h-5 w-5 text-[var(--muted-foreground)]" />
    }
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Drop Zone */}
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          'hover:border-[var(--primary)] hover:bg-[var(--accent)]/50',
          isDragActive && 'border-[var(--primary)] bg-[var(--accent)]',
          disabled && 'opacity-50 cursor-not-allowed hover:border-[var(--border)] hover:bg-transparent',
          'border-[var(--border)]'
        )}
      >
        <input {...getInputProps()} />
        <Upload className="h-10 w-10 mx-auto mb-4 text-[var(--muted-foreground)]" />
        {isDragActive ? (
          <p className="text-[var(--foreground)]">Drop the files here...</p>
        ) : (
          <>
            <p className="text-[var(--foreground)] font-medium mb-1">
              Drag & drop files here, or click to select
            </p>
            <p className="text-sm text-[var(--muted-foreground)]">
              Images, PDFs, videos, audio, and documents up to 50MB
            </p>
          </>
        )}
      </div>

      {/* Upload Progress List */}
      {uploads.length > 0 && (
        <div className="space-y-2">
          {uploads.map((upload, index) => (
            <div
              key={`${upload.file.name}-${index}`}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg',
                'bg-[var(--card)] border border-[var(--border)]'
              )}
            >
              {/* File Icon */}
              {getFileIconComponent(upload.file.type)}

              {/* File Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-[var(--foreground)]">
                  {upload.file.name}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--muted-foreground)]">
                    {formatFileSize(upload.file.size)}
                  </span>
                  {upload.status === 'uploading' && (
                    <span className="text-xs text-[var(--primary)]">
                      {upload.progress}%
                    </span>
                  )}
                  {upload.error && (
                    <span className="text-xs text-red-500">{upload.error}</span>
                  )}
                </div>

                {/* Progress Bar */}
                {upload.status === 'uploading' && (
                  <div className="mt-1 h-1 bg-[var(--muted)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--primary)] transition-all duration-300"
                      style={{ width: `${upload.progress}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Status Icon */}
              <div className="flex items-center gap-2">
                {getStatusIcon(upload.status)}

                {/* Remove Button */}
                {(upload.status === 'success' || upload.status === 'error') && onRemoveUpload && (
                  <button
                    onClick={() => onRemoveUpload(upload.file)}
                    className="p-1 hover:bg-[var(--muted)] rounded transition-colors"
                  >
                    <X className="h-4 w-4 text-[var(--muted-foreground)]" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
