import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'

export type AIProviderType = 'google' | 'anthropic' | 'openai' | 'openrouter'

export interface AIProviderConfig {
  provider: AIProviderType
  apiKey: string
  model?: string
}

// Default models for each provider
export const defaultModels: Record<AIProviderType, string> = {
  google: 'gemini-1.5-flash',
  anthropic: 'claude-3-5-sonnet-20241022',
  openai: 'gpt-4o-mini',
  openrouter: 'meta-llama/llama-3.3-70b-instruct:free',
}

// Available models for each provider
export const availableModels: Record<AIProviderType, { id: string; name: string }[]> = {
  google: [
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
    { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash (Experimental)' },
  ],
  anthropic: [
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
  ],
  openai: [
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
  ],
  openrouter: [
    { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B (Free)' },
    { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash (Free)' },
    { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
    { id: 'openai/gpt-4o', name: 'GPT-4o' },
  ],
}

// Provider display names and icons
export const providerInfo: Record<AIProviderType, { name: string; icon: string; color: string }> = {
  google: { name: 'Google Gemini', icon: 'auto_awesome', color: '#4285F4' },
  anthropic: { name: 'Claude', icon: 'psychology', color: '#D97706' },
  openai: { name: 'OpenAI', icon: 'smart_toy', color: '#10A37F' },
  openrouter: { name: 'OpenRouter', icon: 'router', color: '#6366F1' },
}

// Create AI provider instance with API key
export function createAIProvider(config: AIProviderConfig) {
  const { provider, apiKey, model } = config
  const selectedModel = model || defaultModels[provider]

  switch (provider) {
    case 'google':
      const google = createGoogleGenerativeAI({ apiKey })
      return google(selectedModel)

    case 'anthropic':
      const anthropic = createAnthropic({ apiKey })
      return anthropic(selectedModel)

    case 'openai':
      const openai = createOpenAI({ apiKey })
      return openai(selectedModel)

    case 'openrouter':
      // OpenRouter uses OpenAI-compatible API with custom base URL
      const openrouter = createOpenAI({
        apiKey,
        baseURL: 'https://openrouter.ai/api/v1',
        headers: {
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          'X-Title': 'Journal App',
        },
      })
      return openrouter(selectedModel)

    default:
      throw new Error(`Unknown provider: ${provider}`)
  }
}

// Create Google provider with OAuth access token
export interface GoogleOAuthConfig {
  accessToken: string
  model?: string
}

export function createGoogleOAuthProvider(config: GoogleOAuthConfig) {
  const { accessToken, model } = config
  const selectedModel = model || defaultModels.google

  // Create Google provider with OAuth access token
  // The Google Generative AI SDK supports passing an access token
  // We pass an empty apiKey and use headers to send the Bearer token
  const google = createGoogleGenerativeAI({
    apiKey: '', // Not used when using OAuth
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  })

  return google(selectedModel)
}

// System prompt for the AI assistant
export const defaultSystemPrompt = `You are a helpful AI research assistant integrated into a note-taking application. Your role is to:

1. Help users with their notes by answering questions, providing summaries, and expanding on topics
2. Be concise but thorough in your responses
3. Use markdown formatting when appropriate (headings, lists, code blocks, etc.)
4. When the user provides note content, reference it naturally in your responses
5. Be friendly and professional

If the user asks you to summarize, extract key points, or expand on their note content, focus on being helpful and actionable.`
