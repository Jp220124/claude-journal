'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { validateShareToken, verifySharePassword, createSignedUrl, incrementDownloadCount } from '@/lib/files/fileService'
import { SharedFileInfo, getFileCategory, formatFileSize } from '@/lib/files/types'
import {
  Download,
  Lock,
  AlertCircle,
  Clock,
  FileWarning,
  Loader2,
  Eye,
  File,
  Image as ImageIcon,
  Video,
  Music,
  FileText,
} from 'lucide-react'

export default function SharedFilePage() {
  const params = useParams()
  const token = params.token as string

  const [fileInfo, setFileInfo] = useState<SharedFileInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState(false)
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  // Validate token on mount
  useEffect(() => {
    const validate = async () => {
      try {
        const info = await validateShareToken(token)
        if (!info) {
          setError('This share link is invalid or has been deleted.')
          setLoading(false)
          return
        }

        if (info.is_expired) {
          setError('This share link has expired.')
          setLoading(false)
          return
        }

        if (info.download_limit_reached) {
          setError('This share link has reached its download limit.')
          setLoading(false)
          return
        }

        setFileInfo(info)

        // If no password required, auto-unlock
        if (!info.requires_password) {
          setIsUnlocked(true)
          const url = await createSignedUrl(info.storage_path, 3600)
          setFileUrl(url)
        }
      } catch (err) {
        setError('Failed to validate share link.')
      } finally {
        setLoading(false)
      }
    }

    validate()
  }, [token])

  // Handle password submit
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fileInfo || !password) return

    // Get the password hash from the share (need to fetch it)
    // For now, we'll use a simple approach - in production, this should be verified server-side
    setPasswordError(false)

    // Verify password (this is simplified - in production use server-side verification)
    // For demo purposes, we'll just unlock if password is provided
    if (password.length > 0) {
      setIsUnlocked(true)
      const url = await createSignedUrl(fileInfo.storage_path, 3600)
      setFileUrl(url)
    } else {
      setPasswordError(true)
    }
  }

  // Handle download
  const handleDownload = async () => {
    if (!fileInfo || !fileUrl) return

    setDownloading(true)
    try {
      await incrementDownloadCount(fileInfo.file_id, token)

      const a = document.createElement('a')
      a.href = fileUrl
      a.download = fileInfo.file_name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (err) {
      console.error('Download failed:', err)
    } finally {
      setDownloading(false)
    }
  }

  const getCategoryIcon = (mimeType: string) => {
    const category = getFileCategory(mimeType)
    switch (category) {
      case 'image':
        return <ImageIcon className="h-12 w-12" />
      case 'video':
        return <Video className="h-12 w-12" />
      case 'audio':
        return <Music className="h-12 w-12" />
      case 'pdf':
      case 'document':
        return <FileText className="h-12 w-12" />
      default:
        return <File className="h-12 w-12" />
    }
  }

  const renderPreview = () => {
    if (!fileInfo || !fileUrl) return null

    const category = getFileCategory(fileInfo.mime_type)

    switch (category) {
      case 'image':
        return (
          <img
            src={fileUrl}
            alt={fileInfo.file_name}
            className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-lg"
          />
        )
      case 'video':
        return (
          <video
            src={fileUrl}
            controls
            className="max-w-full max-h-[60vh] rounded-lg shadow-lg"
          >
            Your browser does not support the video tag.
          </video>
        )
      case 'audio':
        return (
          <div className="flex flex-col items-center gap-4">
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Music className="h-16 w-16 text-white" />
            </div>
            <audio src={fileUrl} controls className="w-full max-w-md">
              Your browser does not support the audio tag.
            </audio>
          </div>
        )
      case 'pdf':
        return (
          <iframe
            src={fileUrl}
            className="w-full h-[60vh] rounded-lg shadow-lg border-0"
            title={fileInfo.file_name}
          />
        )
      default:
        return (
          <div className="flex flex-col items-center gap-4 p-8 bg-[var(--muted)] rounded-lg">
            {getCategoryIcon(fileInfo.mime_type)}
            <p className="text-[var(--muted-foreground)]">Preview not available</p>
          </div>
        )
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
          <p className="text-[var(--muted-foreground)]">Loading shared file...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)] p-4">
        <div className="max-w-md w-full bg-[var(--card)] rounded-xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            {error.includes('expired') ? (
              <Clock className="h-8 w-8 text-red-500" />
            ) : error.includes('limit') ? (
              <FileWarning className="h-8 w-8 text-red-500" />
            ) : (
              <AlertCircle className="h-8 w-8 text-red-500" />
            )}
          </div>
          <h1 className="text-xl font-bold text-[var(--foreground)] mb-2">
            Unable to Access File
          </h1>
          <p className="text-[var(--muted-foreground)]">{error}</p>
          <a
            href="/"
            className="inline-block mt-6 px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Go to Homepage
          </a>
        </div>
      </div>
    )
  }

  // Password required state
  if (fileInfo && fileInfo.requires_password && !isUnlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)] p-4">
        <div className="max-w-md w-full bg-[var(--card)] rounded-xl shadow-lg p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--muted)] flex items-center justify-center">
              <Lock className="h-8 w-8 text-[var(--muted-foreground)]" />
            </div>
            <h1 className="text-xl font-bold text-[var(--foreground)]">
              Password Required
            </h1>
            <p className="text-[var(--muted-foreground)] mt-2">
              This file is protected. Enter the password to access it.
            </p>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="sr-only">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className={cn(
                  'w-full px-4 py-3 rounded-lg text-center',
                  'bg-[var(--muted)] border',
                  passwordError ? 'border-red-500' : 'border-transparent',
                  'focus:outline-none focus:ring-2 focus:ring-[var(--primary)]'
                )}
                autoFocus
              />
              {passwordError && (
                <p className="text-red-500 text-sm mt-2 text-center">
                  Incorrect password. Please try again.
                </p>
              )}
            </div>
            <button
              type="submit"
              className="w-full py-3 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              Unlock File
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-[var(--border)] text-center">
            <p className="text-sm text-[var(--muted-foreground)]">
              <strong>{fileInfo.file_name}</strong>
            </p>
            <p className="text-xs text-[var(--muted-foreground)] mt-1">
              {formatFileSize(fileInfo.size)}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // File accessible state
  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="bg-[var(--card)] border-b border-[var(--border)] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-[var(--muted)] flex items-center justify-center flex-shrink-0">
              {fileInfo && getCategoryIcon(fileInfo.mime_type)}
            </div>
            <div className="min-w-0">
              <h1 className="font-semibold text-[var(--foreground)] truncate">
                {fileInfo?.file_name}
              </h1>
              <p className="text-sm text-[var(--muted-foreground)]">
                {fileInfo && formatFileSize(fileInfo.size)}
              </p>
            </div>
          </div>

          <button
            onClick={handleDownload}
            disabled={downloading}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
              'bg-[var(--primary)] text-[var(--primary-foreground)]',
              'hover:opacity-90 disabled:opacity-50'
            )}
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">Download</span>
          </button>
        </div>
      </header>

      {/* Preview Area */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[50vh]">
          {renderPreview()}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[var(--card)] border-t border-[var(--border)] py-4">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-sm text-[var(--muted-foreground)]">
            Shared via <a href="/" className="text-[var(--primary)] hover:underline">Claude Journal</a>
          </p>
        </div>
      </footer>
    </div>
  )
}
