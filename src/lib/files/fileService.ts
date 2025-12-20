import { createClient } from '@/lib/supabase/client'
import {
  FileRecord,
  FileInsert,
  FileUpdate,
  FileShare,
  FileShareCreate,
  SharedFileInfo,
  FileFolder,
  FileFolderInsert,
  FileFolderUpdate,
  FolderTreeNode,
  BreadcrumbSegment,
  isFileTypeAllowed,
  sanitizeFilename,
  MAX_FILE_SIZE,
  RESUMABLE_UPLOAD_THRESHOLD,
} from './types'

const STORAGE_BUCKET = 'user-files'

/**
 * Generate a unique storage path for a file
 */
function generateStoragePath(userId: string, filename: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  const sanitized = sanitizeFilename(filename)
  return `${userId}/${timestamp}-${random}-${sanitized}`
}

/**
 * Generate a unique share token
 */
function generateShareToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let token = ''
  for (let i = 0; i < 24; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return token
}

/**
 * Upload a file to storage and create database record
 */
export async function uploadFile(
  file: File,
  options?: { folder?: string; folderId?: string | null; description?: string; isPublic?: boolean }
): Promise<FileRecord | null> {
  const supabase = createClient()

  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    console.error('No authenticated user')
    return null
  }

  // Validate file type
  if (!isFileTypeAllowed(file.type)) {
    console.error('File type not allowed:', file.type)
    return null
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    console.error('File too large:', file.size)
    return null
  }

  const storagePath = generateStoragePath(user.id, file.name)

  // Upload to storage
  // Use resumable upload for larger files
  const uploadOptions = file.size > RESUMABLE_UPLOAD_THRESHOLD
    ? { upsert: false }
    : { upsert: false }

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, file, uploadOptions)

  if (uploadError) {
    console.error('Error uploading file:', uploadError)
    return null
  }

  // Create database record
  const fileInsert: FileInsert & { user_id: string } = {
    user_id: user.id,
    name: sanitizeFilename(file.name),
    original_name: file.name,
    mime_type: file.type,
    size: file.size,
    storage_path: storagePath,
    is_public: options?.isPublic ?? false,
    folder: options?.folder ?? 'root',
    folder_id: options?.folderId ?? null,
    description: options?.description ?? null,
  }

  const { data, error } = await supabase
    .from('files')
    .insert(fileInsert)
    .select()
    .single()

  if (error) {
    console.error('Error creating file record:', error)
    // Clean up uploaded file if database insert fails
    await supabase.storage.from(STORAGE_BUCKET).remove([storagePath])
    return null
  }

  return data
}

/**
 * Fetch all files for the current user
 */
export async function fetchFiles(folder?: string): Promise<FileRecord[]> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  let query = supabase
    .from('files')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (folder) {
    query = query.eq('folder', folder)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching files:', error)
    return []
  }

  return data || []
}

/**
 * Get a single file by ID
 */
export async function getFile(id: string): Promise<FileRecord | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('files')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching file:', error)
    return null
  }

  return data
}

/**
 * Update file metadata
 */
export async function updateFile(id: string, updates: FileUpdate): Promise<FileRecord | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('files')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating file:', error)
    return null
  }

  return data
}

/**
 * Delete a file from storage and database
 */
export async function deleteFile(id: string): Promise<boolean> {
  const supabase = createClient()

  // First get the file to know the storage path
  const file = await getFile(id)
  if (!file) return false

  // Delete from storage
  const { error: storageError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove([file.storage_path])

  if (storageError) {
    console.error('Error deleting file from storage:', storageError)
    // Continue to delete database record anyway
  }

  // Delete thumbnail if exists
  if (file.thumbnail_path) {
    await supabase.storage.from(STORAGE_BUCKET).remove([file.thumbnail_path])
  }

  // Delete database record
  const { error } = await supabase
    .from('files')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting file record:', error)
    return false
  }

  return true
}

/**
 * Create a signed URL for temporary file access
 */
export async function createSignedUrl(storagePath: string, expiresIn: number = 3600): Promise<string | null> {
  const supabase = createClient()

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(storagePath, expiresIn)

  if (error) {
    console.error('Error creating signed URL:', error)
    return null
  }

  return data.signedUrl
}

/**
 * Get a download URL for a file
 */
export async function getDownloadUrl(fileId: string): Promise<string | null> {
  const file = await getFile(fileId)
  if (!file) return null

  return createSignedUrl(file.storage_path, 3600) // 1 hour expiry
}

/**
 * Create a shareable link for a file
 */
export async function createShareLink(options: FileShareCreate): Promise<FileShare | null> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    console.error('No authenticated user')
    return null
  }

  // Verify user owns the file
  const file = await getFile(options.file_id)
  if (!file || file.user_id !== user.id) {
    console.error('File not found or not owned by user')
    return null
  }

  const shareToken = generateShareToken()

  // Calculate expiry timestamp if specified
  let expiresAt: string | null = null
  if (options.expires_in_hours) {
    const expiry = new Date()
    expiry.setHours(expiry.getHours() + options.expires_in_hours)
    expiresAt = expiry.toISOString()
  }

  // Hash password if provided (simple hash for demo, use bcrypt in production)
  let passwordHash: string | null = null
  if (options.password) {
    // In production, use bcrypt. For now, store a simple hash indicator
    passwordHash = btoa(options.password) // Base64 encode (not secure, use bcrypt)
  }

  const { data, error } = await supabase
    .from('file_shares')
    .insert({
      file_id: options.file_id,
      share_token: shareToken,
      created_by: user.id,
      password_hash: passwordHash,
      expires_at: expiresAt,
      max_downloads: options.max_downloads ?? null,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating share link:', error)
    return null
  }

  return data
}

/**
 * Get all shares for a file
 */
export async function getFileShares(fileId: string): Promise<FileShare[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('file_shares')
    .select('*')
    .eq('file_id', fileId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching file shares:', error)
    return []
  }

  return data || []
}

/**
 * Deactivate a share link
 */
export async function deactivateShare(shareId: string): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase
    .from('file_shares')
    .update({ is_active: false })
    .eq('id', shareId)

  if (error) {
    console.error('Error deactivating share:', error)
    return false
  }

  return true
}

/**
 * Delete a share link
 */
export async function deleteShare(shareId: string): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase
    .from('file_shares')
    .delete()
    .eq('id', shareId)

  if (error) {
    console.error('Error deleting share:', error)
    return false
  }

  return true
}

/**
 * Validate a share token and get file info (for public access)
 */
export async function validateShareToken(token: string): Promise<SharedFileInfo | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .rpc('validate_share_token', { token })

  if (error) {
    console.error('Error validating share token:', error)
    return null
  }

  if (!data || data.length === 0) {
    return null
  }

  return data[0]
}

/**
 * Verify password for a protected share
 */
export function verifySharePassword(inputPassword: string, passwordHash: string): boolean {
  // In production, use bcrypt.compare. For now, simple Base64 comparison
  return btoa(inputPassword) === passwordHash
}

/**
 * Increment download count for a file
 */
export async function incrementDownloadCount(fileId: string, shareToken?: string): Promise<void> {
  const supabase = createClient()

  await supabase.rpc('increment_download_count', {
    p_file_id: fileId,
    p_share_token: shareToken ?? null,
  })
}

/**
 * Get all folders for the current user
 */
export async function getFolders(): Promise<string[]> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('files')
    .select('folder')
    .eq('user_id', user.id)

  if (error) {
    console.error('Error fetching folders:', error)
    return []
  }

  // Get unique folder names
  const folders = [...new Set(data?.map(f => f.folder) || [])]
  return folders.sort()
}

/**
 * Move file to a different folder
 */
export async function moveFile(fileId: string, newFolder: string): Promise<FileRecord | null> {
  return updateFile(fileId, { folder: newFolder })
}

/**
 * Get files shared with the current user
 */
export async function getSharedWithMe(): Promise<FileRecord[]> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // Get file IDs from permissions where current user is the recipient
  const { data: permissions, error: permError } = await supabase
    .from('file_permissions')
    .select('file_id')
    .eq('shared_with', user.id)

  if (permError || !permissions) {
    console.error('Error fetching permissions:', permError)
    return []
  }

  const fileIds = permissions.map(p => p.file_id)
  if (fileIds.length === 0) return []

  // Get the actual files
  const { data: files, error } = await supabase
    .from('files')
    .select('*')
    .in('id', fileIds)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching shared files:', error)
    return []
  }

  return files || []
}

/**
 * Get public URL for a file (if the bucket is public)
 */
export function getPublicUrl(storagePath: string): string {
  const supabase = createClient()
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath)
  return data.publicUrl
}

// =============================================================================
// FILE FOLDER OPERATIONS
// =============================================================================

/**
 * Fetch all file folders for the current user (flat list)
 */
export async function fetchFileFolders(): Promise<FileFolder[]> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('file_folders')
    .select('*')
    .eq('user_id', user.id)
    .order('order_index', { ascending: true })

  if (error) {
    console.error('Error fetching file folders:', error)
    return []
  }

  return data || []
}

/**
 * Build folder tree from flat list
 */
export function buildFolderTree(
  folders: FileFolder[],
  fileCounts: Map<string | null, number>
): FolderTreeNode[] {
  const folderMap = new Map<string, FolderTreeNode>()

  // Initialize all folders as nodes
  folders.forEach(folder => {
    folderMap.set(folder.id, {
      ...folder,
      children: [],
      file_count: fileCounts.get(folder.id) || 0,
      depth: 0,
    })
  })

  const roots: FolderTreeNode[] = []

  // Build tree structure
  folders.forEach(folder => {
    const node = folderMap.get(folder.id)!
    if (folder.parent_folder_id === null) {
      roots.push(node)
    } else {
      const parent = folderMap.get(folder.parent_folder_id)
      if (parent) {
        parent.children.push(node)
        node.depth = parent.depth + 1
      } else {
        // Orphan folder, treat as root
        roots.push(node)
      }
    }
  })

  // Sort children by order_index
  const sortChildren = (nodes: FolderTreeNode[]) => {
    nodes.sort((a, b) => a.order_index - b.order_index)
    nodes.forEach(node => sortChildren(node.children))
  }
  sortChildren(roots)

  return roots
}

/**
 * Fetch folder tree with file counts
 */
export async function fetchFolderTree(): Promise<FolderTreeNode[]> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // Fetch folders and file counts in parallel
  const [foldersRes, filesRes] = await Promise.all([
    supabase
      .from('file_folders')
      .select('*')
      .eq('user_id', user.id)
      .order('order_index'),
    supabase
      .from('files')
      .select('folder_id')
      .eq('user_id', user.id),
  ])

  if (foldersRes.error) {
    console.error('Error fetching folders:', foldersRes.error)
    return []
  }

  // Count files per folder
  const fileCounts = new Map<string | null, number>()
  filesRes.data?.forEach(file => {
    const folderId = file.folder_id
    fileCounts.set(folderId, (fileCounts.get(folderId) || 0) + 1)
  })

  return buildFolderTree(foldersRes.data || [], fileCounts)
}

/**
 * Get file count for root (files with no folder)
 */
export async function getRootFileCount(): Promise<number> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0

  const { count, error } = await supabase
    .from('files')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('folder_id', null)

  if (error) {
    console.error('Error getting root file count:', error)
    return 0
  }

  return count || 0
}

/**
 * Create a new file folder
 */
export async function createFileFolder(
  folder: FileFolderInsert
): Promise<FileFolder | null> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Get max order_index for the parent level
  const { data: maxData } = await supabase
    .from('file_folders')
    .select('order_index')
    .eq('user_id', user.id)
    .is('parent_folder_id', folder.parent_folder_id ?? null)
    .order('order_index', { ascending: false })
    .limit(1)

  const newOrderIndex = ((maxData?.[0]?.order_index) ?? -1) + 1

  const { data, error } = await supabase
    .from('file_folders')
    .insert({
      user_id: user.id,
      name: folder.name.trim(),
      parent_folder_id: folder.parent_folder_id ?? null,
      order_index: folder.order_index ?? newOrderIndex,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating folder:', error)
    return null
  }

  return data
}

/**
 * Update file folder (rename or move)
 */
export async function updateFileFolder(
  folderId: string,
  updates: FileFolderUpdate
): Promise<FileFolder | null> {
  const supabase = createClient()

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (updates.name !== undefined) {
    updateData.name = updates.name.trim()
  }
  if (updates.parent_folder_id !== undefined) {
    updateData.parent_folder_id = updates.parent_folder_id
  }
  if (updates.order_index !== undefined) {
    updateData.order_index = updates.order_index
  }

  const { data, error } = await supabase
    .from('file_folders')
    .update(updateData)
    .eq('id', folderId)
    .select()
    .single()

  if (error) {
    console.error('Error updating folder:', error)
    return null
  }

  return data
}

/**
 * Delete file folder and optionally its contents
 */
export async function deleteFileFolder(
  folderId: string,
  deleteContents: boolean = false
): Promise<boolean> {
  const supabase = createClient()

  if (deleteContents) {
    // Get all descendant folder IDs using the SQL function
    const { data: descendants, error: descError } = await supabase
      .rpc('get_folder_descendants', { p_folder_id: folderId })

    if (descError) {
      console.error('Error getting descendants:', descError)
      return false
    }

    if (descendants && descendants.length > 0) {
      const folderIds = descendants.map((d: { id: string }) => d.id)

      // Get all files in these folders to delete from storage
      const { data: files } = await supabase
        .from('files')
        .select('id, storage_path, thumbnail_path')
        .in('folder_id', folderIds)

      if (files && files.length > 0) {
        // Delete from storage
        const pathsToDelete = files
          .flatMap(f => [f.storage_path, f.thumbnail_path])
          .filter(Boolean) as string[]

        if (pathsToDelete.length > 0) {
          await supabase.storage.from(STORAGE_BUCKET).remove(pathsToDelete)
        }

        // Delete file records
        await supabase.from('files').delete().in('folder_id', folderIds)
      }
    }
  } else {
    // Move files to root (null folder)
    await supabase
      .from('files')
      .update({ folder_id: null })
      .eq('folder_id', folderId)

    // Move subfolders to parent of deleted folder
    const { data: folder } = await supabase
      .from('file_folders')
      .select('parent_folder_id')
      .eq('id', folderId)
      .single()

    if (folder) {
      await supabase
        .from('file_folders')
        .update({ parent_folder_id: folder.parent_folder_id })
        .eq('parent_folder_id', folderId)
    }
  }

  // Delete the folder itself (cascade will delete child folders if deleteContents)
  const { error } = await supabase
    .from('file_folders')
    .delete()
    .eq('id', folderId)

  if (error) {
    console.error('Error deleting folder:', error)
    return false
  }

  return true
}

/**
 * Get folder breadcrumb path
 */
export async function getFolderPath(
  folderId: string
): Promise<BreadcrumbSegment[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .rpc('get_folder_path', { p_folder_id: folderId })

  if (error) {
    console.error('Error getting folder path:', error)
    return []
  }

  return (data || []).map((item: { id: string; name: string }) => ({
    id: item.id,
    name: item.name,
  }))
}

/**
 * Move file to folder
 */
export async function moveFileToFolder(
  fileId: string,
  folderId: string | null
): Promise<FileRecord | null> {
  return updateFile(fileId, { folder_id: folderId })
}

/**
 * Move multiple files to folder
 */
export async function moveFilesToFolder(
  fileIds: string[],
  folderId: string | null
): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase
    .from('files')
    .update({
      folder_id: folderId,
      updated_at: new Date().toISOString(),
    })
    .in('id', fileIds)

  if (error) {
    console.error('Error moving files:', error)
    return false
  }

  return true
}

/**
 * Fetch files by folder_id (new method)
 */
export async function fetchFilesByFolderId(folderId: string | null): Promise<FileRecord[]> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  let query = supabase
    .from('files')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (folderId === null) {
    query = query.is('folder_id', null)
  } else {
    query = query.eq('folder_id', folderId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching files by folder:', error)
    return []
  }

  return data || []
}
