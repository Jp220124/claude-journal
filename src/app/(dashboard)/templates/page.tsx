'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  fetchTemplates,
  setDefaultTemplate,
  archiveTemplate,
  createStarterTemplates,
  hasTemplates,
} from '@/lib/journalTemplateService'
import type { JournalTemplate } from '@/types/database'

export default function TemplatesPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<JournalTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)

  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    setIsLoading(true)

    // Check if user has templates, if not create starter templates
    const hasExisting = await hasTemplates()
    if (!hasExisting) {
      await createStarterTemplates()
    }

    const data = await fetchTemplates()
    setTemplates(data)
    setIsLoading(false)
  }

  const handleSetDefault = async (id: string) => {
    const success = await setDefaultTemplate(id)
    if (success) {
      setTemplates(templates.map(t => ({
        ...t,
        is_default: t.id === id,
      })))
    }
  }

  const handleArchive = async (id: string) => {
    const success = await archiveTemplate(id)
    if (success) {
      setTemplates(templates.filter(t => t.id !== id))
      setShowDeleteConfirm(null)
    }
  }

  const handleUseTemplate = (templateId: string) => {
    // Navigate to journal page with template selected
    router.push(`/journal?template=${templateId}`)
  }

  if (isLoading) {
    return (
      <div className="min-h-full bg-slate-50 dark:bg-transparent flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600"></div>
          <p className="text-slate-500 dark:text-zinc-400">Loading templates...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-slate-50 dark:bg-transparent">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Journal Templates</h1>
            <p className="text-slate-500 dark:text-zinc-400 mt-1">
              Create custom templates for structured journaling
            </p>
          </div>
          <Link
            href="/templates/new"
            className="flex items-center gap-2 px-5 py-2.5 bg-cyan-600 text-white rounded-xl font-medium hover:bg-cyan-700 transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>add</span>
            New Template
          </Link>
        </div>

        {/* Templates Grid */}
        {templates.length === 0 ? (
          <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 p-12 text-center">
            <span
              className="material-symbols-outlined text-slate-300 dark:text-zinc-600 mb-4 block"
              style={{ fontSize: '64px' }}
            >
              style
            </span>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No templates yet</h3>
            <p className="text-slate-500 dark:text-zinc-400 mb-6">
              Create your first template to start structured journaling
            </p>
            <Link
              href="/templates/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-cyan-600 text-white rounded-xl font-medium hover:bg-cyan-700 transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>add</span>
              Create Template
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => (
              <div
                key={template.id}
                className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 overflow-hidden hover:shadow-lg transition-shadow relative"
              >
                {/* Template Header */}
                <div
                  className="h-3"
                  style={{ backgroundColor: template.color }}
                />

                <div className="p-6">
                  {/* Icon & Name */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: `${template.color}20` }}
                      >
                        <span
                          className="material-symbols-outlined"
                          style={{ color: template.color, fontSize: '24px' }}
                        >
                          {template.icon}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                          {template.name}
                          {template.is_default && (
                            <span className="text-xs bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded-full font-medium">
                              Default
                            </span>
                          )}
                        </h3>
                        {template.description && (
                          <p className="text-sm text-slate-500 dark:text-zinc-400 line-clamp-1">
                            {template.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-4 border-t border-slate-100 dark:border-zinc-700">
                    <button
                      onClick={() => handleUseTemplate(template.id)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-zinc-700 text-slate-700 dark:text-zinc-200 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-zinc-600 transition-colors"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                        edit_note
                      </span>
                      Use Today
                    </button>

                    <Link
                      href={`/templates/${template.id}/edit`}
                      className="p-2.5 text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-xl transition-colors"
                      title="Edit template"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                        edit
                      </span>
                    </Link>

                    {!template.is_default && (
                      <button
                        onClick={() => handleSetDefault(template.id)}
                        className="p-2.5 text-slate-400 dark:text-zinc-500 hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-900/30 rounded-xl transition-colors"
                        title="Set as default"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                          star
                        </span>
                      </button>
                    )}

                    <button
                      onClick={() => setShowDeleteConfirm(template.id)}
                      className="p-2.5 text-slate-400 dark:text-zinc-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-colors"
                      title="Delete template"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                        delete
                      </span>
                    </button>
                  </div>
                </div>

                {/* Delete Confirmation */}
                {showDeleteConfirm === template.id && (
                  <div className="absolute inset-0 bg-white/95 dark:bg-zinc-800/95 flex flex-col items-center justify-center p-6 rounded-2xl z-10">
                    <span
                      className="material-symbols-outlined text-red-500 mb-3"
                      style={{ fontSize: '48px' }}
                    >
                      warning
                    </span>
                    <p className="text-slate-900 dark:text-white font-medium text-center mb-2">
                      Delete "{template.name}"?
                    </p>
                    <p className="text-slate-500 dark:text-zinc-400 text-sm text-center mb-6">
                      This will archive the template. Your existing entries will be preserved.
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowDeleteConfirm(null)}
                        className="px-4 py-2 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-xl transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleArchive(template.id)}
                        className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Help Section */}
        <div className="mt-12 bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-zinc-800 dark:to-zinc-800 rounded-2xl border border-cyan-100 dark:border-zinc-700 p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-cyan-100 dark:bg-cyan-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-cyan-600 dark:text-cyan-400" style={{ fontSize: '24px' }}>
                lightbulb
              </span>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-1">How Templates Work</h3>
              <p className="text-slate-600 dark:text-zinc-400 text-sm leading-relaxed">
                Templates help you structure your daily journaling with predefined sections.
                Create sections like "Morning Routine", "Work", "Exercise", or "Evening Reflection"
                and fill them in each day. Your entries are saved per template per day, so you
                can track different aspects of your life separately.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
