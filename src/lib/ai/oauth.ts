import { SupabaseClient } from '@supabase/supabase-js'
import { decryptApiKey, encryptApiKey } from './encryption'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET

interface OAuthConnection {
  id: string
  user_id: string
  provider: string
  access_token_encrypted: string | null
  refresh_token_encrypted: string | null
  token_expires_at: string | null
  is_default: boolean
  metadata: {
    email?: string
    name?: string
    picture?: string
    scope?: string
  } | null
}

interface TokenResult {
  accessToken: string
  email?: string
  name?: string
}

/**
 * Get a valid access token for the specified provider.
 * Automatically refreshes the token if it's expired.
 */
export async function getValidAccessToken(
  supabase: SupabaseClient,
  userId: string,
  provider: 'google' | 'anthropic' | 'openai' = 'google'
): Promise<TokenResult | null> {
  // Fetch the OAuth connection
  const { data: connection, error } = await supabase
    .from('user_ai_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', provider)
    .single()

  if (error || !connection) {
    return null
  }

  const conn = connection as OAuthConnection

  if (!conn.access_token_encrypted) {
    return null
  }

  // Check if token is expired (with 5-minute buffer)
  const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at) : null
  const isExpired = expiresAt && expiresAt.getTime() < Date.now() + 5 * 60 * 1000

  if (isExpired && conn.refresh_token_encrypted && provider === 'google') {
    // Refresh the token
    const refreshedToken = await refreshGoogleToken(
      supabase,
      userId,
      decryptApiKey(conn.refresh_token_encrypted)
    )
    if (refreshedToken) {
      return {
        accessToken: refreshedToken,
        email: conn.metadata?.email,
        name: conn.metadata?.name,
      }
    }
    return null
  }

  // Token is still valid
  return {
    accessToken: decryptApiKey(conn.access_token_encrypted),
    email: conn.metadata?.email,
    name: conn.metadata?.name,
  }
}

/**
 * Refresh a Google OAuth token using the refresh token.
 */
async function refreshGoogleToken(
  supabase: SupabaseClient,
  userId: string,
  refreshToken: string
): Promise<string | null> {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    console.error('Google OAuth credentials not configured')
    return null
  }

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })

    const tokens = await response.json()

    if (!response.ok) {
      console.error('Token refresh failed:', tokens)
      return null
    }

    // Calculate new expiry time
    const expiresAt = new Date(Date.now() + (tokens.expires_in * 1000)).toISOString()

    // Update the stored tokens
    const { error } = await supabase
      .from('user_ai_connections')
      .update({
        access_token_encrypted: encryptApiKey(tokens.access_token),
        token_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('provider', 'google')

    if (error) {
      console.error('Error updating refreshed token:', error)
      return null
    }

    return tokens.access_token
  } catch (error) {
    console.error('Error refreshing token:', error)
    return null
  }
}

/**
 * Check if the user has a valid OAuth connection for the specified provider.
 */
export async function hasOAuthConnection(
  supabase: SupabaseClient,
  userId: string,
  provider: 'google' | 'anthropic' | 'openai' = 'google'
): Promise<{ connected: boolean; email?: string; name?: string }> {
  const { data: connection, error } = await supabase
    .from('user_ai_connections')
    .select('metadata')
    .eq('user_id', userId)
    .eq('provider', provider)
    .single()

  if (error || !connection) {
    return { connected: false }
  }

  const metadata = connection.metadata as OAuthConnection['metadata']

  return {
    connected: true,
    email: metadata?.email,
    name: metadata?.name,
  }
}

/**
 * Get OAuth connection status for display in settings.
 */
export async function getOAuthConnectionStatus(
  supabase: SupabaseClient,
  userId: string
): Promise<{
  google: { connected: boolean; email?: string; name?: string }
}> {
  const google = await hasOAuthConnection(supabase, userId, 'google')

  return { google }
}
