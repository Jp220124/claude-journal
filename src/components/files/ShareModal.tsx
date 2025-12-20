'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { FileRecord, FileShare } from '@/lib/files/types'
import { createShareLink, getFileShares, deleteShare } from '@/lib/files/fileService'
import { X, Copy, Check, Link, Trash2, Clock, Download, Lock, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface ShareModalProps {
  file: FileRecord | null
  isOpen: boolean
  onClose: () => void
}

export function ShareModal({ file, isOpen, onClose }: ShareModalProps) {
  const [shares, setShares] = useState<FileShare[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  // Share options
  const [usePassword, setUsePassword] = useState(false)
  const [password, setPassword] = useState('')
  const [useExpiry, setUseExpiry] = useState(false)
  const [expiryHours, setExpiryHours] = useState(24)
  const [useMaxDownloads, setUseMaxDownloads] = useState(false)
  const [maxDownloads, setMaxDownloads] = useState(10)

  useEffect(() => {
    if (file && isOpen) {
      loadShares()
    }
  }, [file, isOpen])

  const loadShares = async () => {
    if (!file) return
    setLoading(true)
    const data = await getFileShares(file.id)
    setShares(data)
    setLoading(false)
  }

  const handleCreateShare = async () => {
    if (!file) return
    setCreating(true)

    const share = await createShareLink({
      file_id: file.id,
      password: usePassword ? password : undefined,
      expires_in_hours: useExpiry ? expiryHours : undefined,
      max_downloads: useMaxDownloads ? maxDownloads : undefined,
    })

    if (share) {
      setShares(prev => [share, ...prev])
      // Reset form
      setUsePassword(false)
      setPassword('')
      setUseExpiry(false)
      setUseMaxDownloads(false)
    }

    setCreating(false)
  }

  const handleDeleteShare = async (shareId: string) => {
    const success = await deleteShare(shareId)
    if (success) {
      setShares(prev => prev.filter(s => s.id !== shareId))
    }
  }

  const copyToClipboard = (shareToken: string) => {
    const url = `${window.location.origin}/shared/${shareToken}`
    navigator.clipboard.writeText(url)
    setCopied(shareToken)
    setTimeout(() => setCopied(null), 2000)
  }

  const formatExpiry = (expiresAt: string | null) => {
    if (!expiresAt) return 'Never'
    const date = new Date(expiresAt)
    const now = new Date()
    if (date < now) return 'Expired'

    const diffMs = date.getTime() - now.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffHours / 24)

    if (diffDays > 0) return `${diffDays}d ${diffHours % 24}h`
    if (diffHours > 0) return `${diffHours}h`
    return '< 1h'
  }

  if (!isOpen || !file) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg mx-4 bg-[var(--card)] rounded-lg shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Share "{file.name}"
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[var(--muted)] rounded transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Create New Share */}
        <div className="p-4 border-b border-[var(--border)]">
          <h3 className="text-sm font-medium text-[var(--foreground)] mb-3">
            Create Share Link
          </h3>

          <div className="space-y-3">
            {/* Password Protection */}
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={usePassword}
                onChange={(e) => setUsePassword(e.target.checked)}
                className="rounded border-[var(--border)]"
              />
              <Lock className="h-4 w-4 text-[var(--muted-foreground)]" />
              <span className="text-sm">Password protect</span>
            </label>
            {usePassword && (
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className={cn(
                  'w-full px-3 py-2 rounded-lg text-sm',
                  'bg-[var(--background)] border border-[var(--border)]',
                  'focus:outline-none focus:ring-2 focus:ring-[var(--primary)]'
                )}
              />
            )}

            {/* Expiry */}
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={useExpiry}
                onChange={(e) => setUseExpiry(e.target.checked)}
                className="rounded border-[var(--border)]"
              />
              <Clock className="h-4 w-4 text-[var(--muted-foreground)]" />
              <span className="text-sm">Expires after</span>
              {useExpiry && (
                <select
                  value={expiryHours}
                  onChange={(e) => setExpiryHours(Number(e.target.value))}
                  className="px-2 py-1 rounded border border-[var(--border)] text-sm bg-[var(--background)]"
                >
                  <option value={1}>1 hour</option>
                  <option value={24}>1 day</option>
                  <option value={168}>1 week</option>
                  <option value={720}>30 days</option>
                </select>
              )}
            </label>

            {/* Max Downloads */}
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={useMaxDownloads}
                onChange={(e) => setUseMaxDownloads(e.target.checked)}
                className="rounded border-[var(--border)]"
              />
              <Download className="h-4 w-4 text-[var(--muted-foreground)]" />
              <span className="text-sm">Limit downloads to</span>
              {useMaxDownloads && (
                <input
                  type="number"
                  value={maxDownloads}
                  onChange={(e) => setMaxDownloads(Number(e.target.value))}
                  min={1}
                  max={1000}
                  className="w-20 px-2 py-1 rounded border border-[var(--border)] text-sm bg-[var(--background)]"
                />
              )}
            </label>
          </div>

          <Button
            onClick={handleCreateShare}
            disabled={creating || (usePassword && !password)}
            className="w-full mt-4"
            loading={creating}
          >
            <Link className="h-4 w-4 mr-2" />
            Create Share Link
          </Button>
        </div>

        {/* Existing Shares */}
        <div className="p-4 max-h-64 overflow-y-auto">
          <h3 className="text-sm font-medium text-[var(--foreground)] mb-3">
            Active Share Links
          </h3>

          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--muted-foreground)]" />
            </div>
          ) : shares.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)] text-center py-4">
              No share links yet
            </p>
          ) : (
            <div className="space-y-2">
              {shares.map((share) => (
                <div
                  key={share.id}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg',
                    'bg-[var(--muted)] border border-[var(--border)]',
                    !share.is_active && 'opacity-50'
                  )}
                >
                  <Link className="h-4 w-4 text-[var(--muted-foreground)] flex-shrink-0" />

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono truncate">
                      ...{share.share_token.slice(-8)}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                      {share.password_hash && (
                        <span className="flex items-center gap-1">
                          <Lock className="h-3 w-3" /> Protected
                        </span>
                      )}
                      {share.expires_at && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {formatExpiry(share.expires_at)}
                        </span>
                      )}
                      <span>
                        {share.download_count}
                        {share.max_downloads && `/${share.max_downloads}`} downloads
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => copyToClipboard(share.share_token)}
                    className="p-2 hover:bg-[var(--background)] rounded transition-colors"
                    title="Copy link"
                  >
                    {copied === share.share_token ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>

                  <button
                    onClick={() => handleDeleteShare(share.id)}
                    className="p-2 hover:bg-[var(--background)] rounded transition-colors text-red-500"
                    title="Delete share"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
