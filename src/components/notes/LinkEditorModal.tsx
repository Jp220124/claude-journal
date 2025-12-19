'use client'

import { useState, useEffect, useRef } from 'react'

interface LinkEditorModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (url: string) => void
  initialUrl?: string
  selectedText?: string
}

export function LinkEditorModal({
  isOpen,
  onClose,
  onSave,
  initialUrl = '',
  selectedText = '',
}: LinkEditorModalProps) {
  const [url, setUrl] = useState(initialUrl)
  const inputRef = useRef<HTMLInputElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setUrl(initialUrl)
  }, [initialUrl, isOpen])

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(url)
  }

  const handleRemoveLink = () => {
    onSave('')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        ref={modalRef}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
      >
        <h3 className="text-lg font-bold text-slate-900 mb-4">
          {initialUrl ? 'Edit Link' : 'Insert Link'}
        </h3>

        <form onSubmit={handleSubmit}>
          {selectedText && (
            <div className="mb-4">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">
                Selected Text
              </label>
              <p className="text-sm text-slate-700 bg-slate-50 px-3 py-2 rounded-lg">
                {selectedText}
              </p>
            </div>
          )}

          <div className="mb-6">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">
              URL
            </label>
            <input
              ref={inputRef}
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
            />
          </div>

          <div className="flex items-center justify-between">
            {initialUrl && (
              <button
                type="button"
                onClick={handleRemoveLink}
                className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
              >
                Remove Link
              </button>
            )}
            <div className="flex items-center gap-3 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-cyan-600 text-white rounded-xl font-medium hover:bg-cyan-700 transition-colors"
              >
                {initialUrl ? 'Update' : 'Insert'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
