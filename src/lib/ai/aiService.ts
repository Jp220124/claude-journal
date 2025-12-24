import { createClient } from '@/lib/supabase/client'
import { encryptApiKey, decryptApiKey, maskApiKey } from './encryption'
import type { AIProviderType } from './providers'

export interface UserAIApiKey {
  id: string
  user_id: string
  provider: AIProviderType
  api_key_masked: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface UserAIConnection {
  id: string
  user_id: string
  provider: AIProviderType
  is_default: boolean
  token_expires_at: string | null
  created_at: string
  updated_at: string
}

/**
 * Get user's API keys (masked for display)
 */
export async function getUserApiKeys(): Promise<UserAIApiKey[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('user_ai_api_keys')
    .select('id, user_id, provider, is_active, created_at, updated_at, api_key_encrypted')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching API keys:', error)
    return []
  }

  // Mask the API keys for display
  return (data || []).map((key) => ({
    id: key.id,
    user_id: key.user_id,
    provider: key.provider as AIProviderType,
    api_key_masked: key.api_key_encrypted ? maskApiKey(decryptApiKey(key.api_key_encrypted)) : '****',
    is_active: key.is_active,
    created_at: key.created_at,
    updated_at: key.updated_at,
  }))
}

/**
 * Save or update an API key for a provider
 */
export async function saveApiKey(provider: AIProviderType, apiKey: string): Promise<boolean> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    console.error('User not authenticated')
    return false
  }

  const encryptedKey = encryptApiKey(apiKey)

  const { error } = await supabase
    .from('user_ai_api_keys')
    .upsert(
      {
        user_id: user.id,
        provider,
        api_key_encrypted: encryptedKey,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,provider',
      }
    )

  if (error) {
    console.error('Error saving API key:', error)
    return false
  }

  return true
}

/**
 * Delete an API key
 */
export async function deleteApiKey(provider: AIProviderType): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase
    .from('user_ai_api_keys')
    .delete()
    .eq('provider', provider)

  if (error) {
    console.error('Error deleting API key:', error)
    return false
  }

  return true
}

/**
 * Get the decrypted API key for a provider (server-side only)
 */
export async function getDecryptedApiKey(provider: AIProviderType, userId: string): Promise<string | null> {
  // This function should only be called from server-side code
  if (typeof window !== 'undefined') {
    throw new Error('getDecryptedApiKey should only be called from server-side code')
  }

  const { createClient: createServerClient } = await import('@/lib/supabase/server')
  const supabase = await createServerClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('user_ai_api_keys')
    .select('api_key_encrypted')
    .eq('user_id', userId)
    .eq('provider', provider)
    .eq('is_active', true)
    .single()

  const typedData = data as { api_key_encrypted: string } | null

  if (error || !typedData?.api_key_encrypted) {
    return null
  }

  return decryptApiKey(typedData.api_key_encrypted)
}

/**
 * Get user's OAuth connections
 */
export async function getUserConnections(): Promise<UserAIConnection[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('user_ai_connections')
    .select('id, user_id, provider, is_default, token_expires_at, created_at, updated_at')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching connections:', error)
    return []
  }

  return (data || []).map((conn) => ({
    ...conn,
    provider: conn.provider as AIProviderType,
  }))
}

/**
 * Check if user has any configured AI provider
 */
export async function hasConfiguredProvider(): Promise<{ hasProvider: boolean; provider?: AIProviderType }> {
  const supabase = createClient()

  // Check API keys first
  const { data: apiKeys } = await supabase
    .from('user_ai_api_keys')
    .select('provider')
    .eq('is_active', true)
    .limit(1)

  if (apiKeys && apiKeys.length > 0) {
    return { hasProvider: true, provider: apiKeys[0].provider as AIProviderType }
  }

  // Check OAuth connections
  const { data: connections } = await supabase
    .from('user_ai_connections')
    .select('provider')
    .limit(1)

  if (connections && connections.length > 0) {
    return { hasProvider: true, provider: connections[0].provider as AIProviderType }
  }

  return { hasProvider: false }
}
