'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { format, formatDistanceToNow, isPast, isToday, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { isDemoAccount } from '@/lib/demo'
import {
  fetchProject,
  updateProject,
  deleteProject,
  linkTaskToProject,
  unlinkTaskFromProject,
  linkNoteToProject,
  unlinkNoteFromProject,
  createEventForProject,
  deleteCalendarEvent,
  uploadProjectFile,
  uploadProjectFilesWithStructure,
  getFileDownloadUrl,
  deleteProjectFile,
  createProjectFolder,
  getProjectFilesInFolder,
  deleteProjectFolder,
} from '@/lib/projectService'
import { fetchTodos, type Todo } from '@/lib/todoService'
import { fetchNotes } from '@/lib/notesService'
import type {
  ProjectWithLinkedItems,
  ProjectStatus,
  CalendarEventType,
  ProjectLinkedTask,
  ProjectLinkedNote,
  CalendarEvent,
  ProjectFile,
} from '@/types/projects'
import { markdownToHtml } from '@/lib/markdownToTiptap'

// Tab types
type TabType = 'overview' | 'tasks' | 'notes' | 'calendar' | 'files'

const TABS: { id: TabType; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: 'dashboard' },
  { id: 'tasks', label: 'Tasks', icon: 'check_box' },
  { id: 'notes', label: 'Notes', icon: 'description' },
  { id: 'calendar', label: 'Calendar', icon: 'calendar_month' },
  { id: 'files', label: 'Files', icon: 'folder_open' },
]

// Status info
const STATUS_INFO: Record<ProjectStatus, { label: string; color: string; bgColor: string }> = {
  active: { label: 'Active', color: 'text-green-700 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/40' },
  on_hold: { label: 'On Hold', color: 'text-amber-700 dark:text-amber-400', bgColor: 'bg-amber-100 dark:bg-amber-900/40' },
  completed: { label: 'Completed', color: 'text-blue-700 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/40' },
  archived: { label: 'Archived', color: 'text-slate-500 dark:text-slate-400', bgColor: 'bg-slate-100 dark:bg-slate-700/50' },
}

// Event type info
const EVENT_TYPE_INFO: Record<CalendarEventType, { label: string; color: string; icon: string }> = {
  event: { label: 'Event', color: '#3b82f6', icon: 'event' },
  milestone: { label: 'Milestone', color: '#8b5cf6', icon: 'flag' },
  deadline: { label: 'Deadline', color: '#ef4444', icon: 'alarm' },
  meeting: { label: 'Meeting', color: '#22c55e', icon: 'groups' },
}

// File type icons
const getFileIcon = (fileType: string | null) => {
  if (!fileType) return 'description'
  if (fileType.startsWith('image/')) return 'image'
  if (fileType.includes('pdf')) return 'picture_as_pdf'
  if (fileType.includes('word') || fileType.includes('document')) return 'article'
  if (fileType.includes('sheet') || fileType.includes('excel')) return 'table_chart'
  if (fileType.includes('zip') || fileType.includes('archive')) return 'folder_zip'
  return 'description'
}

// Format file size
const formatFileSize = (bytes: number | null) => {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Demo data
const demoProject: ProjectWithLinkedItems = {
  id: 'demo-1',
  user_id: 'demo',
  name: 'Website Redesign',
  description: 'Complete overhaul of the company website with modern design patterns and improved user experience. This project aims to increase conversion rates and user engagement.',
  color: '#6366f1',
  icon: 'design_services',
  status: 'active',
  start_date: '2025-01-01',
  target_date: '2025-03-31',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  tasks: [
    {
      link_id: 'link-1',
      task_id: 'task-1',
      added_at: new Date().toISOString(),
      added_by: 'demo',
      task: {
        id: 'task-1',
        title: 'Design homepage wireframes',
        completed: true,
        priority: 'high' as const,
        due_date: '2025-01-15',
        due_time: null,
        notes: null,
        category_id: null,
        created_at: new Date().toISOString(),
      },
    },
    {
      link_id: 'link-2',
      task_id: 'task-2',
      added_at: new Date().toISOString(),
      added_by: 'demo',
      task: {
        id: 'task-2',
        title: 'Implement responsive navigation',
        completed: false,
        priority: 'medium' as const,
        due_date: '2025-01-20',
        due_time: null,
        notes: null,
        category_id: null,
        created_at: new Date().toISOString(),
      },
    },
    {
      link_id: 'link-3',
      task_id: 'task-3',
      added_at: new Date().toISOString(),
      added_by: 'demo',
      task: {
        id: 'task-3',
        title: 'Set up CI/CD pipeline',
        completed: false,
        priority: 'high' as const,
        due_date: '2025-01-25',
        due_time: null,
        notes: null,
        category_id: null,
        created_at: new Date().toISOString(),
      },
    },
  ],
  notes: [
    {
      link_id: 'note-link-1',
      note_id: 'note-1',
      added_at: new Date().toISOString(),
      added_by: 'demo',
      note: {
        id: 'note-1',
        title: 'Design System Guidelines',
        content: 'Color palette, typography, and component specifications...',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    },
    {
      link_id: 'note-link-2',
      note_id: 'note-2',
      added_at: new Date().toISOString(),
      added_by: 'demo',
      note: {
        id: 'note-2',
        title: 'User Research Findings',
        content: 'Key insights from user interviews and surveys...',
        created_at: new Date(Date.now() - 86400000).toISOString(),
        updated_at: new Date(Date.now() - 86400000).toISOString(),
      },
    },
  ],
  events: [
    {
      id: 'event-1',
      user_id: 'demo',
      title: 'Design Review Meeting',
      description: 'Review wireframes and gather feedback',
      event_type: 'meeting',
      start_datetime: new Date(Date.now() + 86400000 * 2).toISOString(),
      end_datetime: new Date(Date.now() + 86400000 * 2 + 3600000).toISOString(),
      all_day: false,
      color: '#22c55e',
      location: 'Zoom',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'event-2',
      user_id: 'demo',
      title: 'Homepage Launch',
      description: 'Go-live date for the new homepage',
      event_type: 'milestone',
      start_datetime: new Date(Date.now() + 86400000 * 30).toISOString(),
      end_datetime: null,
      all_day: true,
      color: '#8b5cf6',
      location: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
  files: [
    {
      id: 'folder-1',
      project_id: 'demo-1',
      user_id: 'demo',
      file_name: 'Documents',
      file_path: 'demo/demo-1/Documents/',
      file_size: 0,
      file_type: 'folder',
      description: null,
      uploaded_at: new Date().toISOString(),
      folder_path: '',
      is_folder: true,
    },
    {
      id: 'folder-2',
      project_id: 'demo-1',
      user_id: 'demo',
      file_name: 'Assets',
      file_path: 'demo/demo-1/Assets/',
      file_size: 0,
      file_type: 'folder',
      description: null,
      uploaded_at: new Date().toISOString(),
      folder_path: '',
      is_folder: true,
    },
    {
      id: 'file-1',
      project_id: 'demo-1',
      user_id: 'demo',
      file_name: 'design-mockups.pdf',
      file_path: 'demo/demo-1/design-mockups.pdf',
      file_size: 2457600,
      file_type: 'application/pdf',
      description: null,
      uploaded_at: new Date().toISOString(),
      folder_path: '',
      is_folder: false,
    },
    {
      id: 'file-2',
      project_id: 'demo-1',
      user_id: 'demo',
      file_name: 'brand-assets.zip',
      file_path: 'demo/demo-1/brand-assets.zip',
      file_size: 15728640,
      file_type: 'application/zip',
      description: null,
      uploaded_at: new Date(Date.now() - 86400000).toISOString(),
      folder_path: '',
      is_folder: false,
    },
  ],
  members: [],
  progress: {
    total_tasks: 3,
    completed_tasks: 1,
    progress_percent: 33,
  },
}

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  const { user } = useAuthStore()
  const isDemo = isDemoAccount(user?.email)

  // State
  const [project, setProject] = useState<ProjectWithLinkedItems | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [isSaving, setIsSaving] = useState(false)

  // Linker states
  const [showTaskLinker, setShowTaskLinker] = useState(false)
  const [showNoteLinker, setShowNoteLinker] = useState(false)
  const [showEventModal, setShowEventModal] = useState(false)
  const [availableTasks, setAvailableTasks] = useState<Todo[]>([])
  const [availableNotes, setAvailableNotes] = useState<any[]>([])

  // File upload
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 })

  // Folder navigation
  const [currentFolderPath, setCurrentFolderPath] = useState('')
  const [folderFiles, setFolderFiles] = useState<ProjectFile[]>([])
  const [isLoadingFiles, setIsLoadingFiles] = useState(false)

  // Create folder modal
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)

  // Drag and drop
  const [isDragging, setIsDragging] = useState(false)

  // File preview modal
  const [previewFile, setPreviewFile] = useState<ProjectFile | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewTextContent, setPreviewTextContent] = useState<string | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)

  // Event form state
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    event_type: 'event' as CalendarEventType,
    start_datetime: '',
    end_datetime: '',
    all_day: false,
    location: '',
  })

  // Keyboard shortcuts help
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false)

  // Load project
  const loadProject = useCallback(async () => {
    if (isDemo) {
      setProject(demoProject)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const data = await fetchProject(projectId)
      if (data) {
        setProject(data)
      } else {
        router.push('/projects')
      }
    } catch (error) {
      console.error('Error loading project:', error)
      router.push('/projects')
    } finally {
      setIsLoading(false)
    }
  }, [projectId, isDemo, router])

  useEffect(() => {
    loadProject()
  }, [loadProject])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      // Don't trigger if any modal is open
      if (showTaskLinker || showNoteLinker || showEventModal || showCreateFolderModal || previewFile || showKeyboardHelp) {
        if (e.key === 'Escape') {
          setShowTaskLinker(false)
          setShowNoteLinker(false)
          setShowEventModal(false)
          setShowCreateFolderModal(false)
          setPreviewFile(null)
          setShowKeyboardHelp(false)
        }
        return
      }

      switch (e.key.toLowerCase()) {
        case 't':
          e.preventDefault()
          loadAvailableTasks()
          setShowTaskLinker(true)
          break
        case 'n':
          e.preventDefault()
          loadAvailableNotes()
          setShowNoteLinker(true)
          break
        case 'e':
          e.preventDefault()
          setShowEventModal(true)
          break
        case 'u':
          e.preventDefault()
          setActiveTab('files')
          setTimeout(() => fileInputRef.current?.click(), 100)
          break
        case '1':
          e.preventDefault()
          setActiveTab('overview')
          break
        case '2':
          e.preventDefault()
          setActiveTab('tasks')
          break
        case '3':
          e.preventDefault()
          setActiveTab('notes')
          break
        case '4':
          e.preventDefault()
          setActiveTab('calendar')
          break
        case '5':
          e.preventDefault()
          setActiveTab('files')
          break
        case '?':
          e.preventDefault()
          setShowKeyboardHelp(true)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showTaskLinker, showNoteLinker, showEventModal, showCreateFolderModal, previewFile, showKeyboardHelp])

  // Load available tasks for linker
  const loadAvailableTasks = async () => {
    if (isDemo) {
      setAvailableTasks([])
      return
    }
    try {
      const todos = await fetchTodos()
      // Filter out already linked tasks
      const linkedIds = new Set(project?.tasks.map(t => t.task_id) || [])
      setAvailableTasks(todos.filter(t => !linkedIds.has(t.id)))
    } catch (error) {
      console.error('Error loading tasks:', error)
    }
  }

  // Load available notes for linker
  const loadAvailableNotes = async () => {
    if (isDemo) {
      setAvailableNotes([])
      return
    }
    try {
      const notes = await fetchNotes({ includeArchived: false })
      // Filter out already linked notes
      const linkedIds = new Set(project?.notes.map(n => n.note_id) || [])
      setAvailableNotes(notes.filter(n => !linkedIds.has(n.id)))
    } catch (error) {
      console.error('Error loading notes:', error)
    }
  }

  // Link task
  const handleLinkTask = async (taskId: string) => {
    if (isDemo || !project) return
    setIsSaving(true)
    try {
      await linkTaskToProject(projectId, taskId)
      await loadProject()
      setShowTaskLinker(false)
    } catch (error) {
      console.error('Error linking task:', error)
    } finally {
      setIsSaving(false)
    }
  }

  // Unlink task
  const handleUnlinkTask = async (taskId: string) => {
    if (isDemo || !project) return
    if (!confirm('Remove this task from the project?')) return
    try {
      await unlinkTaskFromProject(projectId, taskId)
      await loadProject()
    } catch (error) {
      console.error('Error unlinking task:', error)
    }
  }

  // Link note
  const handleLinkNote = async (noteId: string) => {
    if (isDemo || !project) return
    setIsSaving(true)
    try {
      await linkNoteToProject(projectId, noteId)
      await loadProject()
      setShowNoteLinker(false)
    } catch (error) {
      console.error('Error linking note:', error)
    } finally {
      setIsSaving(false)
    }
  }

  // Unlink note
  const handleUnlinkNote = async (noteId: string) => {
    if (isDemo || !project) return
    if (!confirm('Remove this note from the project?')) return
    try {
      await unlinkNoteFromProject(projectId, noteId)
      await loadProject()
    } catch (error) {
      console.error('Error unlinking note:', error)
    }
  }

  // Create event
  const handleCreateEvent = async () => {
    if (isDemo || !project || !eventForm.title.trim()) return
    setIsSaving(true)
    try {
      await createEventForProject(projectId, {
        title: eventForm.title,
        description: eventForm.description || null,
        event_type: eventForm.event_type,
        start_datetime: eventForm.start_datetime,
        end_datetime: eventForm.end_datetime || null,
        all_day: eventForm.all_day,
        color: EVENT_TYPE_INFO[eventForm.event_type].color,
        location: eventForm.location || null,
      })
      await loadProject()
      setShowEventModal(false)
      setEventForm({
        title: '',
        description: '',
        event_type: 'event',
        start_datetime: '',
        end_datetime: '',
        all_day: false,
        location: '',
      })
    } catch (error) {
      console.error('Error creating event:', error)
    } finally {
      setIsSaving(false)
    }
  }

  // Delete event
  const handleDeleteEvent = async (eventId: string) => {
    if (isDemo) return
    if (!confirm('Delete this event?')) return
    try {
      await deleteCalendarEvent(eventId)
      await loadProject()
    } catch (error) {
      console.error('Error deleting event:', error)
    }
  }

  // Upload file
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0 || isDemo) return

    setIsUploading(true)
    setUploadProgress({ current: 0, total: files.length })
    try {
      let current = 0
      for (const file of Array.from(files)) {
        await uploadProjectFile(projectId, file, currentFolderPath)
        current++
        setUploadProgress({ current, total: files.length })
      }
      await loadProject()
      await loadFolderFiles()
    } catch (error) {
      console.error('Error uploading file:', error)
    } finally {
      setIsUploading(false)
      setUploadProgress({ current: 0, total: 0 })
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // Download file
  const handleDownloadFile = async (file: ProjectFile) => {
    if (isDemo) return
    try {
      const url = await getFileDownloadUrl(file.file_path)
      if (url) {
        window.open(url, '_blank')
      }
    } catch (error) {
      console.error('Error downloading file:', error)
    }
  }

  // Delete file
  const handleDeleteFile = async (file: ProjectFile) => {
    if (isDemo) return
    if (!confirm(`Delete "${file.file_name}"?`)) return
    try {
      await deleteProjectFile(file.id, file.file_path)
      await loadProject()
      await loadFolderFiles()
    } catch (error) {
      console.error('Error deleting file:', error)
    }
  }

  // Preview file
  const handlePreviewFile = async (file: ProjectFile) => {
    setPreviewFile(file)
    setPreviewTextContent(null)
    setIsLoadingPreview(true)
    try {
      const url = await getFileDownloadUrl(file.file_path)
      setPreviewUrl(url)

      // For text-based files, also fetch the content
      const ext = file.file_name.split('.').pop()?.toLowerCase()
      const textExtensions = ['txt', 'md', 'markdown', 'json', 'js', 'ts', 'tsx', 'jsx', 'css', 'scss', 'less',
        'html', 'htm', 'xml', 'yaml', 'yml', 'csv', 'log', 'env', 'gitignore', 'sh', 'bash',
        'py', 'rb', 'php', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'go', 'rs', 'swift',
        'kt', 'sql', 'graphql', 'vue', 'svelte']

      if (url && textExtensions.includes(ext || '')) {
        try {
          const response = await fetch(url)
          const text = await response.text()
          setPreviewTextContent(text)
        } catch (textError) {
          console.error('Error fetching text content:', textError)
        }
      }
    } catch (error) {
      console.error('Error loading preview:', error)
    } finally {
      setIsLoadingPreview(false)
    }
  }

  // Close preview
  const handleClosePreview = () => {
    setPreviewFile(null)
    setPreviewUrl(null)
    setPreviewTextContent(null)
  }

  // Open file in Notes
  const handleOpenInNotes = async (file: ProjectFile) => {
    // Navigate to notes with the file info for creating a new note
    const params = new URLSearchParams({
      createFromFile: 'true',
      fileName: file.file_name,
      fileId: file.id,
      projectId: projectId,
      projectName: project?.name || '',
      filePath: file.file_path  // Pass file path so notes page can fetch content
    })
    router.push(`/notes?${params.toString()}`)
  }

  // File type detection helpers
  const isImageFile = (fileType: string | null, fileName?: string) => {
    if (fileType?.startsWith('image/')) return true
    const ext = fileName?.split('.').pop()?.toLowerCase()
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext || '')
  }

  const isPdfFile = (fileType: string | null, fileName?: string) => {
    if (fileType?.includes('pdf')) return true
    const ext = fileName?.split('.').pop()?.toLowerCase()
    return ext === 'pdf'
  }

  const isTextFile = (fileType: string | null, fileName?: string) => {
    const textMimeTypes = ['text/', 'application/json', 'application/javascript', 'application/xml']
    if (fileType && textMimeTypes.some(t => fileType.includes(t))) return true
    const ext = fileName?.split('.').pop()?.toLowerCase()
    return ['txt', 'md', 'markdown', 'json', 'js', 'ts', 'tsx', 'jsx', 'css', 'scss', 'less',
            'html', 'htm', 'xml', 'yaml', 'yml', 'csv', 'log', 'env', 'gitignore', 'sh', 'bash',
            'py', 'rb', 'php', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'go', 'rs', 'swift',
            'kt', 'sql', 'graphql', 'vue', 'svelte'].includes(ext || '')
  }

  const isMarkdownFile = (fileName?: string) => {
    const ext = fileName?.split('.').pop()?.toLowerCase()
    return ['md', 'markdown'].includes(ext || '')
  }

  const isVideoFile = (fileType: string | null, fileName?: string) => {
    if (fileType?.startsWith('video/')) return true
    const ext = fileName?.split('.').pop()?.toLowerCase()
    return ['mp4', 'webm', 'ogg', 'mov'].includes(ext || '')
  }

  const isAudioFile = (fileType: string | null, fileName?: string) => {
    if (fileType?.startsWith('audio/')) return true
    const ext = fileName?.split('.').pop()?.toLowerCase()
    return ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext || '')
  }

  const isOfficeFile = (fileType: string | null, fileName?: string) => {
    const ext = fileName?.split('.').pop()?.toLowerCase()
    return ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp'].includes(ext || '')
  }

  // Get syntax highlighting language for code files
  const getCodeLanguage = (fileName?: string) => {
    const ext = fileName?.split('.').pop()?.toLowerCase()
    const langMap: Record<string, string> = {
      'js': 'javascript', 'jsx': 'javascript', 'ts': 'typescript', 'tsx': 'typescript',
      'py': 'python', 'rb': 'ruby', 'php': 'php', 'java': 'java',
      'c': 'c', 'cpp': 'cpp', 'h': 'c', 'hpp': 'cpp', 'cs': 'csharp',
      'go': 'go', 'rs': 'rust', 'swift': 'swift', 'kt': 'kotlin',
      'sql': 'sql', 'graphql': 'graphql', 'json': 'json', 'yaml': 'yaml', 'yml': 'yaml',
      'xml': 'xml', 'html': 'html', 'htm': 'html', 'css': 'css', 'scss': 'scss',
      'md': 'markdown', 'markdown': 'markdown', 'sh': 'bash', 'bash': 'bash'
    }
    return langMap[ext || ''] || 'plaintext'
  }

  // Load files in current folder
  const loadFolderFiles = useCallback(async () => {
    if (isDemo || !projectId) return
    setIsLoadingFiles(true)
    try {
      const files = await getProjectFilesInFolder(projectId, currentFolderPath)
      setFolderFiles(files)
    } catch (error) {
      console.error('Error loading folder files:', error)
    } finally {
      setIsLoadingFiles(false)
    }
  }, [projectId, currentFolderPath, isDemo])

  // Load folder files when tab changes or folder path changes
  useEffect(() => {
    if (activeTab === 'files' && !isDemo) {
      loadFolderFiles()
    }
  }, [activeTab, currentFolderPath, loadFolderFiles, isDemo])

  // Navigate to folder
  const handleNavigateToFolder = (folderName: string) => {
    setCurrentFolderPath(prev => prev + folderName + '/')
  }

  // Navigate up to parent folder
  const handleNavigateUp = () => {
    const parts = currentFolderPath.split('/').filter(Boolean)
    parts.pop()
    setCurrentFolderPath(parts.length > 0 ? parts.join('/') + '/' : '')
  }

  // Navigate to specific path from breadcrumb
  const handleBreadcrumbClick = (index: number) => {
    const parts = currentFolderPath.split('/').filter(Boolean)
    const newPath = parts.slice(0, index + 1).join('/') + '/'
    setCurrentFolderPath(index === -1 ? '' : newPath)
  }

  // Create folder
  const handleCreateFolder = async () => {
    if (isDemo || !newFolderName.trim()) return
    setIsCreatingFolder(true)
    try {
      await createProjectFolder(projectId, newFolderName.trim(), currentFolderPath)
      await loadFolderFiles()
      setShowCreateFolderModal(false)
      setNewFolderName('')
    } catch (error) {
      console.error('Error creating folder:', error)
    } finally {
      setIsCreatingFolder(false)
    }
  }

  // Delete folder
  const handleDeleteFolder = async (folder: ProjectFile) => {
    if (isDemo) return
    if (!confirm(`Delete folder "${folder.file_name}" and all its contents?`)) return
    try {
      const folderPath = currentFolderPath + folder.file_name + '/'
      await deleteProjectFolder(projectId, folderPath)
      await loadProject()
      await loadFolderFiles()
    } catch (error) {
      console.error('Error deleting folder:', error)
    }
  }

  // Handle folder upload (webkitdirectory)
  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0 || isDemo) return

    setIsUploading(true)
    setUploadProgress({ current: 0, total: files.length })

    try {
      // Convert FileList to array with relative paths
      const filesWithPaths = Array.from(files).map(file => ({
        file,
        relativePath: (file as any).webkitRelativePath || file.name,
      }))

      await uploadProjectFilesWithStructure(projectId, filesWithPaths, currentFolderPath)
      await loadProject()
      await loadFolderFiles()
    } catch (error) {
      console.error('Error uploading folder:', error)
    } finally {
      setIsUploading(false)
      setUploadProgress({ current: 0, total: 0 })
      if (folderInputRef.current) {
        folderInputRef.current.value = ''
      }
    }
  }

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (isDemo) return

    const items = e.dataTransfer.items
    if (!items) return

    setIsUploading(true)
    const filesWithPaths: { file: File; relativePath: string }[] = []

    // Process dropped items using webkitGetAsEntry for folder support
    const processEntry = async (entry: FileSystemEntry, path: string = ''): Promise<void> => {
      if (entry.isFile) {
        const fileEntry = entry as FileSystemFileEntry
        return new Promise((resolve) => {
          fileEntry.file((file) => {
            filesWithPaths.push({
              file,
              relativePath: path + file.name,
            })
            resolve()
          })
        })
      } else if (entry.isDirectory) {
        const dirEntry = entry as FileSystemDirectoryEntry
        const reader = dirEntry.createReader()
        return new Promise((resolve) => {
          reader.readEntries(async (entries) => {
            for (const subEntry of entries) {
              await processEntry(subEntry, path + entry.name + '/')
            }
            resolve()
          })
        })
      }
    }

    try {
      const promises: Promise<void>[] = []
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        const entry = item.webkitGetAsEntry?.()
        if (entry) {
          promises.push(processEntry(entry))
        } else if (item.kind === 'file') {
          const file = item.getAsFile()
          if (file) {
            filesWithPaths.push({ file, relativePath: file.name })
          }
        }
      }

      await Promise.all(promises)

      if (filesWithPaths.length > 0) {
        setUploadProgress({ current: 0, total: filesWithPaths.length })
        await uploadProjectFilesWithStructure(projectId, filesWithPaths, currentFolderPath)
        await loadProject()
        await loadFolderFiles()
      }
    } catch (error) {
      console.error('Error processing dropped files:', error)
    } finally {
      setIsUploading(false)
      setUploadProgress({ current: 0, total: 0 })
    }
  }

  // Delete project
  const handleDeleteProject = async () => {
    if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) return
    try {
      await deleteProject(projectId)
      router.push('/projects')
    } catch (error) {
      console.error('Error deleting project:', error)
    }
  }

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 max-w-6xl mx-auto animate-pulse">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 rounded-xl bg-zinc-200 dark:bg-zinc-700" />
          <div>
            <div className="h-7 w-48 bg-zinc-200 dark:bg-zinc-700 rounded mb-2" />
            <div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-700 rounded" />
          </div>
        </div>
        <div className="flex gap-2 mb-6">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-10 w-24 bg-zinc-200 dark:bg-zinc-700 rounded-lg" />
          ))}
        </div>
        <div className="h-64 bg-zinc-200 dark:bg-zinc-700 rounded-2xl" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="p-6 lg:p-8 text-center">
        <p className="text-zinc-500">Project not found</p>
      </div>
    )
  }

  const statusInfo = STATUS_INFO[project.status]

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-4">
            {/* Back button */}
            <button
              onClick={() => router.push('/projects')}
              className="p-2 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>

            {/* Project icon */}
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${project.color}20` }}
            >
              <span
                className="material-symbols-outlined text-[28px]"
                style={{ color: project.color }}
              >
                {project.icon}
              </span>
            </div>

            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {project.name}
              </h1>
              <div className="flex items-center gap-3 mt-1">
                <span className={cn(
                  'px-2.5 py-0.5 rounded-full text-xs font-medium',
                  statusInfo.bgColor,
                  statusInfo.color
                )}>
                  {statusInfo.label}
                </span>
                {project.target_date && (
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    Due {format(new Date(project.target_date), 'MMM d, yyyy')}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push(`/projects/${projectId}/settings`)}
              className="p-2 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <span className="material-symbols-outlined">settings</span>
            </button>
            <button
              onClick={handleDeleteProject}
              className="p-2 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
            >
              <span className="material-symbols-outlined">delete</span>
            </button>
          </div>
        </div>

        {project.description && (
          <p className="text-zinc-600 dark:text-zinc-400 max-w-2xl ml-20">
            {project.description}
          </p>
        )}

        {/* Quick Actions Bar - iOS Style */}
        <div className="flex items-center gap-2.5 mt-4 ml-20">
          <button
            onClick={() => {
              loadAvailableTasks()
              setShowTaskLinker(true)
            }}
            className="inline-flex items-center gap-2 px-5 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">add_task</span>
            Add Task
          </button>
          <button
            onClick={() => {
              loadAvailableNotes()
              setShowNoteLinker(true)
            }}
            className="inline-flex items-center gap-2 px-5 py-2 bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 rounded-full text-sm font-medium hover:bg-violet-100 dark:hover:bg-violet-900/50 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">note_add</span>
            Add Note
          </button>
          <button
            onClick={() => setShowEventModal(true)}
            className="inline-flex items-center gap-2 px-5 py-2 bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full text-sm font-medium hover:bg-orange-100 dark:hover:bg-orange-900/50 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">event</span>
            Add Event
          </button>
          <button
            onClick={() => {
              setActiveTab('files')
              setTimeout(() => fileInputRef.current?.click(), 100)
            }}
            className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full text-sm font-medium hover:bg-emerald-100 dark:hover:bg-emerald-900/50 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">upload_file</span>
            Upload File
          </button>
        </div>
      </header>

      {/* Tabs */}
      <nav className="flex items-center gap-1 mb-6 border-b border-zinc-200 dark:border-zinc-700 overflow-x-auto pb-px">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
              activeTab === tab.id
                ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
            )}
          >
            <span className="material-symbols-outlined text-[20px]">{tab.icon}</span>
            {tab.label}
            {tab.id === 'tasks' && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-700 text-xs">
                {project.tasks.length}
              </span>
            )}
            {tab.id === 'notes' && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-700 text-xs">
                {project.notes.length}
              </span>
            )}
            {tab.id === 'files' && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-700 text-xs">
                {project.files.length}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Progress Card */}
            <div className="lg:col-span-2 bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Progress</h3>
                {/* Health Score Badge */}
                {(() => {
                  const hasOverdueTasks = project.tasks.some(t =>
                    t.task.due_date && !t.task.completed && isPast(new Date(t.task.due_date)) && !isToday(new Date(t.task.due_date))
                  )
                  const isProjectOverdue = project.target_date && isPast(new Date(project.target_date)) && !isToday(new Date(project.target_date)) && project.status !== 'completed'
                  const progressRate = project.progress.total_tasks > 0 ? project.progress.progress_percent : 0

                  let healthStatus: 'excellent' | 'good' | 'at-risk' | 'critical'
                  let healthLabel: string
                  let healthIcon: string
                  let healthColors: string

                  if (isProjectOverdue) {
                    healthStatus = 'critical'
                    healthLabel = 'Overdue'
                    healthIcon = 'warning'
                    healthColors = 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
                  } else if (hasOverdueTasks) {
                    healthStatus = 'at-risk'
                    healthLabel = 'At Risk'
                    healthIcon = 'schedule'
                    healthColors = 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
                  } else if (progressRate >= 50 || project.status === 'completed') {
                    healthStatus = 'excellent'
                    healthLabel = 'On Track'
                    healthIcon = 'check_circle'
                    healthColors = 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400'
                  } else {
                    healthStatus = 'good'
                    healthLabel = 'Good'
                    healthIcon = 'thumb_up'
                    healthColors = 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400'
                  }

                  return (
                    <div className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium', healthColors)}>
                      <span className="material-symbols-outlined text-[16px]">{healthIcon}</span>
                      {healthLabel}
                    </div>
                  )
                })()}
              </div>

              {/* Progress Ring with Enhanced Display & Animation */}
              <div className="flex items-center gap-8 mb-6">
                <div className="relative w-32 h-32 group">
                  {/* Glow effect behind ring */}
                  <div
                    className="absolute inset-2 rounded-full blur-xl opacity-30 transition-opacity duration-500 group-hover:opacity-50"
                    style={{ backgroundColor: project.color }}
                  />

                  {/* Animated SVG Ring */}
                  <svg className="w-full h-full -rotate-90 relative z-10">
                    {/* Background track */}
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="12"
                      className="text-zinc-100 dark:text-zinc-700"
                    />
                    {/* Subtle pulse ring */}
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      fill="none"
                      stroke={project.color}
                      strokeWidth="2"
                      strokeOpacity="0.3"
                      strokeDasharray="352"
                      className="animate-pulse"
                    />
                    {/* Progress ring with gradient */}
                    <defs>
                      <linearGradient id={`progressGradient-${project.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor={project.color} />
                        <stop offset="100%" stopColor={project.color} stopOpacity="0.6" />
                      </linearGradient>
                    </defs>
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      fill="none"
                      stroke={`url(#progressGradient-${project.id})`}
                      strokeWidth="12"
                      strokeLinecap="round"
                      strokeDasharray={`${project.progress.progress_percent * 3.52} 352`}
                      className="transition-all duration-1000 ease-out"
                      style={{
                        filter: 'drop-shadow(0 0 6px ' + project.color + '40)',
                        animation: 'progressRingDraw 1.5s ease-out forwards',
                      }}
                    />
                    {/* Animated dot at the end of progress */}
                    {project.progress.progress_percent > 0 && (
                      <circle
                        cx="64"
                        cy="8"
                        r="4"
                        fill={project.color}
                        className="animate-pulse"
                        style={{
                          transformOrigin: '64px 64px',
                          transform: `rotate(${project.progress.progress_percent * 3.6}deg)`,
                        }}
                      />
                    )}
                  </svg>

                  {/* Center content */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
                    <span
                      className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 tabular-nums"
                      style={{
                        textShadow: project.progress.progress_percent > 0 ? `0 0 20px ${project.color}20` : 'none'
                      }}
                    >
                      {project.progress.progress_percent}%
                    </span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">Complete</span>
                  </div>
                </div>

                <div className="flex-1 space-y-4">
                  {/* Task Progress */}
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-zinc-500 dark:text-zinc-400">Completed Tasks</span>
                      <span className="font-medium text-zinc-700 dark:text-zinc-300">
                        {project.progress.completed_tasks} / {project.progress.total_tasks}
                      </span>
                    </div>
                    <div className="h-2 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500 ease-out"
                        style={{
                          width: `${project.progress.progress_percent}%`,
                          backgroundColor: project.color,
                        }}
                      />
                    </div>
                  </div>

                  {/* Milestones Summary */}
                  {(() => {
                    const milestones = project.events.filter(e => e.event_type === 'milestone')
                    const completedMilestones = milestones.filter(m => isPast(new Date(m.start_datetime)))
                    const upcomingMilestone = milestones.find(m => !isPast(new Date(m.start_datetime)))

                    return milestones.length > 0 ? (
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px] text-purple-500">flag</span>
                            Milestones
                          </span>
                          <span className="font-medium text-zinc-700 dark:text-zinc-300">
                            {completedMilestones.length} / {milestones.length}
                          </span>
                        </div>
                        <div className="h-2 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-purple-500 rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${milestones.length > 0 ? (completedMilestones.length / milestones.length) * 100 : 0}%` }}
                          />
                        </div>
                        {upcomingMilestone && (
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                            Next: {upcomingMilestone.title} ({format(new Date(upcomingMilestone.start_datetime), 'MMM d')})
                          </p>
                        )}
                      </div>
                    ) : null
                  })()}

                  {/* Deadline Countdown */}
                  {project.target_date && (
                    <div className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-lg text-sm',
                      isPast(new Date(project.target_date)) && !isToday(new Date(project.target_date)) && project.status !== 'completed'
                        ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                        : 'bg-zinc-50 dark:bg-zinc-700/50 text-zinc-600 dark:text-zinc-400'
                    )}>
                      <span className="material-symbols-outlined text-[16px]">
                        {isPast(new Date(project.target_date)) && !isToday(new Date(project.target_date)) ? 'alarm' : 'schedule'}
                      </span>
                      <span>
                        {isPast(new Date(project.target_date)) && !isToday(new Date(project.target_date)) && project.status !== 'completed'
                          ? `Overdue by ${formatDistanceToNow(new Date(project.target_date))}`
                          : `Due ${formatDistanceToNow(new Date(project.target_date), { addSuffix: true })}`
                        }
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Stats with Visual Hierarchy & Sparklines */}
              <div className="grid grid-cols-4 gap-4">
                {/* Tasks Stat - Enhanced */}
                <button
                  onClick={() => project.tasks.length > 0 ? setActiveTab('tasks') : (() => { loadAvailableTasks(); setShowTaskLinker(true) })()}
                  className={cn(
                    'text-center p-4 rounded-xl transition-all duration-300 group relative overflow-hidden',
                    project.tasks.length > 0
                      ? 'bg-gradient-to-br from-white to-cyan-50/50 dark:from-zinc-800 dark:to-cyan-900/20 border border-cyan-200/50 dark:border-cyan-700/30 shadow-sm hover:shadow-lg hover:-translate-y-1'
                      : 'bg-gradient-to-br from-cyan-50 to-cyan-100/50 dark:from-cyan-900/20 dark:to-cyan-800/10 border-2 border-dashed border-cyan-200 dark:border-cyan-700/50 hover:border-cyan-400'
                  )}
                >
                  {project.tasks.length > 0 && (
                    <div className="absolute top-0 right-0 w-16 h-16 opacity-10">
                      <svg viewBox="0 0 100 40" className="w-full h-full">
                        <polyline fill="none" stroke="currentColor" strokeWidth="3" className="text-cyan-500" points="0,35 20,28 40,32 60,20 80,25 100,15" />
                      </svg>
                    </div>
                  )}
                  <span className={cn(
                    'material-symbols-outlined mb-2 transition-all duration-300 group-hover:scale-110',
                    project.tasks.length > 0 ? 'text-cyan-500 text-[28px]' : 'text-cyan-400 text-[24px]'
                  )}>
                    {project.tasks.length > 0 ? 'check_box' : 'add_task'}
                  </span>
                  <p className={cn(
                    'font-bold text-zinc-900 dark:text-zinc-100 transition-all',
                    project.tasks.length > 0 ? 'text-3xl' : 'text-2xl'
                  )}>{project.tasks.length}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    {project.tasks.length > 0 ? 'Tasks' : 'Add Task'}
                  </p>
                  {project.tasks.length > 0 && (
                    <p className="text-[10px] text-cyan-600 dark:text-cyan-400 mt-1">
                      {project.progress.completed_tasks} completed
                    </p>
                  )}
                </button>

                {/* Notes Stat - Enhanced */}
                <button
                  onClick={() => project.notes.length > 0 ? setActiveTab('notes') : (() => { loadAvailableNotes(); setShowNoteLinker(true) })()}
                  className={cn(
                    'text-center p-4 rounded-xl transition-all duration-300 group relative overflow-hidden',
                    project.notes.length > 0
                      ? 'bg-gradient-to-br from-white to-purple-50/50 dark:from-zinc-800 dark:to-purple-900/20 border border-purple-200/50 dark:border-purple-700/30 shadow-sm hover:shadow-lg hover:-translate-y-1'
                      : 'bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-900/20 dark:to-purple-800/10 border-2 border-dashed border-purple-200 dark:border-purple-700/50 hover:border-purple-400'
                  )}
                >
                  {project.notes.length > 0 && (
                    <div className="absolute top-0 right-0 w-16 h-16 opacity-10">
                      <svg viewBox="0 0 100 40" className="w-full h-full">
                        <polyline fill="none" stroke="currentColor" strokeWidth="3" className="text-purple-500" points="0,30 25,25 50,28 75,18 100,22" />
                      </svg>
                    </div>
                  )}
                  <span className={cn(
                    'material-symbols-outlined mb-2 transition-all duration-300 group-hover:scale-110',
                    project.notes.length > 0 ? 'text-purple-500 text-[28px]' : 'text-purple-400 text-[24px]'
                  )}>
                    {project.notes.length > 0 ? 'description' : 'note_add'}
                  </span>
                  <p className={cn(
                    'font-bold text-zinc-900 dark:text-zinc-100 transition-all',
                    project.notes.length > 0 ? 'text-3xl' : 'text-2xl'
                  )}>{project.notes.length}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    {project.notes.length > 0 ? 'Notes' : 'Add Note'}
                  </p>
                  {project.notes.length > 0 && (
                    <p className="text-[10px] text-purple-600 dark:text-purple-400 mt-1">
                      View all
                    </p>
                  )}
                </button>

                {/* Events Stat - Enhanced */}
                <button
                  onClick={() => project.events.length > 0 ? setActiveTab('calendar') : setShowEventModal(true)}
                  className={cn(
                    'text-center p-4 rounded-xl transition-all duration-300 group relative overflow-hidden',
                    project.events.length > 0
                      ? 'bg-gradient-to-br from-white to-amber-50/50 dark:from-zinc-800 dark:to-amber-900/20 border border-amber-200/50 dark:border-amber-700/30 shadow-sm hover:shadow-lg hover:-translate-y-1'
                      : 'bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-900/20 dark:to-amber-800/10 border-2 border-dashed border-amber-200 dark:border-amber-700/50 hover:border-amber-400'
                  )}
                >
                  {project.events.length > 0 && (
                    <div className="absolute top-0 right-0 w-16 h-16 opacity-10">
                      <svg viewBox="0 0 100 40" className="w-full h-full">
                        <polyline fill="none" stroke="currentColor" strokeWidth="3" className="text-amber-500" points="0,32 30,28 50,35 70,22 100,18" />
                      </svg>
                    </div>
                  )}
                  <span className={cn(
                    'material-symbols-outlined mb-2 transition-all duration-300 group-hover:scale-110',
                    project.events.length > 0 ? 'text-amber-500 text-[28px]' : 'text-amber-400 text-[24px]'
                  )}>
                    event
                  </span>
                  <p className={cn(
                    'font-bold text-zinc-900 dark:text-zinc-100 transition-all',
                    project.events.length > 0 ? 'text-3xl' : 'text-2xl'
                  )}>{project.events.length}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    {project.events.length > 0 ? 'Events' : 'Add Event'}
                  </p>
                  {project.events.length > 0 && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                      {project.events.filter(e => !isPast(new Date(e.start_datetime))).length} upcoming
                    </p>
                  )}
                </button>

                {/* Files Stat - Enhanced with Highlight for Non-Zero */}
                <button
                  onClick={() => setActiveTab('files')}
                  className={cn(
                    'text-center p-4 rounded-xl transition-all duration-300 group relative overflow-hidden',
                    project.files.length > 0
                      ? 'bg-gradient-to-br from-white to-green-50/50 dark:from-zinc-800 dark:to-green-900/20 border border-green-200/50 dark:border-green-700/30 shadow-sm hover:shadow-lg hover:-translate-y-1'
                      : 'bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-900/20 dark:to-green-800/10 border-2 border-dashed border-green-200 dark:border-green-700/50 hover:border-green-400',
                    project.files.length > 10 && 'ring-2 ring-green-400/50 ring-offset-2 ring-offset-white dark:ring-offset-zinc-800'
                  )}
                >
                  {project.files.length > 0 && (
                    <div className="absolute top-0 right-0 w-16 h-16 opacity-10">
                      <svg viewBox="0 0 100 40" className="w-full h-full">
                        <polyline fill="none" stroke="currentColor" strokeWidth="3" className="text-green-500" points="0,38 15,32 35,35 55,25 75,28 100,12" />
                      </svg>
                    </div>
                  )}
                  {project.files.length > 10 && (
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                      <span className="material-symbols-outlined text-white text-[14px]">trending_up</span>
                    </div>
                  )}
                  <span className={cn(
                    'material-symbols-outlined mb-2 transition-all duration-300 group-hover:scale-110',
                    project.files.length > 0 ? 'text-green-500 text-[28px]' : 'text-green-400 text-[24px]'
                  )}>
                    {project.files.length > 0 ? 'folder' : 'upload_file'}
                  </span>
                  <p className={cn(
                    'font-bold text-zinc-900 dark:text-zinc-100 transition-all',
                    project.files.length > 0 ? 'text-3xl' : 'text-2xl',
                    project.files.length > 10 && 'text-green-600 dark:text-green-400'
                  )}>{project.files.length}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    {project.files.length > 0 ? 'Files' : 'Upload'}
                  </p>
                  {project.files.length > 0 && (
                    <p className="text-[10px] text-green-600 dark:text-green-400 mt-1">
                      {project.files.filter(f => f.is_folder).length} folders
                    </p>
                  )}
                </button>
              </div>
            </div>

            {/* Details Card - Enhanced */}
            <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-6">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Details</h3>
              <div className="space-y-4">
                {/* Owner Section */}
                <div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Owner</p>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-sm font-medium">
                      {user?.email?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {user?.email?.split('@')[0] || 'You'}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">Project Owner</p>
                    </div>
                  </div>
                </div>

                {/* Team Members */}
                {project.members && project.members.length > 0 && (
                  <div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Team</p>
                    <div className="flex items-center -space-x-2">
                      {project.members.slice(0, 4).map((member, idx) => (
                        <div
                          key={member.id}
                          className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-600 border-2 border-white dark:border-zinc-800 flex items-center justify-center text-xs font-medium text-zinc-600 dark:text-zinc-300"
                          title={member.user?.email || 'Team member'}
                        >
                          {member.user?.email?.charAt(0).toUpperCase() || 'M'}
                        </div>
                      ))}
                      {project.members.length > 4 && (
                        <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-700 border-2 border-white dark:border-zinc-800 flex items-center justify-center text-xs font-medium text-zinc-600 dark:text-zinc-400">
                          +{project.members.length - 4}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Priority Indicator Based on Task Priorities */}
                {project.tasks.length > 0 && (
                  <div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Priority Distribution</p>
                    <div className="flex gap-2">
                      {(() => {
                        const highCount = project.tasks.filter(t => t.task.priority === 'high').length
                        const mediumCount = project.tasks.filter(t => t.task.priority === 'medium').length
                        const lowCount = project.tasks.filter(t => t.task.priority === 'low').length
                        return (
                          <>
                            {highCount > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-md text-xs font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                {highCount} High
                              </span>
                            )}
                            {mediumCount > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-md text-xs font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                {mediumCount} Med
                              </span>
                            )}
                            {lowCount > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-md text-xs font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                {lowCount} Low
                              </span>
                            )}
                          </>
                        )
                      })()}
                    </div>
                  </div>
                )}

                <div className="border-t border-zinc-100 dark:border-zinc-700 pt-4 mt-4">
                  {/* Timeline Section */}
                  {(project.start_date || project.target_date) && (
                    <div className="mb-4">
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Timeline</p>
                      <div className="space-y-2">
                        {project.start_date && (
                          <div className="flex items-center gap-2 text-sm">
                            <span className="material-symbols-outlined text-[16px] text-green-500">play_circle</span>
                            <span className="text-zinc-600 dark:text-zinc-400">Started:</span>
                            <span className="text-zinc-900 dark:text-zinc-100 font-medium">
                              {format(new Date(project.start_date), 'MMM d, yyyy')}
                            </span>
                          </div>
                        )}
                        {project.target_date && (
                          <div className="flex items-center gap-2 text-sm">
                            <span className={cn(
                              'material-symbols-outlined text-[16px]',
                              isPast(new Date(project.target_date)) && !isToday(new Date(project.target_date)) && project.status !== 'completed'
                                ? 'text-red-500'
                                : 'text-blue-500'
                            )}>
                              flag
                            </span>
                            <span className="text-zinc-600 dark:text-zinc-400">Target:</span>
                            <span className={cn(
                              'font-medium',
                              isPast(new Date(project.target_date)) && !isToday(new Date(project.target_date)) && project.status !== 'completed'
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-zinc-900 dark:text-zinc-100'
                            )}>
                              {format(new Date(project.target_date), 'MMM d, yyyy')}
                            </span>
                          </div>
                        )}
                      </div>
                      {/* Timeline Visual */}
                      {project.start_date && project.target_date && (
                        <div className="mt-3">
                          <div className="h-1.5 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                            {(() => {
                              const start = new Date(project.start_date).getTime()
                              const end = new Date(project.target_date).getTime()
                              const now = Date.now()
                              const progress = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100))
                              return (
                                <div
                                  className={cn(
                                    'h-full rounded-full transition-all',
                                    progress >= 100 ? 'bg-red-500' : 'bg-blue-500'
                                  )}
                                  style={{ width: `${progress}%` }}
                                />
                              )
                            })()}
                          </div>
                          <div className="flex justify-between text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                            <span>Start</span>
                            <span>Today</span>
                            <span>Due</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                    <span className="material-symbols-outlined text-[16px]">history</span>
                    <span>Created {format(new Date(project.created_at), 'MMM d, yyyy')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                    <span className="material-symbols-outlined text-[16px]">update</span>
                    <span>Updated {formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })}</span>
                  </div>
                </div>

                {/* Quick Links */}
                <div className="border-t border-zinc-100 dark:border-zinc-700 pt-4 mt-4">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Quick Links</p>
                  <div className="space-y-1">
                    <button
                      onClick={() => setActiveTab('tasks')}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 rounded-lg transition-colors text-left"
                    >
                      <span className="material-symbols-outlined text-[16px] text-cyan-500">task_alt</span>
                      View all tasks
                      <span className="ml-auto text-xs text-zinc-400">{project.tasks.length}</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('calendar')}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 rounded-lg transition-colors text-left"
                    >
                      <span className="material-symbols-outlined text-[16px] text-amber-500">calendar_month</span>
                      View calendar
                      <span className="ml-auto text-xs text-zinc-400">{project.events.length}</span>
                    </button>
                    <button
                      onClick={() => router.push(`/projects/${projectId}/settings`)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 rounded-lg transition-colors text-left"
                    >
                      <span className="material-symbols-outlined text-[16px] text-zinc-400">settings</span>
                      Project settings
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity Feed */}
            <div className="lg:col-span-2 bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Recent Activity</h3>
                <span className="material-symbols-outlined text-zinc-400 text-[20px]">history</span>
              </div>
              {(() => {
                // Generate activity feed from project data
                const activities: { type: string; title: string; time: Date; icon: string; color: string }[] = []

                // Add file activities
                project.files.slice(0, 3).forEach(file => {
                  activities.push({
                    type: 'file',
                    title: `${file.is_folder ? 'Folder' : 'File'} "${file.file_name}" uploaded`,
                    time: new Date(file.uploaded_at),
                    icon: file.is_folder ? 'folder' : 'upload_file',
                    color: 'text-green-500'
                  })
                })

                // Add task activities
                project.tasks.slice(0, 2).forEach(task => {
                  activities.push({
                    type: 'task',
                    title: `Task "${task.task.title}" ${task.task.completed ? 'completed' : 'added'}`,
                    time: new Date(task.added_at),
                    icon: task.task.completed ? 'task_alt' : 'add_task',
                    color: task.task.completed ? 'text-green-500' : 'text-cyan-500'
                  })
                })

                // Add note activities
                project.notes.slice(0, 2).forEach(note => {
                  activities.push({
                    type: 'note',
                    title: `Note "${note.note.title}" linked`,
                    time: new Date(note.added_at),
                    icon: 'note_add',
                    color: 'text-purple-500'
                  })
                })

                // Add event activities
                project.events.slice(0, 2).forEach(event => {
                  activities.push({
                    type: 'event',
                    title: `Event "${event.title}" scheduled`,
                    time: new Date(event.created_at),
                    icon: 'event',
                    color: 'text-amber-500'
                  })
                })

                // Sort by time and take top 5
                const sortedActivities = activities
                  .sort((a, b) => b.time.getTime() - a.time.getTime())
                  .slice(0, 5)

                if (sortedActivities.length === 0) {
                  return (
                    <div className="text-center py-8 px-4">
                      <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center">
                        <span className="material-symbols-outlined text-zinc-400 text-[24px]">update</span>
                      </div>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">No recent activity</p>
                      <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                        Activity will appear here as you work
                      </p>
                    </div>
                  )
                }

                return (
                  <div className="space-y-3">
                    {sortedActivities.map((activity, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-3 p-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors group"
                      >
                        <div className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                          activity.type === 'file' && 'bg-green-100 dark:bg-green-900/30',
                          activity.type === 'task' && 'bg-cyan-100 dark:bg-cyan-900/30',
                          activity.type === 'note' && 'bg-purple-100 dark:bg-purple-900/30',
                          activity.type === 'event' && 'bg-amber-100 dark:bg-amber-900/30'
                        )}>
                          <span className={cn('material-symbols-outlined text-[16px]', activity.color)}>
                            {activity.icon}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-zinc-700 dark:text-zinc-300 truncate">
                            {activity.title}
                          </p>
                          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
                            {formatDistanceToNow(activity.time, { addSuffix: true })}
                          </p>
                        </div>
                        <span className="material-symbols-outlined text-zinc-300 dark:text-zinc-600 text-[16px] opacity-0 group-hover:opacity-100 transition-opacity">
                          chevron_right
                        </span>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>

            {/* Upcoming Events */}
            <div className="lg:col-span-1 bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Upcoming Events</h3>
                {project.events.length > 0 && (
                  <button
                    onClick={() => setActiveTab('calendar')}
                    className="text-sm text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 font-medium"
                  >
                    View all
                  </button>
                )}
              </div>
              {project.events.length === 0 ? (
                <div className="text-center py-8 px-4 bg-gradient-to-br from-amber-50/50 to-orange-50/50 dark:from-amber-900/10 dark:to-orange-900/10 rounded-xl border-2 border-dashed border-amber-200 dark:border-amber-700/40">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[24px] text-amber-500">calendar_month</span>
                  </div>
                  <h4 className="text-base font-medium text-zinc-900 dark:text-zinc-100 mb-1">No events</h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
                    Schedule milestones and deadlines
                  </p>
                  <button
                    onClick={() => setShowEventModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg text-sm font-medium hover:from-amber-600 hover:to-orange-600 transition-all shadow-sm hover:shadow-md"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    Add Event
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {project.events.slice(0, 4).map(event => (
                    <div
                      key={event.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-700/50 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer group"
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${EVENT_TYPE_INFO[event.event_type].color}20` }}
                      >
                        <span
                          className="material-symbols-outlined text-[16px]"
                          style={{ color: EVENT_TYPE_INFO[event.event_type].color }}
                        >
                          {EVENT_TYPE_INFO[event.event_type].icon}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{event.title}</p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {format(new Date(event.start_datetime), 'MMM d')}
                          {!event.all_day && `, ${format(new Date(event.start_datetime), 'h:mm a')}`}
                        </p>
                      </div>
                    </div>
                  ))}
                  {project.events.length > 4 && (
                    <button
                      onClick={() => setActiveTab('calendar')}
                      className="w-full text-center py-2 text-xs text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 font-medium"
                    >
                      +{project.events.length - 4} more events
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* AI Suggestions Section */}
            <div className="lg:col-span-3 bg-gradient-to-br from-violet-50 via-purple-50 to-indigo-50 dark:from-violet-900/20 dark:via-purple-900/20 dark:to-indigo-900/20 rounded-2xl border border-violet-200 dark:border-violet-800/50 p-6 relative overflow-hidden">
              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-violet-400/20 to-transparent rounded-full blur-2xl" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-indigo-400/20 to-transparent rounded-full blur-2xl" />

              <div className="relative">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                    <span className="material-symbols-outlined text-white">auto_awesome</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">AI Suggestions</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Smart recommendations for your project</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Task Suggestions */}
                  {project.tasks.length === 0 && (
                    <button
                      onClick={() => { loadAvailableTasks(); setShowTaskLinker(true) }}
                      className="p-4 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm rounded-xl border border-violet-200 dark:border-violet-700/50 hover:border-violet-400 dark:hover:border-violet-500 transition-all group text-left"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-blue-500 text-[20px]">lightbulb</span>
                        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Get Started</span>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">Link tasks to track progress and stay organized</p>
                    </button>
                  )}

                  {/* Deadline Suggestion */}
                  {!project.target_date && (
                    <button
                      onClick={() => {/* Could open settings */}}
                      className="p-4 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm rounded-xl border border-violet-200 dark:border-violet-700/50 hover:border-violet-400 dark:hover:border-violet-500 transition-all group text-left"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-orange-500 text-[20px]">schedule</span>
                        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Set a Deadline</span>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">Add a target date to track project timeline</p>
                    </button>
                  )}

                  {/* Milestone Suggestion */}
                  {project.events.filter(e => e.event_type === 'milestone').length === 0 && (
                    <button
                      onClick={() => setShowEventModal(true)}
                      className="p-4 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm rounded-xl border border-violet-200 dark:border-violet-700/50 hover:border-violet-400 dark:hover:border-violet-500 transition-all group text-left"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-purple-500 text-[20px]">flag</span>
                        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Add Milestones</span>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">Break your project into key milestones</p>
                    </button>
                  )}

                  {/* Notes Suggestion */}
                  {project.notes.length === 0 && (
                    <button
                      onClick={() => { loadAvailableNotes(); setShowNoteLinker(true) }}
                      className="p-4 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm rounded-xl border border-violet-200 dark:border-violet-700/50 hover:border-violet-400 dark:hover:border-violet-500 transition-all group text-left"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-emerald-500 text-[20px]">description</span>
                        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Add Documentation</span>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">Link notes for project documentation</p>
                    </button>
                  )}

                  {/* Progress Suggestion */}
                  {project.tasks.length > 0 && project.progress.progress_percent < 50 && (
                    <button
                      onClick={() => setActiveTab('tasks')}
                      className="p-4 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm rounded-xl border border-violet-200 dark:border-violet-700/50 hover:border-violet-400 dark:hover:border-violet-500 transition-all group text-left"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-cyan-500 text-[20px]">trending_up</span>
                        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Boost Progress</span>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">{project.progress.total_tasks - project.progress.completed_tasks} tasks remaining - complete them to reach 50%</p>
                    </button>
                  )}

                  {/* Completed State */}
                  {project.tasks.length > 0 && project.notes.length > 0 && project.events.length > 0 && project.progress.progress_percent >= 50 && (
                    <div className="p-4 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm rounded-xl border border-green-200 dark:border-green-700/50 md:col-span-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                          <span className="material-symbols-outlined text-green-600 dark:text-green-400">check_circle</span>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Great Progress!</span>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">Your project is well-organized with {project.tasks.length} tasks, {project.notes.length} notes, and {project.events.length} events</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tasks Tab */}
        {activeTab === 'tasks' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Linked Tasks ({project.tasks.length})
              </h3>
              <button
                onClick={() => {
                  loadAvailableTasks()
                  setShowTaskLinker(true)
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-xl font-medium hover:bg-cyan-600 transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">add_link</span>
                Link Task
              </button>
            </div>

            {project.tasks.length === 0 ? (
              <div className="text-center py-16 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl">
                <span className="material-symbols-outlined text-[48px] text-zinc-300 dark:text-zinc-600 mb-4">
                  check_box_outline_blank
                </span>
                <p className="text-zinc-500 dark:text-zinc-400 mb-4">No tasks linked to this project</p>
                <button
                  onClick={() => {
                    loadAvailableTasks()
                    setShowTaskLinker(true)
                  }}
                  className="text-cyan-600 dark:text-cyan-400 font-medium hover:underline"
                >
                  Link your first task
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {project.tasks.map(({ task, link_id, task_id }) => (
                  <div
                    key={link_id}
                    className={cn(
                      'flex items-center gap-4 p-4 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 group',
                      task.completed && 'opacity-60'
                    )}
                  >
                    <span className={cn(
                      'material-symbols-outlined text-[24px]',
                      task.completed ? 'text-green-500' : 'text-zinc-300 dark:text-zinc-600'
                    )}>
                      {task.completed ? 'check_circle' : 'radio_button_unchecked'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'font-medium text-zinc-900 dark:text-zinc-100',
                        task.completed && 'line-through'
                      )}>
                        {task.title}
                      </p>
                      <div className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
                        <span className={cn(
                          'px-2 py-0.5 rounded-full text-xs',
                          task.priority === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' :
                          task.priority === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' :
                          'bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400'
                        )}>
                          {task.priority}
                        </span>
                        {task.due_date && (
                          <span className={cn(
                            isPast(new Date(task.due_date)) && !task.completed
                              ? 'text-red-600 dark:text-red-400'
                              : ''
                          )}>
                            Due {format(new Date(task.due_date), 'MMM d')}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleUnlinkTask(task_id)}
                      className="opacity-0 group-hover:opacity-100 p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all"
                    >
                      <span className="material-symbols-outlined text-[18px]">link_off</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Notes Tab */}
        {activeTab === 'notes' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Linked Notes ({project.notes.length})
              </h3>
              <button
                onClick={() => {
                  loadAvailableNotes()
                  setShowNoteLinker(true)
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-xl font-medium hover:bg-cyan-600 transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">add_link</span>
                Link Note
              </button>
            </div>

            {project.notes.length === 0 ? (
              <div className="text-center py-16 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl">
                <span className="material-symbols-outlined text-[48px] text-zinc-300 dark:text-zinc-600 mb-4">
                  note_stack
                </span>
                <p className="text-zinc-500 dark:text-zinc-400 mb-4">No notes linked to this project</p>
                <button
                  onClick={() => {
                    loadAvailableNotes()
                    setShowNoteLinker(true)
                  }}
                  className="text-cyan-600 dark:text-cyan-400 font-medium hover:underline"
                >
                  Link your first note
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {project.notes.map(({ note, link_id, note_id }) => (
                  <div
                    key={link_id}
                    className="p-4 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 group cursor-pointer hover:border-cyan-300 dark:hover:border-cyan-600 transition-colors"
                    onClick={() => router.push(`/notes?note=${note_id}`)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-zinc-900 dark:text-zinc-100 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                        {note.title || 'Untitled Note'}
                      </h4>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleUnlinkNote(note_id)
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all"
                      >
                        <span className="material-symbols-outlined text-[16px]">link_off</span>
                      </button>
                    </div>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2">
                      {typeof note.content === 'string' ? note.content : 'No preview available'}
                    </p>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-2">
                      Updated {formatDistanceToNow(new Date(note.updated_at), { addSuffix: true })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Calendar Tab */}
        {activeTab === 'calendar' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Events & Milestones ({project.events.length})
              </h3>
              <button
                onClick={() => setShowEventModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-xl font-medium hover:bg-cyan-600 transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">add</span>
                Add Event
              </button>
            </div>

            {project.events.length === 0 ? (
              <div className="text-center py-16 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl">
                <span className="material-symbols-outlined text-[48px] text-zinc-300 dark:text-zinc-600 mb-4">
                  event_busy
                </span>
                <p className="text-zinc-500 dark:text-zinc-400 mb-4">No events scheduled</p>
                <button
                  onClick={() => setShowEventModal(true)}
                  className="text-cyan-600 dark:text-cyan-400 font-medium hover:underline"
                >
                  Create your first event
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {project.events.map(event => (
                  <div
                    key={event.id}
                    className="flex items-center gap-4 p-4 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 group"
                  >
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${EVENT_TYPE_INFO[event.event_type].color}20` }}
                    >
                      <span
                        className="material-symbols-outlined text-[24px]"
                        style={{ color: EVENT_TYPE_INFO[event.event_type].color }}
                      >
                        {EVENT_TYPE_INFO[event.event_type].icon}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-zinc-900 dark:text-zinc-100">{event.title}</h4>
                      <div className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
                        <span>{format(new Date(event.start_datetime), 'EEEE, MMMM d, yyyy')}</span>
                        {!event.all_day && (
                          <span>{format(new Date(event.start_datetime), 'h:mm a')}</span>
                        )}
                        {event.location && (
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">location_on</span>
                            {event.location}
                          </span>
                        )}
                      </div>
                    </div>
                    <span
                      className="px-3 py-1 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: `${EVENT_TYPE_INFO[event.event_type].color}20`,
                        color: EVENT_TYPE_INFO[event.event_type].color
                      }}
                    >
                      {EVENT_TYPE_INFO[event.event_type].label}
                    </span>
                    <button
                      onClick={() => handleDeleteEvent(event.id)}
                      className="opacity-0 group-hover:opacity-100 p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Files Tab */}
        {activeTab === 'files' && (
          <div>
            {/* Header with breadcrumbs and actions */}
            <div className="flex flex-col gap-4 mb-4">
              {/* Breadcrumb Navigation */}
              <div className="flex items-center gap-2 text-sm">
                <button
                  onClick={() => handleBreadcrumbClick(-1)}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded-lg transition-colors",
                    currentFolderPath === ''
                      ? "text-cyan-600 dark:text-cyan-400 font-medium"
                      : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  )}
                >
                  <span className="material-symbols-outlined text-[18px]">home</span>
                  Root
                </button>
                {currentFolderPath.split('/').filter(Boolean).map((folder, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-zinc-300 dark:text-zinc-600">/</span>
                    <button
                      onClick={() => handleBreadcrumbClick(index)}
                      className={cn(
                        "px-2 py-1 rounded-lg transition-colors",
                        index === currentFolderPath.split('/').filter(Boolean).length - 1
                          ? "text-cyan-600 dark:text-cyan-400 font-medium"
                          : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      )}
                    >
                      {folder}
                    </button>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {currentFolderPath && (
                    <button
                      onClick={handleNavigateUp}
                      className="inline-flex items-center gap-1 px-3 py-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                    >
                      <span className="material-symbols-outlined text-[20px]">arrow_upward</span>
                      Up
                    </button>
                  )}
                  <button
                    onClick={() => setShowCreateFolderModal(true)}
                    disabled={isDemo}
                    className="inline-flex items-center gap-2 px-3 py-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[20px]">create_new_folder</span>
                    New Folder
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  {/* Hidden file inputs */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <input
                    ref={folderInputRef}
                    type="file"
                    // @ts-ignore - webkitdirectory is not in types but widely supported
                    webkitdirectory=""
                    // @ts-ignore
                    directory=""
                    multiple
                    onChange={handleFolderUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => folderInputRef.current?.click()}
                    disabled={isUploading || isDemo}
                    className="inline-flex items-center gap-2 px-3 py-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[20px]">drive_folder_upload</span>
                    Upload Folder
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading || isDemo}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-xl font-medium hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isUploading ? (
                      <>
                        <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
                        {uploadProgress.total > 0 ? `${uploadProgress.current}/${uploadProgress.total}` : 'Uploading...'}
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[20px]">upload_file</span>
                        Upload Files
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Drag and drop zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                "relative rounded-2xl transition-all min-h-[300px]",
                isDragging
                  ? "bg-cyan-50 dark:bg-cyan-900/20 border-2 border-dashed border-cyan-500"
                  : "bg-zinc-50 dark:bg-zinc-800/50 border-2 border-dashed border-zinc-200 dark:border-zinc-700"
              )}
            >
              {/* Drag overlay */}
              {isDragging && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                  <span className="material-symbols-outlined text-[64px] text-cyan-500 mb-4">cloud_upload</span>
                  <p className="text-lg font-medium text-cyan-600 dark:text-cyan-400">Drop files or folders here</p>
                  <p className="text-sm text-cyan-500/70">Files will be uploaded to current folder</p>
                </div>
              )}

              {/* Files and folders grid */}
              {!isDragging && (
                <div className="p-4">
                  {isLoadingFiles ? (
                    <div className="flex items-center justify-center py-16">
                      <span className="material-symbols-outlined text-[32px] text-zinc-400 animate-spin">progress_activity</span>
                    </div>
                  ) : isDemo ? (
                    // Demo mode: show project.files
                    project.files.length === 0 ? (
                      <div className="text-center py-16">
                        <span className="material-symbols-outlined text-[48px] text-zinc-300 dark:text-zinc-600 mb-4">folder_open</span>
                        <p className="text-zinc-500 dark:text-zinc-400 mb-2">This folder is empty</p>
                        <p className="text-sm text-zinc-400 dark:text-zinc-500">Drag and drop files or folders here, or use the buttons above</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {project.files.map(file => (
                          <div
                            key={file.id}
                            className="flex flex-col items-center p-4 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:border-cyan-300 dark:hover:border-cyan-600 hover:shadow-md transition-all cursor-pointer group"
                          >
                            <div className="w-12 h-12 rounded-lg bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center mb-2">
                              <span className="material-symbols-outlined text-[28px] text-zinc-500 dark:text-zinc-400">
                                {getFileIcon(file.file_type)}
                              </span>
                            </div>
                            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 text-center truncate w-full" title={file.file_name}>
                              {file.file_name}
                            </p>
                            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                              {formatFileSize(file.file_size)}
                            </p>
                            <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              {!file.is_folder && (
                                <>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handlePreviewFile(file); }}
                                    className="p-1.5 text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/30 rounded-lg transition-colors"
                                    title="Preview"
                                  >
                                    <span className="material-symbols-outlined text-[18px]">visibility</span>
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleDownloadFile(file); }}
                                    className="p-1.5 text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-900/30 rounded-lg transition-colors"
                                    title="Download"
                                  >
                                    <span className="material-symbols-outlined text-[18px]">download</span>
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleOpenInNotes(file); }}
                                    className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors"
                                    title="Open in Notes"
                                  >
                                    <span className="material-symbols-outlined text-[18px]">edit_note</span>
                                  </button>
                                </>
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteFile(file); }}
                                className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                title="Delete"
                              >
                                <span className="material-symbols-outlined text-[18px]">delete</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  ) : folderFiles.length === 0 ? (
                    <div className="text-center py-16">
                      <span className="material-symbols-outlined text-[48px] text-zinc-300 dark:text-zinc-600 mb-4">folder_open</span>
                      <p className="text-zinc-500 dark:text-zinc-400 mb-2">This folder is empty</p>
                      <p className="text-sm text-zinc-400 dark:text-zinc-500">Drag and drop files or folders here, or use the buttons above</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                      {folderFiles.map(item => (
                        <div
                          key={item.id}
                          onClick={() => item.is_folder && handleNavigateToFolder(item.file_name)}
                          className={cn(
                            "flex flex-col items-center p-4 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:border-cyan-300 dark:hover:border-cyan-600 hover:shadow-md transition-all group",
                            item.is_folder ? "cursor-pointer" : ""
                          )}
                        >
                          <div className={cn(
                            "w-12 h-12 rounded-lg flex items-center justify-center mb-2",
                            item.is_folder
                              ? "bg-amber-100 dark:bg-amber-900/30"
                              : "bg-zinc-100 dark:bg-zinc-700"
                          )}>
                            <span className={cn(
                              "material-symbols-outlined text-[28px]",
                              item.is_folder
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-zinc-500 dark:text-zinc-400"
                            )}>
                              {item.is_folder ? 'folder' : getFileIcon(item.file_type)}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 text-center truncate w-full" title={item.file_name}>
                            {item.file_name}
                          </p>
                          {!item.is_folder && (
                            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                              {formatFileSize(item.file_size)}
                            </p>
                          )}
                          <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!item.is_folder && (
                              <>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handlePreviewFile(item); }}
                                  className="p-1.5 text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/30 rounded-lg transition-colors"
                                  title="Preview"
                                >
                                  <span className="material-symbols-outlined text-[18px]">visibility</span>
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDownloadFile(item); }}
                                  className="p-1.5 text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-900/30 rounded-lg transition-colors"
                                  title="Download"
                                >
                                  <span className="material-symbols-outlined text-[18px]">download</span>
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleOpenInNotes(item); }}
                                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors"
                                  title="Open in Notes"
                                >
                                  <span className="material-symbols-outlined text-[18px]">edit_note</span>
                                </button>
                              </>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                if (item.is_folder) {
                                  handleDeleteFolder(item)
                                } else {
                                  handleDeleteFile(item)
                                }
                              }}
                              className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Task Linker Modal */}
      {showTaskLinker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-800 rounded-2xl w-full max-w-md shadow-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Link Task</h2>
              <button
                onClick={() => setShowTaskLinker(false)}
                className="p-2 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {availableTasks.length === 0 ? (
                <p className="text-center text-zinc-500 dark:text-zinc-400 py-8">
                  No available tasks to link
                </p>
              ) : (
                <div className="space-y-2">
                  {availableTasks.map(task => (
                    <button
                      key={task.id}
                      onClick={() => handleLinkTask(task.id)}
                      disabled={isSaving}
                      className="w-full text-left p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:border-cyan-300 dark:hover:border-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 transition-colors disabled:opacity-50"
                    >
                      <p className="font-medium text-zinc-900 dark:text-zinc-100">{task.title}</p>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        {task.priority} priority
                        {task.due_date && ` • Due ${format(new Date(task.due_date), 'MMM d')}`}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Note Linker Modal */}
      {showNoteLinker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-800 rounded-2xl w-full max-w-md shadow-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Link Note</h2>
              <button
                onClick={() => setShowNoteLinker(false)}
                className="p-2 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {availableNotes.length === 0 ? (
                <p className="text-center text-zinc-500 dark:text-zinc-400 py-8">
                  No available notes to link
                </p>
              ) : (
                <div className="space-y-2">
                  {availableNotes.map(note => (
                    <button
                      key={note.id}
                      onClick={() => handleLinkNote(note.id)}
                      disabled={isSaving}
                      className="w-full text-left p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:border-cyan-300 dark:hover:border-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 transition-colors disabled:opacity-50"
                    >
                      <p className="font-medium text-zinc-900 dark:text-zinc-100">{note.title || 'Untitled Note'}</p>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-1">
                        {note.content_text || 'No content'}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Event Modal */}
      {showEventModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-800 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Add Event</h2>
              <button
                onClick={() => setShowEventModal(false)}
                className="p-2 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Title *</label>
                <input
                  type="text"
                  value={eventForm.title}
                  onChange={(e) => setEventForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Event title..."
                  className="w-full px-4 py-2.5 border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Type</label>
                <select
                  value={eventForm.event_type}
                  onChange={(e) => setEventForm(prev => ({ ...prev, event_type: e.target.value as CalendarEventType }))}
                  className="w-full px-4 py-2.5 border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
                >
                  <option value="event">Event</option>
                  <option value="meeting">Meeting</option>
                  <option value="milestone">Milestone</option>
                  <option value="deadline">Deadline</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Start *</label>
                  <input
                    type="datetime-local"
                    value={eventForm.start_datetime}
                    onChange={(e) => setEventForm(prev => ({ ...prev, start_datetime: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">End</label>
                  <input
                    type="datetime-local"
                    value={eventForm.end_datetime}
                    onChange={(e) => setEventForm(prev => ({ ...prev, end_datetime: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Location</label>
                <input
                  type="text"
                  value={eventForm.location}
                  onChange={(e) => setEventForm(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="Optional location..."
                  className="w-full px-4 py-2.5 border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Description</label>
                <textarea
                  value={eventForm.description}
                  onChange={(e) => setEventForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional description..."
                  rows={2}
                  className="w-full px-4 py-2.5 border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none resize-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="all-day"
                  checked={eventForm.all_day}
                  onChange={(e) => setEventForm(prev => ({ ...prev, all_day: e.target.checked }))}
                  className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-cyan-600 focus:ring-cyan-500"
                />
                <label htmlFor="all-day" className="text-sm text-zinc-700 dark:text-zinc-300">All day event</label>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-700 flex justify-end gap-3">
              <button
                onClick={() => setShowEventModal(false)}
                className="px-4 py-2 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-xl font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateEvent}
                disabled={isSaving || !eventForm.title.trim() || !eventForm.start_datetime}
                className="px-6 py-2 bg-cyan-500 text-white rounded-xl font-medium hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Creating...' : 'Create Event'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Folder Modal */}
      {showCreateFolderModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-800 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Create New Folder</h2>
              <button
                onClick={() => {
                  setShowCreateFolderModal(false)
                  setNewFolderName('')
                }}
                className="p-2 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Folder Name
                </label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                  placeholder="Enter folder name..."
                  autoFocus
                  className="w-full px-4 py-2.5 border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
                />
              </div>
              {currentFolderPath && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                  Creating in: <span className="font-medium text-zinc-700 dark:text-zinc-300">/{currentFolderPath}</span>
                </p>
              )}
            </div>
            <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-700 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateFolderModal(false)
                  setNewFolderName('')
                }}
                className="px-4 py-2 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-xl font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFolder}
                disabled={isCreatingFolder || !newFolderName.trim()}
                className="px-6 py-2 bg-cyan-500 text-white rounded-xl font-medium hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreatingFolder ? 'Creating...' : 'Create Folder'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={handleClosePreview}>
          <div
            className="bg-white dark:bg-zinc-800 rounded-2xl w-full max-w-4xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center",
                  isImageFile(previewFile.file_type, previewFile.file_name) ? "bg-violet-100 dark:bg-violet-900/30" :
                  isVideoFile(previewFile.file_type, previewFile.file_name) ? "bg-rose-100 dark:bg-rose-900/30" :
                  isAudioFile(previewFile.file_type, previewFile.file_name) ? "bg-purple-100 dark:bg-purple-900/30" :
                  isTextFile(previewFile.file_type, previewFile.file_name) ? "bg-emerald-100 dark:bg-emerald-900/30" :
                  "bg-zinc-100 dark:bg-zinc-700"
                )}>
                  <span className={cn(
                    "material-symbols-outlined",
                    isImageFile(previewFile.file_type, previewFile.file_name) ? "text-violet-600 dark:text-violet-400" :
                    isVideoFile(previewFile.file_type, previewFile.file_name) ? "text-rose-600 dark:text-rose-400" :
                    isAudioFile(previewFile.file_type, previewFile.file_name) ? "text-purple-600 dark:text-purple-400" :
                    isTextFile(previewFile.file_type, previewFile.file_name) ? "text-emerald-600 dark:text-emerald-400" :
                    "text-zinc-500 dark:text-zinc-400"
                  )}>
                    {getFileIcon(previewFile.file_type)}
                  </span>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 line-clamp-1">{previewFile.file_name}</h2>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {formatFileSize(previewFile.file_size)}
                    {previewFile.file_type && ` • ${previewFile.file_type}`}
                  </p>
                </div>
              </div>
              <button
                onClick={handleClosePreview}
                className="p-2 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
              {isLoadingPreview ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-cyan-500 border-t-transparent" />
                </div>
              ) : isImageFile(previewFile.file_type, previewFile.file_name) && previewUrl ? (
                /* Image Preview */
                <div className="flex items-center justify-center">
                  <img
                    src={previewUrl}
                    alt={previewFile.file_name}
                    className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-lg"
                  />
                </div>
              ) : isPdfFile(previewFile.file_type, previewFile.file_name) && previewUrl ? (
                /* PDF Preview */
                <iframe
                  src={previewUrl}
                  className="w-full h-[60vh] rounded-lg border border-zinc-200 dark:border-zinc-700"
                  title={previewFile.file_name}
                />
              ) : isVideoFile(previewFile.file_type, previewFile.file_name) && previewUrl ? (
                /* Video Preview */
                <div className="flex items-center justify-center">
                  <video
                    src={previewUrl}
                    controls
                    className="max-w-full max-h-[60vh] rounded-lg shadow-lg"
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
              ) : isAudioFile(previewFile.file_type, previewFile.file_name) && previewUrl ? (
                /* Audio Preview */
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mb-6 shadow-lg">
                    <span className="material-symbols-outlined text-[48px] text-white">music_note</span>
                  </div>
                  <p className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-6">
                    {previewFile.file_name}
                  </p>
                  <audio
                    src={previewUrl}
                    controls
                    className="w-full max-w-md"
                  >
                    Your browser does not support the audio tag.
                  </audio>
                </div>
              ) : isMarkdownFile(previewFile.file_name) && previewTextContent ? (
                /* Markdown Preview - Rendered with comprehensive parser */
                <div className="prose prose-zinc dark:prose-invert max-w-none">
                  <div
                    className="markdown-content"
                    dangerouslySetInnerHTML={{
                      __html: markdownToHtml(previewTextContent)
                    }}
                  />
                </div>
              ) : isTextFile(previewFile.file_type, previewFile.file_name) && previewTextContent ? (
                /* Code/Text Preview */
                <div className="relative">
                  <div className="absolute top-2 right-2 px-2 py-1 bg-zinc-200 dark:bg-zinc-600 rounded text-xs font-medium text-zinc-600 dark:text-zinc-300">
                    {getCodeLanguage(previewFile.file_name).toUpperCase()}
                  </div>
                  <pre className="bg-zinc-900 dark:bg-zinc-950 text-zinc-100 p-4 rounded-xl overflow-auto max-h-[60vh] text-sm font-mono leading-relaxed">
                    <code>{previewTextContent}</code>
                  </pre>
                </div>
              ) : isOfficeFile(previewFile.file_type, previewFile.file_name) && previewUrl ? (
                /* Office Document Preview via Google Docs Viewer */
                <iframe
                  src={`https://docs.google.com/viewer?url=${encodeURIComponent(previewUrl)}&embedded=true`}
                  className="w-full h-[60vh] rounded-lg border border-zinc-200 dark:border-zinc-700"
                  title={previewFile.file_name}
                />
              ) : (
                /* Fallback for unsupported file types */
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-20 h-20 rounded-2xl bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center mb-4">
                    <span className="material-symbols-outlined text-[40px] text-zinc-400">
                      {getFileIcon(previewFile.file_type)}
                    </span>
                  </div>
                  <p className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-2">
                    {previewFile.file_name}
                  </p>
                  <p className="text-zinc-500 dark:text-zinc-400 text-center max-w-md mb-6">
                    This file type cannot be previewed directly. You can download it or open it in Notes.
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleDownloadFile(previewFile)}
                      className="flex items-center gap-2 px-4 py-2.5 bg-cyan-500 text-white rounded-xl font-medium hover:bg-cyan-600 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[20px]">download</span>
                      Download
                    </button>
                    <button
                      onClick={() => {
                        handleOpenInNotes(previewFile)
                        handleClosePreview()
                      }}
                      className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[20px]">edit_note</span>
                      Open in Notes
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer with actions (for all previewable files) */}
            {(isImageFile(previewFile.file_type, previewFile.file_name) ||
              isPdfFile(previewFile.file_type, previewFile.file_name) ||
              isVideoFile(previewFile.file_type, previewFile.file_name) ||
              isAudioFile(previewFile.file_type, previewFile.file_name) ||
              isTextFile(previewFile.file_type, previewFile.file_name) ||
              isOfficeFile(previewFile.file_type, previewFile.file_name)) && previewUrl && (
              <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-700 flex justify-between items-center">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Uploaded {formatDistanceToNow(new Date(previewFile.uploaded_at), { addSuffix: true })}
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      handleOpenInNotes(previewFile)
                      handleClosePreview()
                    }}
                    className="flex items-center gap-2 px-4 py-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-xl font-medium transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">edit_note</span>
                    Open in Notes
                  </button>
                  <button
                    onClick={() => handleDownloadFile(previewFile)}
                    className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-xl font-medium hover:bg-cyan-600 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">download</span>
                    Download
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Modal */}
      {showKeyboardHelp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowKeyboardHelp(false)}>
          <div
            className="bg-white dark:bg-zinc-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-white">keyboard</span>
                </div>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Keyboard Shortcuts</h2>
              </div>
              <button
                onClick={() => setShowKeyboardHelp(false)}
                className="p-2 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">Quick Actions</h3>
                <div className="space-y-2">
                  {[
                    { key: 'T', action: 'Add Task', icon: 'add_task', color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400' },
                    { key: 'N', action: 'Add Note', icon: 'note_add', color: 'bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400' },
                    { key: 'E', action: 'Add Event', icon: 'event', color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400' },
                    { key: 'U', action: 'Upload File', icon: 'upload_file', color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400' },
                  ].map(({ key, action, icon, color }) => (
                    <div key={key} className="flex items-center justify-between p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700/50">
                      <div className="flex items-center gap-3">
                        <span className={cn('material-symbols-outlined text-[18px] w-8 h-8 rounded-lg flex items-center justify-center', color)}>{icon}</span>
                        <span className="text-sm text-zinc-700 dark:text-zinc-300">{action}</span>
                      </div>
                      <kbd className="px-2.5 py-1 bg-zinc-100 dark:bg-zinc-700 rounded-lg text-xs font-mono font-semibold text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-600">{key}</kbd>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">Navigation</h3>
                <div className="space-y-2">
                  {[
                    { key: '1', action: 'Overview Tab' },
                    { key: '2', action: 'Tasks Tab' },
                    { key: '3', action: 'Notes Tab' },
                    { key: '4', action: 'Calendar Tab' },
                    { key: '5', action: 'Files Tab' },
                  ].map(({ key, action }) => (
                    <div key={key} className="flex items-center justify-between p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700/50">
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">{action}</span>
                      <kbd className="px-2.5 py-1 bg-zinc-100 dark:bg-zinc-700 rounded-lg text-xs font-mono font-semibold text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-600">{key}</kbd>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">General</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700/50">
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">Show this help</span>
                    <kbd className="px-2.5 py-1 bg-zinc-100 dark:bg-zinc-700 rounded-lg text-xs font-mono font-semibold text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-600">?</kbd>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700/50">
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">Close dialogs</span>
                    <kbd className="px-2.5 py-1 bg-zinc-100 dark:bg-zinc-700 rounded-lg text-xs font-mono font-semibold text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-600">Esc</kbd>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcut Hint - Fixed Position */}
      <button
        onClick={() => setShowKeyboardHelp(true)}
        className="fixed bottom-4 left-4 px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg hover:shadow-xl transition-all group z-40 flex items-center gap-2"
      >
        <span className="material-symbols-outlined text-[18px] text-zinc-500 dark:text-zinc-400 group-hover:text-violet-500">keyboard</span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-300">Press <kbd className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-700 rounded text-[10px] font-mono font-semibold mx-0.5">?</kbd> for shortcuts</span>
      </button>

      {/* Demo Banner */}
      {isDemo && (
        <div className="fixed bottom-4 right-4 left-4 sm:left-auto px-4 py-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-xl text-amber-800 dark:text-amber-200 text-sm shadow-lg z-50">
          <span className="font-medium">Demo Mode:</span> Changes are not saved.
        </div>
      )}
    </div>
  )
}
