// File sharing types

export interface FileRecord {
  id: string
  user_id: string
  name: string
  original_name: string
  mime_type: string
  size: number
  storage_path: string
  thumbnail_path: string | null
  is_public: boolean
  folder: string
  folder_id: string | null  // Reference to file_folders table
  description: string | null
  download_count: number
  created_at: string
  updated_at: string
}

// =============================================================================
// FILE FOLDER TYPES
// =============================================================================

export interface FileFolder {
  id: string
  user_id: string
  name: string
  parent_folder_id: string | null
  order_index: number
  created_at: string
  updated_at: string
}

export interface FileFolderInsert {
  name: string
  parent_folder_id?: string | null
  order_index?: number
}

export interface FileFolderUpdate {
  name?: string
  parent_folder_id?: string | null
  order_index?: number
}

// Folder tree node for hierarchical display
export interface FolderTreeNode extends FileFolder {
  children: FolderTreeNode[]
  file_count: number
  depth: number
  isExpanded?: boolean
}

// Breadcrumb segment for folder path navigation
export interface BreadcrumbSegment {
  id: string
  name: string
}

// Drag item type for drag-and-drop
export interface DragItem {
  type: 'file' | 'folder'
  id: string
  name: string
}

export interface FileInsert {
  name: string
  original_name: string
  mime_type: string
  size: number
  storage_path: string
  thumbnail_path?: string | null
  is_public?: boolean
  folder?: string
  folder_id?: string | null
  description?: string | null
}

export interface FileUpdate {
  name?: string
  is_public?: boolean
  folder?: string
  folder_id?: string | null
  description?: string | null
}

export interface FileShare {
  id: string
  file_id: string
  share_token: string
  created_by: string
  password_hash: string | null
  expires_at: string | null
  max_downloads: number | null
  download_count: number
  is_active: boolean
  created_at: string
}

export interface FileShareCreate {
  file_id: string
  password?: string
  expires_in_hours?: number
  max_downloads?: number
}

export interface FilePermission {
  id: string
  file_id: string
  shared_with: string
  permission_level: 'view' | 'download' | 'edit'
  shared_by: string
  created_at: string
}

export interface SharedFileInfo {
  file_id: string
  file_name: string
  mime_type: string
  size: number
  storage_path: string
  requires_password: boolean
  is_expired: boolean
  download_limit_reached: boolean
}

// File type categories for UI
export type FileCategory = 'image' | 'video' | 'audio' | 'document' | 'pdf' | 'other'

// Upload progress tracking
export interface UploadProgress {
  file: File
  progress: number
  status: 'pending' | 'uploading' | 'success' | 'error'
  error?: string
  result?: FileRecord
}

// Allowed MIME types configuration
export const ALLOWED_MIME_TYPES: Record<FileCategory, string[]> = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  video: ['video/mp4', 'video/webm', 'video/quicktime'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm'],
  document: ['text/plain', 'text/markdown', 'application/json', 'text/csv'],
  pdf: ['application/pdf'],
  other: [],
}

// Flatten all allowed types
export const ALL_ALLOWED_TYPES = Object.values(ALLOWED_MIME_TYPES).flat()

// Max file size (50MB)
export const MAX_FILE_SIZE = 50 * 1024 * 1024

// File size for resumable upload threshold (6MB)
export const RESUMABLE_UPLOAD_THRESHOLD = 6 * 1024 * 1024

// Get file category from MIME type
export function getFileCategory(mimeType: string): FileCategory {
  for (const [category, types] of Object.entries(ALLOWED_MIME_TYPES)) {
    if (types.includes(mimeType)) {
      return category as FileCategory
    }
  }
  return 'other'
}

// Get file extension from filename
export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || ''
}

// Format file size for display
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Sanitize filename for storage
export function sanitizeFilename(filename: string): string {
  // Remove path components
  const name = filename.split(/[\\/]/).pop() || filename
  // Remove special characters except dots, dashes, underscores
  return name.replace(/[^a-zA-Z0-9.\-_]/g, '_').substring(0, 200)
}

// Check if file type is allowed
export function isFileTypeAllowed(mimeType: string): boolean {
  return ALL_ALLOWED_TYPES.includes(mimeType)
}

// Check if file is previewable
export function isPreviewable(mimeType: string): boolean {
  const category = getFileCategory(mimeType)
  return ['image', 'video', 'audio', 'pdf'].includes(category)
}

// Get icon name for file type (using Lucide icons)
export function getFileIcon(mimeType: string): string {
  const category = getFileCategory(mimeType)
  switch (category) {
    case 'image': return 'Image'
    case 'video': return 'Video'
    case 'audio': return 'Music'
    case 'pdf': return 'FileText'
    case 'document': return 'FileCode'
    default: return 'File'
  }
}
