import { NextRequest } from 'next/server';
import formidable from 'formidable';
import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';
import { validateVideo, validateThumbnail } from '@/lib/videoValidator';
import { generateMetadata, generateScheduleTime } from '@/lib/metadataGenerator';
import { YouTubeClient } from '@/lib/youtubeClient';
import logger from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max execution time

async function parseFormData(request: NextRequest) {
  const formData = await request.formData();

  const video = formData.get('video') as File;
  const thumbnail = formData.get('thumbnail') as File | null;
  const topic = formData.get('topic') as string;
  const summary = formData.get('summary') as string;
  const language = (formData.get('language') as string) || 'hi';
  const privacy = (formData.get('privacy') as string) || 'public';
  const scheduleTime = formData.get('scheduleTime') as string | null;

  return { video, thumbnail, topic, summary, language, privacy, scheduleTime };
}

async function saveFile(file: File, filename: string): Promise<string> {
  const uploadDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const filepath = path.join(uploadDir, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(filepath, buffer);

  return filepath;
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        send({
          stage: 'Parsing',
          progress: 5,
          message: 'Parsing upload data...',
        });

        const { video, thumbnail, topic, summary, language, privacy, scheduleTime } =
          await parseFormData(request);

        send({
          stage: 'Saving',
          progress: 10,
          message: 'Saving uploaded files...',
        });

        const videoPath = await saveFile(video, `video_${Date.now()}.mp4`);
        const thumbnailPath = thumbnail
          ? await saveFile(thumbnail, `thumbnail_${Date.now()}.${thumbnail.name.split('.').pop()}`)
          : null;

        send({
          stage: 'Validating',
          progress: 20,
          message: 'Validating video file...',
        });

        const videoValidation = await validateVideo(videoPath);

        if (!videoValidation.valid) {
          send({
            stage: 'Error',
            progress: 0,
            message: 'Video validation failed',
            error: videoValidation.errors?.join(', '),
          });
          controller.close();
          return;
        }

        if (thumbnailPath) {
          send({
            stage: 'Validating',
            progress: 25,
            message: 'Validating thumbnail...',
          });

          const thumbnailValidation = await validateThumbnail(thumbnailPath);

          if (!thumbnailValidation.valid) {
            send({
              stage: 'Error',
              progress: 0,
              message: 'Thumbnail validation failed',
              error: thumbnailValidation.errors?.join(', '),
            });
            controller.close();
            return;
          }
        }

        send({
          stage: 'Generating',
          progress: 30,
          message: 'Generating metadata...',
        });

        const metadata = generateMetadata(
          topic,
          summary,
          language as 'hi' | 'en' | 'hinglish'
        );

        logger.info('Generated metadata', { metadata });

        send({
          stage: 'Authenticating',
          progress: 35,
          message: 'Authenticating with YouTube...',
        });

        const tokensPath = path.join(process.cwd(), '.youtube-tokens.json');
        if (!fs.existsSync(tokensPath)) {
          send({
            stage: 'Error',
            progress: 0,
            message: 'Authentication required',
            error: 'Please authenticate with YouTube first',
          });
          controller.close();
          return;
        }

        const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf-8'));

        const youtubeClient = new YouTubeClient({
          clientId: process.env.YOUTUBE_CLIENT_ID || '',
          clientSecret: process.env.YOUTUBE_CLIENT_SECRET || '',
          redirectUri: process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:3000/api/auth/callback',
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        });

        send({
          stage: 'Uploading',
          progress: 40,
          message: 'Starting video upload to YouTube...',
        });

        let publishAt: string | undefined;
        if (scheduleTime) {
          publishAt = new Date(scheduleTime).toISOString();
        }

        const result = await youtubeClient.retryUpload(
          videoPath,
          thumbnailPath,
          {
            title: metadata.title,
            description: metadata.description,
            tags: metadata.tags,
            categoryId: '24', // Entertainment
            privacyStatus: privacy as 'public' | 'private' | 'unlisted',
            publishAt,
            playlistId: process.env.YOUTUBE_DEFAULT_PLAYLIST_ID,
            language: metadata.language,
            madeForKids: false,
          },
          3,
          (progress) => {
            send({
              stage: 'Uploading',
              progress: 40 + (progress * 0.6),
              message: `Uploading video: ${progress.toFixed(1)}%`,
            });
          }
        );

        // Clean up files
        fs.unlinkSync(videoPath);
        if (thumbnailPath) {
          fs.unlinkSync(thumbnailPath);
        }

        if (result.success) {
          logger.info('Upload completed successfully', {
            videoId: result.videoId,
            videoUrl: result.videoUrl,
          });

          send({
            stage: 'Complete',
            progress: 100,
            message: 'Video uploaded successfully!',
            videoId: result.videoId,
            videoUrl: result.videoUrl,
          });
        } else {
          logger.error('Upload failed', { error: result.error });

          send({
            stage: 'Error',
            progress: 0,
            message: 'Upload failed',
            error: result.error,
          });
        }
      } catch (error) {
        logger.error('Unexpected error during upload', { error });

        send({
          stage: 'Error',
          progress: 0,
          message: 'An unexpected error occurred',
          error: (error as Error).message,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
