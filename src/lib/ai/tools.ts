import { tool } from 'ai'
import { z } from 'zod'

// Firecrawl API for advanced web scraping (handles JavaScript, anti-bot protection)
const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v1/scrape'

/**
 * Validate URL to prevent SSRF attacks
 * Blocks localhost, internal IPs, and non-http(s) protocols
 */
function isValidExternalUrl(url: string): { valid: boolean; reason?: string } {
  try {
    const parsed = new URL(url)

    // Only allow http/https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, reason: 'Only HTTP and HTTPS URLs are allowed' }
    }

    // Block localhost variations
    const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1']
    if (blockedHosts.includes(parsed.hostname.toLowerCase())) {
      return { valid: false, reason: 'Localhost URLs are not allowed' }
    }

    // Block private IP ranges
    const privateIpPatterns = [
      /^10\./,                          // 10.0.0.0/8
      /^172\.(1[6-9]|2[0-9]|3[01])\./,  // 172.16.0.0/12
      /^192\.168\./,                     // 192.168.0.0/16
      /^169\.254\./,                     // Link-local
      /^fc00:/i,                         // IPv6 private
      /^fe80:/i,                         // IPv6 link-local
    ]

    for (const pattern of privateIpPatterns) {
      if (pattern.test(parsed.hostname)) {
        return { valid: false, reason: 'Private/internal IP addresses are not allowed' }
      }
    }

    return { valid: true }
  } catch {
    return { valid: false, reason: 'Invalid URL format' }
  }
}

/**
 * Truncate content to a maximum length while preserving complete sentences
 * Increased to 25000 chars for better e-commerce content coverage
 */
function truncateContent(content: string, maxLength: number = 25000): string {
  if (content.length <= maxLength) return content

  // Try to cut at a sentence boundary
  const truncated = content.slice(0, maxLength)
  const lastPeriod = truncated.lastIndexOf('.')
  const lastNewline = truncated.lastIndexOf('\n')
  const cutPoint = Math.max(lastPeriod, lastNewline)

  if (cutPoint > maxLength * 0.8) {
    return truncated.slice(0, cutPoint + 1) + '\n\n[Content truncated...]'
  }

  return truncated + '\n\n[Content truncated...]'
}

/**
 * Fetch URL content using Firecrawl API
 * Handles JavaScript rendering, anti-bot protection, and dynamic content
 */
async function fetchWithFirecrawl(url: string): Promise<{ content?: string; error?: string }> {
  const apiKey = process.env.FIRECRAWL_API_KEY

  if (!apiKey) {
    return { error: 'Firecrawl API key not configured' }
  }

  try {
    console.log(`[Firecrawl] Fetching: ${url}`)

    const response = await fetch(FIRECRAWL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        timeout: 45000, // 45 second timeout for heavy JS sites
        waitFor: 3000,  // Wait 3s for dynamic content to load
      }),
      signal: AbortSignal.timeout(50000), // 50 second total timeout
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      console.log(`[Firecrawl] Error ${response.status}: ${errorText}`)
      return { error: `Firecrawl error (${response.status}): ${response.statusText}` }
    }

    const data = await response.json() as {
      success?: boolean
      data?: {
        markdown?: string
        metadata?: {
          title?: string
          description?: string
          statusCode?: number
        }
      }
      error?: string
    }

    if (!data.success || !data.data?.markdown) {
      console.log(`[Firecrawl] No content returned:`, data.error || 'Unknown')
      return { error: data.error || 'No content extracted from page' }
    }

    console.log(`[Firecrawl] Success: ${data.data.markdown.length} chars`)
    return { content: data.data.markdown }
  } catch (error) {
    console.error('[Firecrawl] Fetch error:', error)

    if (error instanceof Error) {
      if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
        return { error: 'Firecrawl request timed out' }
      }
      return { error: `Firecrawl error: ${error.message}` }
    }

    return { error: 'Firecrawl request failed' }
  }
}

/**
 * Fetch URL content using Jina Reader (fallback)
 */
async function fetchWithJina(url: string): Promise<{ content?: string; error?: string }> {
  try {
    const jinaUrl = `https://r.jina.ai/${url}`
    console.log(`[Jina] Fetching: ${jinaUrl}`)

    const response = await fetch(jinaUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/markdown',
        'User-Agent': 'JournalApp/1.0',
      },
      signal: AbortSignal.timeout(20000), // 20 second timeout
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      console.log(`[Jina] Error ${response.status}: ${errorText}`)
      return { error: `Jina error (${response.status}): ${response.statusText}` }
    }

    const content = await response.text()
    console.log(`[Jina] Success: ${content.length} chars`)
    return { content }
  } catch (error) {
    console.error('[Jina] Fetch error:', error)

    if (error instanceof Error) {
      if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
        return { error: 'Jina request timed out' }
      }
      return { error: `Jina error: ${error.message}` }
    }

    return { error: 'Jina request failed' }
  }
}

/**
 * AI Tools for web access capabilities
 * Uses Firecrawl (primary) for JavaScript-heavy sites, Jina Reader (fallback)
 */
export const webTools = {
  /**
   * Fetch and read content from a URL
   * Uses Firecrawl for JavaScript rendering and anti-bot bypass, falls back to Jina
   */
  fetchUrl: tool({
    description: 'Fetch and read content from a URL. Returns the page content as clean, readable markdown. Use this when you need to read the content of a specific webpage, article, product page, or documentation. Works well with e-commerce sites like Amazon, Myntra, Flipkart.',
    inputSchema: z.object({
      url: z.string().url().describe('The full URL to fetch content from (must start with http:// or https://)')
    }),
    execute: async ({ url }: { url: string }): Promise<{ content?: string; error?: string; url: string; source?: string }> => {
      console.log(`[AI Tool] fetchUrl called for: ${url}`)

      // Validate URL
      const validation = isValidExternalUrl(url)
      if (!validation.valid) {
        console.log(`[AI Tool] URL validation failed: ${validation.reason}`)
        return { error: validation.reason || 'Invalid URL', url }
      }

      // Check if Firecrawl is configured
      const hasFirecrawl = Boolean(process.env.FIRECRAWL_API_KEY)
      console.log(`[AI Tool] Firecrawl available: ${hasFirecrawl}`)

      // Try Firecrawl first (better for e-commerce, JavaScript sites)
      if (hasFirecrawl) {
        const firecrawlResult = await fetchWithFirecrawl(url)

        if (firecrawlResult.content) {
          const truncatedContent = truncateContent(firecrawlResult.content)
          return {
            content: truncatedContent,
            url,
            source: 'firecrawl'
          }
        }

        console.log(`[AI Tool] Firecrawl failed, trying Jina fallback...`)
      }

      // Fallback to Jina Reader
      const jinaResult = await fetchWithJina(url)

      if (jinaResult.content) {
        const truncatedContent = truncateContent(jinaResult.content)
        return {
          content: truncatedContent,
          url,
          source: 'jina'
        }
      }

      // Both failed
      const errorMessage = hasFirecrawl
        ? `Failed to fetch content. Firecrawl and Jina both failed. The site may be blocking automated access.`
        : `Failed to fetch content: ${jinaResult.error || 'Unknown error'}. For better results with e-commerce sites, configure FIRECRAWL_API_KEY.`

      return { error: errorMessage, url }
    },
  }),

  /**
   * Search the web for information
   * Uses Jina Search (s.jina.ai) with API key, or falls back to DuckDuckGo
   */
  webSearch: tool({
    description: 'Search the web for information on any topic. Returns relevant search results with snippets. Use this when you need to find current information, research a topic, or answer questions that require up-to-date knowledge.',
    inputSchema: z.object({
      query: z.string().min(2).max(200).describe('The search query (2-200 characters)')
    }),
    execute: async ({ query }: { query: string }): Promise<{ results?: string; error?: string; query: string }> => {
      console.log(`[AI Tool] webSearch called for: "${query}"`)

      const jinaApiKey = process.env.JINA_API_KEY

      try {
        // Try Jina Search first (requires API key)
        if (jinaApiKey) {
          const searchUrl = `https://s.jina.ai/${encodeURIComponent(query)}`
          console.log(`[AI Tool] Searching via Jina with API key: ${searchUrl}`)

          const response = await fetch(searchUrl, {
            method: 'GET',
            headers: {
              'Accept': 'text/markdown',
              'User-Agent': 'JournalApp/1.0',
              'Authorization': `Bearer ${jinaApiKey}`,
            },
            signal: AbortSignal.timeout(15000),
          })

          if (response.ok) {
            const results = await response.text()
            console.log(`[AI Tool] Jina search returned ${results.length} characters`)
            return { results: truncateContent(results), query }
          }
          console.log(`[AI Tool] Jina search failed: ${response.status}, trying fallback`)
        }

        // Fallback: Use Jina Reader to fetch DuckDuckGo HTML results
        const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
        const jinaReaderUrl = `https://r.jina.ai/${ddgUrl}`
        console.log(`[AI Tool] Fallback: Searching via DuckDuckGo + Jina Reader`)

        const response = await fetch(jinaReaderUrl, {
          method: 'GET',
          headers: {
            'Accept': 'text/markdown',
            'User-Agent': 'JournalApp/1.0',
          },
          signal: AbortSignal.timeout(15000),
        })

        if (!response.ok) {
          console.log(`[AI Tool] DuckDuckGo fallback failed: ${response.status}`)
          return {
            error: `Search failed. Try using fetchUrl with a specific website URL instead.`,
            query
          }
        }

        const results = await response.text()
        console.log(`[AI Tool] DuckDuckGo search returned ${results.length} characters`)

        // Truncate if too long
        const truncatedResults = truncateContent(results)

        return {
          results: truncatedResults,
          query
        }
      } catch (error) {
        console.error('[AI Tool] webSearch error:', error)

        if (error instanceof Error) {
          if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
            return { error: 'Search timed out. Please try again.', query }
          }
          return { error: `Search failed: ${error.message}`, query }
        }

        return { error: 'An unexpected error occurred during search', query }
      }
    },
  }),
}

// Export type for tools
export type WebTools = typeof webTools
