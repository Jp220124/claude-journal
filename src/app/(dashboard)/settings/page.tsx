'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

type SettingsTab = 'general' | 'appearance' | 'notifications' | 'telegram' | 'data' | 'account'

interface TelegramIntegration {
  id: string
  is_verified: boolean
  platform_username: string | null
  notification_enabled: boolean
  reminder_minutes_before: number
  daily_summary_enabled: boolean
  daily_summary_time: string
  created_at: string
}
type Theme = 'system' | 'dark' | 'light'
type AccentColor = 'cyan' | 'purple' | 'pink' | 'amber' | 'green'
type ExportFormat = 'pdf' | 'markdown' | 'json'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance')
  const [theme, setTheme] = useState<Theme>('light')
  const [accentColor, setAccentColor] = useState<AccentColor>('cyan')
  const [fontSize, setFontSize] = useState(16)
  const [reduceMotion, setReduceMotion] = useState(false)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('markdown')

  // Telegram integration state
  const [telegramIntegration, setTelegramIntegration] = useState<TelegramIntegration | null>(null)
  const [verificationCode, setVerificationCode] = useState<string | null>(null)
  const [codeExpiresAt, setCodeExpiresAt] = useState<Date | null>(null)
  const [isGeneratingCode, setIsGeneratingCode] = useState(false)
  const [telegramLoading, setTelegramLoading] = useState(true)
  const [notificationEnabled, setNotificationEnabled] = useState(true)
  const [reminderMinutes, setReminderMinutes] = useState(30)

  const supabase = createClient()

  // Fetch Telegram integration status
  useEffect(() => {
    async function fetchTelegramIntegration() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data, error } = await supabase
          .from('user_integrations')
          .select('*')
          .eq('user_id', user.id)
          .eq('platform', 'telegram')
          .single()

        if (data && !error) {
          setTelegramIntegration(data as TelegramIntegration)
          setNotificationEnabled(data.notification_enabled)
          setReminderMinutes(data.reminder_minutes_before)
        }
      } catch (err) {
        console.error('Error fetching integration:', err)
      } finally {
        setTelegramLoading(false)
      }
    }

    fetchTelegramIntegration()
  }, [])

  // Generate verification code
  const generateVerificationCode = async () => {
    setIsGeneratingCode(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Generate a random 6-digit code
      const code = Math.floor(100000 + Math.random() * 900000).toString()
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes from now

      // Upsert the integration record with the verification code
      const { error } = await supabase
        .from('user_integrations')
        .upsert({
          user_id: user.id,
          platform: 'telegram',
          platform_chat_id: 'pending',
          verification_code: code,
          code_expires_at: expiresAt.toISOString(),
          is_verified: false,
        }, {
          onConflict: 'user_id,platform',
          ignoreDuplicates: false,
        })

      if (error) {
        // If conflict on unique constraint, update instead
        const { error: updateError } = await supabase
          .from('user_integrations')
          .update({
            verification_code: code,
            code_expires_at: expiresAt.toISOString(),
            is_verified: false,
            platform_chat_id: 'pending',
          })
          .eq('user_id', user.id)
          .eq('platform', 'telegram')

        if (updateError) {
          console.error('Error generating code:', updateError)
          return
        }
      }

      setVerificationCode(code)
      setCodeExpiresAt(expiresAt)
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setIsGeneratingCode(false)
    }
  }

  // Unlink Telegram
  const unlinkTelegram = async () => {
    if (!confirm('Are you sure you want to unlink your Telegram account?')) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('user_integrations')
        .delete()
        .eq('user_id', user.id)
        .eq('platform', 'telegram')

      if (!error) {
        setTelegramIntegration(null)
        setVerificationCode(null)
      }
    } catch (err) {
      console.error('Error unlinking:', err)
    }
  }

  // Update notification settings
  const updateNotificationSettings = async () => {
    if (!telegramIntegration) return

    try {
      const { error } = await supabase
        .from('user_integrations')
        .update({
          notification_enabled: notificationEnabled,
          reminder_minutes_before: reminderMinutes,
        })
        .eq('id', telegramIntegration.id)

      if (!error) {
        setTelegramIntegration({
          ...telegramIntegration,
          notification_enabled: notificationEnabled,
          reminder_minutes_before: reminderMinutes,
        })
      }
    } catch (err) {
      console.error('Error updating settings:', err)
    }
  }

  const tabs = [
    { id: 'general' as SettingsTab, label: 'General', icon: 'settings' },
    { id: 'appearance' as SettingsTab, label: 'Appearance', icon: 'palette' },
    { id: 'notifications' as SettingsTab, label: 'Notifications', icon: 'notifications' },
    { id: 'telegram' as SettingsTab, label: 'Telegram Bot', icon: 'smart_toy' },
    { id: 'data' as SettingsTab, label: 'Data & Export', icon: 'download' },
    { id: 'account' as SettingsTab, label: 'Account', icon: 'person' },
  ]

  const accentColors = [
    { id: 'cyan' as AccentColor, color: '#06b6d4', label: 'Cyan' },
    { id: 'purple' as AccentColor, color: '#a855f7', label: 'Purple' },
    { id: 'pink' as AccentColor, color: '#ec4899', label: 'Pink' },
    { id: 'amber' as AccentColor, color: '#f59e0b', label: 'Amber' },
    { id: 'green' as AccentColor, color: '#22c55e', label: 'Green' },
  ]

  return (
    <div className="flex h-full overflow-hidden bg-slate-50">
      {/* Settings Sidebar */}
      <aside className="w-64 flex-col border-r border-slate-200 bg-slate-50 hidden md:flex overflow-y-auto">
        <div className="p-6">
          <div className="flex flex-col gap-1">
            <h1 className="text-slate-900 text-lg font-bold leading-normal mb-1">Settings</h1>
            <p className="text-slate-500 text-sm font-normal mb-6">Manage your workspace</p>
            <nav className="flex flex-col gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left ${
                    activeTab === tab.id
                      ? 'bg-white shadow-sm text-cyan-600 border border-slate-200'
                      : 'text-slate-500 hover:bg-white hover:shadow-sm hover:text-slate-900 group'
                  }`}
                >
                  <span className={`material-symbols-outlined ${
                    activeTab === tab.id ? 'text-cyan-600' : 'group-hover:text-cyan-600'
                  }`}>{tab.icon}</span>
                  <p className={`text-sm leading-normal ${
                    activeTab === tab.id ? 'font-bold' : 'font-medium'
                  }`}>{tab.label}</p>
                </button>
              ))}
            </nav>
          </div>
        </div>
        <div className="mt-auto p-6 border-t border-slate-200">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Version 2.4.0</span>
            <a className="hover:text-cyan-600 hover:underline" href="#">Changelog</a>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-10">
        <div className="max-w-[800px] mx-auto flex flex-col gap-10 pb-20">
          {/* Header */}
          <div className="flex flex-col gap-3 pb-6 border-b border-slate-200">
            <h1 className="text-slate-900 tracking-tight text-4xl font-extrabold leading-tight">
              {activeTab === 'telegram' ? 'Telegram Bot' : 'Appearance'}
            </h1>
            <p className="text-slate-500 text-lg font-normal leading-relaxed">
              {activeTab === 'telegram'
                ? 'Connect your Telegram account to add tasks and journal entries via chat or voice.'
                : 'Customize the look and feel of your journal environment.'}
            </p>
          </div>

          {/* Telegram Integration Section */}
          {activeTab === 'telegram' && (
            <>
              {/* Connection Status */}
              <section className="flex flex-col gap-5">
                <h3 className="text-slate-900 text-xl font-bold">Connection Status</h3>
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                  {telegramLoading ? (
                    <div className="flex items-center gap-3">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-cyan-600 border-t-transparent"></div>
                      <span className="text-slate-500">Loading...</span>
                    </div>
                  ) : telegramIntegration?.is_verified ? (
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-green-100 p-2 rounded-full">
                          <span className="material-symbols-outlined text-green-600">check_circle</span>
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">Connected</p>
                          <p className="text-sm text-slate-500">
                            {telegramIntegration.platform_username
                              ? `@${telegramIntegration.platform_username}`
                              : 'Telegram account linked'}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={unlinkTelegram}
                        className="self-start px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all"
                      >
                        Unlink Account
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-6">
                      <div className="flex items-start gap-4">
                        <div className="bg-slate-100 p-3 rounded-full shrink-0">
                          <span className="material-symbols-outlined text-slate-600">link_off</span>
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">Not Connected</p>
                          <p className="text-sm text-slate-500 mt-1">
                            Link your Telegram account to add tasks via chat, voice messages, and receive reminders.
                          </p>
                        </div>
                      </div>

                      {verificationCode ? (
                        <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-5">
                          <p className="text-sm text-slate-600 mb-3">Your verification code:</p>
                          <div className="flex items-center gap-4">
                            <code className="text-3xl font-mono font-bold text-cyan-600 tracking-widest">
                              {verificationCode}
                            </code>
                            <button
                              onClick={() => navigator.clipboard.writeText(verificationCode)}
                              className="p-2 hover:bg-cyan-100 rounded-lg transition-colors"
                              title="Copy code"
                            >
                              <span className="material-symbols-outlined text-cyan-600">content_copy</span>
                            </button>
                          </div>
                          <p className="text-xs text-slate-500 mt-3">
                            Send this code to our bot: <strong>@YourJournalBot</strong>
                            {codeExpiresAt && (
                              <> · Expires in {Math.max(0, Math.round((codeExpiresAt.getTime() - Date.now()) / 60000))} minutes</>
                            )}
                          </p>
                          <div className="mt-4 bg-white rounded-lg p-4 border border-cyan-100">
                            <p className="text-sm text-slate-600 font-medium mb-2">Instructions:</p>
                            <ol className="text-sm text-slate-500 list-decimal list-inside space-y-1">
                              <li>Open Telegram and search for <strong>@YourJournalBot</strong></li>
                              <li>Start the bot with /start</li>
                              <li>Send: <code className="bg-slate-100 px-1 rounded">/link {verificationCode}</code></li>
                            </ol>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={generateVerificationCode}
                          disabled={isGeneratingCode}
                          className="self-start bg-cyan-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-cyan-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          {isGeneratingCode ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                              Generating...
                            </>
                          ) : (
                            <>
                              <span className="material-symbols-outlined">link</span>
                              Generate Link Code
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </section>

              {/* Notification Settings (only shown when connected) */}
              {telegramIntegration?.is_verified && (
                <section className="flex flex-col gap-5">
                  <h3 className="text-slate-900 text-xl font-bold">Notification Settings</h3>
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100">
                    {/* Enable Notifications */}
                    <div className="p-5 flex items-center justify-between">
                      <div className="flex gap-3 items-center">
                        <div className="bg-slate-50 border border-slate-200 p-2 rounded-lg text-slate-900">
                          <span className="material-symbols-outlined">notifications_active</span>
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">Task Reminders</p>
                          <p className="text-xs text-slate-500">Receive reminders before tasks are due</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={notificationEnabled}
                          onChange={(e) => setNotificationEnabled(e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
                      </label>
                    </div>

                    {/* Reminder Time */}
                    <div className="p-5 flex items-center justify-between">
                      <div className="flex gap-3 items-center">
                        <div className="bg-slate-50 border border-slate-200 p-2 rounded-lg text-slate-900">
                          <span className="material-symbols-outlined">schedule</span>
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">Remind Before</p>
                          <p className="text-xs text-slate-500">How long before due time to send reminder</p>
                        </div>
                      </div>
                      <select
                        value={reminderMinutes}
                        onChange={(e) => setReminderMinutes(Number(e.target.value))}
                        className="px-3 py-2 border border-slate-200 rounded-lg bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-600"
                      >
                        <option value={15}>15 minutes</option>
                        <option value={30}>30 minutes</option>
                        <option value={60}>1 hour</option>
                        <option value={120}>2 hours</option>
                      </select>
                    </div>
                  </div>
                  <button
                    onClick={updateNotificationSettings}
                    className="self-end bg-cyan-600 text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-cyan-700 transition-all flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-lg">save</span>
                    Save Settings
                  </button>
                </section>
              )}

              {/* Features Info */}
              <section className="flex flex-col gap-5">
                <h3 className="text-slate-900 text-xl font-bold">What You Can Do</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="material-symbols-outlined text-cyan-600">add_task</span>
                      <h4 className="font-semibold text-slate-900">Add Tasks</h4>
                    </div>
                    <p className="text-sm text-slate-500">
                      "Add buy groceries tomorrow at 5pm"
                    </p>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="material-symbols-outlined text-cyan-600">check_circle</span>
                      <h4 className="font-semibold text-slate-900">Complete Tasks</h4>
                    </div>
                    <p className="text-sm text-slate-500">
                      "Done with groceries"
                    </p>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="material-symbols-outlined text-cyan-600">edit_note</span>
                      <h4 className="font-semibold text-slate-900">Journal Entries</h4>
                    </div>
                    <p className="text-sm text-slate-500">
                      "Journal: Had a productive day today"
                    </p>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="material-symbols-outlined text-cyan-600">mic</span>
                      <h4 className="font-semibold text-slate-900">Voice Messages</h4>
                    </div>
                    <p className="text-sm text-slate-500">
                      Send voice messages - we'll transcribe and understand them!
                    </p>
                  </div>
                </div>
              </section>
            </>
          )}

          {/* Appearance Content (only when appearance tab is active) */}
          {activeTab === 'appearance' && (
            <>
          {/* Interface Theme Section */}
          <section className="flex flex-col gap-5">
            <div className="flex justify-between items-end">
              <h3 className="text-slate-900 text-xl font-bold">Interface Theme</h3>
              <span className="text-xs font-medium text-cyan-600 uppercase tracking-wider">
                Active: {theme.charAt(0).toUpperCase() + theme.slice(1)}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* System Theme */}
              <label className="group relative cursor-pointer">
                <input
                  className="peer sr-only"
                  name="theme"
                  type="radio"
                  checked={theme === 'system'}
                  onChange={() => setTheme('system')}
                />
                <div className="flex flex-col gap-3 p-4 rounded-xl border border-slate-200 bg-white shadow-sm hover:border-cyan-600/50 peer-checked:border-cyan-600 peer-checked:ring-1 peer-checked:ring-cyan-600 peer-checked:bg-cyan-600/5 transition-all h-full">
                  <div className="w-full aspect-video rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 border border-slate-200 relative overflow-hidden">
                    <div className="absolute inset-y-0 left-0 w-1/2 bg-white"></div>
                    <div className="absolute bottom-2 right-2 flex gap-1">
                      <div className="size-2 rounded-full bg-cyan-600"></div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-900 group-hover:text-cyan-600 transition-colors">System Default</span>
                    <span className={`material-symbols-outlined text-cyan-600 transition-opacity ${
                      theme === 'system' ? 'opacity-100' : 'opacity-0'
                    }`}>check_circle</span>
                  </div>
                </div>
              </label>

              {/* Dark Theme */}
              <label className="group relative cursor-pointer">
                <input
                  className="peer sr-only"
                  name="theme"
                  type="radio"
                  checked={theme === 'dark'}
                  onChange={() => setTheme('dark')}
                />
                <div className="flex flex-col gap-3 p-4 rounded-xl border border-slate-200 bg-white shadow-sm hover:border-cyan-600/50 peer-checked:border-cyan-600 peer-checked:ring-1 peer-checked:ring-cyan-600 peer-checked:bg-cyan-600/5 transition-all h-full">
                  <div className="w-full aspect-video rounded-lg bg-[#111f22] border border-gray-200 relative overflow-hidden">
                    <div className="absolute top-3 left-3 w-16 h-2 rounded bg-white/10"></div>
                    <div className="absolute top-7 left-3 w-10 h-2 rounded bg-white/10"></div>
                    <div className="absolute bottom-3 right-3 size-6 rounded-full bg-cyan-600/80"></div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-900 group-hover:text-cyan-600 transition-colors">Dark Mode</span>
                    <span className={`material-symbols-outlined text-cyan-600 transition-opacity ${
                      theme === 'dark' ? 'opacity-100' : 'opacity-0'
                    }`}>check_circle</span>
                  </div>
                </div>
              </label>

              {/* Light Theme */}
              <label className="group relative cursor-pointer">
                <input
                  className="peer sr-only"
                  name="theme"
                  type="radio"
                  checked={theme === 'light'}
                  onChange={() => setTheme('light')}
                />
                <div className="flex flex-col gap-3 p-4 rounded-xl border border-slate-200 bg-white shadow-sm hover:border-cyan-600/50 peer-checked:border-cyan-600 peer-checked:ring-1 peer-checked:ring-cyan-600 peer-checked:bg-cyan-600/5 transition-all h-full">
                  <div className="w-full aspect-video rounded-lg bg-[#f8fafc] border border-gray-200 relative overflow-hidden">
                    <div className="absolute top-3 left-3 w-16 h-2 rounded bg-gray-300"></div>
                    <div className="absolute top-7 left-3 w-10 h-2 rounded bg-gray-200"></div>
                    <div className="absolute bottom-3 right-3 size-6 rounded-full bg-cyan-600"></div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-900 group-hover:text-cyan-600 transition-colors">Light Mode</span>
                    <span className={`material-symbols-outlined text-cyan-600 transition-opacity ${
                      theme === 'light' ? 'opacity-100' : 'opacity-0'
                    }`}>check_circle</span>
                  </div>
                </div>
              </label>
            </div>
          </section>

          {/* Accent Color Section */}
          <section className="flex flex-col gap-5 pt-4">
            <h3 className="text-slate-900 text-xl font-bold">Accent Color</h3>
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-wrap gap-4 items-center">
              {accentColors.map((color) => (
                <label key={color.id} className="cursor-pointer group">
                  <input
                    className="sr-only peer"
                    name="accent"
                    type="radio"
                    checked={accentColor === color.id}
                    onChange={() => setAccentColor(color.id)}
                  />
                  <div
                    className={`size-10 rounded-full border-2 transition-all hover:scale-110 flex items-center justify-center ${
                      accentColor === color.id
                        ? 'border-slate-300'
                        : 'border-transparent'
                    }`}
                    style={{
                      backgroundColor: color.color,
                      boxShadow: accentColor === color.id ? `0 0 0 2px ${color.color}40` : 'none'
                    }}
                  >
                    <span className={`material-symbols-outlined text-white text-lg transition-opacity ${
                      accentColor === color.id ? 'opacity-100' : 'opacity-0'
                    }`}>check</span>
                  </div>
                  <span className="block text-center text-xs mt-2 text-slate-500 group-hover:text-slate-900">{color.label}</span>
                </label>
              ))}
            </div>
          </section>

          {/* Typography & View Section */}
          <section className="flex flex-col gap-5 pt-4">
            <h3 className="text-slate-900 text-xl font-bold">Typography &amp; View</h3>
            <div className="flex flex-col gap-4 bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
              {/* Font Size */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex gap-3 items-center">
                  <div className="bg-slate-50 border border-slate-200 p-2 rounded-lg text-slate-900">
                    <span className="material-symbols-outlined">format_size</span>
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">Editor Font Size</p>
                    <p className="text-xs text-slate-500">Adjust the text size for reading entries.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-slate-50 p-1 rounded-lg border border-slate-200">
                  <button
                    onClick={() => setFontSize(Math.max(12, fontSize - 2))}
                    className="size-8 flex items-center justify-center rounded hover:bg-white hover:shadow-sm text-slate-500 hover:text-slate-900 transition-all"
                  >
                    <span className="text-xs font-bold">A-</span>
                  </button>
                  <span className="text-sm font-medium w-8 text-center text-slate-900">{fontSize}px</span>
                  <button
                    onClick={() => setFontSize(Math.min(24, fontSize + 2))}
                    className="size-8 flex items-center justify-center rounded hover:bg-white hover:shadow-sm text-slate-500 hover:text-slate-900 transition-all"
                  >
                    <span className="text-base font-bold">A+</span>
                  </button>
                </div>
              </div>

              <hr className="border-slate-200" />

              {/* Reduce Motion */}
              <div className="flex items-center justify-between">
                <div className="flex gap-3 items-center">
                  <div className="bg-slate-50 border border-slate-200 p-2 rounded-lg text-slate-900">
                    <span className="material-symbols-outlined">animation</span>
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">Reduce Motion</p>
                    <p className="text-xs text-slate-500">Minimize animations across the app.</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={reduceMotion}
                    onChange={(e) => setReduceMotion(e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
                </label>
              </div>
            </div>
          </section>

          {/* Data & Export Section */}
          <section className="flex flex-col gap-5 pt-4">
            <div className="flex justify-between items-end">
              <h3 className="text-slate-900 text-xl font-bold">Data &amp; Export</h3>
              <a className="text-sm text-cyan-600 hover:text-cyan-700 transition-colors font-medium" href="#">
                Manage backups →
              </a>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="bg-cyan-600/10 p-3 rounded-full text-cyan-600 shrink-0">
                    <span className="material-symbols-outlined">ios_share</span>
                  </div>
                  <div>
                    <h4 className="text-slate-900 font-bold text-base">Quick Export</h4>
                    <p className="text-slate-500 text-sm mt-1">Download a copy of your journal entries in your preferred format.</p>
                    <div className="flex gap-3 mt-3">
                      <div className="flex items-center gap-2">
                        <input
                          className="w-4 h-4 text-cyan-600 bg-white border-gray-300 focus:ring-cyan-600 focus:ring-2"
                          id="fmt-pdf"
                          name="export-fmt"
                          type="radio"
                          checked={exportFormat === 'pdf'}
                          onChange={() => setExportFormat('pdf')}
                        />
                        <label className="text-sm text-slate-500" htmlFor="fmt-pdf">PDF</label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          className="w-4 h-4 text-cyan-600 bg-white border-gray-300 focus:ring-cyan-600 focus:ring-2"
                          id="fmt-md"
                          name="export-fmt"
                          type="radio"
                          checked={exportFormat === 'markdown'}
                          onChange={() => setExportFormat('markdown')}
                        />
                        <label className="text-sm text-slate-500" htmlFor="fmt-md">Markdown</label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          className="w-4 h-4 text-cyan-600 bg-white border-gray-300 focus:ring-cyan-600 focus:ring-2"
                          id="fmt-json"
                          name="export-fmt"
                          type="radio"
                          checked={exportFormat === 'json'}
                          onChange={() => setExportFormat('json')}
                        />
                        <label className="text-sm text-slate-500" htmlFor="fmt-json">JSON</label>
                      </div>
                    </div>
                  </div>
                </div>
                <button className="px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-900 font-semibold rounded-lg border border-slate-200 transition-all flex items-center gap-2 whitespace-nowrap shadow-sm hover:shadow">
                  <span className="material-symbols-outlined text-lg">download</span>
                  Export Now
                </button>
              </div>
            </div>
          </section>

          {/* Save Button */}
          <div className="flex justify-end pt-6">
            <button className="bg-cyan-600 text-white font-bold text-base py-3 px-8 rounded-full shadow-lg shadow-cyan-600/20 hover:bg-cyan-700 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2">
              <span>Save Changes</span>
              <span className="material-symbols-outlined text-lg">check</span>
            </button>
          </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
