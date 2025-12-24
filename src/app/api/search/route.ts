import { createClient } from '@/lib/supabase/server'
import { decryptApiKey } from '@/lib/ai/encryption'

export const runtime = 'nodejs'

interface ExaSearchResult {
  title: string
  url: string
  text?: string
  highlights?: string[]
  publishedDate?: string
  author?: string
  score?: number
}

interface ExaSearchResponse {
  results: ExaSearchResult[]
  autopromptString?: string
  costDollars?: number
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

    const { query, numResults = 8 } = await request.json()

    if (!query || typeof query !== 'string') {
      return new Response(JSON.stringify({ error: 'Query is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Get Exa API key from user's saved keys (or fall back to environment variable)
    let exaApiKey = process.env.EXA_API_KEY

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: exaKeyData } = await (supabase as any)
      .from('user_ai_api_keys')
      .select('api_key_encrypted')
      .eq('user_id', user.id)
      .eq('provider', 'exa')
      .eq('is_active', true)
      .single()

    const typedExaKeyData = exaKeyData as { api_key_encrypted: string } | null

    if (typedExaKeyData?.api_key_encrypted) {
      exaApiKey = decryptApiKey(typedExaKeyData.api_key_encrypted)
    }

    if (!exaApiKey) {
      return new Response(JSON.stringify({
        error: 'Search not configured',
        message: 'Please add your Exa Search API key in Settings → AI Providers to enable web search.',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Call Exa API
    const response = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': exaApiKey,
      },
      body: JSON.stringify({
        query,
        numResults,
        type: 'auto',
        contents: {
          text: {
            maxCharacters: 500,
            includeHtmlTags: false,
          },
          highlights: {
            numSentences: 2,
            highlightsPerUrl: 1,
          },
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Exa API error:', response.status, errorText)
      return new Response(JSON.stringify({
        error: 'Search failed',
        message: 'Failed to search the web. Please try again.',
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const data: ExaSearchResponse = await response.json()

    // Transform results for the frontend
    const results = data.results.map((result, index) => ({
      id: `${index}-${Date.now()}`,
      title: result.title || 'Untitled',
      url: result.url,
      snippet: result.highlights?.[0] || result.text?.slice(0, 300) || '',
      favicon: `https://www.google.com/s2/favicons?domain=${new URL(result.url).hostname}&sz=32`,
      publishedDate: result.publishedDate,
      author: result.author,
    }))

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Search error:', error)
    return new Response(JSON.stringify({
      error: 'Search failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
