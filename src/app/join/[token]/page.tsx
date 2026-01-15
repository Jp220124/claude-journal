'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  validateShareLink,
  claimShareLink,
} from '@/lib/projectSharingService'
import { createClient } from '@/lib/supabase/client'
import type { ShareLinkValidation } from '@/types/sharing'
import { ACCESS_LEVEL_INFO } from '@/types/sharing'

export default function JoinProjectPage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string

  const [isLoading, setIsLoading] = useState(true)
  const [isJoining, setIsJoining] = useState(false)
  const [validation, setValidation] = useState<ShareLinkValidation | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  // Check authentication and validate token on mount
  useEffect(() => {
    const init = async () => {
      setIsLoading(true)

      // Check auth
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setIsAuthenticated(!!user)
      setUserEmail(user?.email || null)

      // Validate token
      try {
        const result = await validateShareLink(token)
        setValidation(result)

        if (!result.is_valid) {
          setError(result.invalid_reason || 'This link is invalid')
        }
      } catch (err) {
        setError('Failed to validate link')
      } finally {
        setIsLoading(false)
      }
    }

    init()
  }, [token])

  const handleJoin = async () => {
    if (!validation?.is_valid) return

    // Check password if required
    if (validation.requires_password && !password) {
      setPasswordError('Please enter the password')
      return
    }

    setIsJoining(true)
    setPasswordError(null)

    try {
      const result = await claimShareLink(token, password || undefined)

      if (result.success && result.project_id) {
        // Redirect to the project
        router.push(`/projects/${result.project_id}`)
      } else {
        if (result.message === 'Incorrect password') {
          setPasswordError('Incorrect password')
        } else {
          setError(result.message)
        }
      }
    } catch (err) {
      setError('Failed to join project')
    } finally {
      setIsJoining(false)
    }
  }

  const handleLogin = () => {
    // Store the current URL to redirect back after login
    sessionStorage.setItem('redirectAfterLogin', window.location.href)
    router.push('/login')
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)] mx-auto mb-4" />
          <p className="text-[var(--muted-foreground)]">Validating link...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error && !validation?.is_valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)] p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <span className="material-icons text-3xl text-red-500">error_outline</span>
          </div>
          <h1 className="text-2xl font-bold text-[var(--foreground)] mb-2">
            Invalid Link
          </h1>
          <p className="text-[var(--muted-foreground)] mb-6">
            {error}
          </p>
          <Button onClick={() => router.push('/')}>
            Go Home
          </Button>
        </div>
      </div>
    )
  }

  // Valid link - show join UI
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] p-4">
      <div className="max-w-md w-full">
        {/* Card */}
        <div className="bg-[var(--card)] rounded-2xl shadow-xl border border-[var(--border)] overflow-hidden">
          {/* Header with gradient */}
          <div className="bg-gradient-to-r from-[var(--primary)] to-purple-600 p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center mx-auto mb-4">
              <span className="material-icons text-3xl text-white">group_add</span>
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">
              Join Project
            </h1>
            <p className="text-white/80">
              You've been invited to collaborate
            </p>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Project Info */}
            <div className="text-center">
              <h2 className="text-xl font-semibold text-[var(--foreground)]">
                {validation?.project_name || 'Project'}
              </h2>
              {validation?.access_level && (
                <div className="flex items-center justify-center gap-2 mt-2">
                  <span className="material-icons text-sm text-[var(--primary)]">
                    {ACCESS_LEVEL_INFO[validation.access_level].icon}
                  </span>
                  <span className="text-sm text-[var(--muted-foreground)]">
                    {ACCESS_LEVEL_INFO[validation.access_level].label} access
                  </span>
                </div>
              )}
            </div>

            {/* Access Level Description */}
            {validation?.access_level && (
              <div className="p-4 bg-[var(--muted)]/50 rounded-lg">
                <p className="text-sm text-[var(--muted-foreground)]">
                  As a <strong>{ACCESS_LEVEL_INFO[validation.access_level].label}</strong>, you will be able to:
                </p>
                <ul className="mt-2 text-sm text-[var(--muted-foreground)] space-y-1">
                  {validation.access_level === 'viewer' && (
                    <>
                      <li className="flex items-center gap-2">
                        <span className="material-icons text-xs text-green-500">check</span>
                        View all project content
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="material-icons text-xs text-green-500">check</span>
                        Download files
                      </li>
                    </>
                  )}
                  {validation.access_level === 'member' && (
                    <>
                      <li className="flex items-center gap-2">
                        <span className="material-icons text-xs text-green-500">check</span>
                        View and edit tasks
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="material-icons text-xs text-green-500">check</span>
                        Add and edit notes
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="material-icons text-xs text-green-500">check</span>
                        Upload and manage files
                      </li>
                    </>
                  )}
                  {validation.access_level === 'admin' && (
                    <>
                      <li className="flex items-center gap-2">
                        <span className="material-icons text-xs text-green-500">check</span>
                        Full project access
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="material-icons text-xs text-green-500">check</span>
                        Manage team members
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="material-icons text-xs text-green-500">check</span>
                        Create and manage share links
                      </li>
                    </>
                  )}
                </ul>
              </div>
            )}

            {/* Password Input */}
            {validation?.requires_password && (
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                  <span className="material-icons text-sm mr-1 align-middle">lock</span>
                  This link is password protected
                </label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setPasswordError(null)
                  }}
                  placeholder="Enter password"
                  className={cn(passwordError && 'border-red-500')}
                />
                {passwordError && (
                  <p className="text-sm text-red-500 mt-1">{passwordError}</p>
                )}
              </div>
            )}

            {/* Error Message */}
            {error && validation?.is_valid && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">
                {error}
              </div>
            )}

            {/* Auth Check */}
            {isAuthenticated === false ? (
              <div className="space-y-3">
                <p className="text-sm text-[var(--muted-foreground)] text-center">
                  Please sign in to join this project
                </p>
                <Button className="w-full" onClick={handleLogin}>
                  <span className="material-icons mr-2 text-sm">login</span>
                  Sign In to Join
                </Button>
              </div>
            ) : isAuthenticated ? (
              <div className="space-y-3">
                <p className="text-sm text-[var(--muted-foreground)] text-center">
                  Joining as <strong>{userEmail}</strong>
                </p>
                <Button
                  className="w-full"
                  onClick={handleJoin}
                  loading={isJoining}
                  disabled={isJoining}
                >
                  <span className="material-icons mr-2 text-sm">group_add</span>
                  Join Project
                </Button>
              </div>
            ) : null}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-[var(--muted)]/30 border-t border-[var(--border)]">
            <p className="text-xs text-[var(--muted-foreground)] text-center">
              By joining, you'll be added as a collaborator to this project.
            </p>
          </div>
        </div>

        {/* Back link */}
        <div className="mt-4 text-center">
          <button
            onClick={() => router.push('/')}
            className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            ← Back to home
          </button>
        </div>
      </div>
    </div>
  )
}
