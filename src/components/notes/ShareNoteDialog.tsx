'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Note, NoteShare } from '@/types/database'
import {
  createNoteShare,
  getNoteShares,
  deleteNoteShare,
  revokeNoteShare,
} from '@/lib/notesService'
import {
  X,
  Copy,
  Check,
  Link,
  Trash2,
  Clock,
  Eye,
  Clipboard,
  ClipboardX,
  Loader2,
  ExternalLink,
} from 'lucide-react'

interface ShareNoteDialogProps {
  note: Note | null
  isOpen: boolean
  onClose: () => void
}

export function ShareNoteDialog({ note, isOpen, onClose }: ShareNoteDialogProps) {
  const [shares, setShares] = useState<NoteShare[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  // Share options
  const [useExpiry, setUseExpiry] = useState(false)
  const [expiryHours, setExpiryHours] = useState(24)
  const [allowCopy, setAllowCopy] = useState(true)

  useEffect(() => {
    if (note && isOpen) {
      loadShares()
    }
  }, [note, isOpen])

  const loadShares = async () => {
    if (!note) return
    setLoading(true)
    const data = await getNoteShares(note.id)
    setShares(data)
    setLoading(false)
  }

  const handleCreateShare = async () => {
    if (!note) return
    setCreating(true)

    // Calculate expiry date if set
    const expiresAt = useExpiry
      ? new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString()
      : null

    const share = await createNoteShare({
      note_id: note.id,
      expires_at: expiresAt,
      allow_copy: allowCopy,
    })

    if (share) {
      setShares((prev) => [share, ...prev])
      // Reset form
      setUseExpiry(false)
      setAllowCopy(true)
    }

    setCreating(false)
  }

  const handleDeleteShare = async (shareId: string) => {
    const success = await deleteNoteShare(shareId)
    if (success) {
      setShares((prev) => prev.filter((s) => s.id !== shareId))
    }
  }

  const handleRevokeShare = async (shareId: string) => {
    const success = await revokeNoteShare(shareId)
    if (success) {
      setShares((prev) =>
        prev.map((s) => (s.id === shareId ? { ...s, is_active: false } : s))
      )
    }
  }

  const copyToClipboard = (shareToken: string) => {
    const url = `${window.location.origin}/share/note/${shareToken}`
    navigator.clipboard.writeText(url)
    setCopied(shareToken)
    setTimeout(() => setCopied(null), 2000)
  }

  const openShareLink = (shareToken: string) => {
    const url = `${window.location.origin}/share/note/${shareToken}`
    window.open(url, '_blank')
  }

  const formatExpiry = (expiresAt: string | null) => {
    if (!expiresAt) return 'Never expires'
    const date = new Date(expiresAt)
    const now = new Date()
    if (date < now) return 'Expired'

    const diffMs = date.getTime() - now.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffHours / 24)

    if (diffDays > 0) return `${diffDays}d ${diffHours % 24}h remaining`
    if (diffHours > 0) return `${diffHours}h remaining`
    return '< 1h remaining'
  }

  if (!isOpen || !note) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg mx-4 bg-[var(--card)] rounded-xl shadow-xl border border-[var(--border)]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <Link className="h-5 w-5 text-[var(--primary)]" />
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Share Note
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-[var(--muted)] rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-[var(--muted-foreground)]" />
          </button>
        </div>

        {/* Note Title */}
        <div className="px-6 py-3 bg-[var(--muted)]/30 border-b border-[var(--border)]">
          <p className="text-sm text-[var(--muted-foreground)]">Sharing:</p>
          <p className="font-medium text-[var(--foreground)] truncate">
            {note.title || 'Untitled Note'}
          </p>
        </div>

        {/* Create New Share */}
        <div className="p-6 border-b border-[var(--border)]">
          <h3 className="text-sm font-medium text-[var(--foreground)] mb-4">
            Create Share Link
          </h3>

          <div className="space-y-4">
            {/* Expiry */}
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={useExpiry}
                onChange={(e) => setUseExpiry(e.target.checked)}
                className="rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
              />
              <Clock className="h-4 w-4 text-[var(--muted-foreground)]" />
              <span className="text-sm text-[var(--foreground)]">Expires after</span>
              {useExpiry && (
                <select
                  value={expiryHours}
                  onChange={(e) => setExpiryHours(Number(e.target.value))}
                  className="px-2 py-1 rounded-lg border border-[var(--border)] text-sm bg-[var(--background)] text-[var(--foreground)]"
                >
                  <option value={1}>1 hour</option>
                  <option value={24}>1 day</option>
                  <option value={168}>1 week</option>
                  <option value={720}>30 days</option>
                </select>
              )}
            </label>

            {/* Allow Copy */}
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={allowCopy}
                onChange={(e) => setAllowCopy(e.target.checked)}
                className="rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
              />
              {allowCopy ? (
                <Clipboard className="h-4 w-4 text-[var(--muted-foreground)]" />
              ) : (
                <ClipboardX className="h-4 w-4 text-[var(--muted-foreground)]" />
              )}
              <span className="text-sm text-[var(--foreground)]">
                Allow copying content
              </span>
            </label>
          </div>

          <button
            onClick={handleCreateShare}
            disabled={creating}
            className={cn(
              'w-full mt-6 px-4 py-2.5 rounded-lg font-medium text-sm',
              'bg-[var(--primary)] text-[var(--primary-foreground)]',
              'hover:opacity-90 transition-all',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'flex items-center justify-center gap-2'
            )}
          >
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Link className="h-4 w-4" />
            )}
            {creating ? 'Creating...' : 'Create Share Link'}
          </button>
        </div>

        {/* Existing Shares */}
        <div className="p-6 max-h-64 overflow-y-auto">
          <h3 className="text-sm font-medium text-[var(--foreground)] mb-4">
            Active Share Links
          </h3>

          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--muted-foreground)]" />
            </div>
          ) : shares.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)] text-center py-6">
              No share links yet. Create one above.
            </p>
          ) : (
            <div className="space-y-3">
              {shares.map((share) => (
                <div
                  key={share.id}
                  className={cn(
                    'p-4 rounded-lg border',
                    share.is_active
                      ? 'bg-[var(--background)] border-[var(--border)]'
                      : 'bg-[var(--muted)]/50 border-[var(--border)] opacity-60'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Link className="h-4 w-4 text-[var(--muted-foreground)] flex-shrink-0" />

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-mono text-[var(--foreground)] truncate">
                        /share/note/...{share.share_token.slice(-8)}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-[var(--muted-foreground)]">
                        {!share.is_active && (
                          <span className="text-red-500 font-medium">Revoked</span>
                        )}
                        {share.is_active && (
                          <>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatExpiry(share.expires_at)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              {share.view_count} views
                            </span>
                            {!share.allow_copy && (
                              <span className="flex items-center gap-1">
                                <ClipboardX className="h-3 w-3" />
                                Copy disabled
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {share.is_active && (
                      <>
                        <button
                          onClick={() => openShareLink(share.share_token)}
                          className="p-2 hover:bg-[var(--muted)] rounded-lg transition-colors"
                          title="Open in new tab"
                        >
                          <ExternalLink className="h-4 w-4 text-[var(--muted-foreground)]" />
                        </button>

                        <button
                          onClick={() => copyToClipboard(share.share_token)}
                          className="p-2 hover:bg-[var(--muted)] rounded-lg transition-colors"
                          title="Copy link"
                        >
                          {copied === share.share_token ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4 text-[var(--muted-foreground)]" />
                          )}
                        </button>
                      </>
                    )}

                    <button
                      onClick={() => handleDeleteShare(share.id)}
                      className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Delete share"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
