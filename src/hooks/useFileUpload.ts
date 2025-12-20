'use client'

import { useState, useCallback } from 'react'
import { uploadFile } from '@/lib/files/fileService'
import {
  FileRecord,
  UploadProgress,
  isFileTypeAllowed,
  MAX_FILE_SIZE,
} from '@/lib/files/types'

interface UseFileUploadOptions {
  folder?: string
  folderId?: string | null
  onSuccess?: (file: FileRecord) => void
  onError?: (error: string, file: File) => void
}

interface UseFileUploadReturn {
  uploads: UploadProgress[]
  isUploading: boolean
  uploadFiles: (files: File[]) => Promise<void>
  removeUpload: (file: File) => void
  clearCompleted: () => void
  clearAll: () => void
}

export function useFileUpload(options: UseFileUploadOptions = {}): UseFileUploadReturn {
  const [uploads, setUploads] = useState<UploadProgress[]>([])

  const isUploading = uploads.some(u => u.status === 'uploading' || u.status === 'pending')

  const validateFile = (file: File): string | null => {
    if (!isFileTypeAllowed(file.type)) {
      return `File type "${file.type}" is not allowed`
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`
    }
    return null
  }

  const uploadFiles = useCallback(async (files: File[]) => {
    // Initialize upload states
    const newUploads: UploadProgress[] = files.map(file => {
      const error = validateFile(file)
      return {
        file,
        progress: 0,
        status: error ? 'error' : 'pending',
        error: error || undefined,
      }
    })

    setUploads(prev => [...prev, ...newUploads])

    // Process valid files
    const validUploads = newUploads.filter(u => u.status === 'pending')

    for (const upload of validUploads) {
      // Update status to uploading
      setUploads(prev =>
        prev.map(u =>
          u.file === upload.file ? { ...u, status: 'uploading', progress: 10 } : u
        )
      )

      try {
        // Simulate progress updates
        const progressInterval = setInterval(() => {
          setUploads(prev =>
            prev.map(u => {
              if (u.file === upload.file && u.status === 'uploading' && u.progress < 90) {
                return { ...u, progress: Math.min(u.progress + 10, 90) }
              }
              return u
            })
          )
        }, 200)

        // Perform upload
        const result = await uploadFile(upload.file, {
          folder: options.folder,
          folderId: options.folderId,
        })

        clearInterval(progressInterval)

        if (result) {
          setUploads(prev =>
            prev.map(u =>
              u.file === upload.file
                ? { ...u, status: 'success', progress: 100, result }
                : u
            )
          )
          options.onSuccess?.(result)
        } else {
          setUploads(prev =>
            prev.map(u =>
              u.file === upload.file
                ? { ...u, status: 'error', error: 'Upload failed' }
                : u
            )
          )
          options.onError?.('Upload failed', upload.file)
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Upload failed'
        setUploads(prev =>
          prev.map(u =>
            u.file === upload.file ? { ...u, status: 'error', error: errorMessage } : u
          )
        )
        options.onError?.(errorMessage, upload.file)
      }
    }
  }, [options])

  const removeUpload = useCallback((file: File) => {
    setUploads(prev => prev.filter(u => u.file !== file))
  }, [])

  const clearCompleted = useCallback(() => {
    setUploads(prev => prev.filter(u => u.status !== 'success'))
  }, [])

  const clearAll = useCallback(() => {
    setUploads([])
  }, [])

  return {
    uploads,
    isUploading,
    uploadFiles,
    removeUpload,
    clearCompleted,
    clearAll,
  }
}
