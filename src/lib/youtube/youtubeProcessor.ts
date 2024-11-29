import { Pinecone } from '@pinecone-database/pinecone';
import { OpenAIEmbeddings } from '@langchain/openai';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { Document } from 'langchain/document';
import { Cache } from './cache';
import { BatchProcessor } from './batchProcessor';
import { env } from '~/env.mjs';

interface VideoMetadata {
  id: string;
  title: string;
  description?: string;
  publishedAt: string;
  thumbnailUrl?: string;
  channelId: string;
  channelTitle: string;
  duration?: string;
}

interface ProcessingOptions {
  batchSize?: number;
  maxRetries?: number;
  cacheEnabled?: boolean;
  chunkSize?: number;
  chunkOverlap?: number;
}

interface ProcessingStatus {
  totalVideos: number;
  processedVideos: number;
  failedVideos: number;
  currentVideo?: VideoMetadata;
  errors: Array<{ videoId: string; error: string }>;
  status: 'idle' | 'processing' | 'completed' | 'error';
}

export class YouTubeProcessor {
  private pinecone: Pinecone;
  private embeddings: OpenAIEmbeddings;
  private textSplitter: RecursiveCharacterTextSplitter;
  private cache: Cache;
  private batchProcessor: BatchProcessor;
  private channelMonitors: Map<string, { timer: NodeJS.Timeout; lastVideos: VideoMetadata[] }>;
  private status: Map<string, ProcessingStatus>;

  constructor(options: ProcessingOptions = {}) {
    this.pinecone = new Pinecone({
      apiKey: env.PINECONE_API_KEY,
    });

    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: env.OPENAI_API_KEY,
    });

    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: options.chunkSize ?? 1000,
      chunkOverlap: options.chunkOverlap ?? 200,
    });

    this.cache = new Cache({
      enabled: options.cacheEnabled ?? true,
    });

    this.batchProcessor = new BatchProcessor({
      batchSize: options.batchSize ?? 5,
      maxRetries: options.maxRetries ?? 3,
    });

    this.channelMonitors = new Map();
    this.status = new Map();
  }

  private async getChannelVideos(channelId: string): Promise<VideoMetadata[]> {
    const url = new URL('https://www.googleapis.com/youtube/v3/search');
    url.searchParams.append('part', 'snippet');
    url.searchParams.append('channelId', channelId);
    url.searchParams.append('maxResults', '50');
    url.searchParams.append('type', 'video');
    url.searchParams.append('key', env.YOUTUBE_API_KEY ?? '');

    try {
      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`Failed to fetch channel videos: ${response.statusText}`);
      }

      const data = await response.json();
      return data.items.map((item: any) => ({
        id: item.id.videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        publishedAt: item.snippet.publishedAt,
        thumbnailUrl: item.snippet.thumbnails?.high?.url,
        channelId: item.snippet.channelId,
        channelTitle: item.snippet.channelTitle,
      }));
    } catch (error) {
      console.error('Error fetching channel videos:', error);
      throw error;
    }
  }

  private async processVideo(video: VideoMetadata): Promise<void> {
    try {
      // Check cache first
      const cachedTranscript = await this.cache.get(`transcript:${video.id}`);
      if (cachedTranscript) {
        return;
      }

      // Download video audio and get transcript
      const transcript = await this.getVideoTranscript(video.id);
      
      // Split transcript into chunks
      const docs = await this.textSplitter.createDocuments([transcript]);
      
      // Create embeddings and store in Pinecone
      const vectors = await Promise.all(
        docs.map(async (doc, index) => {
          const embedding = await this.embeddings.embedQuery(doc.pageContent);
          return {
            id: `${video.id}-${index}`,
            values: embedding,
            metadata: {
              text: doc.pageContent,
              videoId: video.id,
              title: video.title,
              channelId: video.channelId,
              channelTitle: video.channelTitle,
              chunkIndex: index,
              type: 'youtube',
              url: `https://youtube.com/watch?v=${video.id}`,
            },
          };
        })
      );

      const index = this.pinecone.index(env.PINECONE_INDEX);
      await index.upsert(vectors);

      // Cache the processed result
      await this.cache.set(`transcript:${video.id}`, transcript);
    } catch (error) {
      console.error(`Error processing video ${video.id}:`, error);
      throw error;
    }
  }

  private async getVideoTranscript(videoId: string): Promise<string> {
    // This is a placeholder. You'll need to implement the actual video download
    // and transcription logic using youtube-dl and Whisper API
    throw new Error('Not implemented');
  }

  public async processChannel(channelId: string): Promise<string> {
    const processId = `channel:${channelId}:${Date.now()}`;
    
    this.status.set(processId, {
      totalVideos: 0,
      processedVideos: 0,
      failedVideos: 0,
      errors: [],
      status: 'processing',
    });

    try {
      const videos = await this.getChannelVideos(channelId);
      const status = this.status.get(processId)!;
      status.totalVideos = videos.length;

      await this.batchProcessor.process(videos, async (video) => {
        try {
          await this.processVideo(video);
          status.processedVideos++;
          status.currentVideo = video;
        } catch (error) {
          status.failedVideos++;
          status.errors.push({
            videoId: video.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      });

      status.status = 'completed';
      return processId;
    } catch (error) {
      const status = this.status.get(processId)!;
      status.status = 'error';
      throw error;
    }
  }

  public getStatus(processId: string): ProcessingStatus | undefined {
    return this.status.get(processId);
  }

  public startMonitoring(channelId: string, intervalMinutes: number = 60): void {
    if (this.channelMonitors.has(channelId)) {
      return;
    }

    const checkForNewVideos = async () => {
      const monitor = this.channelMonitors.get(channelId);
      if (!monitor) return;

      try {
        const currentVideos = await this.getChannelVideos(channelId);
        const newVideos = currentVideos.filter(
          (video) => !monitor.lastVideos.some((v) => v.id === video.id)
        );

        if (newVideos.length > 0) {
          await this.batchProcessor.process(newVideos, async (video) => {
            await this.processVideo(video);
          });
          monitor.lastVideos = currentVideos;
        }
      } catch (error) {
        console.error(`Error monitoring channel ${channelId}:`, error);
      }
    };

    const timer = setInterval(checkForNewVideos, intervalMinutes * 60 * 1000);
    this.channelMonitors.set(channelId, { timer, lastVideos: [] });

    // Initial check
    void checkForNewVideos();
  }

  public stopMonitoring(channelId: string): void {
    const monitor = this.channelMonitors.get(channelId);
    if (monitor) {
      clearInterval(monitor.timer);
      this.channelMonitors.delete(channelId);
    }
  }
}
