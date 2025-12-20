'use client'

import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { isDemoAccount } from '@/lib/demo'
import {
  fetchFilesByFolderId,
  deleteFile,
  getDownloadUrl,
  incrementDownloadCount,
  fetchFolderTree,
  getRootFileCount,
  createFileFolder,
  updateFileFolder,
  deleteFileFolder,
  getFolderPath,
  moveFilesToFolder,
} from '@/lib/files/fileService'
import { FileRecord, FolderTreeNode, BreadcrumbSegment, formatFileSize, getFileCategory } from '@/lib/files/types'
import { useFileUpload } from '@/hooks/useFileUpload'
import {
  FileUploader,
  FileCard,
  FilePreviewModal,
  ShareModal,
  FolderTree,
  CreateFolderDialog,
  RenameFolderDialog,
  MoveToFolderDialog,
  FolderBreadcrumb,
} from '@/components/files'
import {
  Upload,
  Grid,
  List,
  FolderPlus,
  Search,
  Loader2,
  Files as FilesIcon,
} from 'lucide-react'

// Demo files for non-authenticated users
const demoFiles: FileRecord[] = [
  {
    id: 'demo-1',
    user_id: 'demo',
    name: 'sample-image.jpg',
    original_name: 'sample-image.jpg',
    mime_type: 'image/jpeg',
    size: 1024 * 1024 * 2,
    storage_path: 'demo/sample-image.jpg',
    thumbnail_path: null,
    is_public: false,
    folder: 'root',
    folder_id: null,
    description: null,
    download_count: 5,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'demo-2',
    user_id: 'demo',
    name: 'document.pdf',
    original_name: 'document.pdf',
    mime_type: 'application/pdf',
    size: 1024 * 512,
    storage_path: 'demo/document.pdf',
    thumbnail_path: null,
    is_public: false,
    folder: 'root',
    folder_id: null,
    description: null,
    download_count: 3,
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date(Date.now() - 86400000).toISOString(),
  },
]

// Demo folders
const demoFolders: FolderTreeNode[] = [
  {
    id: 'demo-folder-1',
    user_id: 'demo',
    name: 'Documents',
    parent_folder_id: null,
    order_index: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    children: [],
    file_count: 0,
    depth: 0,
  },
  {
    id: 'demo-folder-2',
    user_id: 'demo',
    name: 'Images',
    parent_folder_id: null,
    order_index: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    children: [],
    file_count: 0,
    depth: 0,
  },
]

export default function FilesPage() {
  const { user } = useAuthStore()
  const isDemo = isDemoAccount(user?.email)

  // File state
  const [files, setFiles] = useState<FileRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [showUploader, setShowUploader] = useState(false)

  // Folder state
  const [folderTree, setFolderTree] = useState<FolderTreeNode[]>([])
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [breadcrumbPath, setBreadcrumbPath] = useState<BreadcrumbSegment[]>([])
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set())
  const [rootFileCount, setRootFileCount] = useState(0)

  // Dialog state
  const [showCreateFolder, setShowCreateFolder] = useState(false)
  const [createFolderParentId, setCreateFolderParentId] = useState<string | null>(null)
  const [renamingFolder, setRenamingFolder] = useState<FolderTreeNode | null>(null)
  const [movingFiles, setMovingFiles] = useState<FileRecord[]>([])

  // Selection state for multi-select
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set())

  // Preview & Share state
  const [previewFile, setPreviewFile] = useState<FileRecord | null>(null)
  const [shareFile, setShareFile] = useState<FileRecord | null>(null)

  // Upload hook
  const { uploads, isUploading, uploadFiles, removeUpload, clearCompleted } = useFileUpload({
    folderId: currentFolderId,
    onSuccess: (file) => {
      setFiles(prev => [file, ...prev])
      loadFolderTree() // Refresh folder counts
    },
  })

  // Load folder tree
  const loadFolderTree = useCallback(async () => {
    if (isDemo) {
      setFolderTree(demoFolders)
      setRootFileCount(demoFiles.length)
      return
    }

    try {
      const [tree, rootCount] = await Promise.all([
        fetchFolderTree(),
        getRootFileCount(),
      ])
      setFolderTree(tree)
      setRootFileCount(rootCount)
    } catch (error) {
      console.error('Error loading folder tree:', error)
    }
  }, [isDemo])

  // Load files for current folder
  const loadFiles = useCallback(async () => {
    if (isDemo) {
      setFiles(demoFiles)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const filesData = await fetchFilesByFolderId(currentFolderId)
      setFiles(filesData)
    } catch (error) {
      console.error('Error loading files:', error)
    } finally {
      setIsLoading(false)
    }
  }, [isDemo, currentFolderId])

  // Load breadcrumb path
  const loadBreadcrumb = useCallback(async () => {
    if (!currentFolderId || isDemo) {
      setBreadcrumbPath([])
      return
    }

    try {
      const path = await getFolderPath(currentFolderId)
      setBreadcrumbPath(path)
    } catch (error) {
      console.error('Error loading breadcrumb:', error)
    }
  }, [currentFolderId, isDemo])

  useEffect(() => {
    loadFolderTree()
  }, [loadFolderTree])

  useEffect(() => {
    loadFiles()
    loadBreadcrumb()
  }, [loadFiles, loadBreadcrumb])

  // Filter files
  const filteredFiles = files.filter(file => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      if (!file.name.toLowerCase().includes(query) &&
          !file.original_name.toLowerCase().includes(query)) {
        return false
      }
    }

    // Type filter
    if (filterType !== 'all') {
      const category = getFileCategory(file.mime_type)
      if (category !== filterType) return false
    }

    return true
  })

  // Folder navigation
  const handleFolderSelect = (folderId: string | null) => {
    setCurrentFolderId(folderId)
    setSelectedFileIds(new Set())
  }

  const handleFolderExpand = (folderId: string) => {
    setExpandedFolderIds(prev => new Set([...prev, folderId]))
  }

  const handleFolderCollapse = (folderId: string) => {
    setExpandedFolderIds(prev => {
      const next = new Set(prev)
      next.delete(folderId)
      return next
    })
  }

  // Folder CRUD
  const handleCreateFolder = (parentFolderId: string | null) => {
    setCreateFolderParentId(parentFolderId)
    setShowCreateFolder(true)
  }

  const handleCreateFolderSubmit = async (name: string, parentFolderId: string | null) => {
    if (isDemo) {
      throw new Error('Demo mode: Folder creation not available')
    }

    await createFileFolder({ name, parent_folder_id: parentFolderId })
    await loadFolderTree()

    // Expand parent folder to show new child
    if (parentFolderId) {
      setExpandedFolderIds(prev => new Set([...prev, parentFolderId]))
    }
  }

  const handleRenameFolder = (folder: FolderTreeNode) => {
    setRenamingFolder(folder)
  }

  const handleRenameFolderSubmit = async (folderId: string, newName: string) => {
    if (isDemo) {
      throw new Error('Demo mode: Folder renaming not available')
    }

    await updateFileFolder(folderId, { name: newName })
    await loadFolderTree()
    await loadBreadcrumb()
  }

  const handleDeleteFolder = async (folderId: string) => {
    if (isDemo) {
      alert('Demo mode: Folder deletion not available')
      return
    }

    if (!confirm('Delete this folder and all its contents? This cannot be undone.')) return

    await deleteFileFolder(folderId)
    await loadFolderTree()

    // If we're viewing the deleted folder, go back to root
    if (currentFolderId === folderId) {
      setCurrentFolderId(null)
    }
  }

  // File operations
  const handleDelete = async (file: FileRecord) => {
    if (!confirm(`Delete "${file.name}"? This cannot be undone.`)) return

    if (isDemo) {
      setFiles(prev => prev.filter(f => f.id !== file.id))
      return
    }

    const success = await deleteFile(file.id)
    if (success) {
      setFiles(prev => prev.filter(f => f.id !== file.id))
      await loadFolderTree()
    }
  }

  const handleDownload = async (file: FileRecord) => {
    if (isDemo) {
      alert('Demo mode: Downloads not available. Create an account to use this feature.')
      return
    }

    const url = await getDownloadUrl(file.id)
    if (url) {
      await incrementDownloadCount(file.id)
      const a = document.createElement('a')
      a.href = url
      a.download = file.original_name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  }

  const handleMoveFiles = (fileOrFiles: FileRecord | FileRecord[]) => {
    const filesToMove = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles]
    setMovingFiles(filesToMove)
  }

  const handleMoveFilesSubmit = async (fileIds: string[], folderId: string | null) => {
    if (isDemo) {
      throw new Error('Demo mode: Moving files not available')
    }

    await moveFilesToFolder(fileIds, folderId)
    await loadFiles()
    await loadFolderTree()
  }

  // Drag and drop handler
  const handleFileDrop = async (fileIds: string[], folderId: string | null) => {
    if (isDemo) {
      alert('Demo mode: Moving files not available')
      return
    }

    try {
      await moveFilesToFolder(fileIds, folderId)
      await loadFiles()
      await loadFolderTree()
    } catch (error) {
      console.error('Error moving files:', error)
    }
  }

  // Handle file drop
  const handleFilesSelected = (selectedFiles: File[]) => {
    uploadFiles(selectedFiles)
    setShowUploader(false)
  }

  // Get current folder name for header
  const getCurrentFolderName = () => {
    if (!currentFolderId) return 'All Files'
    const segment = breadcrumbPath.find(s => s.id === currentFolderId)
    return segment?.name || 'Files'
  }

  return (
    <div className="flex h-full overflow-hidden bg-[var(--background)]">
      {/* Sidebar */}
      <aside className="w-64 border-r border-[var(--border)] bg-[var(--card)] flex-shrink-0 hidden md:flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h2 className="font-bold text-lg text-[var(--foreground)]">My Files</h2>
          {!isDemo && (
            <button
              onClick={() => handleCreateFolder(null)}
              className="p-1.5 rounded-lg hover:bg-[var(--muted)] transition-colors text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              title="New Folder"
            >
              <FolderPlus className="h-4 w-4" />
            </button>
          )}
        </div>

        <nav className="flex-1 p-2 overflow-y-auto">
          <FolderTree
            folders={folderTree}
            selectedFolderId={currentFolderId}
            expandedFolderIds={expandedFolderIds}
            rootFileCount={rootFileCount}
            onFolderSelect={handleFolderSelect}
            onFolderExpand={handleFolderExpand}
            onFolderCollapse={handleFolderCollapse}
            onCreateFolder={handleCreateFolder}
            onRenameFolder={handleRenameFolder}
            onDeleteFolder={handleDeleteFolder}
            onFileDrop={handleFileDrop}
            isDemo={isDemo}
          />
        </nav>

        {/* Upload Button */}
        <div className="p-4 border-t border-[var(--border)]">
          <button
            onClick={() => setShowUploader(true)}
            className={cn(
              'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors',
              'bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90'
            )}
          >
            <Upload className="h-4 w-4" />
            Upload Files
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="border-b border-[var(--border)] bg-[var(--card)] flex-shrink-0">
          {/* Breadcrumb */}
          <div className="px-4 md:px-6 py-2 border-b border-[var(--border)]">
            <FolderBreadcrumb
              path={breadcrumbPath}
              onNavigate={handleFolderSelect}
            />
          </div>

          {/* Toolbar */}
          <div className="h-14 flex items-center justify-between px-4 md:px-6">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-semibold text-[var(--foreground)] hidden sm:block">
                {getCurrentFolderName()}
              </h1>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search files..."
                  className={cn(
                    'pl-9 pr-4 py-2 rounded-lg text-sm w-48 md:w-64',
                    'bg-[var(--muted)] border-none',
                    'focus:outline-none focus:ring-2 focus:ring-[var(--primary)]',
                    'placeholder:text-[var(--muted-foreground)]'
                  )}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Type Filter */}
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className={cn(
                  'px-3 py-2 rounded-lg text-sm',
                  'bg-[var(--muted)] border-none',
                  'focus:outline-none focus:ring-2 focus:ring-[var(--primary)]'
                )}
              >
                <option value="all">All Types</option>
                <option value="image">Images</option>
                <option value="video">Videos</option>
                <option value="audio">Audio</option>
                <option value="pdf">PDFs</option>
                <option value="document">Documents</option>
              </select>

              {/* View Toggle */}
              <div className="flex rounded-lg bg-[var(--muted)] p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    'p-2 rounded transition-colors',
                    viewMode === 'grid' ? 'bg-[var(--card)] shadow-sm' : 'hover:bg-[var(--card)]/50'
                  )}
                >
                  <Grid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={cn(
                    'p-2 rounded transition-colors',
                    viewMode === 'list' ? 'bg-[var(--card)] shadow-sm' : 'hover:bg-[var(--card)]/50'
                  )}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>

              {/* Mobile Upload Button */}
              <button
                onClick={() => setShowUploader(true)}
                className="md:hidden p-2 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)]"
              >
                <Upload className="h-5 w-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--muted-foreground)]" />
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-[var(--muted-foreground)]">
              <FilesIcon className="h-16 w-16 mb-4 opacity-50" />
              <p className="text-lg font-medium">No files yet</p>
              <p className="text-sm">Upload some files to get started</p>
              <button
                onClick={() => setShowUploader(true)}
                className="mt-4 px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg font-medium hover:opacity-90 transition-opacity"
              >
                Upload Files
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {filteredFiles.map(file => (
                <FileCard
                  key={file.id}
                  file={file}
                  onPreview={setPreviewFile}
                  onShare={setShareFile}
                  onDelete={handleDelete}
                  onDownload={handleDownload}
                  onMove={() => handleMoveFiles(file)}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredFiles.map(file => (
                <div
                  key={file.id}
                  className={cn(
                    'flex items-center gap-4 p-3 rounded-lg',
                    'bg-[var(--card)] border border-[var(--border)]',
                    'hover:border-[var(--primary)] transition-colors cursor-pointer'
                  )}
                  onClick={() => setPreviewFile(file)}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/json', JSON.stringify({
                      type: 'file',
                      id: file.id,
                    }))
                  }}
                >
                  <div className="w-10 h-10 rounded bg-[var(--muted)] flex items-center justify-center text-[var(--muted-foreground)]">
                    <FilesIcon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-[var(--foreground)]">{file.name}</p>
                    <p className="text-sm text-[var(--muted-foreground)]">
                      {formatFileSize(file.size)} - {file.mime_type}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDownload(file)
                      }}
                      className="p-2 hover:bg-[var(--muted)] rounded-lg transition-colors"
                      title="Download"
                    >
                      <Upload className="h-4 w-4 rotate-180" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleMoveFiles(file)
                      }}
                      className="p-2 hover:bg-[var(--muted)] rounded-lg transition-colors"
                      title="Move to folder"
                    >
                      <FolderPlus className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setShareFile(file)
                      }}
                      className="p-2 hover:bg-[var(--muted)] rounded-lg transition-colors"
                      title="Share"
                    >
                      <Upload className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Upload Modal */}
      {showUploader && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowUploader(false)}
          />
          <div className="relative z-10 w-full max-w-lg mx-4 bg-[var(--card)] rounded-lg shadow-xl p-6">
            <h2 className="text-lg font-semibold mb-4 text-[var(--foreground)]">
              Upload Files {currentFolderId && breadcrumbPath.length > 0 && (
                <span className="text-sm font-normal text-[var(--muted-foreground)]">
                  to {breadcrumbPath[breadcrumbPath.length - 1]?.name}
                </span>
              )}
            </h2>
            <FileUploader
              onFilesSelected={handleFilesSelected}
              uploads={uploads}
              onRemoveUpload={removeUpload}
              disabled={isUploading}
            />
            <div className="flex justify-end gap-2 mt-4">
              {uploads.some(u => u.status === 'success') && (
                <button
                  onClick={clearCompleted}
                  className="px-4 py-2 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                >
                  Clear Completed
                </button>
              )}
              <button
                onClick={() => setShowUploader(false)}
                className="px-4 py-2 text-sm bg-[var(--muted)] rounded-lg hover:bg-[var(--muted)]/80 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Folder Dialog */}
      <CreateFolderDialog
        isOpen={showCreateFolder}
        onClose={() => setShowCreateFolder(false)}
        onSubmit={handleCreateFolderSubmit}
        folders={folderTree}
        initialParentId={createFolderParentId}
      />

      {/* Rename Folder Dialog */}
      <RenameFolderDialog
        isOpen={!!renamingFolder}
        folder={renamingFolder}
        onClose={() => setRenamingFolder(null)}
        onSubmit={handleRenameFolderSubmit}
      />

      {/* Move to Folder Dialog */}
      <MoveToFolderDialog
        isOpen={movingFiles.length > 0}
        files={movingFiles}
        folders={folderTree}
        currentFolderId={currentFolderId}
        onClose={() => setMovingFiles([])}
        onSubmit={handleMoveFilesSubmit}
      />

      {/* Preview Modal */}
      <FilePreviewModal
        file={previewFile}
        isOpen={!!previewFile}
        onClose={() => setPreviewFile(null)}
        onShare={setShareFile}
      />

      {/* Share Modal */}
      <ShareModal
        file={shareFile}
        isOpen={!!shareFile}
        onClose={() => setShareFile(null)}
      />

      {/* Demo Banner */}
      {isDemo && (
        <div className="fixed bottom-4 right-4 left-4 sm:left-auto px-4 py-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-xl text-amber-800 dark:text-amber-200 text-sm shadow-lg z-50">
          <span className="font-medium">Demo Mode:</span> Files are not saved. Create an account to use this feature.
        </div>
      )}
    </div>
  )
}
