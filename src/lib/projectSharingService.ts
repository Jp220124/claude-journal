// =====================================================
// Project Sharing - API Service Functions
// =====================================================

import { createClient } from '@/lib/supabase/client'
import type {
  ProjectShareLink,
  ShareLinkFormData,
  ShareLinkValidation,
  ClaimShareLinkResult,
  CreateShareLinkResult,
  ShareLinkWithStats,
  Collaborator,
  ShareLinkAccessLevel,
} from '@/types/sharing'
import type { ProjectMemberRole } from '@/types/projects'

// =====================================================
// SHARE LINK OPERATIONS
// =====================================================

/**
 * Generate the full share URL from a token
 */
export function getShareUrl(token: string): string {
  // Use window.location.origin for client-side
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/join/${token}`
  }
  // Fallback for SSR
  return `/join/${token}`
}

/**
 * Hash a password using bcrypt (client-side compatible)
 * Note: In production, consider doing this server-side
 */
async function hashPassword(password: string): Promise<string> {
  // Using Web Crypto API for client-side hashing
  // For production, use a proper bcrypt implementation via edge function
  const encoder = new TextEncoder()
  const data = encoder.encode(password + 'journal_share_salt_v1')
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Verify a password against a hash
 */
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const inputHash = await hashPassword(password)
  return inputHash === hash
}

/**
 * Create a new share link for a project
 */
export async function createShareLink(
  projectId: string,
  options: ShareLinkFormData
): Promise<CreateShareLinkResult> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, message: 'You must be logged in', link_id: null, token: null }
  }

  // Calculate expiry date
  let expires_at: string | null = null
  if (options.expires_in_days) {
    const expiryDate = new Date()
    expiryDate.setDate(expiryDate.getDate() + options.expires_in_days)
    expires_at = expiryDate.toISOString()
  }

  // Hash password if provided
  let password_hash: string | null = null
  if (options.password && options.password.length > 0) {
    password_hash = await hashPassword(options.password)
  }

  // Call the database function
  const { data, error } = await supabase
    .rpc('create_share_link', {
      p_project_id: projectId,
      p_name: options.name || null,
      p_access_level: options.access_level,
      p_password_hash: password_hash,
      p_expires_at: expires_at,
      p_max_uses: options.max_uses,
      p_is_public: options.is_public,
    })

  if (error) {
    console.error('Error creating share link:', error)
    return { success: false, message: error.message, link_id: null, token: null }
  }

  const result = data?.[0]
  if (!result?.success) {
    return {
      success: false,
      message: result?.message || 'Failed to create share link',
      link_id: null,
      token: null,
    }
  }

  return {
    success: true,
    message: 'Share link created successfully',
    link_id: result.link_id,
    token: result.token,
  }
}

/**
 * Get all share links for a project
 */
export async function getProjectShareLinks(projectId: string): Promise<ShareLinkWithStats[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('project_share_links')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching share links:', error)
    return []
  }

  const now = new Date()

  return (data || []).map(link => ({
    ...link,
    share_url: getShareUrl(link.token),
    is_expired: link.expires_at ? new Date(link.expires_at) < now : false,
    is_maxed_out: link.max_uses ? link.use_count >= link.max_uses : false,
  }))
}

/**
 * Update a share link
 */
export async function updateShareLink(
  linkId: string,
  updates: Partial<ShareLinkFormData>
): Promise<boolean> {
  const supabase = createClient()

  const updateData: Record<string, unknown> = {}

  if (updates.name !== undefined) {
    updateData.name = updates.name || null
  }

  if (updates.access_level !== undefined) {
    updateData.access_level = updates.access_level
  }

  if (updates.is_public !== undefined) {
    updateData.is_public = updates.is_public
  }

  if (updates.max_uses !== undefined) {
    updateData.max_uses = updates.max_uses
  }

  if (updates.expires_in_days !== undefined) {
    if (updates.expires_in_days === null) {
      updateData.expires_at = null
    } else {
      const expiryDate = new Date()
      expiryDate.setDate(expiryDate.getDate() + updates.expires_in_days)
      updateData.expires_at = expiryDate.toISOString()
    }
  }

  if (updates.password !== undefined) {
    if (updates.password && updates.password.length > 0) {
      updateData.password_hash = await hashPassword(updates.password)
    } else {
      updateData.password_hash = null
    }
  }

  const { error } = await supabase
    .from('project_share_links')
    .update(updateData)
    .eq('id', linkId)

  if (error) {
    console.error('Error updating share link:', error)
    return false
  }

  return true
}

/**
 * Deactivate (soft delete) a share link
 */
export async function deactivateShareLink(linkId: string): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase
    .from('project_share_links')
    .update({ is_active: false })
    .eq('id', linkId)

  if (error) {
    console.error('Error deactivating share link:', error)
    return false
  }

  return true
}

/**
 * Delete a share link permanently
 */
export async function deleteShareLink(linkId: string): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase
    .from('project_share_links')
    .delete()
    .eq('id', linkId)

  if (error) {
    console.error('Error deleting share link:', error)
    return false
  }

  return true
}

// =====================================================
// SHARE LINK VALIDATION & CLAIMING
// =====================================================

/**
 * Validate a share link token
 */
export async function validateShareLink(token: string): Promise<ShareLinkValidation> {
  const supabase = createClient()

  const { data, error } = await supabase
    .rpc('validate_share_link', { p_token: token })

  if (error) {
    console.error('Error validating share link:', error)
    return {
      link_id: null,
      project_id: null,
      project_name: null,
      access_level: null,
      requires_password: false,
      is_valid: false,
      invalid_reason: 'An error occurred while validating the link',
    }
  }

  const result = data?.[0]
  if (!result) {
    return {
      link_id: null,
      project_id: null,
      project_name: null,
      access_level: null,
      requires_password: false,
      is_valid: false,
      invalid_reason: 'Link not found',
    }
  }

  return {
    link_id: result.link_id,
    project_id: result.project_id,
    project_name: result.project_name,
    access_level: result.access_level,
    requires_password: result.requires_password,
    is_valid: result.is_valid,
    invalid_reason: result.invalid_reason,
  }
}

/**
 * Verify password for a protected share link
 */
export async function verifyShareLinkPassword(
  token: string,
  password: string
): Promise<boolean> {
  const supabase = createClient()

  // Get the link to check password
  const { data, error } = await supabase
    .from('project_share_links')
    .select('password_hash')
    .eq('token', token)
    .single()

  if (error || !data?.password_hash) {
    return false
  }

  return verifyPassword(password, data.password_hash)
}

/**
 * Claim a share link (join the project)
 */
export async function claimShareLink(
  token: string,
  password?: string
): Promise<ClaimShareLinkResult> {
  const supabase = createClient()

  // First validate the link
  const validation = await validateShareLink(token)
  if (!validation.is_valid) {
    return {
      success: false,
      message: validation.invalid_reason || 'Invalid link',
      project_id: null,
      access_level: null,
    }
  }

  // If password required, verify it
  if (validation.requires_password) {
    if (!password) {
      return {
        success: false,
        message: 'Password required',
        project_id: null,
        access_level: null,
      }
    }

    const isPasswordValid = await verifyShareLinkPassword(token, password)
    if (!isPasswordValid) {
      return {
        success: false,
        message: 'Incorrect password',
        project_id: null,
        access_level: null,
      }
    }
  }

  // Claim the link
  const { data, error } = await supabase
    .rpc('claim_share_link', {
      p_token: token,
      p_password: password || null,
    })

  if (error) {
    console.error('Error claiming share link:', error)
    return {
      success: false,
      message: error.message,
      project_id: null,
      access_level: null,
    }
  }

  const result = data?.[0]
  return {
    success: result?.success ?? false,
    message: result?.message || 'Failed to join project',
    project_id: result?.project_id || null,
    access_level: result?.access_level || null,
  }
}

// =====================================================
// COLLABORATOR OPERATIONS
// =====================================================

/**
 * Get all collaborators for a project
 */
export async function getProjectCollaborators(projectId: string): Promise<Collaborator[]> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const currentUserId = user?.id

  const { data, error } = await supabase
    .from('project_members')
    .select('*')
    .eq('project_id', projectId)
    .order('role', { ascending: true })
    .order('accepted_at', { ascending: true })

  if (error) {
    console.error('Error fetching collaborators:', error)
    return []
  }

  // Get the current user's role to determine permissions
  const currentUserMember = (data || []).find(m => m.user_id === currentUserId)
  const isOwnerOrAdmin = currentUserMember?.role === 'owner' || currentUserMember?.role === 'admin'

  return (data || []).map(member => ({
    ...member,
    is_current_user: member.user_id === currentUserId,
    can_remove: isOwnerOrAdmin && member.user_id !== currentUserId && member.role !== 'owner',
  }))
}

/**
 * Update a collaborator's role
 */
export async function updateCollaboratorRole(
  memberId: string,
  newRole: ProjectMemberRole
): Promise<boolean> {
  const supabase = createClient()

  // Can't change to or from owner role
  if (newRole === 'owner') {
    console.error('Cannot change member to owner role')
    return false
  }

  const { error } = await supabase
    .from('project_members')
    .update({ role: newRole })
    .eq('id', memberId)

  if (error) {
    console.error('Error updating collaborator role:', error)
    return false
  }

  return true
}

/**
 * Remove a collaborator from a project
 */
export async function removeCollaborator(memberId: string): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase
    .from('project_members')
    .delete()
    .eq('id', memberId)

  if (error) {
    console.error('Error removing collaborator:', error)
    return false
  }

  return true
}

/**
 * Leave a project (remove self)
 */
export async function leaveProject(projectId: string): Promise<boolean> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  // Check if user is the owner
  const { data: project } = await supabase
    .from('projects')
    .select('user_id')
    .eq('id', projectId)
    .single()

  if (project?.user_id === user.id) {
    console.error('Project owner cannot leave their own project')
    return false
  }

  const { error } = await supabase
    .from('project_members')
    .delete()
    .eq('project_id', projectId)
    .eq('user_id', user.id)

  if (error) {
    console.error('Error leaving project:', error)
    return false
  }

  return true
}

// =====================================================
// ACCESS LOG OPERATIONS
// =====================================================

/**
 * Get access logs for a share link
 */
export async function getShareLinkAccessLogs(linkId: string) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('share_link_access_log')
    .select('*')
    .eq('share_link_id', linkId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('Error fetching access logs:', error)
    return []
  }

  return data || []
}

// =====================================================
// PERMISSION HELPERS
// =====================================================

/**
 * Check if current user can manage share links for a project
 */
export async function canManageShareLinks(projectId: string): Promise<boolean> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  // Check if owner
  const { data: project } = await supabase
    .from('projects')
    .select('user_id')
    .eq('id', projectId)
    .single()

  if (project?.user_id === user.id) return true

  // Check if admin
  const { data: member } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()

  return member?.role === 'owner' || member?.role === 'admin'
}

/**
 * Get current user's role in a project
 */
export async function getUserProjectRole(projectId: string): Promise<ProjectMemberRole | null> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Check if owner
  const { data: project } = await supabase
    .from('projects')
    .select('user_id')
    .eq('id', projectId)
    .single()

  if (project?.user_id === user.id) return 'owner'

  // Check member role
  const { data: member } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()

  return member?.role || null
}
