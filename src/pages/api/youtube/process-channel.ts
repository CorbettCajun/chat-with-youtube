import { NextApiRequest, NextApiResponse } from 'next';
import { YouTubeProcessor } from '~/lib/youtube/youtubeProcessor';
import { env } from '~/env.mjs';

interface ProcessChannelRequest {
  channelUrl: string;
  options?: {
    monitor?: boolean;
    intervalMinutes?: number;
    batchSize?: number;
    maxRetries?: number;
    cacheEnabled?: boolean;
  };
}

interface ProcessChannelResponse {
  processId: string;
  channelId: string;
  message: string;
  monitoring?: boolean;
}

// Initialize processor with default options
const processor = new YouTubeProcessor({
  batchSize: 5,
  maxRetries: 3,
  cacheEnabled: true,
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ProcessChannelResponse | { error: string; details?: string }>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { channelUrl, options = {} } = req.body as ProcessChannelRequest;

    if (!channelUrl) {
      return res.status(400).json({ error: 'Channel URL is required' });
    }

    // Check if YouTube API key is configured
    if (!env.YOUTUBE_API_KEY) {
      return res.status(400).json({ error: 'YouTube API key is not configured' });
    }

    // Extract channel ID from URL
    let channelId: string;
    try {
      const url = new URL(channelUrl);
      const paths = url.pathname.split('/').filter(Boolean); // Remove empty segments
      
      if (url.hostname === 'www.youtube.com' || url.hostname === 'youtube.com') {
        if (url.pathname.startsWith('/channel/')) {
          const id = paths[1]; // 'channel' is at index 0, ID at index 1
          if (!id) {
            return res.status(400).json({ error: 'Invalid channel URL: missing channel ID' });
          }
          channelId = id;
        } else if (url.pathname.startsWith('/c/') || url.pathname.startsWith('/@')) {
          const username = paths[1]; // 'c' or '@' is at index 0, username at index 1
          if (!username) {
            return res.status(400).json({ error: 'Invalid channel URL: missing username' });
          }
          
          // For custom URLs, we need to fetch the channel ID
          const response = await fetch(
            `https://www.googleapis.com/youtube/v3/channels?part=id&forUsername=${username}&key=${env.YOUTUBE_API_KEY}`
          );
          
          if (!response.ok) {
            throw new Error(`YouTube API error: ${response.statusText}`);
          }
          
          const data = await response.json();
          channelId = data.items?.[0]?.id;
          
          if (!channelId) {
            return res.status(400).json({ error: 'Could not find channel ID' });
          }
        } else {
          return res.status(400).json({ error: 'Invalid channel URL format' });
        }
      } else {
        return res.status(400).json({ error: 'Not a YouTube URL' });
      }
    } catch (error) {
      return res.status(400).json({
        error: 'Invalid URL',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Start processing the channel
    const processId = await processor.processChannel(channelId);

    // Start monitoring for new videos if requested
    if (options.monitor) {
      processor.startMonitoring(channelId, options.intervalMinutes);
    }

    return res.status(200).json({
      processId,
      channelId,
      message: 'Channel processing started',
      monitoring: options.monitor,
    });
  } catch (error) {
    console.error('Error processing channel:', error);
    return res.status(500).json({
      error: 'Error processing channel',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
