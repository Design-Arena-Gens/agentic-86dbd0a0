import { google, youtube_v3 } from 'googleapis';
import fs from 'fs';
import logger from './logger';

export interface YouTubeConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface UploadOptions {
  title: string;
  description: string;
  tags: string[];
  categoryId?: string;
  privacyStatus: 'public' | 'private' | 'unlisted';
  publishAt?: string;
  playlistId?: string;
  language?: string;
  madeForKids: boolean;
}

export interface UploadResult {
  success: boolean;
  videoId?: string;
  videoUrl?: string;
  error?: string;
}

export class YouTubeClient {
  private oauth2Client;
  private youtube: youtube_v3.Youtube;

  constructor(config: YouTubeConfig) {
    this.oauth2Client = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      config.redirectUri
    );

    if (config.accessToken && config.refreshToken) {
      this.oauth2Client.setCredentials({
        access_token: config.accessToken,
        refresh_token: config.refreshToken,
      });
    }

    this.youtube = google.youtube({
      version: 'v3',
      auth: this.oauth2Client,
    });

    logger.info('YouTube client initialized');
  }

  getAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube',
      'https://www.googleapis.com/auth/youtube.force-ssl',
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
    });
  }

  async getTokenFromCode(code: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);

      logger.info('OAuth tokens obtained successfully');

      return {
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token!,
      };
    } catch (error) {
      logger.error('Error getting tokens from code', { error });
      throw error;
    }
  }

  async uploadVideo(
    videoPath: string,
    thumbnailPath: string | null,
    options: UploadOptions,
    onProgress?: (progress: number) => void
  ): Promise<UploadResult> {
    try {
      logger.info('Starting video upload', { videoPath, options });

      const fileSize = fs.statSync(videoPath).size;
      let uploadedBytes = 0;

      const requestBody: youtube_v3.Schema$Video = {
        snippet: {
          title: options.title,
          description: options.description,
          tags: options.tags,
          categoryId: options.categoryId || '24', // Entertainment category
          defaultLanguage: options.language || 'hi',
          defaultAudioLanguage: options.language || 'hi',
        },
        status: {
          privacyStatus: options.privacyStatus,
          publishAt: options.publishAt,
          selfDeclaredMadeForKids: options.madeForKids,
        },
      };

      const media = {
        body: fs.createReadStream(videoPath),
      };

      const uploadResponse = await this.youtube.videos.insert(
        {
          part: ['snippet', 'status'],
          requestBody,
          media,
        },
        {
          onUploadProgress: (evt) => {
            uploadedBytes = evt.bytesRead;
            const progress = (uploadedBytes / fileSize) * 100;
            logger.info('Upload progress', { progress: progress.toFixed(2) });
            if (onProgress) {
              onProgress(progress);
            }
          },
        }
      );

      const videoId = uploadResponse.data.id;
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

      logger.info('Video uploaded successfully', { videoId, videoUrl });

      // Upload thumbnail if provided
      if (thumbnailPath && videoId) {
        await this.uploadThumbnail(videoId, thumbnailPath);
      }

      // Add to playlist if specified
      if (options.playlistId && videoId) {
        await this.addToPlaylist(videoId, options.playlistId);
      }

      return {
        success: true,
        videoId: videoId || undefined,
        videoUrl: videoUrl || undefined,
      };
    } catch (error) {
      logger.error('Error uploading video', { error });
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  async uploadThumbnail(videoId: string, thumbnailPath: string): Promise<void> {
    try {
      logger.info('Uploading thumbnail', { videoId, thumbnailPath });

      await this.youtube.thumbnails.set({
        videoId,
        media: {
          body: fs.createReadStream(thumbnailPath),
        },
      });

      logger.info('Thumbnail uploaded successfully', { videoId });
    } catch (error) {
      logger.error('Error uploading thumbnail', { error });
      throw error;
    }
  }

  async addToPlaylist(videoId: string, playlistId: string): Promise<void> {
    try {
      logger.info('Adding video to playlist', { videoId, playlistId });

      await this.youtube.playlistItems.insert({
        part: ['snippet'],
        requestBody: {
          snippet: {
            playlistId,
            resourceId: {
              kind: 'youtube#video',
              videoId,
            },
          },
        },
      });

      logger.info('Video added to playlist successfully', { videoId, playlistId });
    } catch (error) {
      logger.error('Error adding video to playlist', { error });
      throw error;
    }
  }

  async retryUpload(
    videoPath: string,
    thumbnailPath: string | null,
    options: UploadOptions,
    maxRetries: number = 3,
    onProgress?: (progress: number) => void
  ): Promise<UploadResult> {
    let lastError: string = '';

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      logger.info(`Upload attempt ${attempt}/${maxRetries}`);

      const result = await this.uploadVideo(videoPath, thumbnailPath, options, onProgress);

      if (result.success) {
        return result;
      }

      lastError = result.error || 'Unknown error';
      logger.warn(`Upload attempt ${attempt} failed`, { error: lastError });

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        logger.info(`Waiting ${delay}ms before retry`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    return {
      success: false,
      error: `Failed after ${maxRetries} attempts. Last error: ${lastError}`,
    };
  }
}
