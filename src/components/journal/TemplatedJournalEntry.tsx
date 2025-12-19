'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import {
  fetchTemplateWithSections,
  getOrCreateTemplateEntry,
  fetchTemplateEntryWithSections,
  upsertSectionEntries,
} from '@/lib/journalTemplateService'
import type {
  JournalTemplateWithSections,
  JournalTemplateSection,
  JournalTemplateSectionEntry,
} from '@/types/database'

// Mood options
const moodOptions = [
  { emoji: '😊', label: 'Great', value: 'great' },
  { emoji: '🙂', label: 'Good', value: 'good' },
  { emoji: '😐', label: 'Okay', value: 'okay' },
  { emoji: '😕', label: 'Meh', value: 'meh' },
  { emoji: '😔', label: 'Bad', value: 'bad' },
]

interface SectionContent {
  content: string
  mood?: string
}

interface TemplatedJournalEntryProps {
  templateId: string
  date: Date
  onBack: () => void
}

// Section editor component
function SectionEditor({
  section,
  content,
  mood,
  onChange,
  onMoodChange,
}: {
  section: JournalTemplateSection
  content: string
  mood?: string
  onChange: (content: string) => void
  onMoodChange: (mood: string | undefined) => void
}) {
  const [showMoodPicker, setShowMoodPicker] = useState(false)
  const moodPickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moodPickerRef.current && !moodPickerRef.current.contains(event.target as Node)) {
        setShowMoodPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedMood = moodOptions.find(m => m.value === mood)

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Section Header */}
      <div
        className="px-6 py-4 border-b border-slate-100 flex items-center justify-between"
        style={{ backgroundColor: `${section.color}08` }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${section.color}20` }}
          >
            <span
              className="material-symbols-outlined"
              style={{ color: section.color, fontSize: '20px' }}
            >
              {section.icon}
            </span>
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">{section.name}</h3>
            {section.description && (
              <p className="text-sm text-slate-500">{section.description}</p>
            )}
          </div>
        </div>

        {/* Mood Picker */}
        <div className="relative" ref={moodPickerRef}>
          <button
            onClick={() => setShowMoodPicker(!showMoodPicker)}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors',
              selectedMood
                ? 'border-slate-200 bg-slate-50'
                : 'border-slate-200 hover:border-slate-300'
            )}
          >
            {selectedMood ? (
              <>
                <span className="text-lg">{selectedMood.emoji}</span>
                <span className="text-sm text-slate-600">{selectedMood.label}</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-slate-400" style={{ fontSize: '18px' }}>
                  add_reaction
                </span>
                <span className="text-sm text-slate-400">Mood</span>
              </>
            )}
          </button>

          {showMoodPicker && (
            <div className="absolute top-full right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-200 p-2 z-50">
              <div className="flex gap-1">
                {moodOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      onMoodChange(mood === option.value ? undefined : option.value)
                      setShowMoodPicker(false)
                    }}
                    className={cn(
                      'p-2 rounded-lg transition-colors',
                      mood === option.value
                        ? 'bg-cyan-50 ring-2 ring-cyan-500'
                        : 'hover:bg-slate-50'
                    )}
                    title={option.label}
                  >
                    <span className="text-xl">{option.emoji}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content Editor */}
      <div className="p-6">
        <textarea
          value={content}
          onChange={(e) => onChange(e.target.value)}
          placeholder={section.description || `Write about ${section.name.toLowerCase()}...`}
          className="w-full min-h-[150px] resize-none border-none focus:ring-0 focus:outline-none text-slate-700 placeholder-slate-400 leading-relaxed"
          style={{ background: 'transparent' }}
        />
      </div>
    </div>
  )
}

export default function TemplatedJournalEntry({
  templateId,
  date,
  onBack,
}: TemplatedJournalEntryProps) {
  const [template, setTemplate] = useState<JournalTemplateWithSections | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [entryId, setEntryId] = useState<string | null>(null)

  // Content state: section_id -> { content, mood }
  const [sectionContents, setSectionContents] = useState<Record<string, SectionContent>>({})
  const contentRef = useRef<Record<string, SectionContent>>({})
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isInitialLoad = useRef(true)

  // Load template and entry
  useEffect(() => {
    loadTemplateAndEntry()
  }, [templateId, date])

  const loadTemplateAndEntry = async () => {
    setIsLoading(true)
    isInitialLoad.current = true

    try {
      // Load template with sections
      const templateData = await fetchTemplateWithSections(templateId)
      if (!templateData) {
        onBack()
        return
      }
      setTemplate(templateData)

      // Get or create entry for this date
      const dateStr = format(date, 'yyyy-MM-dd')
      const entry = await getOrCreateTemplateEntry(templateId, dateStr)
      if (!entry) {
        console.error('Failed to create entry')
        return
      }
      setEntryId(entry.id)

      // Load existing section entries
      const entryWithSections = await fetchTemplateEntryWithSections(templateId, dateStr)

      // Build content map from existing entries
      const contentMap: Record<string, SectionContent> = {}
      for (const section of templateData.journal_template_sections) {
        const existingEntry = entryWithSections?.journal_template_section_entries?.find(
          (e: JournalTemplateSectionEntry) => e.section_id === section.id
        )
        contentMap[section.id] = {
          content: existingEntry?.content || '',
          mood: existingEntry?.mood || undefined,
        }
      }

      setSectionContents(contentMap)
      contentRef.current = contentMap

      if (entryWithSections?.updated_at) {
        setLastSaved(new Date(entryWithSections.updated_at))
      }
    } catch (error) {
      console.error('Error loading template entry:', error)
    } finally {
      setIsLoading(false)
      setTimeout(() => {
        isInitialLoad.current = false
      }, 200)
    }
  }

  // Save entry
  const saveEntry = useCallback(async () => {
    if (!entryId || !template || isInitialLoad.current) return

    setSaveStatus('saving')
    setIsSaving(true)

    try {
      await upsertSectionEntries(
        entryId,
        template.journal_template_sections,
        contentRef.current
      )
      setLastSaved(new Date())
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (error) {
      console.error('Error saving entry:', error)
      setSaveStatus('error')
    } finally {
      setIsSaving(false)
    }
  }, [entryId, template])

  // Auto-save with debounce
  const triggerAutoSave = useCallback(() => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
    }
    autoSaveTimeoutRef.current = setTimeout(() => {
      saveEntry()
    }, 1500)
  }, [saveEntry])

  // Handle content change
  const handleContentChange = useCallback((sectionId: string, content: string) => {
    setSectionContents((prev) => ({
      ...prev,
      [sectionId]: { ...prev[sectionId], content },
    }))
    contentRef.current = {
      ...contentRef.current,
      [sectionId]: { ...contentRef.current[sectionId], content },
    }
    if (!isInitialLoad.current) {
      triggerAutoSave()
    }
  }, [triggerAutoSave])

  // Handle mood change
  const handleMoodChange = useCallback((sectionId: string, mood: string | undefined) => {
    setSectionContents((prev) => ({
      ...prev,
      [sectionId]: { ...prev[sectionId], mood },
    }))
    contentRef.current = {
      ...contentRef.current,
      [sectionId]: { ...contentRef.current[sectionId], mood },
    }
    if (!isInitialLoad.current) {
      triggerAutoSave()
    }
  }, [triggerAutoSave])

  // Cleanup
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
    }
  }, [])

  if (isLoading || !template) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-500">Loading template...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Template Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <span className="material-symbols-outlined text-slate-600" style={{ fontSize: '20px' }}>
                arrow_back
              </span>
            </button>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${template.color}20` }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ color: template.color, fontSize: '20px' }}
                >
                  {template.icon}
                </span>
              </div>
              <div>
                <h2 className="font-semibold text-slate-900">{template.name}</h2>
                <p className="text-sm text-slate-500">
                  {format(date, 'EEEE, MMMM do, yyyy')}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {saveStatus === 'saved' && (
              <span className="text-xs font-medium text-green-600 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                Saved
              </span>
            )}
            {saveStatus === 'saving' && (
              <span className="text-xs font-medium text-cyan-600 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
                Saving...
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="text-xs font-medium text-red-600 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">error</span>
                Save failed
              </span>
            )}
            {lastSaved && saveStatus === 'idle' && (
              <span className="text-xs text-slate-500">
                Last saved {format(lastSaved, 'h:mm a')}
              </span>
            )}
            <button
              onClick={saveEntry}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg font-medium hover:bg-cyan-700 transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                save
              </span>
              Save
            </button>
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
        <div className="max-w-3xl mx-auto space-y-6">
          {template.journal_template_sections.map((section) => (
            <SectionEditor
              key={section.id}
              section={section}
              content={sectionContents[section.id]?.content || ''}
              mood={sectionContents[section.id]?.mood}
              onChange={(content) => handleContentChange(section.id, content)}
              onMoodChange={(mood) => handleMoodChange(section.id, mood)}
            />
          ))}

          {/* Completion message */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl border border-green-100 p-6 text-center">
            <span className="material-symbols-outlined text-green-500 mb-2" style={{ fontSize: '32px' }}>
              task_alt
            </span>
            <h3 className="font-semibold text-slate-900 mb-1">All sections complete!</h3>
            <p className="text-sm text-slate-600">
              Great job journaling today. Your entries are saved automatically.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
