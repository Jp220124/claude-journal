// =====================================================
// Project Sharing Feature - TypeScript Types
// =====================================================

import type { ProjectMemberRole } from './projects'

// =====================================================
// SHARE LINK TYPES
// =====================================================

export type ShareLinkAccessLevel = 'viewer' | 'member' | 'admin'

export interface ProjectShareLink {
  id: string
  project_id: string
  created_by: string | null
  token: string
  name: string | null
  access_level: ShareLinkAccessLevel
  password_hash: string | null
  expires_at: string | null
  max_uses: number | null
  use_count: number
  is_public: boolean
  is_active: boolean
  created_at: string
  last_used_at: string | null
}

export interface ProjectShareLinkInsert {
  project_id: string
  name?: string | null
  access_level?: ShareLinkAccessLevel
  password?: string // Plain text password (will be hashed)
  expires_at?: string | null
  max_uses?: number | null
  is_public?: boolean
}

export interface ProjectShareLinkUpdate {
  name?: string | null
  access_level?: ShareLinkAccessLevel
  password?: string | null // New password (will be hashed)
  expires_at?: string | null
  max_uses?: number | null
  is_public?: boolean
  is_active?: boolean
}

// =====================================================
// ACCESS LOG TYPES
// =====================================================

export type ShareLinkAction = 'viewed' | 'claimed' | 'rejected'

export interface ShareLinkAccessLog {
  id: string
  share_link_id: string
  user_id: string | null
  action: ShareLinkAction
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

// =====================================================
// VALIDATION TYPES
// =====================================================

export interface ShareLinkValidation {
  link_id: string | null
  project_id: string | null
  project_name: string | null
  access_level: ShareLinkAccessLevel | null
  requires_password: boolean
  is_valid: boolean
  invalid_reason: string | null
}

export interface ClaimShareLinkResult {
  success: boolean
  message: string
  project_id: string | null
  access_level: ShareLinkAccessLevel | null
}

export interface CreateShareLinkResult {
  success: boolean
  message: string
  link_id: string | null
  token: string | null
}

// =====================================================
// UI TYPES
// =====================================================

export interface ShareLinkFormData {
  name: string
  access_level: ShareLinkAccessLevel
  password: string
  expires_in_days: number | null // null = never
  max_uses: number | null // null = unlimited
  is_public: boolean
}

export interface ShareLinkWithStats extends ProjectShareLink {
  share_url: string
  created_by_email?: string
  access_count?: number
  is_expired: boolean
  is_maxed_out: boolean
}

// =====================================================
// COLLABORATOR TYPES (for display)
// =====================================================

export interface Collaborator {
  id: string
  project_id: string
  user_id: string
  role: ProjectMemberRole
  invited_at: string
  accepted_at: string | null
  user?: {
    id: string
    email: string
    full_name?: string
    avatar_url?: string
  }
  is_current_user: boolean
  can_remove: boolean
}

// =====================================================
// CONSTANTS
// =====================================================

export const ACCESS_LEVEL_INFO: Record<ShareLinkAccessLevel, { label: string; description: string; icon: string }> = {
  viewer: {
    label: 'Viewer',
    description: 'Can view all project content but cannot make changes',
    icon: 'visibility',
  },
  member: {
    label: 'Member',
    description: 'Can view and edit tasks, notes, and files',
    icon: 'edit',
  },
  admin: {
    label: 'Admin',
    description: 'Full access including member management and settings',
    icon: 'admin_panel_settings',
  },
}

export const EXPIRY_OPTIONS = [
  { value: null, label: 'Never expires' },
  { value: 1, label: '1 day' },
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
] as const

export const MAX_USES_OPTIONS = [
  { value: null, label: 'Unlimited' },
  { value: 1, label: '1 use' },
  { value: 5, label: '5 uses' },
  { value: 10, label: '10 uses' },
  { value: 25, label: '25 uses' },
  { value: 100, label: '100 uses' },
] as const
