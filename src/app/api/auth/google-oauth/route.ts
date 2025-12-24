import { createClient } from '@/lib/supabase/server'
import { encryptApiKey } from '@/lib/ai/encryption'
import { NextRequest } from 'next/server'

export const runtime = 'nodejs'

// Google OAuth configuration for Gemini API access
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET

function getRedirectUri() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${baseUrl}/api/auth/google-oauth/callback`
}

// Scopes needed for Gemini API
const SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/generative-language.retriever',
  'openid',
  'email',
  'profile'
].join(' ')

// GET: Initiate Google OAuth flow
export async function GET() {
  const supabase = await createClient()

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!GOOGLE_CLIENT_ID) {
    return new Response(JSON.stringify({
      error: 'Google OAuth not configured',
      message: 'Please configure GOOGLE_CLIENT_ID in environment variables'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Generate state parameter to prevent CSRF
  const state = Buffer.from(JSON.stringify({
    userId: user.id,
    timestamp: Date.now(),
    random: Math.random().toString(36).substring(7)
  })).toString('base64url')

  // Build Google OAuth URL
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID)
  authUrl.searchParams.set('redirect_uri', getRedirectUri())
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', SCOPES)
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('access_type', 'offline') // Get refresh token
  authUrl.searchParams.set('prompt', 'consent') // Force consent to get refresh token

  // Return the auth URL for client-side redirect
  return new Response(JSON.stringify({ authUrl: authUrl.toString() }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

// POST: Exchange authorization code for tokens
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return new Response(JSON.stringify({
      error: 'Google OAuth not configured',
      message: 'Please configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { code, state } = await request.json()

  if (!code) {
    return new Response(JSON.stringify({ error: 'Authorization code required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Verify state parameter
  try {
    const decodedState = JSON.parse(Buffer.from(state, 'base64url').toString())
    if (decodedState.userId !== user.id) {
      return new Response(JSON.stringify({ error: 'Invalid state parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    // Check if state is not too old (5 minutes)
    if (Date.now() - decodedState.timestamp > 5 * 60 * 1000) {
      return new Response(JSON.stringify({ error: 'State expired' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid state parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: getRedirectUri(),
      }),
    })

    const tokens = await tokenResponse.json()

    if (!tokenResponse.ok) {
      console.error('Token exchange error:', tokens)
      return new Response(JSON.stringify({
        error: 'Token exchange failed',
        message: tokens.error_description || tokens.error
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Get user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    })
    const userInfo = await userInfoResponse.json()

    // Calculate token expiry time
    const expiresAt = new Date(Date.now() + (tokens.expires_in * 1000)).toISOString()

    // Encrypt tokens before storing
    const encryptedAccessToken = encryptApiKey(tokens.access_token)
    const encryptedRefreshToken = tokens.refresh_token ? encryptApiKey(tokens.refresh_token) : null

    // Store tokens in user_ai_connections table
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: upsertError } = await (supabase as any)
      .from('user_ai_connections')
      .upsert({
        user_id: user.id,
        provider: 'google',
        access_token_encrypted: encryptedAccessToken,
        refresh_token_encrypted: encryptedRefreshToken,
        token_expires_at: expiresAt,
        is_default: true,
        metadata: {
          email: userInfo.email,
          name: userInfo.name,
          picture: userInfo.picture,
          scope: tokens.scope,
        },
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,provider',
      })

    if (upsertError) {
      console.error('Error storing tokens:', upsertError)
      return new Response(JSON.stringify({
        error: 'Failed to store tokens',
        message: upsertError.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({
      success: true,
      email: userInfo.email,
      name: userInfo.name,
      message: 'Google account connected successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('OAuth error:', error)
    return new Response(JSON.stringify({
      error: 'OAuth failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

// DELETE: Disconnect Google account
export async function DELETE() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { error } = await supabase
    .from('user_ai_connections')
    .delete()
    .eq('user_id', user.id)
    .eq('provider', 'google')

  if (error) {
    return new Response(JSON.stringify({ error: 'Failed to disconnect' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
