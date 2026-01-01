import { z } from 'zod';
import logger from './logger';

let ffmpeg: any;
let ffmpegInitialized = false;

async function initFfmpeg() {
  if (ffmpegInitialized) return;

  try {
    const fluentFfmpeg = await import('fluent-ffmpeg');
    const ffmpegInstaller = await import('@ffmpeg-installer/ffmpeg');
    ffmpeg = fluentFfmpeg.default;
    ffmpeg.setFfmpegPath(ffmpegInstaller.default.path);
    ffmpegInitialized = true;
  } catch (error) {
    logger.warn('FFmpeg not available, video validation will be limited', { error });
  }
}

export const VideoValidationSchema = z.object({
  duration: z.number().min(300).max(600), // 5-10 minutes in seconds
  width: z.number().min(1920),
  height: z.number().min(1080),
  aspectRatio: z.string().refine((ratio) => {
    const [w, h] = ratio.split(':').map(Number);
    return Math.abs(w / h - 16 / 9) < 0.01;
  }, 'Aspect ratio must be 16:9'),
  hasAudio: z.boolean().refine((val) => val === true, 'Video must have audio'),
  format: z.string().toLowerCase().includes('mp4'),
});

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  aspectRatio: string;
  hasAudio: boolean;
  format: string;
  bitrate: number;
  fps: number;
  audioCodec?: string;
  videoCodec?: string;
}

export async function validateVideo(filePath: string): Promise<{
  valid: boolean;
  metadata?: VideoMetadata;
  errors?: string[];
}> {
  try {
    await initFfmpeg();

    if (!ffmpegInitialized) {
      logger.warn('FFmpeg not initialized, skipping validation');
      return { valid: true };
    }

    const metadata = await getVideoMetadata(filePath);

    logger.info('Video metadata extracted', { metadata });

    const validation = VideoValidationSchema.safeParse(metadata);

    if (!validation.success) {
      const errors = validation.error.errors.map((err) => `${err.path.join('.')}: ${err.message}`);
      logger.error('Video validation failed', { errors });
      return { valid: false, errors };
    }

    logger.info('Video validation passed', { filePath });
    return { valid: true, metadata };
  } catch (error) {
    logger.error('Error validating video', { error });
    return { valid: false, errors: [(error as Error).message] };
  }
}

function getVideoMetadata(filePath: string): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err: any, metadata: any) => {
      if (err) {
        reject(err);
        return;
      }

      const videoStream = metadata.streams.find((s: any) => s.codec_type === 'video');
      const audioStream = metadata.streams.find((s: any) => s.codec_type === 'audio');

      if (!videoStream) {
        reject(new Error('No video stream found'));
        return;
      }

      const duration = metadata.format.duration || 0;
      const width = videoStream.width || 0;
      const height = videoStream.height || 0;
      const aspectRatio = videoStream.display_aspect_ratio || `${width}:${height}`;
      const hasAudio = !!audioStream;
      const format = metadata.format.format_name || '';
      const bitrate = metadata.format.bit_rate ? parseInt(String(metadata.format.bit_rate)) : 0;
      const fps = videoStream.r_frame_rate
        ? eval(videoStream.r_frame_rate.replace('/', '/'))
        : 30;

      resolve({
        duration,
        width,
        height,
        aspectRatio,
        hasAudio,
        format,
        bitrate,
        fps,
        audioCodec: audioStream?.codec_name,
        videoCodec: videoStream?.codec_name,
      });
    });
  });
}

export async function validateThumbnail(filePath: string): Promise<{
  valid: boolean;
  errors?: string[];
}> {
  try {
    const sharp = (await import('sharp')).default;
    const image = sharp(filePath);
    const metadata = await image.metadata();
    const stats = await import('fs').then((fs) => fs.promises.stat(filePath));

    const errors: string[] = [];

    if (metadata.width !== 1280 || metadata.height !== 720) {
      errors.push('Thumbnail must be 1280x720 resolution');
    }

    if (stats.size > 2 * 1024 * 1024) {
      errors.push('Thumbnail must be under 2MB');
    }

    if (!['jpeg', 'jpg', 'png'].includes(metadata.format || '')) {
      errors.push('Thumbnail must be JPG or PNG format');
    }

    if (errors.length > 0) {
      logger.error('Thumbnail validation failed', { errors });
      return { valid: false, errors };
    }

    logger.info('Thumbnail validation passed', { filePath });
    return { valid: true };
  } catch (error) {
    logger.error('Error validating thumbnail', { error });
    return { valid: false, errors: [(error as Error).message] };
  }
}
