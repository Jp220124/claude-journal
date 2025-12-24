import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ hasProvider: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Check if user has any active API keys
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: apiKeys } = await (supabase as any)
      .from('user_ai_api_keys')
      .select('provider')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)

    const typedApiKeys = apiKeys as { provider: string }[] | null

    if (typedApiKeys && typedApiKeys.length > 0) {
      return new Response(JSON.stringify({
        hasProvider: true,
        provider: typedApiKeys[0].provider,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Check OAuth connections as fallback
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: connections } = await (supabase as any)
      .from('user_ai_connections')
      .select('provider')
      .eq('user_id', user.id)
      .limit(1)

    const typedConnections = connections as { provider: string }[] | null

    if (typedConnections && typedConnections.length > 0) {
      return new Response(JSON.stringify({
        hasProvider: true,
        provider: typedConnections[0].provider,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Check for OpenRouter API key in environment
    if (process.env.OPENROUTER_API_KEY) {
      return new Response(JSON.stringify({
        hasProvider: true,
        provider: 'openrouter',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ hasProvider: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Check config error:', error)
    return new Response(JSON.stringify({ hasProvider: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
