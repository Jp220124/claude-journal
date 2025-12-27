'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { uploadTaskImage, deleteTaskImage, type TaskImage } from '@/lib/tasks/taskImageUpload'

interface TaskImageUploadProps {
  taskId: string
  existingImage?: TaskImage | null
  onImageChange?: (image: TaskImage | null) => void
  disabled?: boolean
}

export function TaskImageUpload({
  taskId,
  existingImage,
  onImageChange,
  disabled = false,
}: TaskImageUploadProps) {
  const [image, setImage] = useState<TaskImage | null>(existingImage || null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback(async (file: File) => {
    if (disabled) return

    setError(null)
    setIsUploading(true)
    setUploadProgress(0)

    const result = await uploadTaskImage(file, taskId, (progress) => {
      setUploadProgress(progress)
    })

    setIsUploading(false)

    if (result.success && result.taskImage) {
      setImage(result.taskImage)
      onImageChange?.(result.taskImage)
    } else {
      setError(result.error || 'Upload failed')
    }
  }, [taskId, disabled, onImageChange])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
    // Reset input so same file can be selected again
    e.target.value = ''
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) {
      handleFileSelect(file)
    }
  }, [handleFileSelect])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) {
          handleFileSelect(file)
          break
        }
      }
    }
  }, [handleFileSelect])

  // Listen for paste events
  useEffect(() => {
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [handlePaste])

  // Sync with existingImage prop when it changes
  useEffect(() => {
    setImage(existingImage || null)
  }, [existingImage])

  const handleRemoveImage = async () => {
    if (disabled || !image) return

    const success = await deleteTaskImage(taskId)
    if (success) {
      setImage(null)
      onImageChange?.(null)
    } else {
      setError('Failed to remove image')
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
        Photo
      </label>

      {image ? (
        // Show uploaded image
        <div className="relative group">
          <img
            src={image.url}
            alt="Task attachment"
            className="w-full h-40 object-cover rounded-xl border border-zinc-200 dark:border-zinc-700"
          />
          {!disabled && (
            <button
              onClick={handleRemoveImage}
              className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
              title="Remove image"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}
          <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/50 text-white text-xs rounded-lg">
            {image.file_name}
          </div>
        </div>
      ) : isUploading ? (
        // Upload progress
        <div className="w-full h-32 flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl">
          <div className="w-8 h-8 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin mb-2" />
          <span className="text-sm text-zinc-600 dark:text-zinc-400">Uploading... {uploadProgress}%</span>
          <div className="w-32 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full mt-2 overflow-hidden">
            <div
              className="h-full bg-cyan-500 transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      ) : (
        // Upload area
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => !disabled && fileInputRef.current?.click()}
          className={cn(
            "w-full h-32 flex flex-col items-center justify-center border-2 border-dashed rounded-xl transition-colors cursor-pointer",
            isDragging
              ? "border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20"
              : "border-zinc-200 dark:border-zinc-700 hover:border-cyan-400 hover:bg-zinc-50 dark:hover:bg-zinc-800",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <span className="material-symbols-outlined text-3xl text-zinc-400 dark:text-zinc-500 mb-1">
            add_photo_alternate
          </span>
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            {isDragging ? 'Drop image here' : 'Click or drag to upload'}
          </span>
          <span className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
            or paste from clipboard
          </span>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled}
      />

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <span className="material-symbols-outlined text-[16px]">error</span>
          {error}
        </div>
      )}
    </div>
  )
}
