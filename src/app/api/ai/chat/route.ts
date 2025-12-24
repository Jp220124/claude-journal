import { streamText, convertToModelMessages, UIMessage } from 'ai'
import { createClient } from '@/lib/supabase/server'
import { createAIProvider, createGoogleOAuthProvider, defaultSystemPrompt, type AIProviderType } from '@/lib/ai/providers'
import { decryptApiKey } from '@/lib/ai/encryption'
import { getValidAccessToken } from '@/lib/ai/oauth'

export const runtime = 'nodejs'
export const maxDuration = 60

interface ChatRequest {
  messages: UIMessage[]
  provider?: AIProviderType
  model?: string
  noteContent?: string
  noteId?: string
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const body: ChatRequest = await request.json()
    const { messages, provider: requestedProvider, model, noteContent } = body

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Messages are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Determine provider and authentication method
    let provider: AIProviderType = requestedProvider || 'openrouter'
    let apiKey: string | null = null
    let oauthToken: string | null = null

    // First, check if OpenRouter is available as the default provider
    const openRouterKey = process.env.OPENROUTER_API_KEY
    if (openRouterKey) {
      console.log('OpenRouter API key found, using OpenRouter as default provider')
      apiKey = openRouterKey
      provider = 'openrouter'
    }

    // Only check database if user explicitly requested a specific provider
    if (requestedProvider && requestedProvider !== 'openrouter') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: apiKeyData } = await (supabase as any)
        .from('user_ai_api_keys')
        .select('api_key_encrypted, provider')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .eq('provider', requestedProvider)
        .single()

      const typedApiKeyData = apiKeyData as { api_key_encrypted: string; provider: string } | null

      if (typedApiKeyData) {
        const decryptedKey = decryptApiKey(typedApiKeyData.api_key_encrypted)
        if (decryptedKey && decryptedKey.length > 0) {
          apiKey = decryptedKey
          provider = typedApiKeyData.provider as AIProviderType
          console.log(`Using user-configured ${provider} provider`)
        }
      }

      // Try Google OAuth token if provider is Google and no API key yet
      if (requestedProvider === 'google' && !apiKey) {
        const tokenResult = await getValidAccessToken(supabase, user.id, 'google')
        if (tokenResult) {
          oauthToken = tokenResult.accessToken
          console.log('Using Google OAuth token')
        }
      }
    }

    console.log(`Final provider: ${provider}, has API key: ${!!apiKey}, has OAuth: ${!!oauthToken}`)

    // Check if we have any authentication method
    if (!oauthToken && !apiKey) {
      return new Response(JSON.stringify({
        error: 'No AI provider configured',
        message: 'Please add an API key in Settings to use AI chat.',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Build system prompt with note context if provided
    let systemPrompt = defaultSystemPrompt
    if (noteContent) {
      systemPrompt += `\n\n---\n\n**Current Note Content:**\n${noteContent.slice(0, 4000)}`
    }

    // Create the AI provider instance
    let aiModel
    if (oauthToken && provider === 'google') {
      // Use OAuth token for Google Gemini
      aiModel = createGoogleOAuthProvider({
        accessToken: oauthToken,
        model,
      })
    } else {
      // Use API key for other providers
      aiModel = createAIProvider({
        provider,
        apiKey: apiKey!,
        model,
      })
    }

    // Convert UIMessages to model messages
    const modelMessages = await convertToModelMessages(messages)

    // Stream the response
    const result = streamText({
      model: aiModel,
      system: systemPrompt,
      messages: modelMessages,
      onError({ error }) {
        console.error('Stream error:', error)
      },
    })

    return result.toUIMessageStreamResponse({
      onError: (error) => {
        if (error instanceof Error) {
          return error.message
        }
        return 'An error occurred while generating the response.'
      },
    })
  } catch (error) {
    console.error('AI chat error:', error)
    return new Response(JSON.stringify({
      error: 'AI request failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
