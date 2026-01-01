'use client';

import { useState, useRef, useEffect } from 'react';

interface UploadStatus {
  stage: string;
  progress: number;
  message: string;
  videoId?: string;
  videoUrl?: string;
  error?: string;
}

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const videoFileRef = useRef<HTMLInputElement>(null);
  const thumbnailFileRef = useRef<HTMLInputElement>(null);
  const topicRef = useRef<HTMLInputElement>(null);
  const summaryRef = useRef<HTMLTextAreaElement>(null);
  const languageRef = useRef<HTMLSelectElement>(null);
  const privacyRef = useRef<HTMLSelectElement>(null);
  const scheduleRef = useRef<HTMLInputElement>(null);

  const handleAuth = async () => {
    try {
      const response = await fetch('/api/auth/url');
      const data = await response.json();
      window.location.href = data.authUrl;
    } catch (error) {
      alert('Authentication error: ' + (error as Error).message);
    }
  };

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/auth/status');
      const data = await response.json();
      setIsAuthenticated(data.authenticated);
    } catch (error) {
      console.error('Error checking auth status:', error);
    }
  };

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    const videoFile = videoFileRef.current?.files?.[0];
    const thumbnailFile = thumbnailFileRef.current?.files?.[0];
    const topic = topicRef.current?.value;
    const summary = summaryRef.current?.value;
    const language = languageRef.current?.value;
    const privacy = privacyRef.current?.value;
    const scheduleTime = scheduleRef.current?.value;

    if (!videoFile || !topic || !summary) {
      alert('Please provide video file, topic, and summary');
      return;
    }

    setIsUploading(true);
    setUploadStatus({
      stage: 'Uploading files',
      progress: 0,
      message: 'Preparing files for upload...',
    });

    const formData = new FormData();
    formData.append('video', videoFile);
    if (thumbnailFile) {
      formData.append('thumbnail', thumbnailFile);
    }
    formData.append('topic', topic);
    formData.append('summary', summary);
    formData.append('language', language || 'hi');
    formData.append('privacy', privacy || 'public');
    if (scheduleTime) {
      formData.append('scheduleTime', scheduleTime);
    }

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('Failed to get response reader');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              setUploadStatus(data);
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }
      }
    } catch (error) {
      setUploadStatus({
        stage: 'Error',
        progress: 0,
        message: 'Upload failed',
        error: (error as Error).message,
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-red-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-12 text-center">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-red-500 to-red-700 bg-clip-text text-transparent">
            YouTube Mystery & Crime Uploader
          </h1>
          <p className="text-gray-400 text-lg">
            Automated upload system for 5-10 minute cinematic crime documentaries
          </p>
        </header>

        {!isAuthenticated ? (
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-8 text-center border border-red-900/30">
            <h2 className="text-2xl font-semibold mb-4">Authentication Required</h2>
            <p className="text-gray-400 mb-6">
              Connect your YouTube channel to start uploading videos
            </p>
            <button
              onClick={handleAuth}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
            >
              Authenticate with YouTube
            </button>
          </div>
        ) : (
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-8 border border-red-900/30">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold">Upload Video</h2>
              <span className="text-green-400 text-sm">● Authenticated</span>
            </div>

            <form onSubmit={handleUpload} className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Video File (5-10 minutes, 1920x1080, MP4)
                </label>
                <input
                  ref={videoFileRef}
                  type="file"
                  accept="video/mp4"
                  required
                  className="w-full bg-gray-700/50 border border-gray-600 rounded-lg p-3 text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-red-600 file:text-white hover:file:bg-red-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Thumbnail (Optional - 1280x720, under 2MB)
                </label>
                <input
                  ref={thumbnailFileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/jpg"
                  className="w-full bg-gray-700/50 border border-gray-600 rounded-lg p-3 text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-red-600 file:text-white hover:file:bg-red-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Topic/Case Name</label>
                <input
                  ref={topicRef}
                  type="text"
                  required
                  placeholder="e.g., The Midnight Killer Case"
                  className="w-full bg-gray-700/50 border border-gray-600 rounded-lg p-3 text-white placeholder-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Story Summary</label>
                <textarea
                  ref={summaryRef}
                  required
                  rows={4}
                  placeholder="Brief summary of the crime story for description..."
                  className="w-full bg-gray-700/50 border border-gray-600 rounded-lg p-3 text-white placeholder-gray-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Language</label>
                  <select
                    ref={languageRef}
                    className="w-full bg-gray-700/50 border border-gray-600 rounded-lg p-3 text-white"
                  >
                    <option value="hi">Hindi</option>
                    <option value="en">English</option>
                    <option value="hinglish">Hinglish</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Privacy</label>
                  <select
                    ref={privacyRef}
                    className="w-full bg-gray-700/50 border border-gray-600 rounded-lg p-3 text-white"
                  >
                    <option value="public">Public</option>
                    <option value="unlisted">Unlisted</option>
                    <option value="private">Private</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Schedule Time (Optional - leave empty for immediate)
                </label>
                <input
                  ref={scheduleRef}
                  type="datetime-local"
                  className="w-full bg-gray-700/50 border border-gray-600 rounded-lg p-3 text-white"
                />
              </div>

              <button
                type="submit"
                disabled={isUploading}
                className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-8 rounded-lg transition-colors"
              >
                {isUploading ? 'Uploading...' : 'Upload to YouTube'}
              </button>
            </form>

            {uploadStatus && (
              <div className="mt-6 bg-gray-900/50 rounded-lg p-6 border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold">{uploadStatus.stage}</h3>
                  {uploadStatus.progress > 0 && (
                    <span className="text-sm text-gray-400">
                      {uploadStatus.progress.toFixed(1)}%
                    </span>
                  )}
                </div>

                {uploadStatus.progress > 0 && (
                  <div className="w-full bg-gray-700 rounded-full h-2 mb-3">
                    <div
                      className="bg-red-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadStatus.progress}%` }}
                    />
                  </div>
                )}

                <p className="text-gray-300 text-sm">{uploadStatus.message}</p>

                {uploadStatus.error && (
                  <div className="mt-3 p-3 bg-red-900/30 border border-red-700 rounded text-red-300 text-sm">
                    {uploadStatus.error}
                  </div>
                )}

                {uploadStatus.videoUrl && (
                  <div className="mt-4 p-4 bg-green-900/30 border border-green-700 rounded">
                    <p className="text-green-300 font-semibold mb-2">Upload Successful!</p>
                    <a
                      href={uploadStatus.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 underline break-all"
                    >
                      {uploadStatus.videoUrl}
                    </a>
                    <p className="text-gray-400 text-sm mt-2">
                      Video ID: {uploadStatus.videoId}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <footer className="mt-12 text-center text-gray-500 text-sm">
          <p>
            Automated YouTube uploader for Mystery & Crime content • 5-10 minute videos • Full HD
          </p>
        </footer>
      </div>
    </div>
  );
}
