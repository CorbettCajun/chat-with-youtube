import { NextApiRequest, NextApiResponse } from 'next';
import { YouTubeProcessor } from '~/lib/youtube/youtubeProcessor';

// Use the same processor instance as process-channel.ts
const processor = new YouTubeProcessor({
  batchSize: 5,
  maxRetries: 3,
  cacheEnabled: true,
});

interface StatusResponse {
  processId: string;
  status: {
    totalVideos: number;
    processedVideos: number;
    failedVideos: number;
    currentVideo?: {
      id: string;
      title: string;
      thumbnailUrl?: string;
    };
    errors: Array<{ videoId: string; error: string }>;
    status: 'idle' | 'processing' | 'completed' | 'error';
  };
  timestamp: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<StatusResponse | { error: string; details?: string }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { processId } = req.query;

    if (!processId || typeof processId !== 'string') {
      return res.status(400).json({ error: 'Process ID is required' });
    }

    const status = processor.getStatus(processId);
    
    if (!status) {
      return res.status(404).json({ error: 'Process not found' });
    }

    return res.status(200).json({
      processId,
      status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error getting status:', error);
    return res.status(500).json({
      error: 'Error getting status',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
