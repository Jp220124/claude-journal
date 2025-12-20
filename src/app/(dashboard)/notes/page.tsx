'use client'

import { useState, useEffect, useCallback, useRef, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { isDemoAccount } from '@/lib/demo'
import {
  fetchNotes,
  fetchFoldersWithCounts,
  fetchNoteFolderTree,
  getRootNoteCount,
  getArchivedNoteCount,
  getNoteFolderPath,
  moveNotesToFolder,
  createNote,
  updateNote,
  deleteNote,
  toggleNotePin,
  toggleNoteArchive,
  moveNoteToFolder,
  createFolder,
  updateFolder,
  deleteFolder,
  hasNoteFolders,
  createStarterFolders,
  searchNotes,
  fetchTags,
  createTag,
  updateTag,
  deleteTag,
  addTagToNote,
  removeTagFromNote,
  getNoteTags,
} from '@/lib/notesService'
import { uploadNoteImage } from '@/lib/notes/imageUpload'
import {
  NotesEditor,
  TagSelector,
  TagsModal,
  LinkedTasksPanel,
  TaskLinker,
  NewNoteButton,
  RecentNotesList,
  NotesLoadingSkeleton,
  NotesErrorBoundary,
  NotesEmptyState,
} from '@/components/notes'
import { NoteFolderTree } from '@/components/notes/NoteFolderTree'
import { ShareNoteDialog } from '@/components/notes/ShareNoteDialog'
import type { LinkedTask } from '@/lib/notes/taskLinks'
import type { Note, NoteFolder, NoteFolderWithNotes, NoteTag, NoteFolderTreeNode, NoteBreadcrumbSegment } from '@/types/database'

// Demo data for non-authenticated users
const demoNotes: Note[] = [
  {
    id: 'demo-1',
    user_id: 'demo',
    title: 'Welcome to Notes',
    content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'This is a demo note. Create an account to save your notes!' }] }] },
    content_text: 'This is a demo note. Create an account to save your notes!',
    folder_id: null,
    is_pinned: true,
    is_archived: false,
    word_count: 12,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'demo-2',
    user_id: 'demo',
    title: 'Getting Started',
    content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Use notes to capture ideas, meeting notes, and more.' }] }] },
    content_text: 'Use notes to capture ideas, meeting notes, and more.',
    folder_id: null,
    is_pinned: false,
    is_archived: false,
    word_count: 10,
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date(Date.now() - 86400000).toISOString(),
  },
]

const demoFolders: NoteFolderWithNotes[] = [
  {
    id: 'demo-folder-1',
    user_id: 'demo',
    name: 'Personal',
    icon: 'person',
    color: '#0ea5e9',
    parent_folder_id: null,
    order_index: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    notes: [],
    note_count: 0,
  },
  {
    id: 'demo-folder-2',
    user_id: 'demo',
    name: 'Work',
    icon: 'work',
    color: '#f59e0b',
    parent_folder_id: null,
    order_index: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    notes: [],
    note_count: 0,
  },
  {
    id: 'demo-folder-3',
    user_id: 'demo',
    name: 'Ideas',
    icon: 'lightbulb',
    color: '#a855f7',
    parent_folder_id: null,
    order_index: 2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    notes: [],
    note_count: 0,
  },
]

const demoTags: NoteTag[] = [
  { id: 'demo-tag-1', user_id: 'demo', name: 'Important', color: '#ef4444', created_at: new Date().toISOString() },
  { id: 'demo-tag-2', user_id: 'demo', name: 'Ideas', color: '#f59e0b', created_at: new Date().toISOString() },
  { id: 'demo-tag-3', user_id: 'demo', name: 'Research', color: '#3b82f6', created_at: new Date().toISOString() },
]

// Demo folder tree with hierarchical structure
const demoFolderTree: NoteFolderTreeNode[] = [
  {
    id: 'demo-folder-1',
    user_id: 'demo',
    name: 'Personal',
    icon: 'person',
    color: '#0ea5e9',
    parent_folder_id: null,
    order_index: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    children: [
      {
        id: 'demo-folder-1-1',
        user_id: 'demo',
        name: 'Daily Journal',
        icon: 'edit_note',
        color: '#0ea5e9',
        parent_folder_id: 'demo-folder-1',
        order_index: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        children: [],
        note_count: 0,
        depth: 1,
      },
    ],
    note_count: 0,
    depth: 0,
  },
  {
    id: 'demo-folder-2',
    user_id: 'demo',
    name: 'Work',
    icon: 'work',
    color: '#f59e0b',
    parent_folder_id: null,
    order_index: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    children: [
      {
        id: 'demo-folder-2-1',
        user_id: 'demo',
        name: 'Projects',
        icon: 'folder',
        color: '#f59e0b',
        parent_folder_id: 'demo-folder-2',
        order_index: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        children: [],
        note_count: 0,
        depth: 1,
      },
      {
        id: 'demo-folder-2-2',
        user_id: 'demo',
        name: 'Meetings',
        icon: 'groups',
        color: '#f59e0b',
        parent_folder_id: 'demo-folder-2',
        order_index: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        children: [],
        note_count: 0,
        depth: 1,
      },
    ],
    note_count: 0,
    depth: 0,
  },
  {
    id: 'demo-folder-3',
    user_id: 'demo',
    name: 'Ideas',
    icon: 'lightbulb',
    color: '#a855f7',
    parent_folder_id: null,
    order_index: 2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    children: [],
    note_count: 0,
    depth: 0,
  },
]

function NotesPageContent() {
  const { user } = useAuthStore()
  const isDemo = isDemoAccount(user?.email)
  const searchParams = useSearchParams()
  const noteIdFromUrl = searchParams.get('note')

  const [notes, setNotes] = useState<Note[]>([])
  const [folders, setFolders] = useState<NoteFolderWithNotes[]>([])
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  // Panel state
  const [isPanelOpen, setIsPanelOpen] = useState(true)

  // Folder tree state
  const [folderTree, setFolderTree] = useState<NoteFolderTreeNode[]>([])
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set())
  const [breadcrumbPath, setBreadcrumbPath] = useState<NoteBreadcrumbSegment[]>([])
  const [rootNoteCount, setRootNoteCount] = useState(0)
  const [archivedNoteCount, setArchivedNoteCount] = useState(0)

  // Share dialog state
  const [showShareDialog, setShowShareDialog] = useState(false)

  // Tags state
  const [tags, setTags] = useState<NoteTag[]>([])
  const [selectedNoteTags, setSelectedNoteTags] = useState<NoteTag[]>([])
  const [showTagsModal, setShowTagsModal] = useState(false)

  // Task linking state
  const [showTaskLinker, setShowTaskLinker] = useState(false)
  const [linkedTaskIds, setLinkedTaskIds] = useState<string[]>([])
  const [linkedTasksKey, setLinkedTasksKey] = useState(0)

  // Folder management state
  const [showFolderModal, setShowFolderModal] = useState(false)
  const [editingFolder, setEditingFolder] = useState<NoteFolder | null>(null)
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderIcon, setNewFolderIcon] = useState('folder')
  const [newFolderColor, setNewFolderColor] = useState('#0ea5e9')

  const folderModalRef = useRef<HTMLDivElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const starterFoldersCreated = useRef(false)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  // Debounce saving indicator to prevent rapid flashing
  const savingDisplayTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Track if initial load has happened
  const initialLoadDone = useRef(false)
  const selectedNoteRef = useRef<Note | null>(null)

  // Keep ref in sync with state
  useEffect(() => {
    selectedNoteRef.current = selectedNote
  }, [selectedNote])

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      if (savingDisplayTimeoutRef.current) clearTimeout(savingDisplayTimeoutRef.current)
    }
  }, [])

  // Load data
  const loadData = useCallback(async (forceReload = false) => {
    if (isDemo) {
      setNotes(demoNotes)
      setFolders(demoFolders)
      setTags(demoTags)
      setFolderTree(demoFolderTree)
      setRootNoteCount(demoNotes.filter(n => !n.is_archived).length)
      setArchivedNoteCount(0)
      // Only auto-select on initial load (not when navigating folders)
      if (!selectedNoteRef.current && !initialLoadDone.current) {
        setSelectedNote(demoNotes[0])
      }
      initialLoadDone.current = true
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      // Check if user has folders, if not create starter ones
      if (!starterFoldersCreated.current) {
        const hasFolders = await hasNoteFolders()
        if (!hasFolders) {
          await createStarterFolders()
        }
        starterFoldersCreated.current = true
      }

      // Fetch folders, notes, tags, and folder tree in parallel
      // When viewing archive, don't filter by folderId - we want ALL archived notes
      const [foldersData, notesData, tagsData, treeData, rootCount, archiveCount] = await Promise.all([
        fetchFoldersWithCounts(),
        fetchNotes({
          folderId: showArchived ? undefined : selectedFolderId,
          includeArchived: showArchived,
          archivedOnly: showArchived,
        }),
        fetchTags(),
        fetchNoteFolderTree(),
        getRootNoteCount(),
        getArchivedNoteCount(),
      ])

      setFolders(foldersData)
      setNotes(notesData)
      setTags(tagsData)
      setFolderTree(treeData)
      setRootNoteCount(rootCount)
      setArchivedNoteCount(archiveCount)

      // Select first note ONLY on initial load (not when navigating folders)
      if (notesData.length > 0 && !selectedNoteRef.current && !initialLoadDone.current) {
        setSelectedNote(notesData[0])
      }
      initialLoadDone.current = true
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [isDemo, selectedFolderId, showArchived])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Update breadcrumb when folder changes
  useEffect(() => {
    const updateBreadcrumb = async () => {
      if (isDemo || !selectedFolderId) {
        setBreadcrumbPath([])
        return
      }
      const path = await getNoteFolderPath(selectedFolderId)
      setBreadcrumbPath(path)
    }
    updateBreadcrumb()
  }, [selectedFolderId, isDemo])

  // Handle note selection from URL query parameter (e.g., /notes?note=xxx)
  useEffect(() => {
    if (!noteIdFromUrl) return

    const selectNoteFromUrl = async () => {
      // First try to find in current notes list
      const noteFromUrl = notes.find(n => n.id === noteIdFromUrl)
      if (noteFromUrl) {
        // CRITICAL: Only update selectedNote if it's a DIFFERENT note
        // If the same note is already selected, DON'T overwrite it!
        // This prevents wiping unsaved editor changes when notes array updates (e.g., during search)
        if (selectedNoteRef.current?.id === noteFromUrl.id) {
          return // Same note already selected - preserve current state with unsaved changes
        }
        setSelectedNote(noteFromUrl)
        return
      }

      // If not found in current folder, fetch all notes to find it
      // But ONLY if the note isn't already selected (to preserve unsaved changes)
      if (notes.length > 0 && !isDemo && selectedNoteRef.current?.id !== noteIdFromUrl) {
        try {
          const allNotes = await fetchNotes({ includeArchived: true })
          const targetNote = allNotes.find(n => n.id === noteIdFromUrl)
          if (targetNote) {
            // Switch to the note's folder (or All Notes if no folder)
            setSelectedFolderId(targetNote.folder_id)
            setShowArchived(targetNote.is_archived)
            setSelectedNote(targetNote)
          }
        } catch (error) {
          console.error('Error fetching note from URL:', error)
        }
      }
    }

    selectNoteFromUrl()
  }, [noteIdFromUrl, notes, isDemo])

  // Load tags for selected note
  useEffect(() => {
    const loadNoteTags = async () => {
      if (!selectedNote) {
        setSelectedNoteTags([])
        return
      }

      if (isDemo) {
        if (selectedNote.id === 'demo-1') {
          setSelectedNoteTags([demoTags[0]])
        } else {
          setSelectedNoteTags([])
        }
        return
      }

      try {
        const noteTags = await getNoteTags(selectedNote.id)
        setSelectedNoteTags(noteTags)
      } catch (error) {
        console.error('Error loading note tags:', error)
        setSelectedNoteTags([])
      }
    }

    loadNoteTags()
  }, [selectedNote, isDemo])

  // Search notes
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      loadData()
      return
    }

    if (isDemo) {
      const filtered = demoNotes.filter(n =>
        n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.content_text.toLowerCase().includes(searchQuery.toLowerCase())
      )
      setNotes(filtered)
      return
    }

    setIsLoading(true)
    try {
      const results = await searchNotes(searchQuery)
      setNotes(results)
    } catch (error) {
      console.error('Error searching notes:', error)
    } finally {
      setIsLoading(false)
    }
  }, [searchQuery, isDemo, loadData])

  useEffect(() => {
    const debounce = setTimeout(handleSearch, 300)
    return () => clearTimeout(debounce)
  }, [handleSearch])

  // Get recent notes (last 5, sorted by updated_at)
  const recentNotes = useMemo(() => {
    return [...notes]
      .filter(n => !n.is_archived)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 5)
  }, [notes])

  // Sort notes for list
  const sortedNotes = useMemo(() => {
    return [...notes]
      .filter(n => showArchived ? n.is_archived : !n.is_archived)
      .sort((a, b) => {
        // Pinned first
        if (a.is_pinned && !b.is_pinned) return -1
        if (!a.is_pinned && b.is_pinned) return 1
        // Then by updated_at
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      })
  }, [notes, showArchived])

  // Handle task linked to note
  const handleTaskLinked = (task: LinkedTask) => {
    setLinkedTaskIds(prev => [...prev, task.id])
    setLinkedTasksKey(prev => prev + 1)
  }

  // Reset linked task IDs when note changes
  useEffect(() => {
    setLinkedTaskIds([])
    setLinkedTasksKey(prev => prev + 1)
  }, [selectedNote?.id])

  // Stable callback for selecting notes - prevents re-renders of memoized components
  const handleSelectNote = useCallback((note: Note) => {
    setSelectedNote(note)
  }, [])

  // Create new note
  const handleCreateNote = async () => {
    if (isDemo) {
      const newNote: Note = {
        id: `demo-${Date.now()}`,
        user_id: 'demo',
        title: 'New Note',
        content: {},
        content_text: '',
        folder_id: selectedFolderId,
        is_pinned: false,
        is_archived: false,
        word_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      setNotes([newNote, ...notes])
      setSelectedNote(newNote)
      return
    }

    setIsSaving(true)
    try {
      const newNote = await createNote({
        title: 'New Note',
        folder_id: selectedFolderId,
      })
      if (newNote) {
        setNotes([newNote, ...notes])
        setSelectedNote(newNote)
        setTimeout(() => titleInputRef.current?.focus(), 100)
      }
    } catch (error) {
      console.error('Error creating note:', error)
    } finally {
      setIsSaving(false)
    }
  }

  // Update note with debouncing
  // OPTIMIZED: Only update selectedNote during typing, defer notes array update until save completes
  // This prevents sidebar re-renders during active typing which caused UI flicker
  const handleUpdateNote = useCallback(async (noteId: string, updates: Partial<Note>) => {
    // Only update selectedNote for editor reactivity - NOT the notes array
    // This keeps the notes array stable and prevents sidebar flicker
    if (selectedNote?.id === noteId) {
      setSelectedNote(prev => prev ? { ...prev, ...updates } : null)
    }

    if (isDemo) {
      // For demo mode, we can update notes array since there's no server save
      setNotes(prev => prev.map(n => n.id === noteId ? { ...n, ...updates } : n))
      return
    }

    // Clear existing timeouts
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    if (savingDisplayTimeoutRef.current) {
      clearTimeout(savingDisplayTimeoutRef.current)
    }

    // Debounce save - update notes array AFTER successful save
    saveTimeoutRef.current = setTimeout(async () => {
      // Only show "Saving..." after 200ms delay to prevent rapid flashing
      savingDisplayTimeoutRef.current = setTimeout(() => {
        setIsSaving(true)
      }, 200)

      try {
        await updateNote(noteId, updates)
        // Update notes array AFTER successful save - this updates the sidebar preview
        setNotes(prev => prev.map(n => n.id === noteId ? { ...n, ...updates } : n))
      } catch (error) {
        console.error('Error updating note:', error)
      } finally {
        // Clear the saving display timeout if save completed quickly
        if (savingDisplayTimeoutRef.current) {
          clearTimeout(savingDisplayTimeoutRef.current)
        }
        setIsSaving(false)
      }
    }, 500)
  }, [isDemo, selectedNote?.id])

  // Handle title change
  const handleTitleChange = (title: string) => {
    if (selectedNote) {
      handleUpdateNote(selectedNote.id, { title })
    }
  }

  // Delete note
  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this note?')) return

    // Optimistic update
    setNotes(prev => prev.filter(n => n.id !== noteId))
    if (selectedNote?.id === noteId) {
      setSelectedNote(notes.find(n => n.id !== noteId) || null)
    }

    if (isDemo) return

    try {
      await deleteNote(noteId)
    } catch (error) {
      console.error('Error deleting note:', error)
      loadData()
    }
  }

  // Pin/Unpin note
  const handleTogglePin = async (noteId: string, isPinned: boolean) => {
    // Optimistic update
    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, is_pinned: !isPinned } : n))
    if (selectedNote?.id === noteId) {
      setSelectedNote(prev => prev ? { ...prev, is_pinned: !isPinned } : null)
    }

    if (isDemo) return

    try {
      await toggleNotePin(noteId, !isPinned)
    } catch (error) {
      console.error('Error toggling pin:', error)
      loadData()
    }
  }

  // Archive/Unarchive note
  const handleToggleArchive = async (noteId: string, isArchived: boolean) => {
    // Optimistic update
    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, is_archived: !isArchived } : n))
    if (selectedNote?.id === noteId && !showArchived) {
      setSelectedNote(notes.find(n => n.id !== noteId) || null)
    }

    if (isDemo) return

    try {
      await toggleNoteArchive(noteId, !isArchived)
      if (!showArchived) {
        loadData()
      }
    } catch (error) {
      console.error('Error toggling archive:', error)
      loadData()
    }
  }

  // Move note to folder
  const handleMoveToFolder = async (noteId: string, folderId: string | null) => {
    // Optimistic update
    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, folder_id: folderId } : n))
    if (selectedNote?.id === noteId) {
      setSelectedNote(prev => prev ? { ...prev, folder_id: folderId } : null)
    }

    if (isDemo) return

    try {
      await moveNoteToFolder(noteId, folderId)
      loadData()
    } catch (error) {
      console.error('Error moving note:', error)
      loadData()
    }
  }

  // Tag operations
  const handleTagAdd = async (tagId: string) => {
    if (!selectedNote) return

    const tag = tags.find(t => t.id === tagId)
    if (tag) {
      setSelectedNoteTags(prev => [...prev, tag])
    }

    if (isDemo) return

    try {
      await addTagToNote(selectedNote.id, tagId)
    } catch (error) {
      console.error('Error adding tag:', error)
      setSelectedNoteTags(prev => prev.filter(t => t.id !== tagId))
    }
  }

  const handleTagRemove = async (tagId: string) => {
    if (!selectedNote) return

    setSelectedNoteTags(prev => prev.filter(t => t.id !== tagId))

    if (isDemo) return

    try {
      await removeTagFromNote(selectedNote.id, tagId)
    } catch (error) {
      console.error('Error removing tag:', error)
      const noteTags = await getNoteTags(selectedNote.id)
      setSelectedNoteTags(noteTags)
    }
  }

  const handleCreateTag = async (name: string, color: string): Promise<NoteTag | null> => {
    if (isDemo) {
      const newTag: NoteTag = {
        id: `demo-tag-${Date.now()}`,
        user_id: 'demo',
        name,
        color,
        created_at: new Date().toISOString(),
      }
      setTags(prev => [...prev, newTag])
      return newTag
    }

    try {
      const newTag = await createTag({ name, color })
      if (newTag) {
        setTags(prev => [...prev, newTag])
      }
      return newTag
    } catch (error) {
      console.error('Error creating tag:', error)
      return null
    }
  }

  const handleUpdateTag = async (tagId: string, name: string, color: string): Promise<NoteTag | null> => {
    if (isDemo) {
      setTags(prev => prev.map(t => t.id === tagId ? { ...t, name, color } : t))
      setSelectedNoteTags(prev => prev.map(t => t.id === tagId ? { ...t, name, color } : t))
      return tags.find(t => t.id === tagId) || null
    }

    try {
      const updatedTag = await updateTag(tagId, { name, color })
      if (updatedTag) {
        setTags(prev => prev.map(t => t.id === tagId ? updatedTag : t))
        setSelectedNoteTags(prev => prev.map(t => t.id === tagId ? updatedTag : t))
      }
      return updatedTag
    } catch (error) {
      console.error('Error updating tag:', error)
      return null
    }
  }

  const handleDeleteTag = async (tagId: string): Promise<boolean> => {
    if (isDemo) {
      setTags(prev => prev.filter(t => t.id !== tagId))
      setSelectedNoteTags(prev => prev.filter(t => t.id !== tagId))
      return true
    }

    try {
      const success = await deleteTag(tagId)
      if (success) {
        setTags(prev => prev.filter(t => t.id !== tagId))
        setSelectedNoteTags(prev => prev.filter(t => t.id !== tagId))
      }
      return success
    } catch (error) {
      console.error('Error deleting tag:', error)
      return false
    }
  }

  // Folder CRUD
  const handleSaveFolder = async () => {
    if (!newFolderName.trim()) return

    setIsSaving(true)
    try {
      if (editingFolder) {
        await updateFolder(editingFolder.id, {
          name: newFolderName,
          icon: newFolderIcon,
          color: newFolderColor,
        })
      } else {
        await createFolder({
          name: newFolderName,
          icon: newFolderIcon,
          color: newFolderColor,
        })
      }
      await loadData()
      closeFolderModal()
    } catch (error) {
      console.error('Error saving folder:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteFolder = async (folderId: string) => {
    if (!confirm('Delete this folder? Notes will be moved to "All Notes".')) return

    try {
      await deleteFolder(folderId)
      if (selectedFolderId === folderId) {
        setSelectedFolderId(null)
      }
      await loadData()
    } catch (error) {
      console.error('Error deleting folder:', error)
    }
  }

  // Folder tree handlers
  const handleFolderExpand = (folderId: string) => {
    setExpandedFolderIds(prev => new Set([...prev, folderId]))
  }

  const handleFolderCollapse = (folderId: string) => {
    setExpandedFolderIds(prev => {
      const newSet = new Set(prev)
      newSet.delete(folderId)
      return newSet
    })
  }

  const handleCreateSubfolder = async (parentFolderId: string | null) => {
    if (isDemo) return

    try {
      await createFolder({
        name: 'New Folder',
        parent_id: parentFolderId,
        icon: 'folder',
        color: '#0ea5e9',
      })
      // Expand the parent folder if creating a subfolder
      if (parentFolderId) {
        setExpandedFolderIds(prev => new Set([...prev, parentFolderId]))
      }
      await loadData()
    } catch (error) {
      console.error('Error creating subfolder:', error)
    }
  }

  const handleNoteDrop = async (noteIds: string[], folderId: string | null) => {
    if (isDemo) return

    try {
      await moveNotesToFolder(noteIds, folderId)
      await loadData()
    } catch (error) {
      console.error('Error moving notes to folder:', error)
    }
  }

  const handleShowArchive = () => {
    setShowArchived(true)
    setSelectedFolderId(null)
  }

  const openFolderModal = (folder?: NoteFolder) => {
    if (folder) {
      setEditingFolder(folder)
      setNewFolderName(folder.name)
      setNewFolderIcon(folder.icon)
      setNewFolderColor(folder.color)
    } else {
      setEditingFolder(null)
      setNewFolderName('')
      setNewFolderIcon('folder')
      setNewFolderColor('#0ea5e9')
    }
    setShowFolderModal(true)
  }

  const closeFolderModal = () => {
    setShowFolderModal(false)
    setEditingFolder(null)
    setNewFolderName('')
  }

  // Close modal on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (folderModalRef.current && !folderModalRef.current.contains(event.target as Node)) {
        closeFolderModal()
      }
    }
    if (showFolderModal) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showFolderModal])

  // Icon options for folders
  const iconOptions = [
    'folder', 'work', 'person', 'home', 'school',
    'favorite', 'star', 'lightbulb', 'book', 'description',
    'note', 'article', 'draft', 'task', 'checklist',
  ]

  // Color options
  const colorOptions = [
    '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
    '#10b981', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
    '#8b5cf6', '#a855f7', '#ec4899',
  ]

  // Get current folder name
  const currentFolderName = selectedFolderId
    ? folders.find(f => f.id === selectedFolderId)?.name || 'Folder'
    : showArchived ? 'Archive' : 'All Notes'

  // Show loading skeleton during initial load
  if (isLoading && !initialLoadDone.current) {
    return <NotesLoadingSkeleton />
  }

  return (
    <NotesErrorBoundary>
      <div className="flex h-full overflow-hidden" role="main">
        {/* Collapsible Notes Panel */}
        <aside
          aria-label="Notes sidebar"
          className={cn(
            'flex-shrink-0 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 transition-all duration-300 ease-in-out overflow-hidden',
            isPanelOpen ? 'w-[clamp(280px,22vw,360px)] md:w-[clamp(280px,22vw,360px)]' : 'w-0',
            // Mobile: full width when open
            isPanelOpen && 'max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-40 max-md:w-[85vw]'
          )}
        >
          {/* Inner container that matches aside width */}
          <div className="w-[clamp(280px,22vw,360px)] max-md:w-full h-full flex flex-col">
          {/* Panel Header */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center h-16 flex-shrink-0">
            <h2 className="font-bold text-slate-900 dark:text-slate-100 text-lg tracking-tight whitespace-nowrap">My Notes</h2>
            <div className="flex gap-1">
              {/* Mobile close button */}
              <button
                onClick={() => setIsPanelOpen(false)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors md:hidden"
                aria-label="Close sidebar"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
              <button
                onClick={() => openFolderModal()}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                aria-label="Create new folder"
              >
                <span className="material-symbols-outlined text-[20px]">create_new_folder</span>
              </button>
              <button
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                aria-label="Sort notes"
              >
                <span className="material-symbols-outlined text-[20px]">sort</span>
              </button>
            </div>
          </div>

          {/* Panel Content */}
          <div className="flex-1 overflow-y-auto px-2 py-4 space-y-6">
          {/* Folder Tree Section */}
          <nav aria-label="Note folders" className="space-y-1">
            <div className="flex items-center justify-between px-3 mb-2">
              <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Folders</h3>
            </div>
            <NoteFolderTree
              folders={folderTree}
              selectedFolderId={selectedFolderId}
              expandedFolderIds={expandedFolderIds}
              rootNoteCount={rootNoteCount}
              archivedNoteCount={archivedNoteCount}
              showArchive={showArchived}
              onFolderSelect={(folderId) => {
                setSelectedFolderId(folderId);
                setShowArchived(false);
                setSelectedNote(null);  // Clear selection to show folder contents
                // Expand the folder to show subfolders
                if (folderId) {
                  setExpandedFolderIds(prev => new Set([...prev, folderId]));
                }
              }}
              onFolderExpand={handleFolderExpand}
              onFolderCollapse={handleFolderCollapse}
              onCreateFolder={handleCreateSubfolder}
              onRenameFolder={(folder) => openFolderModal(folder)}
              onDeleteFolder={handleDeleteFolder}
              onNoteDrop={handleNoteDrop}
              onShowArchive={handleShowArchive}
              isDemo={isDemo}
            />
          </nav>

          {/* Recent Section - Uses memoized component to prevent flicker during typing */}
          <div className="space-y-1 pt-4 border-t border-slate-100 dark:border-slate-700">
            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 mb-2">Recent</h3>
            <div className="px-1">
              <RecentNotesList
                notes={recentNotes}
                selectedNoteId={selectedNote?.id ?? null}
                onSelectNote={handleSelectNote}
              />
            </div>
          </div>
        </div>

          {/* New Note Button - Uses memoized component to prevent flicker */}
          <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
            <NewNoteButton onClick={handleCreateNote} />
          </div>
        </div>
      </aside>

      {/* Mobile overlay when sidebar is open */}
      {isPanelOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setIsPanelOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full bg-white dark:bg-slate-900 overflow-hidden min-w-0">
        {/* Header */}
        <header className="h-16 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-4 md:px-6 bg-white dark:bg-slate-900 flex-shrink-0 z-20 relative gap-3 md:gap-6">
          <div className="flex items-center gap-2 md:gap-4 min-w-0">
            {/* Toggle Panel Button */}
            <button
              onClick={() => setIsPanelOpen(!isPanelOpen)}
              className="p-2 -ml-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
              aria-label={isPanelOpen ? 'Close notes panel' : 'Open notes panel'}
              aria-expanded={isPanelOpen}
            >
              <span className="material-symbols-outlined text-[24px]">
                {isPanelOpen ? 'menu_open' : 'menu'}
              </span>
            </button>

            {/* Divider - Hidden on mobile */}
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 hidden md:block"></div>

            {/* Breadcrumb */}
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm min-w-0">
              <button
                className="text-slate-500 dark:text-slate-400 flex items-center gap-1 cursor-pointer hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                onClick={() => { setSelectedFolderId(null); setShowArchived(false); }}
              >
                <span className="material-symbols-outlined text-[18px]">folder_open</span>
                <span className="hidden sm:inline">{currentFolderName}</span>
              </button>
              {selectedNote && (
                <>
                  <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 text-[16px]">chevron_right</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[120px] md:max-w-[200px]">{selectedNote.title}</span>
                </>
              )}
            </nav>
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-xl hidden sm:block">
            <div className="relative group w-full">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 material-symbols-outlined transition-colors group-focus-within:text-cyan-600 dark:group-focus-within:text-cyan-400 text-[20px]">
                search
              </span>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 pl-10 pr-12 py-2 rounded-lg border-transparent focus:bg-white dark:focus:bg-slate-700 focus:border-cyan-300 dark:focus:border-cyan-500 focus:ring-1 focus:ring-cyan-300 dark:focus:ring-cyan-500 focus:outline-none transition-all placeholder-slate-400 dark:placeholder-slate-500 text-sm"
                placeholder="Search notes, folders and tags..."
                aria-label="Search notes"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 pointer-events-none">
                <kbd className="hidden lg:inline-block px-1.5 py-0.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded shadow-sm">
                  Ctrl+K
                </kbd>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          {selectedNote && (
            <div className="flex items-center gap-1" role="toolbar" aria-label="Note actions">
              <button
                onClick={() => handleTogglePin(selectedNote.id, selectedNote.is_pinned)}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  selectedNote.is_pinned
                    ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/30'
                    : 'text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
                )}
                aria-label={selectedNote.is_pinned ? 'Unpin note' : 'Pin note'}
                aria-pressed={selectedNote.is_pinned}
              >
                <span className="material-symbols-outlined text-[20px]">push_pin</span>
              </button>
              <button
                onClick={() => handleToggleArchive(selectedNote.id, selectedNote.is_archived)}
                className="p-2 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label={selectedNote.is_archived ? 'Unarchive note' : 'Archive note'}
              >
                <span className="material-symbols-outlined text-[20px]">
                  {selectedNote.is_archived ? 'unarchive' : 'archive'}
                </span>
              </button>
              {!isDemo && (
                <button
                  onClick={() => setShowShareDialog(true)}
                  className="p-2 rounded-lg text-slate-400 dark:text-slate-500 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/30 transition-colors"
                  aria-label="Share note"
                >
                  <span className="material-symbols-outlined text-[20px]">share</span>
                </button>
              )}

              {/* Divider */}
              <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 mx-2 hidden sm:block"></div>

              <button
                onClick={() => handleDeleteNote(selectedNote.id)}
                className="p-2 rounded-lg text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                aria-label="Delete note"
              >
                <span className="material-symbols-outlined text-[20px]">delete</span>
              </button>

              {/* Save indicator */}
              {isSaving && (
                <span className="ml-2 text-xs text-cyan-600 dark:text-cyan-400 flex items-center gap-1" role="status" aria-live="polite">
                  <span className="w-2 h-2 bg-cyan-600 dark:bg-cyan-400 rounded-full animate-pulse"></span>
                  <span className="hidden sm:inline">Saving...</span>
                </span>
              )}
            </div>
          )}
        </header>

        {/* Editor Area */}
        {selectedNote ? (
          <article className="flex-1 overflow-y-auto w-full relative" aria-label={`Editing note: ${selectedNote.title}`}>
            <div className="max-w-5xl mx-auto px-4 md:px-8 py-4 md:py-6 h-full flex flex-col">
              {/* Title */}
              <input
                ref={titleInputRef}
                type="text"
                value={selectedNote.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Untitled Note"
                aria-label="Note title"
                className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 border-none p-0 focus:ring-0 placeholder-slate-300 dark:placeholder-slate-600 bg-transparent mb-3 w-full leading-tight outline-none"
              />

              {/* Tags & Folder Row - Combined on same line */}
              <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
                <TagSelector
                  tags={tags}
                  selectedTags={selectedNoteTags}
                  onTagAdd={handleTagAdd}
                  onTagRemove={handleTagRemove}
                  onCreateTag={handleCreateTag}
                  onManageTags={() => setShowTagsModal(true)}
                />

                {/* Folder Selector */}
                <div className="flex items-center gap-2">
                  <label htmlFor="folder-select" className="text-xs text-slate-400 dark:text-slate-500">Folder:</label>
                  <select
                    id="folder-select"
                    value={selectedNote.folder_id || ''}
                    onChange={(e) => handleMoveToFolder(selectedNote.id, e.target.value || null)}
                    className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 text-slate-600 dark:text-slate-300 focus:ring-1 focus:ring-cyan-200 dark:focus:ring-cyan-500 outline-none"
                  >
                    <option value="">No Folder</option>
                    {folders.filter(f => f.name.toLowerCase() !== 'archive').map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* TipTap Rich Text Editor */}
              <div className="flex-1">
                <NotesEditor
                  content={selectedNote.content || ''}
                  onUpdate={({ json, text }) => {
                    const wordCount = text.trim().split(/\s+/).filter(Boolean).length
                    handleUpdateNote(selectedNote.id, {
                      content: json as Record<string, unknown>,
                      content_text: text,
                      word_count: wordCount,
                    })
                  }}
                  placeholder="Start writing..."
                  onImageUpload={async (file) => {
                    if (isDemo) return null
                    return await uploadNoteImage(file, selectedNote.id)
                  }}
                />

                {/* Linked Tasks Panel */}
                <LinkedTasksPanel
                  key={linkedTasksKey}
                  noteId={selectedNote.id}
                  onLinkTask={() => setShowTaskLinker(true)}
                  isDemo={isDemo}
                />
              </div>

              {/* Footer */}
              <footer className="border-t border-slate-100 dark:border-slate-700 mt-8 pt-4">
                <div className="flex flex-col sm:flex-row justify-between text-xs text-slate-400 dark:text-slate-500 gap-2">
                  <div className="flex gap-4">
                    <time dateTime={selectedNote.updated_at}>
                      Last edited {format(new Date(selectedNote.updated_at), 'MMM d, yyyy \'at\' h:mm a')}
                    </time>
                  </div>
                  <div className="flex gap-4">
                    <span>{selectedNote.word_count || 0} words</span>
                    <span>{selectedNote.content_text?.length || 0} characters</span>
                  </div>
                </div>
              </footer>
            </div>
          </article>
        ) : sortedNotes.length > 0 ? (
          /* Notes List View - when folder is selected but no note is open */
          <div className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="max-w-5xl mx-auto">
              {/* Folder Header */}
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">
                  {currentFolderName}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {sortedNotes.length} {sortedNotes.length === 1 ? 'note' : 'notes'}
                </p>
              </div>

              {/* Notes Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {sortedNotes.map((note) => (
                  <button
                    key={note.id}
                    onClick={() => setSelectedNote(note)}
                    className="text-left p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-cyan-300 dark:hover:border-cyan-600 hover:shadow-md transition-all group"
                  >
                    {/* Pin indicator */}
                    {note.is_pinned && (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 mb-2">
                        <span className="material-symbols-outlined text-[14px]">push_pin</span>
                        Pinned
                      </span>
                    )}

                    {/* Title */}
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2 line-clamp-2 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                      {note.title || 'Untitled Note'}
                    </h3>

                    {/* Preview */}
                    <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-3 mb-3">
                      {note.content_text || 'No content'}
                    </p>

                    {/* Footer */}
                    <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
                      <span>{format(new Date(note.updated_at), 'MMM d, yyyy')}</span>
                      <span>{note.word_count || 0} words</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <NotesEmptyState onCreateNote={handleCreateNote} isArchive={showArchived} />
        )}
      </main>

      {/* Demo Banner */}
      {isDemo && (
        <div className="fixed bottom-4 right-4 left-4 sm:left-auto px-4 py-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-xl text-amber-800 dark:text-amber-200 text-sm shadow-lg z-50" role="alert">
          <span className="font-medium">Demo Mode:</span> Changes are not saved. Create an account to save your notes.
        </div>
      )}

      {/* Folder Modal */}
      {showFolderModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="folder-modal-title">
          <div
            ref={folderModalRef}
            className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl"
          >
            <h3 id="folder-modal-title" className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
              {editingFolder ? 'Edit Folder' : 'New Folder'}
            </h3>

            <div className="flex flex-col gap-4">
              {/* Name */}
              <div>
                <label htmlFor="folder-name" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1 block">
                  Name
                </label>
                <input
                  id="folder-name"
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Folder name"
                  className="w-full px-4 py-3 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none placeholder-slate-400 dark:placeholder-slate-500"
                  autoFocus
                />
              </div>

              {/* Icon */}
              <fieldset>
                <legend className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2 block">
                  Icon
                </legend>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Select folder icon">
                  {iconOptions.map(icon => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setNewFolderIcon(icon)}
                      aria-pressed={newFolderIcon === icon}
                      className={cn(
                        'p-2 rounded-lg transition-colors',
                        newFolderIcon === icon
                          ? 'bg-cyan-100 dark:bg-cyan-900/50 text-cyan-600 dark:text-cyan-400'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                      )}
                    >
                      <span className="material-symbols-outlined text-[20px]">{icon}</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              {/* Color */}
              <fieldset>
                <legend className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2 block">
                  Color
                </legend>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Select folder color">
                  {colorOptions.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewFolderColor(color)}
                      aria-pressed={newFolderColor === color}
                      aria-label={`Color ${color}`}
                      className={cn(
                        'w-8 h-8 rounded-lg transition-transform hover:scale-110',
                        newFolderColor === color && 'ring-2 ring-offset-2 ring-slate-400 dark:ring-slate-500 dark:ring-offset-slate-800'
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </fieldset>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={closeFolderModal}
                className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveFolder}
                disabled={isSaving || !newFolderName.trim()}
                className="px-4 py-2 bg-cyan-600 text-white rounded-xl font-medium hover:bg-cyan-700 transition-colors disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : editingFolder ? 'Save Changes' : 'Create Folder'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tags Modal */}
      <TagsModal
        isOpen={showTagsModal}
        onClose={() => setShowTagsModal(false)}
        tags={tags}
        onCreateTag={handleCreateTag}
        onUpdateTag={handleUpdateTag}
        onDeleteTag={handleDeleteTag}
      />

      {/* Task Linker Modal */}
      {selectedNote && (
        <TaskLinker
          isOpen={showTaskLinker}
          onClose={() => setShowTaskLinker(false)}
          noteId={selectedNote.id}
          existingTaskIds={linkedTaskIds}
          onTaskLinked={handleTaskLinked}
          isDemo={isDemo}
        />
      )}

      {/* Share Note Dialog */}
      <ShareNoteDialog
        note={selectedNote}
        isOpen={showShareDialog}
        onClose={() => setShowShareDialog(false)}
      />
    </div>
    </NotesErrorBoundary>
  )
}

// Wrapper with Suspense boundary for useSearchParams
export default function NotesPage() {
  return (
    <Suspense fallback={<NotesLoadingSkeleton />}>
      <NotesPageContent />
    </Suspense>
  )
}
