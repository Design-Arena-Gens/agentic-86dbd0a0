import { NextResponse } from 'next/server';
import { YouTubeClient } from '@/lib/youtubeClient';

export async function GET() {
  try {
    const client = new YouTubeClient({
      clientId: process.env.YOUTUBE_CLIENT_ID || '',
      clientSecret: process.env.YOUTUBE_CLIENT_SECRET || '',
      redirectUri: process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:3000/api/auth/callback',
    });

    const authUrl = client.getAuthUrl();

    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate auth URL' },
      { status: 500 }
    );
  }
}
