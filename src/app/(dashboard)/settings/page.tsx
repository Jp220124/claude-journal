'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type AIProviderType = 'google' | 'anthropic' | 'openai' | 'exa'

interface UserAIApiKey {
  id: string
  user_id: string
  provider: AIProviderType
  api_key_masked: string
  is_active: boolean
  created_at: string
  updated_at: string
}

interface GoogleOAuthConnection {
  connected: boolean
  email?: string
  name?: string
}

const providerInfo: Record<AIProviderType, { name: string; icon: string; color: string; description: string; keyUrl: string }> = {
  google: {
    name: 'Google Gemini',
    icon: 'auto_awesome',
    color: '#4285F4',
    description: 'AI chat powered by Google\'s Gemini models',
    keyUrl: 'https://aistudio.google.com/app/apikey'
  },
  anthropic: {
    name: 'Claude',
    icon: 'psychology',
    color: '#D97706',
    description: 'AI chat powered by Anthropic\'s Claude models',
    keyUrl: 'https://console.anthropic.com/settings/keys'
  },
  openai: {
    name: 'OpenAI',
    icon: 'smart_toy',
    color: '#10A37F',
    description: 'AI chat powered by OpenAI\'s GPT models',
    keyUrl: 'https://platform.openai.com/api-keys'
  },
  exa: {
    name: 'Exa Search',
    icon: 'travel_explore',
    color: '#8B5CF6',
    description: 'Web search for the Research Panel',
    keyUrl: 'https://dashboard.exa.ai/api-keys'
  },
}

type SettingsTab = 'general' | 'appearance' | 'notifications' | 'telegram' | 'ai-providers' | 'data' | 'account'

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

function SettingsPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance')
  const [theme, setTheme] = useState<Theme>('light')
  const [accentColor, setAccentColor] = useState<AccentColor>('cyan')
  const [fontSize, setFontSize] = useState(16)
  const [reduceMotion, setReduceMotion] = useState(false)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('markdown')

  // AI Providers state
  const [aiApiKeys, setAiApiKeys] = useState<UserAIApiKey[]>([])
  const [aiKeysLoading, setAiKeysLoading] = useState(true)
  const [newApiKey, setNewApiKey] = useState('')
  const [selectedProvider, setSelectedProvider] = useState<AIProviderType>('google')
  const [isSavingKey, setIsSavingKey] = useState(false)
  const [aiKeyError, setAiKeyError] = useState<string | null>(null)
  const [aiKeySuccess, setAiKeySuccess] = useState<string | null>(null)

  // Google OAuth state
  const [googleOAuth, setGoogleOAuth] = useState<GoogleOAuthConnection>({ connected: false })
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false)
  const [isDisconnectingGoogle, setIsDisconnectingGoogle] = useState(false)

  // Telegram integration state
  const [telegramIntegration, setTelegramIntegration] = useState<TelegramIntegration | null>(null)
  const [verificationCode, setVerificationCode] = useState<string | null>(null)
  const [codeExpiresAt, setCodeExpiresAt] = useState<Date | null>(null)
  const [isGeneratingCode, setIsGeneratingCode] = useState(false)
  const [telegramLoading, setTelegramLoading] = useState(true)
  const [notificationEnabled, setNotificationEnabled] = useState(true)
  const [reminderMinutes, setReminderMinutes] = useState(30)

  const supabase = createClient()

  // Handle OAuth callback from URL params
  useEffect(() => {
    const tab = searchParams.get('tab')
    const oauthCode = searchParams.get('oauth_code')
    const oauthState = searchParams.get('oauth_state')
    const oauthError = searchParams.get('oauth_error')

    // Switch to ai-providers tab if specified
    if (tab === 'ai-providers') {
      setActiveTab('ai-providers')
    }

    // Handle OAuth error
    if (oauthError) {
      setAiKeyError(`Google sign-in failed: ${oauthError}`)
      router.replace('/settings?tab=ai-providers')
      return
    }

    // Handle OAuth success - exchange code for tokens
    if (oauthCode && oauthState) {
      setIsConnectingGoogle(true)
      fetch('/api/auth/google-oauth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: oauthCode, state: oauthState }),
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setGoogleOAuth({ connected: true, email: data.email, name: data.name })
            setAiKeySuccess(`Google account connected: ${data.email}`)
          } else {
            setAiKeyError(data.message || 'Failed to connect Google account')
          }
        })
        .catch(() => {
          setAiKeyError('Failed to connect Google account')
        })
        .finally(() => {
          setIsConnectingGoogle(false)
          router.replace('/settings?tab=ai-providers')
        })
    }
  }, [searchParams, router])

  // Fetch Google OAuth connection status
  useEffect(() => {
    async function fetchGoogleOAuthStatus() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: connection } = await supabase
          .from('user_ai_connections')
          .select('metadata')
          .eq('user_id', user.id)
          .eq('provider', 'google')
          .single()

        if (connection?.metadata) {
          const metadata = connection.metadata as { email?: string; name?: string }
          setGoogleOAuth({
            connected: true,
            email: metadata.email,
            name: metadata.name,
          })
        }
      } catch (err) {
        // No connection found - that's okay
        console.debug('No Google OAuth connection found')
      }
    }
    fetchGoogleOAuthStatus()
  }, [])

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

  // Fetch AI API keys
  useEffect(() => {
    async function fetchAiKeys() {
      try {
        const response = await fetch('/api/ai/keys')
        if (response.ok) {
          const data = await response.json()
          setAiApiKeys(data.keys || [])
        }
      } catch (err) {
        console.error('Error fetching AI keys:', err)
      } finally {
        setAiKeysLoading(false)
      }
    }
    fetchAiKeys()
  }, [])

  // Save API key
  const handleSaveApiKey = async () => {
    if (!newApiKey.trim()) {
      setAiKeyError('Please enter an API key')
      return
    }

    setIsSavingKey(true)
    setAiKeyError(null)
    setAiKeySuccess(null)

    try {
      const response = await fetch('/api/ai/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: selectedProvider, apiKey: newApiKey.trim() }),
      })

      if (response.ok) {
        setAiKeySuccess(`${providerInfo[selectedProvider].name} API key saved successfully!`)
        setNewApiKey('')
        // Refresh the keys list
        const keysResponse = await fetch('/api/ai/keys')
        if (keysResponse.ok) {
          const data = await keysResponse.json()
          setAiApiKeys(data.keys || [])
        }
      } else {
        setAiKeyError('Failed to save API key. Please try again.')
      }
    } catch (err) {
      setAiKeyError('An error occurred while saving the API key.')
      console.error('Error saving API key:', err)
    } finally {
      setIsSavingKey(false)
    }
  }

  // Delete API key
  const handleDeleteApiKey = async (provider: AIProviderType) => {
    if (!confirm(`Are you sure you want to remove your ${providerInfo[provider].name} API key?`)) {
      return
    }

    try {
      const response = await fetch('/api/ai/keys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      })

      if (response.ok) {
        setAiApiKeys(aiApiKeys.filter(k => k.provider !== provider))
        setAiKeySuccess(`${providerInfo[provider].name} API key removed.`)
      } else {
        setAiKeyError('Failed to remove API key.')
      }
    } catch (err) {
      setAiKeyError('An error occurred while removing the API key.')
      console.error('Error deleting API key:', err)
    }
  }

  // Connect Google OAuth
  const handleConnectGoogle = async () => {
    setIsConnectingGoogle(true)
    setAiKeyError(null)

    try {
      const response = await fetch('/api/auth/google-oauth')
      const data = await response.json()

      if (data.authUrl) {
        // Redirect to Google OAuth
        window.location.href = data.authUrl
      } else {
        setAiKeyError(data.message || 'Failed to start Google sign-in')
        setIsConnectingGoogle(false)
      }
    } catch (err) {
      setAiKeyError('Failed to start Google sign-in')
      setIsConnectingGoogle(false)
      console.error('Error connecting Google:', err)
    }
  }

  // Disconnect Google OAuth
  const handleDisconnectGoogle = async () => {
    if (!confirm('Are you sure you want to disconnect your Google account?')) {
      return
    }

    setIsDisconnectingGoogle(true)
    setAiKeyError(null)

    try {
      const response = await fetch('/api/auth/google-oauth', {
        method: 'DELETE',
      })

      if (response.ok) {
        setGoogleOAuth({ connected: false })
        setAiKeySuccess('Google account disconnected.')
      } else {
        setAiKeyError('Failed to disconnect Google account.')
      }
    } catch (err) {
      setAiKeyError('Failed to disconnect Google account.')
      console.error('Error disconnecting Google:', err)
    } finally {
      setIsDisconnectingGoogle(false)
    }
  }

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
    { id: 'ai-providers' as SettingsTab, label: 'AI Providers', icon: 'psychology' },
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
    <div className="flex h-full overflow-hidden bg-slate-50 dark:bg-transparent">
      {/* Settings Sidebar */}
      <aside className="w-64 flex-col border-r border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-transparent hidden md:flex overflow-y-auto">
        <div className="p-6">
          <div className="flex flex-col gap-1">
            <h1 className="text-slate-900 dark:text-white text-lg font-bold leading-normal mb-1">Settings</h1>
            <p className="text-slate-500 dark:text-zinc-400 text-sm font-normal mb-6">Manage your workspace</p>
            <nav className="flex flex-col gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left ${
                    activeTab === tab.id
                      ? 'bg-white dark:bg-zinc-800 shadow-sm text-cyan-600 dark:text-cyan-400 border border-slate-200 dark:border-zinc-700'
                      : 'text-slate-500 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-800 hover:shadow-sm hover:text-slate-900 dark:hover:text-white group'
                  }`}
                >
                  <span className={`material-symbols-outlined ${
                    activeTab === tab.id ? 'text-cyan-600 dark:text-cyan-400' : 'group-hover:text-cyan-600 dark:group-hover:text-cyan-400'
                  }`}>{tab.icon}</span>
                  <p className={`text-sm leading-normal ${
                    activeTab === tab.id ? 'font-bold' : 'font-medium'
                  }`}>{tab.label}</p>
                </button>
              ))}
            </nav>
          </div>
        </div>
        <div className="mt-auto p-6 border-t border-slate-200 dark:border-zinc-700">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
            <span>Version 2.4.0</span>
            <a className="hover:text-cyan-600 dark:hover:text-cyan-400 hover:underline" href="#">Changelog</a>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-transparent p-4 md:p-10">
        <div className="max-w-[800px] mx-auto flex flex-col gap-10 pb-20">
          {/* Header */}
          <div className="flex flex-col gap-3 pb-6 border-b border-slate-200 dark:border-zinc-700">
            <h1 className="text-slate-900 dark:text-white tracking-tight text-4xl font-extrabold leading-tight">
              {activeTab === 'telegram' ? 'Telegram Bot' : activeTab === 'ai-providers' ? 'AI Providers' : 'Appearance'}
            </h1>
            <p className="text-slate-500 dark:text-zinc-400 text-lg font-normal leading-relaxed">
              {activeTab === 'telegram'
                ? 'Connect your Telegram account to add tasks and journal entries via chat or voice.'
                : activeTab === 'ai-providers'
                ? 'Configure AI providers to enable the Research Assistant in your notes.'
                : 'Customize the look and feel of your journal environment.'}
            </p>
          </div>

          {/* Telegram Integration Section */}
          {activeTab === 'telegram' && (
            <>
              {/* Connection Status */}
              <section className="flex flex-col gap-5">
                <h3 className="text-slate-900 dark:text-white text-xl font-bold">Connection Status</h3>
                <div className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-sm p-6">
                  {telegramLoading ? (
                    <div className="flex items-center gap-3">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-cyan-600 dark:border-cyan-400 border-t-transparent"></div>
                      <span className="text-slate-500 dark:text-zinc-400">Loading...</span>
                    </div>
                  ) : telegramIntegration?.is_verified ? (
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-full">
                          <span className="material-symbols-outlined text-green-600 dark:text-green-400">check_circle</span>
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">Connected</p>
                          <p className="text-sm text-slate-500 dark:text-zinc-400">
                            {telegramIntegration.platform_username
                              ? `@${telegramIntegration.platform_username}`
                              : 'Telegram account linked'}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={unlinkTelegram}
                        className="self-start px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                      >
                        Unlink Account
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-6">
                      <div className="flex items-start gap-4">
                        <div className="bg-slate-100 dark:bg-zinc-700 p-3 rounded-full shrink-0">
                          <span className="material-symbols-outlined text-slate-600 dark:text-zinc-400">link_off</span>
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">Not Connected</p>
                          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
                            Link your Telegram account to add tasks via chat, voice messages, and receive reminders.
                          </p>
                        </div>
                      </div>

                      {verificationCode ? (
                        <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-xl p-5">
                          <p className="text-sm text-slate-600 dark:text-zinc-300 mb-3">Your verification code:</p>
                          <div className="flex items-center gap-4">
                            <code className="text-3xl font-mono font-bold text-cyan-600 dark:text-cyan-400 tracking-widest">
                              {verificationCode}
                            </code>
                            <button
                              onClick={() => navigator.clipboard.writeText(verificationCode)}
                              className="p-2 hover:bg-cyan-100 dark:hover:bg-cyan-900/30 rounded-lg transition-colors"
                              title="Copy code"
                            >
                              <span className="material-symbols-outlined text-cyan-600 dark:text-cyan-400">content_copy</span>
                            </button>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-3">
                            Send this code to our bot: <strong>@YourJournalBot</strong>
                            {codeExpiresAt && (
                              <> · Expires in {Math.max(0, Math.round((codeExpiresAt.getTime() - Date.now()) / 60000))} minutes</>
                            )}
                          </p>
                          <div className="mt-4 bg-white dark:bg-zinc-800 rounded-lg p-4 border border-cyan-100 dark:border-cyan-900">
                            <p className="text-sm text-slate-600 dark:text-zinc-300 font-medium mb-2">Instructions:</p>
                            <ol className="text-sm text-slate-500 dark:text-zinc-400 list-decimal list-inside space-y-1">
                              <li>Open Telegram and search for <strong>@YourJournalBot</strong></li>
                              <li>Start the bot with /start</li>
                              <li>Send: <code className="bg-slate-100 dark:bg-zinc-700 px-1 rounded">/link {verificationCode}</code></li>
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
                  <h3 className="text-slate-900 dark:text-white text-xl font-bold">Notification Settings</h3>
                  <div className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-sm divide-y divide-slate-100 dark:divide-zinc-700">
                    {/* Enable Notifications */}
                    <div className="p-5 flex items-center justify-between">
                      <div className="flex gap-3 items-center">
                        <div className="bg-slate-50 dark:bg-zinc-700 border border-slate-200 dark:border-zinc-600 p-2 rounded-lg text-slate-900 dark:text-white">
                          <span className="material-symbols-outlined">notifications_active</span>
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">Task Reminders</p>
                          <p className="text-xs text-slate-500 dark:text-zinc-400">Receive reminders before tasks are due</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={notificationEnabled}
                          onChange={(e) => setNotificationEnabled(e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-slate-200 dark:bg-zinc-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
                      </label>
                    </div>

                    {/* Reminder Time */}
                    <div className="p-5 flex items-center justify-between">
                      <div className="flex gap-3 items-center">
                        <div className="bg-slate-50 dark:bg-zinc-700 border border-slate-200 dark:border-zinc-600 p-2 rounded-lg text-slate-900 dark:text-white">
                          <span className="material-symbols-outlined">schedule</span>
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">Remind Before</p>
                          <p className="text-xs text-slate-500 dark:text-zinc-400">How long before due time to send reminder</p>
                        </div>
                      </div>
                      <select
                        value={reminderMinutes}
                        onChange={(e) => setReminderMinutes(Number(e.target.value))}
                        className="px-3 py-2 border border-slate-200 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-600"
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
                <h3 className="text-slate-900 dark:text-white text-xl font-bold">What You Can Do</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="material-symbols-outlined text-cyan-600 dark:text-cyan-400">add_task</span>
                      <h4 className="font-semibold text-slate-900 dark:text-white">Add Tasks</h4>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-zinc-400">
                      "Add buy groceries tomorrow at 5pm"
                    </p>
                  </div>
                  <div className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="material-symbols-outlined text-cyan-600 dark:text-cyan-400">check_circle</span>
                      <h4 className="font-semibold text-slate-900 dark:text-white">Complete Tasks</h4>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-zinc-400">
                      "Done with groceries"
                    </p>
                  </div>
                  <div className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="material-symbols-outlined text-cyan-600 dark:text-cyan-400">edit_note</span>
                      <h4 className="font-semibold text-slate-900 dark:text-white">Journal Entries</h4>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-zinc-400">
                      "Journal: Had a productive day today"
                    </p>
                  </div>
                  <div className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="material-symbols-outlined text-cyan-600 dark:text-cyan-400">mic</span>
                      <h4 className="font-semibold text-slate-900 dark:text-white">Voice Messages</h4>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-zinc-400">
                      Send voice messages - we'll transcribe and understand them!
                    </p>
                  </div>
                </div>
              </section>
            </>
          )}

          {/* AI Providers Section */}
          {activeTab === 'ai-providers' && (
            <>
              {/* Status Messages */}
              {aiKeyError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-center gap-3">
                  <span className="material-symbols-outlined text-red-600 dark:text-red-400">error</span>
                  <p className="text-red-700 dark:text-red-300 text-sm">{aiKeyError}</p>
                  <button onClick={() => setAiKeyError(null)} className="ml-auto">
                    <span className="material-symbols-outlined text-red-400 hover:text-red-600">close</span>
                  </button>
                </div>
              )}
              {aiKeySuccess && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 flex items-center gap-3">
                  <span className="material-symbols-outlined text-green-600 dark:text-green-400">check_circle</span>
                  <p className="text-green-700 dark:text-green-300 text-sm">{aiKeySuccess}</p>
                  <button onClick={() => setAiKeySuccess(null)} className="ml-auto">
                    <span className="material-symbols-outlined text-green-400 hover:text-green-600">close</span>
                  </button>
                </div>
              )}

              {/* Google OAuth - Sign in with Google */}
              <section className="flex flex-col gap-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-slate-900 dark:text-white text-xl font-bold">Google Gemini</h3>
                  <span className="text-xs font-medium text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-900/30 px-2 py-1 rounded-full">
                    Recommended
                  </span>
                </div>
                <div className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-sm p-6">
                  {googleOAuth.connected ? (
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-green-500 flex items-center justify-center">
                          <span className="material-symbols-outlined text-white text-2xl">account_circle</span>
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {googleOAuth.name || 'Google Account'}
                          </p>
                          <p className="text-sm text-slate-500 dark:text-zinc-400">
                            {googleOAuth.email}
                          </p>
                        </div>
                        <div className="ml-auto flex items-center gap-2">
                          <span className="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                            Connected
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-zinc-700">
                        <p className="text-sm text-slate-500 dark:text-zinc-400">
                          Uses your Google account to access Gemini AI
                        </p>
                        <button
                          onClick={handleDisconnectGoogle}
                          disabled={isDisconnectingGoogle}
                          className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all disabled:opacity-50"
                        >
                          {isDisconnectingGoogle ? 'Disconnecting...' : 'Disconnect'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 via-red-500 to-yellow-500 flex items-center justify-center shrink-0">
                          <svg className="w-6 h-6 text-white" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                          </svg>
                        </div>
                        <div>
                          <h4 className="font-semibold text-slate-900 dark:text-white mb-1">
                            Sign in with Google
                          </h4>
                          <p className="text-sm text-slate-500 dark:text-zinc-400">
                            Connect your Google account to use Gemini AI. No API key needed - just sign in with your Google account.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={handleConnectGoogle}
                        disabled={isConnectingGoogle}
                        className="w-full bg-white dark:bg-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-600 text-slate-900 dark:text-white font-semibold py-3 px-6 rounded-xl border border-slate-200 dark:border-zinc-600 shadow-sm hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                      >
                        {isConnectingGoogle ? (
                          <>
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-400 border-t-transparent"></div>
                            Connecting...
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                            Continue with Google
                          </>
                        )}
                      </button>
                      <p className="text-xs text-center text-slate-400 dark:text-zinc-500">
                        Or add an API key below for other providers
                      </p>
                    </div>
                  )}
                </div>
              </section>

              {/* Connected Providers */}
              <section className="flex flex-col gap-5">
                <h3 className="text-slate-900 dark:text-white text-xl font-bold">Connected Providers</h3>
                <div className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-sm">
                  {aiKeysLoading ? (
                    <div className="p-6 flex items-center gap-3">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-cyan-600 dark:border-cyan-400 border-t-transparent"></div>
                      <span className="text-slate-500 dark:text-zinc-400">Loading...</span>
                    </div>
                  ) : aiApiKeys.length === 0 ? (
                    <div className="p-6 text-center">
                      <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-zinc-700 mx-auto mb-4 flex items-center justify-center">
                        <span className="material-symbols-outlined text-3xl text-slate-400 dark:text-zinc-500">key_off</span>
                      </div>
                      <p className="text-slate-500 dark:text-zinc-400 mb-2">No API keys configured</p>
                      <p className="text-sm text-slate-400 dark:text-zinc-500">Add an API key below to start using the AI Research Assistant.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-zinc-700">
                      {aiApiKeys.map((key) => (
                        <div key={key.id} className="p-5 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div
                              className="w-10 h-10 rounded-lg flex items-center justify-center"
                              style={{ backgroundColor: `${providerInfo[key.provider].color}20` }}
                            >
                              <span
                                className="material-symbols-outlined"
                                style={{ color: providerInfo[key.provider].color }}
                              >
                                {providerInfo[key.provider].icon}
                              </span>
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-white">
                                {providerInfo[key.provider].name}
                              </p>
                              <p className="text-sm text-slate-500 dark:text-zinc-400 font-mono">
                                {key.api_key_masked}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {key.is_active && (
                              <span className="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                                Active
                              </span>
                            )}
                            <button
                              onClick={() => handleDeleteApiKey(key.provider)}
                              className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                              title="Remove API key"
                            >
                              <span className="material-symbols-outlined">delete</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {/* Add New API Key */}
              <section className="flex flex-col gap-5">
                <h3 className="text-slate-900 dark:text-white text-xl font-bold">Add API Key</h3>
                <div className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-sm p-6">
                  <div className="space-y-4">
                    {/* Provider Selection */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
                        Select Provider
                      </label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {(['google', 'anthropic', 'openai', 'exa'] as AIProviderType[]).map((provider) => (
                          <label
                            key={provider}
                            className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${
                              selectedProvider === provider
                                ? 'border-cyan-600 bg-cyan-50 dark:bg-cyan-900/20'
                                : 'border-slate-200 dark:border-zinc-700 hover:border-slate-300 dark:hover:border-zinc-600'
                            }`}
                          >
                            <input
                              type="radio"
                              name="provider"
                              value={provider}
                              checked={selectedProvider === provider}
                              onChange={() => setSelectedProvider(provider)}
                              className="sr-only"
                            />
                            <div className="flex flex-col items-center gap-2 text-center">
                              <span
                                className="material-symbols-outlined text-2xl"
                                style={{ color: providerInfo[provider].color }}
                              >
                                {providerInfo[provider].icon}
                              </span>
                              <span className="text-sm font-medium text-slate-700 dark:text-zinc-300">
                                {providerInfo[provider].name}
                              </span>
                            </div>
                          </label>
                        ))}
                      </div>
                      <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
                        {providerInfo[selectedProvider].description}
                      </p>
                    </div>

                    {/* API Key Input */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
                        API Key
                      </label>
                      <input
                        type="password"
                        value={newApiKey}
                        onChange={(e) => setNewApiKey(e.target.value)}
                        placeholder={`Enter your ${providerInfo[selectedProvider].name} API key`}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-600"
                      />
                      <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
                        Get your API key from{' '}
                        <a
                          href={providerInfo[selectedProvider].keyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-cyan-600 hover:underline inline-flex items-center gap-1"
                        >
                          {providerInfo[selectedProvider].name}
                          <span className="material-symbols-outlined text-xs">open_in_new</span>
                        </a>
                      </p>
                    </div>

                    <button
                      onClick={handleSaveApiKey}
                      disabled={isSavingKey || !newApiKey.trim()}
                      className="w-full bg-cyan-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-cyan-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isSavingKey ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                          Saving...
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined">save</span>
                          Save API Key
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </section>

              {/* Security Note */}
              <section className="flex flex-col gap-5">
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-5">
                  <div className="flex gap-4">
                    <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 shrink-0">security</span>
                    <div>
                      <h4 className="font-semibold text-amber-800 dark:text-amber-300 mb-1">Security Note</h4>
                      <p className="text-sm text-amber-700 dark:text-amber-400">
                        Your API keys are encrypted before being stored. They are only decrypted server-side when making AI requests.
                        We never log or expose your keys. For maximum security, consider using keys with limited permissions.
                      </p>
                    </div>
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
              <h3 className="text-slate-900 dark:text-white text-xl font-bold">Interface Theme</h3>
              <span className="text-xs font-medium text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">
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
                <div className="flex flex-col gap-3 p-4 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-sm hover:border-cyan-600/50 peer-checked:border-cyan-600 peer-checked:ring-1 peer-checked:ring-cyan-600 peer-checked:bg-cyan-600/5 dark:peer-checked:bg-cyan-600/10 transition-all h-full">
                  <div className="w-full aspect-video rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 dark:from-zinc-600 dark:to-zinc-700 border border-slate-200 dark:border-zinc-600 relative overflow-hidden">
                    <div className="absolute inset-y-0 left-0 w-1/2 bg-white dark:bg-zinc-500"></div>
                    <div className="absolute bottom-2 right-2 flex gap-1">
                      <div className="size-2 rounded-full bg-cyan-600"></div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">System Default</span>
                    <span className={`material-symbols-outlined text-cyan-600 dark:text-cyan-400 transition-opacity ${
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
                <div className="flex flex-col gap-3 p-4 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-sm hover:border-cyan-600/50 peer-checked:border-cyan-600 peer-checked:ring-1 peer-checked:ring-cyan-600 peer-checked:bg-cyan-600/5 dark:peer-checked:bg-cyan-600/10 transition-all h-full">
                  <div className="w-full aspect-video rounded-lg bg-[#111f22] border border-gray-200 dark:border-zinc-600 relative overflow-hidden">
                    <div className="absolute top-3 left-3 w-16 h-2 rounded bg-white/10"></div>
                    <div className="absolute top-7 left-3 w-10 h-2 rounded bg-white/10"></div>
                    <div className="absolute bottom-3 right-3 size-6 rounded-full bg-cyan-600/80"></div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">Dark Mode</span>
                    <span className={`material-symbols-outlined text-cyan-600 dark:text-cyan-400 transition-opacity ${
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
                <div className="flex flex-col gap-3 p-4 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-sm hover:border-cyan-600/50 peer-checked:border-cyan-600 peer-checked:ring-1 peer-checked:ring-cyan-600 peer-checked:bg-cyan-600/5 dark:peer-checked:bg-cyan-600/10 transition-all h-full">
                  <div className="w-full aspect-video rounded-lg bg-[#f8fafc] border border-gray-200 dark:border-zinc-600 relative overflow-hidden">
                    <div className="absolute top-3 left-3 w-16 h-2 rounded bg-gray-300"></div>
                    <div className="absolute top-7 left-3 w-10 h-2 rounded bg-gray-200"></div>
                    <div className="absolute bottom-3 right-3 size-6 rounded-full bg-cyan-600"></div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">Light Mode</span>
                    <span className={`material-symbols-outlined text-cyan-600 dark:text-cyan-400 transition-opacity ${
                      theme === 'light' ? 'opacity-100' : 'opacity-0'
                    }`}>check_circle</span>
                  </div>
                </div>
              </label>
            </div>
          </section>

          {/* Accent Color Section */}
          <section className="flex flex-col gap-5 pt-4">
            <h3 className="text-slate-900 dark:text-white text-xl font-bold">Accent Color</h3>
            <div className="bg-white dark:bg-zinc-800 rounded-xl p-5 border border-slate-200 dark:border-zinc-700 shadow-sm flex flex-wrap gap-4 items-center">
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
                        ? 'border-slate-300 dark:border-zinc-500'
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
                  <span className="block text-center text-xs mt-2 text-slate-500 dark:text-zinc-400 group-hover:text-slate-900 dark:group-hover:text-white">{color.label}</span>
                </label>
              ))}
            </div>
          </section>

          {/* Typography & View Section */}
          <section className="flex flex-col gap-5 pt-4">
            <h3 className="text-slate-900 dark:text-white text-xl font-bold">Typography &amp; View</h3>
            <div className="flex flex-col gap-4 bg-white dark:bg-zinc-800 rounded-xl p-5 border border-slate-200 dark:border-zinc-700 shadow-sm">
              {/* Font Size */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex gap-3 items-center">
                  <div className="bg-slate-50 dark:bg-zinc-700 border border-slate-200 dark:border-zinc-600 p-2 rounded-lg text-slate-900 dark:text-white">
                    <span className="material-symbols-outlined">format_size</span>
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">Editor Font Size</p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">Adjust the text size for reading entries.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-slate-50 dark:bg-zinc-700 p-1 rounded-lg border border-slate-200 dark:border-zinc-600">
                  <button
                    onClick={() => setFontSize(Math.max(12, fontSize - 2))}
                    className="size-8 flex items-center justify-center rounded hover:bg-white dark:hover:bg-zinc-600 hover:shadow-sm text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-all"
                  >
                    <span className="text-xs font-bold">A-</span>
                  </button>
                  <span className="text-sm font-medium w-8 text-center text-slate-900 dark:text-white">{fontSize}px</span>
                  <button
                    onClick={() => setFontSize(Math.min(24, fontSize + 2))}
                    className="size-8 flex items-center justify-center rounded hover:bg-white dark:hover:bg-zinc-600 hover:shadow-sm text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-all"
                  >
                    <span className="text-base font-bold">A+</span>
                  </button>
                </div>
              </div>

              <hr className="border-slate-200 dark:border-zinc-700" />

              {/* Reduce Motion */}
              <div className="flex items-center justify-between">
                <div className="flex gap-3 items-center">
                  <div className="bg-slate-50 dark:bg-zinc-700 border border-slate-200 dark:border-zinc-600 p-2 rounded-lg text-slate-900 dark:text-white">
                    <span className="material-symbols-outlined">animation</span>
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">Reduce Motion</p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">Minimize animations across the app.</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={reduceMotion}
                    onChange={(e) => setReduceMotion(e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-slate-200 dark:bg-zinc-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
                </label>
              </div>
            </div>
          </section>

          {/* Data & Export Section */}
          <section className="flex flex-col gap-5 pt-4">
            <div className="flex justify-between items-end">
              <h3 className="text-slate-900 dark:text-white text-xl font-bold">Data &amp; Export</h3>
              <a className="text-sm text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors font-medium" href="#">
                Manage backups →
              </a>
            </div>
            <div className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-sm overflow-hidden">
              <div className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="bg-cyan-600/10 dark:bg-cyan-600/20 p-3 rounded-full text-cyan-600 dark:text-cyan-400 shrink-0">
                    <span className="material-symbols-outlined">ios_share</span>
                  </div>
                  <div>
                    <h4 className="text-slate-900 dark:text-white font-bold text-base">Quick Export</h4>
                    <p className="text-slate-500 dark:text-zinc-400 text-sm mt-1">Download a copy of your journal entries in your preferred format.</p>
                    <div className="flex gap-3 mt-3">
                      <div className="flex items-center gap-2">
                        <input
                          className="w-4 h-4 text-cyan-600 bg-white dark:bg-zinc-700 border-gray-300 dark:border-zinc-600 focus:ring-cyan-600 focus:ring-2"
                          id="fmt-pdf"
                          name="export-fmt"
                          type="radio"
                          checked={exportFormat === 'pdf'}
                          onChange={() => setExportFormat('pdf')}
                        />
                        <label className="text-sm text-slate-500 dark:text-zinc-400" htmlFor="fmt-pdf">PDF</label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          className="w-4 h-4 text-cyan-600 bg-white dark:bg-zinc-700 border-gray-300 dark:border-zinc-600 focus:ring-cyan-600 focus:ring-2"
                          id="fmt-md"
                          name="export-fmt"
                          type="radio"
                          checked={exportFormat === 'markdown'}
                          onChange={() => setExportFormat('markdown')}
                        />
                        <label className="text-sm text-slate-500 dark:text-zinc-400" htmlFor="fmt-md">Markdown</label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          className="w-4 h-4 text-cyan-600 bg-white dark:bg-zinc-700 border-gray-300 dark:border-zinc-600 focus:ring-cyan-600 focus:ring-2"
                          id="fmt-json"
                          name="export-fmt"
                          type="radio"
                          checked={exportFormat === 'json'}
                          onChange={() => setExportFormat('json')}
                        />
                        <label className="text-sm text-slate-500 dark:text-zinc-400" htmlFor="fmt-json">JSON</label>
                      </div>
                    </div>
                  </div>
                </div>
                <button className="px-5 py-2.5 bg-white dark:bg-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-600 text-slate-900 dark:text-white font-semibold rounded-lg border border-slate-200 dark:border-zinc-600 transition-all flex items-center gap-2 whitespace-nowrap shadow-sm hover:shadow">
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

// Wrap with Suspense to handle useSearchParams
export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900">
        <div className="flex items-center gap-3 text-zinc-500">
          <span className="material-symbols-outlined animate-spin">progress_activity</span>
          <span>Loading settings...</span>
        </div>
      </div>
    }>
      <SettingsPageContent />
    </Suspense>
  )
}
