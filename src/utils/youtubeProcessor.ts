import { google } from 'googleapis';
import { CacheManager } from './cacheManager';
import { BatchProcessor } from './batchProcessor';
import { EnhancedVectorStorage } from './vectorStorage';
import { WorkerPool } from './workerPool';
import ytdl from 'ytdl-core';
import ffmpeg from 'fluent-ffmpeg';
import { Readable } from 'stream';
import path from 'path';
import fs from 'fs/promises';
import OpenAI from 'openai';

interface VideoMetadata {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  channelId: string;
  channelTitle: string;
}

interface ProcessedVideo {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  channelId: string;
  channelTitle: string;
  transcript?: string;
}

interface ProcessingOptions {
  downloadAudio?: boolean;
  transcribe?: boolean;
  vectorize?: boolean;
  deleteAfterProcessing?: boolean;
}

export class YouTubeProcessor {
  private youtube;
  private cache: CacheManager;
  private batchProcessor: BatchProcessor;
  private vectorStorage: EnhancedVectorStorage;
  private workerPool: WorkerPool;
  private openai: OpenAI;
  private processingQueue: Map<string, Promise<void>>;
  private channelMonitors: Map<string, { lastVideos: VideoMetadata[]; options: ProcessingOptions }>;
  private pollingInterval?: NodeJS.Timeout;
  private pollingIntervalMs: number;

  constructor() {
    this.youtube = google.youtube('v3');
    this.cache = new CacheManager({
      stdTTL: 24 * 60 * 60, // 24 hours
      checkperiod: 60 * 60,  // 1 hour
    });
    this.batchProcessor = new BatchProcessor();
    this.vectorStorage = new EnhancedVectorStorage();
    this.workerPool = new WorkerPool();
    this.processingQueue = new Map();
    this.channelMonitors = new Map();
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.pollingIntervalMs = 15 * 60 * 1000; // 15 minutes
  }

  async initialize() {
    await this.batchProcessor.initialize();
    await this.vectorStorage.initialize();
    
    // Create processing directories
    const dirs = ['audio', 'transcripts'];
    for (const dir of dirs) {
      const dirPath = path.join(process.cwd(), dir);
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  async getChannelVideos(channelId: string): Promise<VideoMetadata[]> {
    const response = await this.youtube.search.list({
      part: ['snippet'],
      channelId,
      maxResults: 50,
      order: 'date',
    });

    const videos: VideoMetadata[] = [];
    if (response.data.items) {
      videos.push(
        ...response.data.items
          .filter(item => item.id?.videoId && item.snippet)
          .map(item => ({
            id: item.id!.videoId!,
            title: item.snippet!.title!,
            description: item.snippet!.description || '',
            publishedAt: item.snippet!.publishedAt!,
            channelId: item.snippet!.channelId!,
            channelTitle: item.snippet!.channelTitle!,
          }))
      );
    }
    return videos;
  }

  private async downloadAudio(videoId: string): Promise<string> {
    const audioPath = path.join(process.cwd(), 'audio', `${videoId}.mp3`);

    // Check if already downloaded
    try {
      await fs.access(audioPath);
      return audioPath;
    } catch {}

    return new Promise((resolve, reject) => {
      const stream = ytdl(`https://www.youtube.com/watch?v=${videoId}`, {
        quality: 'highestaudio',
        filter: 'audioonly',
      });

      ffmpeg(stream)
        .toFormat('mp3')
        .on('error', reject)
        .on('end', () => resolve(audioPath))
        .save(audioPath);
    });
  }

  private async transcribeAudio(audioPath: string): Promise<string> {
    const audioFile = await fs.readFile(audioPath);
    const response = await this.openai.audio.transcriptions.create({
      file: new File([audioFile], 'audio.mp3', { type: 'audio/mp3' }),
      model: 'whisper-1',
    });
    return response.text;
  }

  private async processVideoBatch(videos: VideoMetadata[]): Promise<void> {
    const batchProcessor = new BatchProcessor({ batchSize: 5 });
    await batchProcessor.initialize();

    // Create a single text document from all videos
    const videoText = videos.map((video, index) => 
      `Video ${index + 1}:\nTitle: ${video.title}\nDescription: ${video.description}\n`
    ).join('\n\n');

    await batchProcessor.processLargeDocument(
      videoText,
      { type: 'youtube_videos', count: videos.length },
      async (chunk: string, index: number): Promise<void> => {
        const videoMatch = videos[index];
        if (videoMatch) {
          await this.processVideo(videoMatch.id);
        }
      }
    );
  }

  async processVideo(
    videoId: string,
    options: ProcessingOptions = {}
  ): Promise<void> {
    const {
      downloadAudio = true,
      transcribe = true,
      vectorize = true,
      deleteAfterProcessing = true,
    } = options;

    // Check if already processing
    if (this.processingQueue.has(videoId)) {
      await this.processingQueue.get(videoId);
      return;
    }

    const processing = (async () => {
      try {
        let audioPath: string | undefined;
        let transcript: string | undefined;

        // Download audio
        if (downloadAudio) {
          audioPath = await this.downloadAudio(videoId);
        }

        // Transcribe
        if (transcribe && audioPath) {
          transcript = await this.transcribeAudio(audioPath);
        }

        // Vectorize
        if (vectorize && transcript) {
          await this.batchProcessor.processLargeDocument(
            transcript,
            {
              videoId,
              type: 'youtube_transcript',
            },
            async (chunk: string, index: number): Promise<void> => {
              // Process each chunk of the transcript
              await this.vectorStorage.addDocument(chunk, {
                sourceType: 'text',
                title: `Transcript chunk ${index} for video ${videoId}`,
                url: `https://youtube.com/watch?v=${videoId}`,
                timestamp: new Date().toISOString()
              });
            }
          );
        }

        // Cleanup
        if (deleteAfterProcessing && audioPath) {
          await fs.unlink(audioPath);
        }
      } finally {
        this.processingQueue.delete(videoId);
      }
    })();

    this.processingQueue.set(videoId, processing);
    await processing;
  }

  async processChannel(
    channelId: string,
    options: ProcessingOptions = {}
  ): Promise<void> {
    const videos = await this.getChannelVideos(channelId);
    
    // Process in batches of 5 videos
    const batches = [];
    for (let i = 0; i < videos.length; i += 5) {
      const batch = videos.slice(i, i + 5);
      batches.push(batch);
    }

    for (const batch of batches) {
      await this.processVideoBatch(batch);
    }
  }

  async monitorChannel(
    channelId: string,
    options: ProcessingOptions = {}
  ): Promise<void> {
    if (this.channelMonitors.has(channelId)) {
      return;
    }

    // Get initial video list
    const lastVideos = await this.getChannelVideos(channelId);
    this.channelMonitors.set(channelId, { lastVideos, options });

    // Start polling if not already started
    if (!this.pollingInterval) {
      this.startPolling();
    }
  }

  private async checkForNewVideos(): Promise<void> {
    for (const [channelId, monitor] of this.channelMonitors.entries()) {
      try {
        const currentVideos = await this.getChannelVideos(channelId);
        const newVideos = currentVideos.filter(
          video => !monitor.lastVideos.find(v => v.id === video.id)
        );

        if (newVideos.length > 0) {
          console.log(`Found ${newVideos.length} new videos for channel ${channelId}`);
          await this.processVideoBatch(newVideos);
          monitor.lastVideos = currentVideos;
        }
      } catch (error) {
        console.error('Error checking for new videos:', error);
      }
    }
  }

  private startPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
    this.pollingInterval = setInterval(() => this.checkForNewVideos(), this.pollingIntervalMs);
  }

  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
    }
  }

  stopMonitoring(channelId: string): void {
    this.channelMonitors.delete(channelId);
    if (this.channelMonitors.size === 0) {
      this.stopPolling();
    }
  }

  async getProcessingStatus(): Promise<{
    queueSize: number;
    monitoredChannels: string[];
    cacheMetrics: any;
    processorMetrics: any;
  }> {
    return {
      queueSize: this.processingQueue.size,
      monitoredChannels: Array.from(this.channelMonitors.keys()),
      cacheMetrics: this.cache.getMetrics(),
      processorMetrics: this.batchProcessor.getMetrics(),
    };
  }
}
