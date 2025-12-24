'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  fetchTemplateWithSections,
  updateTemplate,
  createSection,
  updateSection,
  deleteSection,
  reorderSections,
} from '@/lib/journalTemplateService'
import type { JournalTemplateSection } from '@/types/database'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// Icon options for templates and sections
const iconOptions = [
  'auto_stories', 'book', 'menu_book', 'edit_note', 'description',
  'wb_sunny', 'wb_twilight', 'nights_stay', 'light_mode', 'dark_mode',
  'work', 'business_center', 'laptop', 'code', 'school',
  'fitness_center', 'self_improvement', 'spa', 'psychology', 'favorite',
  'restaurant', 'coffee', 'local_cafe', 'cake', 'emoji_food_beverage',
  'directions_run', 'hiking', 'pool', 'sports_soccer', 'sports_basketball',
  'music_note', 'palette', 'brush', 'camera', 'movie',
  'flight', 'explore', 'public', 'nature', 'park',
  'groups', 'family_restroom', 'pets', 'child_care', 'volunteer_activism',
  'attach_money', 'savings', 'shopping_cart', 'receipt', 'credit_card',
  'task_alt', 'flag', 'star', 'grade', 'emoji_events',
  'sentiment_very_satisfied', 'sentiment_satisfied', 'mood', 'celebration', 'rocket_launch',
]

// Color options
const colorOptions = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#64748b', '#78716c', '#71717a',
]

interface EditableSection {
  id: string
  name: string
  description: string
  icon: string
  color: string
  isNew?: boolean
  isDeleted?: boolean
}

// Sortable section item component
function SortableSectionItem({
  section,
  onUpdate,
  onRemove,
  showIconPicker,
  setShowIconPicker,
  showColorPicker,
  setShowColorPicker,
}: {
  section: EditableSection
  onUpdate: (id: string, field: keyof EditableSection, value: string) => void
  onRemove: (id: string) => void
  showIconPicker: string | null
  setShowIconPicker: (id: string | null) => void
  showColorPicker: string | null
  setShowColorPicker: (id: string | null) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  if (section.isDeleted) return null

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'bg-white rounded-xl border border-slate-200 p-4 transition-shadow',
        isDragging && 'shadow-lg ring-2 ring-cyan-500 z-50'
      )}
    >
      <div className="flex items-start gap-4">
        {/* Drag Handle */}
        <button
          {...attributes}
          {...listeners}
          className="mt-2 p-1 text-slate-400 hover:text-slate-600 cursor-grab active:cursor-grabbing"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
            drag_indicator
          </span>
        </button>

        {/* Section Icon */}
        <div className="relative">
          <button
            onClick={() => setShowIconPicker(showIconPicker === `section-${section.id}` ? null : `section-${section.id}`)}
            className="w-12 h-12 rounded-xl flex items-center justify-center transition-colors"
            style={{ backgroundColor: `${section.color}20` }}
          >
            <span
              className="material-symbols-outlined"
              style={{ color: section.color, fontSize: '24px' }}
            >
              {section.icon}
            </span>
          </button>

          {/* Icon Picker Dropdown */}
          {showIconPicker === `section-${section.id}` && (
            <div className="absolute top-14 left-0 z-50 bg-white rounded-xl shadow-xl border border-slate-200 p-3 w-64">
              <p className="text-xs font-medium text-slate-500 mb-2">Choose Icon</p>
              <div className="grid grid-cols-6 gap-1 max-h-48 overflow-y-auto">
                {iconOptions.map((icon) => (
                  <button
                    key={icon}
                    onClick={() => {
                      onUpdate(section.id, 'icon', icon)
                      setShowIconPicker(null)
                    }}
                    className={cn(
                      'p-2 rounded-lg hover:bg-slate-100 transition-colors',
                      section.icon === icon && 'bg-cyan-100'
                    )}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                      {icon}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Section Details */}
        <div className="flex-1 space-y-3">
          <input
            type="text"
            value={section.name}
            onChange={(e) => onUpdate(section.id, 'name', e.target.value)}
            placeholder="Section name"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent font-medium"
          />
          <input
            type="text"
            value={section.description}
            onChange={(e) => onUpdate(section.id, 'description', e.target.value)}
            placeholder="Optional description or prompt"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm text-slate-600"
          />

          {/* Color Picker */}
          <div className="relative">
            <button
              onClick={() => setShowColorPicker(showColorPicker === `section-${section.id}` ? null : `section-${section.id}`)}
              className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: section.color }}
              />
              <span className="text-xs text-slate-600">Color</span>
            </button>

            {showColorPicker === `section-${section.id}` && (
              <div className="absolute top-10 left-0 z-50 bg-white rounded-xl shadow-xl border border-slate-200 p-3">
                <div className="grid grid-cols-5 gap-1">
                  {colorOptions.map((color) => (
                    <button
                      key={color}
                      onClick={() => {
                        onUpdate(section.id, 'color', color)
                        setShowColorPicker(null)
                      }}
                      className={cn(
                        'w-8 h-8 rounded-lg transition-transform hover:scale-110',
                        section.color === color && 'ring-2 ring-offset-2 ring-slate-400'
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Remove Button */}
        <button
          onClick={() => onRemove(section.id)}
          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
            close
          </span>
        </button>
      </div>
    </div>
  )
}

export default function EditTemplatePage() {
  const router = useRouter()
  const params = useParams()
  const templateId = params.id as string

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Template form state
  const [templateName, setTemplateName] = useState('')
  const [templateDescription, setTemplateDescription] = useState('')
  const [templateIcon, setTemplateIcon] = useState('auto_stories')
  const [templateColor, setTemplateColor] = useState('#6366f1')

  // Sections state
  const [sections, setSections] = useState<EditableSection[]>([])
  const [originalSections, setOriginalSections] = useState<JournalTemplateSection[]>([])

  // Picker visibility state
  const [showIconPicker, setShowIconPicker] = useState<string | null>(null)
  const [showColorPicker, setShowColorPicker] = useState<string | null>(null)

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    loadTemplate()
  }, [templateId])

  const loadTemplate = async () => {
    setIsLoading(true)
    const data = await fetchTemplateWithSections(templateId)

    if (!data) {
      router.push('/templates')
      return
    }

    setTemplateName(data.name)
    setTemplateDescription(data.description || '')
    setTemplateIcon(data.icon)
    setTemplateColor(data.color)

    const editableSections: EditableSection[] = data.journal_template_sections.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description || '',
      icon: s.icon,
      color: s.color,
    }))

    setSections(editableSections)
    setOriginalSections(data.journal_template_sections)
    setIsLoading(false)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setSections((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id)
        const newIndex = items.findIndex((i) => i.id === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  const addSection = () => {
    setSections([
      ...sections,
      {
        id: crypto.randomUUID(),
        name: '',
        description: '',
        icon: 'notes',
        color: '#8b5cf6',
        isNew: true,
      },
    ])
  }

  const updateSectionField = useCallback((id: string, field: keyof EditableSection, value: string) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    )
  }, [])

  const removeSection = useCallback((id: string) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, isDeleted: true } : s))
    )
  }, [])

  const handleSave = async () => {
    if (!templateName.trim()) {
      alert('Please enter a template name')
      return
    }

    const validSections = sections.filter((s) => s.name.trim() && !s.isDeleted)
    if (validSections.length === 0) {
      alert('Please add at least one section with a name')
      return
    }

    setIsSaving(true)

    try {
      // Update the template
      await updateTemplate(templateId, {
        name: templateName.trim(),
        description: templateDescription.trim() || null,
        icon: templateIcon,
        color: templateColor,
      })

      // Handle sections
      // 1. Delete removed sections
      const deletedSections = sections.filter((s) => s.isDeleted && !s.isNew)
      for (const section of deletedSections) {
        await deleteSection(section.id)
      }

      // 2. Create new sections
      const newSections = validSections.filter((s) => s.isNew)
      for (let i = 0; i < newSections.length; i++) {
        const section = newSections[i]
        const orderIndex = validSections.indexOf(section)
        await createSection({
          template_id: templateId,
          name: section.name.trim(),
          description: section.description.trim() || null,
          icon: section.icon,
          color: section.color,
          order_index: orderIndex,
        })
      }

      // 3. Update existing sections
      const existingSections = validSections.filter((s) => !s.isNew)
      for (const section of existingSections) {
        const original = originalSections.find((o) => o.id === section.id)
        if (original) {
          const hasChanges =
            original.name !== section.name.trim() ||
            original.description !== section.description.trim() ||
            original.icon !== section.icon ||
            original.color !== section.color

          if (hasChanges) {
            await updateSection(section.id, {
              name: section.name.trim(),
              description: section.description.trim() || null,
              icon: section.icon,
              color: section.color,
            })
          }
        }
      }

      // 4. Reorder sections if needed
      const sectionIds = validSections.map((s) => s.id).filter((id) => !sections.find((s) => s.id === id)?.isNew)
      if (sectionIds.length > 0) {
        await reorderSections(templateId, sectionIds)
      }

      // Navigate back to templates list
      router.push('/templates')
    } catch (error) {
      console.error('Error saving template:', error)
      alert('Failed to save template. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  // Close pickers when clicking outside
  const handlePageClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (!target.closest('[data-picker]')) {
      setShowIconPicker(null)
      setShowColorPicker(null)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-full bg-slate-50 dark:bg-transparent flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600"></div>
          <p className="text-slate-500 dark:text-zinc-400">Loading template...</p>
        </div>
      </div>
    )
  }

  const visibleSections = sections.filter((s) => !s.isDeleted)

  return (
    <div className="min-h-full bg-slate-50 dark:bg-transparent" onClick={handlePageClick}>
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/templates"
            className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
          >
            <span className="material-symbols-outlined text-slate-600 dark:text-zinc-400" style={{ fontSize: '24px' }}>
              arrow_back
            </span>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Edit Template</h1>
            <p className="text-slate-500 dark:text-zinc-400 mt-1">
              Modify your template and sections
            </p>
          </div>
        </div>

        {/* Template Info Card */}
        <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Template Details</h2>

          <div className="flex items-start gap-6">
            {/* Icon & Color Selection */}
            <div className="space-y-3" data-picker>
              {/* Icon Button */}
              <div className="relative">
                <button
                  onClick={() => setShowIconPicker(showIconPicker === 'template' ? null : 'template')}
                  className="w-16 h-16 rounded-xl flex items-center justify-center transition-colors"
                  style={{ backgroundColor: `${templateColor}20` }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ color: templateColor, fontSize: '32px' }}
                  >
                    {templateIcon}
                  </span>
                </button>

                {showIconPicker === 'template' && (
                  <div className="absolute top-20 left-0 z-50 bg-white rounded-xl shadow-xl border border-slate-200 p-3 w-72">
                    <p className="text-xs font-medium text-slate-500 mb-2">Choose Icon</p>
                    <div className="grid grid-cols-7 gap-1 max-h-48 overflow-y-auto">
                      {iconOptions.map((icon) => (
                        <button
                          key={icon}
                          onClick={() => {
                            setTemplateIcon(icon)
                            setShowIconPicker(null)
                          }}
                          className={cn(
                            'p-2 rounded-lg hover:bg-slate-100 transition-colors',
                            templateIcon === icon && 'bg-cyan-100'
                          )}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                            {icon}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Color Button */}
              <div className="relative">
                <button
                  onClick={() => setShowColorPicker(showColorPicker === 'template' ? null : 'template')}
                  className="w-16 h-8 rounded-lg border-2 border-slate-200 transition-colors hover:border-slate-300"
                  style={{ backgroundColor: templateColor }}
                />

                {showColorPicker === 'template' && (
                  <div className="absolute top-10 left-0 z-50 bg-white rounded-xl shadow-xl border border-slate-200 p-3">
                    <div className="grid grid-cols-5 gap-1">
                      {colorOptions.map((color) => (
                        <button
                          key={color}
                          onClick={() => {
                            setTemplateColor(color)
                            setShowColorPicker(null)
                          }}
                          className={cn(
                            'w-8 h-8 rounded-lg transition-transform hover:scale-110',
                            templateColor === color && 'ring-2 ring-offset-2 ring-slate-400'
                          )}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Name & Description */}
            <div className="flex-1 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Template Name *
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g., Daily Routine, Work Log, Gratitude"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  placeholder="Brief description of what this template is for"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-slate-600"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Sections Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Sections</h2>
              <p className="text-sm text-slate-500">
                Edit or reorder your journal sections
              </p>
            </div>
            <button
              onClick={addSection}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                add
              </span>
              Add Section
            </button>
          </div>

          {/* Sortable Sections */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={visibleSections} strategy={verticalListSortingStrategy}>
              <div className="space-y-3" data-picker>
                {visibleSections.map((section) => (
                  <SortableSectionItem
                    key={section.id}
                    section={section}
                    onUpdate={updateSectionField}
                    onRemove={removeSection}
                    showIconPicker={showIconPicker}
                    setShowIconPicker={setShowIconPicker}
                    showColorPicker={showColorPicker}
                    setShowColorPicker={setShowColorPicker}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {visibleSections.length === 0 && (
            <div className="text-center py-8">
              <span className="material-symbols-outlined text-slate-300 mb-2 block" style={{ fontSize: '48px' }}>
                view_list
              </span>
              <p className="text-slate-500">No sections. Add your first section above.</p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3">
          <Link
            href="/templates"
            className="px-6 py-3 text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition-colors"
          >
            Cancel
          </Link>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-3 bg-cyan-600 text-white rounded-xl font-medium hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                  save
                </span>
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
