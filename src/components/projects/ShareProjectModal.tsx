'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  createShareLink,
  getProjectShareLinks,
  deactivateShareLink,
  deleteShareLink,
  getShareUrl,
} from '@/lib/projectSharingService'
import type { ShareLinkFormData, ShareLinkWithStats, ShareLinkAccessLevel } from '@/types/sharing'
import { ACCESS_LEVEL_INFO, EXPIRY_OPTIONS, MAX_USES_OPTIONS } from '@/types/sharing'

interface ShareProjectModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  projectName: string
}

export function ShareProjectModal({
  isOpen,
  onClose,
  projectId,
  projectName,
}: ShareProjectModalProps) {
  const [activeTab, setActiveTab] = useState<'create' | 'manage'>('create')
  const [isLoading, setIsLoading] = useState(false)
  const [shareLinks, setShareLinks] = useState<ShareLinkWithStats[]>([])
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null)
  const [createdLink, setCreatedLink] = useState<{ token: string; url: string } | null>(null)

  // Form state
  const [formData, setFormData] = useState<ShareLinkFormData>({
    name: '',
    access_level: 'viewer',
    password: '',
    expires_in_days: null,
    max_uses: null,
    is_public: false,
  })

  // Load existing share links
  useEffect(() => {
    if (isOpen && projectId) {
      loadShareLinks()
    }
  }, [isOpen, projectId])

  const loadShareLinks = async () => {
    const links = await getProjectShareLinks(projectId)
    setShareLinks(links)
  }

  const handleCreateLink = async () => {
    setIsLoading(true)
    try {
      const result = await createShareLink(projectId, formData)
      if (result.success && result.token) {
        setCreatedLink({
          token: result.token,
          url: getShareUrl(result.token),
        })
        await loadShareLinks()
        // Reset form
        setFormData({
          name: '',
          access_level: 'viewer',
          password: '',
          expires_in_days: null,
          max_uses: null,
          is_public: false,
        })
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopyLink = async (url: string, linkId: string) => {
    await navigator.clipboard.writeText(url)
    setCopiedLinkId(linkId)
    setTimeout(() => setCopiedLinkId(null), 2000)
  }

  const handleDeactivate = async (linkId: string) => {
    if (await deactivateShareLink(linkId)) {
      await loadShareLinks()
    }
  }

  const handleDelete = async (linkId: string) => {
    if (confirm('Are you sure you want to permanently delete this link?')) {
      if (await deleteShareLink(linkId)) {
        await loadShareLinks()
      }
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-[var(--card)] rounded-xl shadow-2xl border border-[var(--border)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Share Project
            </h2>
            <p className="text-sm text-[var(--muted-foreground)]">
              {projectName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--muted)] transition-colors"
          >
            <span className="material-icons text-[var(--muted-foreground)]">close</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--border)]">
          <button
            onClick={() => setActiveTab('create')}
            className={cn(
              'flex-1 py-3 text-sm font-medium transition-colors',
              activeTab === 'create'
                ? 'text-[var(--primary)] border-b-2 border-[var(--primary)]'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            )}
          >
            Create Link
          </button>
          <button
            onClick={() => setActiveTab('manage')}
            className={cn(
              'flex-1 py-3 text-sm font-medium transition-colors relative',
              activeTab === 'manage'
                ? 'text-[var(--primary)] border-b-2 border-[var(--primary)]'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            )}
          >
            Manage Links
            {shareLinks.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-[var(--primary)] text-white rounded-full">
                {shareLinks.filter(l => l.is_active).length}
              </span>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {activeTab === 'create' ? (
            <div className="space-y-4">
              {/* Created Link Success */}
              {createdLink && (
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-icons text-green-500">check_circle</span>
                    <span className="text-sm font-medium text-green-600 dark:text-green-400">
                      Link created successfully!
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={createdLink.url}
                      readOnly
                      className="flex-1 px-3 py-2 text-sm bg-[var(--background)] border border-[var(--border)] rounded-lg"
                    />
                    <Button
                      size="sm"
                      onClick={() => handleCopyLink(createdLink.url, 'new')}
                    >
                      {copiedLinkId === 'new' ? 'Copied!' : 'Copy'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Link Name */}
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                  Link Name (optional)
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Team Access, Client View"
                />
              </div>

              {/* Access Level */}
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                  Access Level
                </label>
                <div className="space-y-2">
                  {(['viewer', 'member', 'admin'] as ShareLinkAccessLevel[]).map((level) => (
                    <label
                      key={level}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                        formData.access_level === level
                          ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                          : 'border-[var(--border)] hover:border-[var(--primary)]/50'
                      )}
                    >
                      <input
                        type="radio"
                        name="access_level"
                        value={level}
                        checked={formData.access_level === level}
                        onChange={() => setFormData(prev => ({ ...prev, access_level: level }))}
                        className="sr-only"
                      />
                      <span className="material-icons text-[var(--primary)]">
                        {ACCESS_LEVEL_INFO[level].icon}
                      </span>
                      <div>
                        <div className="font-medium text-[var(--foreground)]">
                          {ACCESS_LEVEL_INFO[level].label}
                        </div>
                        <div className="text-xs text-[var(--muted-foreground)]">
                          {ACCESS_LEVEL_INFO[level].description}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Password Protection */}
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                  Password Protection (optional)
                </label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Leave empty for no password"
                />
              </div>

              {/* Expiry & Max Uses */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                    Expires After
                  </label>
                  <select
                    value={formData.expires_in_days ?? ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      expires_in_days: e.target.value ? Number(e.target.value) : null,
                    }))}
                    className="w-full px-3 py-2 text-sm bg-[var(--background)] border border-[var(--border)] rounded-lg"
                  >
                    {EXPIRY_OPTIONS.map((opt) => (
                      <option key={opt.label} value={opt.value ?? ''}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                    Max Uses
                  </label>
                  <select
                    value={formData.max_uses ?? ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      max_uses: e.target.value ? Number(e.target.value) : null,
                    }))}
                    className="w-full px-3 py-2 text-sm bg-[var(--background)] border border-[var(--border)] rounded-lg"
                  >
                    {MAX_USES_OPTIONS.map((opt) => (
                      <option key={opt.label} value={opt.value ?? ''}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Create Button */}
              <Button
                className="w-full"
                onClick={handleCreateLink}
                loading={isLoading}
              >
                <span className="material-icons mr-2 text-sm">link</span>
                Create Share Link
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {shareLinks.length === 0 ? (
                <div className="text-center py-8 text-[var(--muted-foreground)]">
                  <span className="material-icons text-4xl mb-2 opacity-50">link_off</span>
                  <p>No share links yet</p>
                  <p className="text-sm">Create your first link to share this project</p>
                </div>
              ) : (
                shareLinks.map((link) => (
                  <ShareLinkCard
                    key={link.id}
                    link={link}
                    onCopy={() => handleCopyLink(link.share_url, link.id)}
                    onDeactivate={() => handleDeactivate(link.id)}
                    onDelete={() => handleDelete(link.id)}
                    isCopied={copiedLinkId === link.id}
                  />
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// =====================================================
// Share Link Card Component
// =====================================================

interface ShareLinkCardProps {
  link: ShareLinkWithStats
  onCopy: () => void
  onDeactivate: () => void
  onDelete: () => void
  isCopied: boolean
}

function ShareLinkCard({
  link,
  onCopy,
  onDeactivate,
  onDelete,
  isCopied,
}: ShareLinkCardProps) {
  const isDisabled = !link.is_active || link.is_expired || link.is_maxed_out

  const getStatusBadge = () => {
    if (!link.is_active) {
      return <span className="px-2 py-0.5 text-xs bg-gray-500/10 text-gray-500 rounded">Deactivated</span>
    }
    if (link.is_expired) {
      return <span className="px-2 py-0.5 text-xs bg-red-500/10 text-red-500 rounded">Expired</span>
    }
    if (link.is_maxed_out) {
      return <span className="px-2 py-0.5 text-xs bg-amber-500/10 text-amber-500 rounded">Max Uses Reached</span>
    }
    return <span className="px-2 py-0.5 text-xs bg-green-500/10 text-green-500 rounded">Active</span>
  }

  return (
    <div className={cn(
      'p-4 rounded-lg border',
      isDisabled ? 'border-[var(--border)] opacity-60' : 'border-[var(--border)]'
    )}>
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="material-icons text-[var(--primary)]">
            {ACCESS_LEVEL_INFO[link.access_level].icon}
          </span>
          <div>
            <div className="font-medium text-[var(--foreground)]">
              {link.name || `${ACCESS_LEVEL_INFO[link.access_level].label} Link`}
            </div>
            <div className="text-xs text-[var(--muted-foreground)]">
              {ACCESS_LEVEL_INFO[link.access_level].label} access
            </div>
          </div>
        </div>
        {getStatusBadge()}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-[var(--muted-foreground)] mb-3">
        <span className="flex items-center gap-1">
          <span className="material-icons text-sm">people</span>
          {link.use_count} {link.max_uses ? `/ ${link.max_uses}` : ''} uses
        </span>
        {link.password_hash && (
          <span className="flex items-center gap-1">
            <span className="material-icons text-sm">lock</span>
            Password protected
          </span>
        )}
        {link.expires_at && (
          <span className="flex items-center gap-1">
            <span className="material-icons text-sm">schedule</span>
            Expires {new Date(link.expires_at).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={onCopy}
          disabled={isDisabled}
          className="flex-1"
        >
          <span className="material-icons text-sm mr-1">
            {isCopied ? 'check' : 'content_copy'}
          </span>
          {isCopied ? 'Copied!' : 'Copy Link'}
        </Button>
        {link.is_active && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onDeactivate}
            title="Deactivate link"
          >
            <span className="material-icons text-sm">block</span>
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={onDelete}
          className="text-red-500 hover:text-red-600"
          title="Delete link"
        >
          <span className="material-icons text-sm">delete</span>
        </Button>
      </div>
    </div>
  )
}
