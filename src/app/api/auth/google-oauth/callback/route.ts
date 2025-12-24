import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

// This route handles the OAuth callback from Google
// It redirects to the settings page with the auth code and state
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  if (error) {
    // User denied access or error occurred
    return NextResponse.redirect(
      `${baseUrl}/settings?tab=ai-providers&oauth_error=${encodeURIComponent(error)}`
    )
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${baseUrl}/settings?tab=ai-providers&oauth_error=missing_params`
    )
  }

  // Redirect to settings page with the code and state for client-side processing
  return NextResponse.redirect(
    `${baseUrl}/settings?tab=ai-providers&oauth_code=${encodeURIComponent(code)}&oauth_state=${encodeURIComponent(state)}`
  )
}
