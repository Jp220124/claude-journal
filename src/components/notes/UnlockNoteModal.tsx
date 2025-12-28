'use client'

import { useState, useEffect, useRef } from 'react'

interface UnlockNoteModalProps {
  isOpen: boolean
  onClose: () => void
  onUnlock: (password: string) => Promise<void>
  noteTitle?: string
}

export function UnlockNoteModal({
  isOpen,
  onClose,
  onUnlock,
  noteTitle,
}: UnlockNoteModalProps) {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      setPassword('')
      setError(null)
      setShowPassword(false)
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!password) {
      setError('Please enter the password')
      return
    }

    setIsLoading(true)
    try {
      await onUnlock(password)
      setAttempts(0)
      onClose()
    } catch (err) {
      setAttempts(prev => prev + 1)
      setError(err instanceof Error ? err.message : 'Incorrect password')
      setPassword('')
      inputRef.current?.focus()
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        ref={modalRef}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-cyan-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-cyan-600">lock_open</span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Unlock Note</h3>
            {noteTitle && (
              <p className="text-sm text-slate-500 truncate max-w-[280px]">{noteTitle}</p>
            )}
          </div>
        </div>

        <p className="text-slate-600 text-sm mb-6">
          This note is password protected. Enter the password to view its content.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">
              Password
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full px-4 py-3 pr-12 border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined text-xl">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">error</span>
              <span>{error}</span>
              {attempts >= 3 && (
                <span className="text-xs text-red-500 ml-auto">
                  {attempts} failed attempts
                </span>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !password}
              className="px-4 py-2 bg-cyan-600 text-white rounded-xl font-medium hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-lg">refresh</span>
                  Unlocking...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">lock_open</span>
                  Unlock
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
