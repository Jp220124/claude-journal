import { createClient } from '@/lib/supabase/server'
import { encryptApiKey, decryptApiKey, maskApiKey } from '@/lib/ai/encryption'
import type { AIProviderType } from '@/lib/ai/providers'

export const runtime = 'nodejs'

// GET - Fetch user's API keys (masked)
export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('user_ai_api_keys')
      .select('id, user_id, provider, is_active, created_at, updated_at, api_key_encrypted')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching API keys:', error)
      return new Response(JSON.stringify({ error: 'Failed to fetch API keys' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    interface ApiKeyRecord {
      id: string
      user_id: string
      provider: string
      api_key_encrypted: string
      is_active: boolean
      created_at: string
      updated_at: string
    }

    // Mask the API keys for display
    const keys = ((data || []) as ApiKeyRecord[]).map((key) => ({
      id: key.id,
      user_id: key.user_id,
      provider: key.provider as AIProviderType,
      api_key_masked: key.api_key_encrypted ? maskApiKey(decryptApiKey(key.api_key_encrypted)) : '****',
      is_active: key.is_active,
      created_at: key.created_at,
      updated_at: key.updated_at,
    }))

    return new Response(JSON.stringify({ keys }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

// POST - Save or update an API key
export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { provider, apiKey } = await request.json()

    if (!provider || !apiKey) {
      return new Response(JSON.stringify({ error: 'Provider and API key are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const encryptedKey = encryptApiKey(apiKey)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
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
      return new Response(JSON.stringify({ error: 'Failed to save API key' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

// DELETE - Remove an API key
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { provider } = await request.json()

    if (!provider) {
      return new Response(JSON.stringify({ error: 'Provider is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('user_ai_api_keys')
      .delete()
      .eq('user_id', user.id)
      .eq('provider', provider)

    if (error) {
      console.error('Error deleting API key:', error)
      return new Response(JSON.stringify({ error: 'Failed to delete API key' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
