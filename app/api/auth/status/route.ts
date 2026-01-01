import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const tokensPath = path.join(process.cwd(), '.youtube-tokens.json');

    if (fs.existsSync(tokensPath)) {
      const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf-8'));

      if (tokens.accessToken && tokens.refreshToken) {
        return NextResponse.json({ authenticated: true });
      }
    }

    return NextResponse.json({ authenticated: false });
  } catch (error) {
    console.error('Error checking auth status:', error);
    return NextResponse.json({ authenticated: false });
  }
}
