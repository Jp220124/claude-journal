'use client'

import { useState, useCallback, useRef, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { format, addDays, subDays, isToday, isFuture } from 'date-fns'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import LinkExtension from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import { useAuthStore } from '@/stores/authStore'
import { isDemoAccount, demoJournalEntry } from '@/lib/demo'
import { fetchJournalEntry, saveJournalEntry } from '@/lib/journalService'
import { fetchTemplates } from '@/lib/journalTemplateService'
import type { JournalTemplate } from '@/types/database'
import { cn } from '@/lib/utils'
import TemplatedJournalEntry from '@/components/journal/TemplatedJournalEntry'

// Mood options
const moodOptions = [
  { emoji: '😊', label: 'Happy', value: 'happy' },
  { emoji: '😌', label: 'Calm', value: 'calm' },
  { emoji: '😐', label: 'Neutral', value: 'neutral' },
  { emoji: '😔', label: 'Sad', value: 'sad' },
  { emoji: '😤', label: 'Frustrated', value: 'frustrated' },
  { emoji: '😴', label: 'Tired', value: 'tired' },
  { emoji: '🤔', label: 'Thoughtful', value: 'thoughtful' },
  { emoji: '😃', label: 'Excited', value: 'excited' },
  { emoji: '😰', label: 'Anxious', value: 'anxious' },
  { emoji: '🥰', label: 'Loved', value: 'loved' },
]

// Find mood option by value
const findMoodByValue = (value: string | null) => {
  if (!value) return null
  return moodOptions.find(m => m.value === value) || null
}

function JournalEntryContent() {
  const { user } = useAuthStore()
  const isDemo = isDemoAccount(user?.email)
  const searchParams = useSearchParams()

  // Template state
  const [templates, setTemplates] = useState<JournalTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [showTemplateSelector, setShowTemplateSelector] = useState(false)
  const templateSelectorRef = useRef<HTMLDivElement>(null)

  // Date state for navigation
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [showDatePicker, setShowDatePicker] = useState(false)

  // Content state
  const [title, setTitle] = useState('')
  const [mood, setMood] = useState<{ emoji: string; label: string; value: string } | null>(null)
  const [showMoodPicker, setShowMoodPicker] = useState(false)
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
  const [images, setImages] = useState<{ url: string; name: string }[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const moodPickerRef = useRef<HTMLDivElement>(null)
  const datePickerRef = useRef<HTMLDivElement>(null)
  const isInitialLoad = useRef(true)
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const contentRef = useRef({ title: '', content: '', mood: null as string | null, tags: [] as string[] })

  // TipTap Editor
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      LinkExtension.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-cyan-600 underline cursor-pointer',
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'rounded-lg max-w-full h-auto my-4',
        },
      }),
      Placeholder.configure({
        placeholder: 'Start writing your thoughts for today...',
      }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-lg prose-slate max-w-none focus:outline-none min-h-[300px] text-slate-700 leading-relaxed',
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items
        if (items) {
          for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
              event.preventDefault()
              const file = items[i].getAsFile()
              if (file) {
                handleImageUpload(file)
              }
              return true
            }
          }
        }
        return false
      },
    },
    onUpdate: ({ editor }) => {
      if (!isInitialLoad.current) {
        contentRef.current.content = editor.getHTML()
        triggerAutoSave()
      }
    },
  })

  // Load templates
  useEffect(() => {
    const loadTemplates = async () => {
      if (isDemo) return
      const data = await fetchTemplates()
      setTemplates(data)
    }
    loadTemplates()
  }, [isDemo])

  // Check for template query parameter
  useEffect(() => {
    const templateParam = searchParams.get('template')
    if (templateParam) {
      setSelectedTemplate(templateParam)
    }
  }, [searchParams])

  // Load entry when date changes
  useEffect(() => {
    if (!editor) return

    const loadEntry = async () => {
      setIsLoading(true)
      isInitialLoad.current = true
      setSaveStatus('idle')

      const dateStr = format(selectedDate, 'yyyy-MM-dd')

      // For demo account, show demo data for today only
      if (isDemo && isToday(selectedDate)) {
        setTitle(demoJournalEntry.title)
        setMood({ emoji: '😊', label: 'Happy', value: 'happy' })
        setTags(demoJournalEntry.tags)
        setImages([])
        editor.commands.setContent(demoJournalEntry.content)
        setLastSaved(new Date())
        contentRef.current = {
          title: demoJournalEntry.title,
          content: demoJournalEntry.content,
          mood: 'happy',
          tags: demoJournalEntry.tags,
        }
      } else if (!isDemo) {
        // Load from Supabase
        try {
          const entry = await fetchJournalEntry(dateStr)
          if (entry) {
            setTitle(entry.title || '')
            setMood(findMoodByValue(entry.mood))
            setTags(entry.tags || [])
            setImages([])
            editor.commands.setContent(entry.content || '')
            setLastSaved(entry.updated_at ? new Date(entry.updated_at) : null)
            contentRef.current = {
              title: entry.title || '',
              content: entry.content || '',
              mood: entry.mood,
              tags: entry.tags || [],
            }
          } else {
            // Clear for new entry
            setTitle('')
            setMood(null)
            setTags([])
            setImages([])
            editor.commands.setContent('')
            setLastSaved(null)
            contentRef.current = { title: '', content: '', mood: null, tags: [] }
          }
        } catch (error) {
          console.error('Error loading entry:', error)
          // Clear on error
          setTitle('')
          setMood(null)
          setTags([])
          setImages([])
          editor.commands.setContent('')
          setLastSaved(null)
          contentRef.current = { title: '', content: '', mood: null, tags: [] }
        }
      } else {
        // Demo account on non-today date - show empty
        setTitle('')
        setMood(null)
        setTags([])
        setImages([])
        editor.commands.setContent('')
        setLastSaved(null)
        contentRef.current = { title: '', content: '', mood: null, tags: [] }
      }

      setIsLoading(false)
      // Allow auto-save after a short delay
      setTimeout(() => {
        isInitialLoad.current = false
      }, 200)
    }

    loadEntry()
  }, [selectedDate, editor, isDemo])

  // Save current entry to Supabase
  const saveCurrentEntry = useCallback(async () => {
    if (isInitialLoad.current || !editor || isDemo) return

    const currentTitle = contentRef.current.title
    const currentContent = contentRef.current.content
    const currentMood = contentRef.current.mood
    const currentTags = contentRef.current.tags

    // Only save if there's actual content
    const hasContent = currentTitle.trim() || editor.getText().trim()
    if (!hasContent) return

    setSaveStatus('saving')

    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd')
      const result = await saveJournalEntry(dateStr, {
        title: currentTitle,
        content: currentContent,
        mood: currentMood,
        tags: currentTags,
      })

      if (result) {
        setLastSaved(new Date())
        setSaveStatus('saved')
        // Reset to idle after showing saved status
        setTimeout(() => setSaveStatus('idle'), 2000)
      } else {
        setSaveStatus('error')
      }
    } catch (error) {
      console.error('Error saving entry:', error)
      setSaveStatus('error')
    }
  }, [editor, selectedDate, isDemo])

  // Auto-save with debounce
  const triggerAutoSave = useCallback(() => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
    }
    setSaveStatus('idle')
    autoSaveTimeoutRef.current = setTimeout(() => {
      saveCurrentEntry()
    }, 1500) // Save 1.5 seconds after last change
  }, [saveCurrentEntry])

  // Update content ref when title changes and trigger auto-save
  const handleTitleChange = useCallback((newTitle: string) => {
    setTitle(newTitle)
    contentRef.current.title = newTitle
    if (!isInitialLoad.current) {
      triggerAutoSave()
    }
  }, [triggerAutoSave])

  // Update content ref when mood changes and trigger auto-save
  const handleMoodChange = useCallback((newMood: typeof mood) => {
    setMood(newMood)
    contentRef.current.mood = newMood?.value || null
    if (!isInitialLoad.current) {
      triggerAutoSave()
    }
  }, [triggerAutoSave])

  // Update content ref when tags change and trigger auto-save
  const handleTagsChange = useCallback((newTags: string[]) => {
    setTags(newTags)
    contentRef.current.tags = newTags
    if (!isInitialLoad.current) {
      triggerAutoSave()
    }
  }, [triggerAutoSave])

  // Handle image upload
  const handleImageUpload = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const url = e.target?.result as string
      if (editor) {
        editor.chain().focus().setImage({ src: url }).run()
      }
      setImages(prev => [...prev, { url, name: file.name }])
    }
    reader.readAsDataURL(file)
  }, [editor])

  // File input change handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      handleImageUpload(file)
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Tag handlers
  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newTag.trim()) {
      const tagToAdd = newTag.startsWith('#') ? newTag : `#${newTag}`
      if (!tags.includes(tagToAdd)) {
        handleTagsChange([...tags, tagToAdd])
      }
      setNewTag('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    handleTagsChange(tags.filter(tag => tag !== tagToRemove))
  }

  // Date navigation
  const goToPreviousDay = () => {
    setSelectedDate(prev => subDays(prev, 1))
  }

  const goToNextDay = () => {
    const nextDay = addDays(selectedDate, 1)
    if (!isFuture(nextDay) || isToday(nextDay)) {
      setSelectedDate(nextDay)
    }
  }

  const goToToday = () => {
    setSelectedDate(new Date())
    setShowDatePicker(false)
  }

  // Link insertion
  const addLink = () => {
    const url = window.prompt('Enter URL:')
    if (url && editor) {
      editor.chain().focus().setLink({ href: url }).run()
    }
  }

  // Manual save entry
  const handleSave = async () => {
    if (isDemo) return
    setIsSaving(true)
    await saveCurrentEntry()
    setIsSaving(false)
  }

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moodPickerRef.current && !moodPickerRef.current.contains(event.target as Node)) {
        setShowMoodPicker(false)
      }
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setShowDatePicker(false)
      }
      if (templateSelectorRef.current && !templateSelectorRef.current.contains(event.target as Node)) {
        setShowTemplateSelector(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Cleanup auto-save timeout on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
    }
  }, [])

  const hasContent = title.trim() || (editor && editor.getText().trim())
  const isCurrentDay = isToday(selectedDate)
  const canGoNext = !isFuture(addDays(selectedDate, 1)) || isToday(addDays(selectedDate, 1))
  const currentTemplate = templates.find(t => t.id === selectedTemplate)

  // Status text helper
  const getStatusText = () => {
    if (isLoading) return 'Loading...'
    if (saveStatus === 'saving') return 'Saving...'
    if (saveStatus === 'error') return 'Save failed'
    if (lastSaved) return `Saved ${format(lastSaved, 'h:mm a')}`
    if (hasContent) return 'Editing...'
    return 'New entry'
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50">
      {/* Header */}
      <header className="flex items-center justify-between whitespace-nowrap border-b border-slate-200 px-6 py-4 bg-white/90 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="flex items-center justify-center p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>

          {/* Date Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={goToPreviousDay}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
              title="Previous day"
            >
              <span className="material-symbols-outlined text-[20px]">chevron_left</span>
            </button>

            <div className="relative" ref={datePickerRef}>
              <button
                onClick={() => setShowDatePicker(!showDatePicker)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <span className="material-symbols-outlined text-cyan-600 text-[20px]">calendar_today</span>
                <h2 className="text-base font-bold leading-tight tracking-tight text-slate-900">
                  {format(selectedDate, 'EEEE, MMMM do, yyyy')}
                </h2>
                <span className="material-symbols-outlined text-slate-400 text-[18px]">expand_more</span>
              </button>

              {/* Date Picker Dropdown */}
              {showDatePicker && (
                <div className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-200 p-4 z-50 min-w-[280px]">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-slate-900">Select Date</h3>
                    <button
                      onClick={goToToday}
                      className="text-xs font-bold text-cyan-600 hover:text-cyan-700"
                    >
                      Today
                    </button>
                  </div>
                  <input
                    type="date"
                    value={format(selectedDate, 'yyyy-MM-dd')}
                    max={format(new Date(), 'yyyy-MM-dd')}
                    onChange={(e) => {
                      if (e.target.value) {
                        setSelectedDate(new Date(e.target.value))
                        setShowDatePicker(false)
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cyan-600 focus:border-cyan-600 outline-none"
                  />
                  <p className="text-xs text-slate-500 mt-2">
                    View and edit entries from any past date
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={goToNextDay}
              disabled={!canGoNext}
              className={`p-1.5 rounded-lg transition-colors ${
                canGoNext
                  ? 'text-slate-500 hover:bg-slate-100'
                  : 'text-slate-300 cursor-not-allowed'
              }`}
              title="Next day"
            >
              <span className="material-symbols-outlined text-[20px]">chevron_right</span>
            </button>

            {!isCurrentDay && (
              <button
                onClick={goToToday}
                className="ml-2 px-3 py-1 text-xs font-bold text-cyan-600 bg-cyan-50 rounded-full hover:bg-cyan-100 transition-colors"
              >
                Go to Today
              </button>
            )}
          </div>

          {/* Template Selector */}
          {!isDemo && templates.length > 0 && (
            <div className="relative ml-4" ref={templateSelectorRef}>
              <button
                onClick={() => setShowTemplateSelector(!showTemplateSelector)}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors',
                  selectedTemplate
                    ? 'border-cyan-200 bg-cyan-50 text-cyan-700'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                )}
              >
                {currentTemplate ? (
                  <>
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: '18px', color: currentTemplate.color }}
                    >
                      {currentTemplate.icon}
                    </span>
                    <span className="text-sm font-medium">{currentTemplate.name}</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">style</span>
                    <span className="text-sm font-medium">Free-form</span>
                  </>
                )}
                <span className="material-symbols-outlined text-slate-400 text-[16px]">expand_more</span>
              </button>

              {showTemplateSelector && (
                <div className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-200 p-2 z-50 min-w-[220px]">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500 px-3 py-2">
                    Journal Mode
                  </p>
                  <button
                    onClick={() => {
                      setSelectedTemplate(null)
                      setShowTemplateSelector(false)
                    }}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left',
                      !selectedTemplate
                        ? 'bg-cyan-50 text-cyan-700'
                        : 'hover:bg-slate-50 text-slate-700'
                    )}
                  >
                    <span className="material-symbols-outlined text-[20px]">edit_note</span>
                    <span className="text-sm font-medium">Free-form Writing</span>
                  </button>
                  <div className="h-px bg-slate-100 my-2" />
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500 px-3 py-2">
                    Templates
                  </p>
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => {
                        setSelectedTemplate(template.id)
                        setShowTemplateSelector(false)
                      }}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left',
                        selectedTemplate === template.id
                          ? 'bg-cyan-50 text-cyan-700'
                          : 'hover:bg-slate-50 text-slate-700'
                      )}
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: '20px', color: template.color }}
                      >
                        {template.icon}
                      </span>
                      <span className="text-sm font-medium">{template.name}</span>
                      {template.is_default && (
                        <span className="ml-auto text-xs text-cyan-600 bg-cyan-100 px-1.5 py-0.5 rounded">
                          Default
                        </span>
                      )}
                    </button>
                  ))}
                  <div className="h-px bg-slate-100 my-2" />
                  <Link
                    href="/templates"
                    className="flex items-center gap-2 px-3 py-2 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                    onClick={() => setShowTemplateSelector(false)}
                  >
                    <span className="material-symbols-outlined text-[18px]">settings</span>
                    Manage Templates
                  </Link>
                </div>
              )}
            </div>
          )}

          {!selectedTemplate && (
            <p className={`text-xs ml-2 ${saveStatus === 'error' ? 'text-red-500' : 'text-slate-500'}`}>
              {getStatusText()}
            </p>
          )}
        </div>

        {!selectedTemplate && (
          <div className="flex items-center gap-3">
            {saveStatus === 'saved' && (
              <span className="text-xs font-medium text-green-600 mr-2 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                Saved
              </span>
            )}
            {saveStatus === 'saving' && (
              <span className="text-xs font-medium text-cyan-600 mr-2 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
                Saving...
              </span>
            )}
            <Link
              href="/dashboard"
              className="flex h-10 items-center justify-center overflow-hidden rounded-lg px-4 bg-slate-100 text-slate-700 text-sm font-bold leading-normal tracking-wide hover:bg-slate-200 transition-colors"
            >
              Close
            </Link>
            <button
              onClick={handleSave}
              disabled={isSaving || isDemo}
              className="flex h-10 items-center justify-center overflow-hidden rounded-lg px-6 bg-cyan-600 text-white text-sm font-bold leading-normal tracking-wide shadow-lg shadow-cyan-600/20 hover:brightness-110 transition-all disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Entry'}
            </button>
          </div>
        )}
      </header>

      {/* Templated Journal Entry */}
      {selectedTemplate ? (
        <TemplatedJournalEntry
          templateId={selectedTemplate}
          date={selectedDate}
          onBack={() => setSelectedTemplate(null)}
        />
      ) : (
        /* Main Content - Free-form */
        <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 flex flex-col items-center overflow-y-auto relative p-0 sm:p-4 lg:p-8">
          <div className="w-full max-w-[850px] flex flex-col bg-white sm:rounded-xl sm:shadow-sm min-h-full sm:min-h-[80vh] border-x sm:border border-slate-200">
            {/* Loading State */}
            {isLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-sm text-slate-500">Loading entry...</p>
                </div>
              </div>
            ) : (
              <>
                {/* Demo Mode Banner */}
                {isDemo && (
                  <div className="px-8 py-3 bg-amber-50 border-b border-amber-200 text-amber-800 text-sm">
                    <span className="font-medium">Demo Mode:</span> Changes are not saved. Create an account to save your journal entries.
                  </div>
                )}

                {/* Mood and Tags */}
                <div className="px-8 pt-8 pb-4 flex flex-wrap gap-6 border-b border-dashed border-slate-200">
                  {/* Mood Selector */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Mood</label>
                    <div className="flex gap-2 relative" ref={moodPickerRef}>
                      <button
                        onClick={() => setShowMoodPicker(!showMoodPicker)}
                        className={`group flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all cursor-pointer ${
                          mood
                            ? 'border-cyan-600/30 bg-cyan-600/10 hover:bg-cyan-600/20'
                            : 'border-slate-200 hover:border-cyan-600/30 hover:bg-cyan-600/5'
                        }`}
                      >
                        {mood ? (
                          <>
                            <span className="text-lg">{mood.emoji}</span>
                            <span className="text-sm font-medium text-cyan-600">{mood.label}</span>
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-slate-400 group-hover:text-cyan-600 text-[18px]">mood</span>
                            <span className="text-sm font-medium text-slate-400 group-hover:text-cyan-600">Set mood</span>
                          </>
                        )}
                        <span className="material-symbols-outlined text-slate-400 text-[16px]">expand_more</span>
                      </button>

                      {/* Mood Picker Dropdown */}
                      {showMoodPicker && (
                        <div className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-200 p-3 z-50 min-w-[200px]">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 px-2">How are you feeling?</p>
                          <div className="grid grid-cols-2 gap-1">
                            {moodOptions.map((option) => (
                              <button
                                key={option.value}
                                onClick={() => {
                                  handleMoodChange(option)
                                  setShowMoodPicker(false)
                                }}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left ${
                                  mood?.value === option.value
                                    ? 'bg-cyan-50 text-cyan-600'
                                    : 'hover:bg-slate-50 text-slate-700'
                                }`}
                              >
                                <span className="text-lg">{option.emoji}</span>
                                <span className="text-sm font-medium">{option.label}</span>
                              </button>
                            ))}
                          </div>
                          {mood && (
                            <button
                              onClick={() => {
                                handleMoodChange(null)
                                setShowMoodPicker(false)
                              }}
                              className="w-full mt-2 px-3 py-2 text-sm text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              Clear mood
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-col gap-2 flex-1 min-w-[200px]">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Tags</label>
                    <div className="flex items-center gap-2 flex-wrap">
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center px-2.5 py-1 rounded bg-slate-100 text-slate-600 text-sm hover:bg-slate-200 transition-colors"
                        >
                          {tag}
                          <button
                            onClick={() => handleRemoveTag(tag)}
                            className="ml-1.5 hover:text-slate-900"
                          >
                            <span className="material-symbols-outlined text-[14px]">close</span>
                          </button>
                        </span>
                      ))}
                      <input
                        className="bg-transparent border-none text-sm p-1 focus:ring-0 text-slate-900 placeholder-slate-400 outline-none"
                        placeholder="Add tag..."
                        type="text"
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyDown={handleAddTag}
                      />
                    </div>
                  </div>
                </div>

                {/* Formatting Toolbar */}
                <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm px-8 py-3 border-b border-slate-200 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                    <button
                      onClick={() => editor?.chain().focus().toggleBold().run()}
                      className={`p-2 rounded transition-colors ${
                        editor?.isActive('bold')
                          ? 'bg-cyan-100 text-cyan-600'
                          : 'text-slate-400 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                      title="Bold (Ctrl+B)"
                    >
                      <span className="material-symbols-outlined text-[20px]">format_bold</span>
                    </button>
                    <button
                      onClick={() => editor?.chain().focus().toggleItalic().run()}
                      className={`p-2 rounded transition-colors ${
                        editor?.isActive('italic')
                          ? 'bg-cyan-100 text-cyan-600'
                          : 'text-slate-400 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                      title="Italic (Ctrl+I)"
                    >
                      <span className="material-symbols-outlined text-[20px]">format_italic</span>
                    </button>
                    <button
                      onClick={() => editor?.chain().focus().toggleUnderline().run()}
                      className={`p-2 rounded transition-colors ${
                        editor?.isActive('underline')
                          ? 'bg-cyan-100 text-cyan-600'
                          : 'text-slate-400 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                      title="Underline (Ctrl+U)"
                    >
                      <span className="material-symbols-outlined text-[20px]">format_underlined</span>
                    </button>
                    <div className="w-px h-5 bg-slate-200 mx-2"></div>
                    <button
                      onClick={() => editor?.chain().focus().toggleBulletList().run()}
                      className={`p-2 rounded transition-colors ${
                        editor?.isActive('bulletList')
                          ? 'bg-cyan-100 text-cyan-600'
                          : 'text-slate-400 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                      title="Bullet List"
                    >
                      <span className="material-symbols-outlined text-[20px]">format_list_bulleted</span>
                    </button>
                    <button
                      onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                      className={`p-2 rounded transition-colors ${
                        editor?.isActive('orderedList')
                          ? 'bg-cyan-100 text-cyan-600'
                          : 'text-slate-400 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                      title="Numbered List"
                    >
                      <span className="material-symbols-outlined text-[20px]">format_list_numbered</span>
                    </button>
                    <button
                      onClick={() => editor?.chain().focus().toggleBlockquote().run()}
                      className={`p-2 rounded transition-colors ${
                        editor?.isActive('blockquote')
                          ? 'bg-cyan-100 text-cyan-600'
                          : 'text-slate-400 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                      title="Quote"
                    >
                      <span className="material-symbols-outlined text-[20px]">format_quote</span>
                    </button>
                    <div className="w-px h-5 bg-slate-200 mx-2"></div>
                    <button
                      onClick={addLink}
                      className={`p-2 rounded transition-colors ${
                        editor?.isActive('link')
                          ? 'bg-cyan-100 text-cyan-600'
                          : 'text-slate-400 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                      title="Insert Link"
                    >
                      <span className="material-symbols-outlined text-[20px]">link</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 rounded flex items-center gap-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors text-sm font-medium"
                    >
                      <span className="material-symbols-outlined text-[20px]">image</span>
                      <span className="hidden md:inline">Add Media</span>
                    </button>
                  </div>
                </div>

                {/* Editor Content */}
                <div className="flex-1 p-8 md:px-12 lg:px-16 flex flex-col">
                  <input
                    className="w-full bg-transparent border-none text-3xl md:text-4xl font-extrabold text-slate-900 placeholder-slate-300 focus:ring-0 px-0 py-4 mb-2 leading-tight outline-none"
                    placeholder="Give your day a title..."
                    value={title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                  />

                  {/* TipTap Editor */}
                  <div className="flex-1">
                    <EditorContent editor={editor} className="min-h-[300px]" />
                  </div>

                  {/* Pro tip for empty state */}
                  {!hasContent && (
                    <div className="py-8 text-center border-t border-dashed border-slate-200 mt-8">
                      <p className="text-slate-400 text-sm">
                        Pro tip: Use the toolbar above to format your text. You can also paste images directly (Ctrl+V).
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          <div className="h-20 w-full shrink-0"></div>
        </main>

        {/* Sidebar */}
        <aside className="hidden 2xl:flex w-80 flex-col border-l border-slate-200 bg-white p-6 gap-8 overflow-y-auto shrink-0">
          {/* Entry Stats */}
          <div className="rounded-xl bg-slate-50 p-5 border border-slate-100">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">Entry Stats</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-2xl font-bold text-slate-900">
                  {editor ? editor.storage.characterCount?.words?.() || editor.getText().split(/\s+/).filter(Boolean).length : 0}
                </p>
                <p className="text-xs text-slate-500">Words</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">
                  {editor ? Math.ceil((editor.getText().split(/\s+/).filter(Boolean).length || 0) / 200) : 0}
                </p>
                <p className="text-xs text-slate-500">Minutes</p>
              </div>
            </div>
          </div>

          {/* Attachments */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Attachments</h3>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-cyan-600 hover:text-cyan-700 text-xs font-bold"
              >
                Add New
              </button>
            </div>
            <div className="flex flex-col gap-3">
              {images.map((img, index) => (
                <div key={index} className="group flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer border border-transparent hover:border-slate-200">
                  <div
                    className="w-12 h-12 rounded-lg bg-cover bg-center shrink-0"
                    style={{ backgroundImage: `url(${img.url})` }}
                  ></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{img.name}</p>
                    <p className="text-xs text-slate-500">Image</p>
                  </div>
                  <button
                    onClick={() => setImages(images.filter((_, i) => i !== index))}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-400 transition-all"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
              ))}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center text-center gap-2 hover:border-cyan-600/50 hover:bg-cyan-600/5 transition-all cursor-pointer group"
              >
                <span className="material-symbols-outlined text-slate-400 group-hover:text-cyan-600 transition-colors text-[32px]">cloud_upload</span>
                <p className="text-xs text-slate-500 font-medium">Drop files here or click to upload</p>
              </div>
            </div>
          </div>

          {/* Reflection Prompts */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">Reflection Prompts</h3>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => editor?.chain().focus().insertContent('What is one thing I learned today? ').run()}
                className="text-left p-3 rounded-lg bg-slate-50 hover:bg-cyan-600/5 hover:ring-1 ring-cyan-600/30 transition-all"
              >
                <p className="text-sm text-slate-700 leading-snug">What is one thing you learned today?</p>
              </button>
              <button
                onClick={() => editor?.chain().focus().insertContent('I am grateful for... ').run()}
                className="text-left p-3 rounded-lg bg-slate-50 hover:bg-cyan-600/5 hover:ring-1 ring-cyan-600/30 transition-all"
              >
                <p className="text-sm text-slate-700 leading-snug">Describe a moment of gratitude.</p>
              </button>
              <button
                onClick={() => editor?.chain().focus().insertContent('Tomorrow I want to... ').run()}
                className="text-left p-3 rounded-lg bg-slate-50 hover:bg-cyan-600/5 hover:ring-1 ring-cyan-600/30 transition-all"
              >
                <p className="text-sm text-slate-700 leading-snug">What do you want to accomplish tomorrow?</p>
              </button>
            </div>
          </div>
        </aside>
      </div>
      )}
    </div>
  )
}

// Loading fallback for Suspense
function JournalLoadingFallback() {
  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50">
      <header className="flex items-center justify-between whitespace-nowrap border-b border-slate-200 px-6 py-4 bg-white/90 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-slate-100 rounded-lg animate-pulse"></div>
          <div className="w-48 h-6 bg-slate-100 rounded animate-pulse"></div>
        </div>
      </header>
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-500">Loading journal...</p>
        </div>
      </div>
    </div>
  )
}

// Export with Suspense boundary for useSearchParams
export default function JournalEntryPage() {
  return (
    <Suspense fallback={<JournalLoadingFallback />}>
      <JournalEntryContent />
    </Suspense>
  )
}
