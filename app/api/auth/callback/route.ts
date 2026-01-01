import { NextRequest, NextResponse } from 'next/server';
import { YouTubeClient } from '@/lib/youtubeClient';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json(
        { error: 'Authorization code not found' },
        { status: 400 }
      );
    }

    const client = new YouTubeClient({
      clientId: process.env.YOUTUBE_CLIENT_ID || '',
      clientSecret: process.env.YOUTUBE_CLIENT_SECRET || '',
      redirectUri: process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:3000/api/auth/callback',
    });

    const tokens = await client.getTokenFromCode(code);

    // Store tokens in a file (in production, use a secure database)
    const tokensPath = path.join(process.cwd(), '.youtube-tokens.json');
    fs.writeFileSync(
      tokensPath,
      JSON.stringify(tokens, null, 2)
    );

    // Redirect to home page
    return NextResponse.redirect(new URL('/', request.url));
  } catch (error) {
    console.error('Error in OAuth callback:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}
