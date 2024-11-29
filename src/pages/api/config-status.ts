import type { NextApiRequest, NextApiResponse } from 'next';
import { Pinecone } from '@pinecone-database/pinecone';
import { OpenAI } from 'openai';

type ConfigStatus = {
  configured: boolean;
  missingSecrets: string[];
  message: string;
  details?: {
    openai?: boolean;
    pinecone?: boolean;
    youtube?: boolean;
  };
};

type ValidationError = {
  service: 'openai' | 'pinecone' | 'youtube';
  message: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ConfigStatus>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      configured: false,
      missingSecrets: [],
      message: 'Method not allowed',
    });
  }

  const requiredEnvVars = [
    'OPENAI_API_KEY',
    'PINECONE_API_KEY',
    'PINECONE_INDEX',
    'PINECONE_ENVIRONMENT',
  ];

  try {
    // Check required environment variables
    const missingSecrets = requiredEnvVars.filter(
      (envVar) => !process.env[envVar]
    );

    if (missingSecrets.length > 0) {
      return res.status(200).json({
        configured: false,
        missingSecrets,
        message: 'Missing required environment variables',
        details: {
          openai: !missingSecrets.includes('OPENAI_API_KEY'),
          pinecone: !missingSecrets.some(secret => secret.startsWith('PINECONE_')),
          youtube: true // Optional
        }
      });
    }

    const validationErrors: ValidationError[] = [];

    // Validate OpenAI API Key
    try {
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
      await openai.models.list();
    } catch (error) {
      validationErrors.push({
        service: 'openai',
        message: 'Invalid OpenAI API key'
      });
    }

    // Validate Pinecone credentials
    try {
      const pineconeApiKey = process.env.PINECONE_API_KEY;
      const pineconeIndex = process.env.PINECONE_INDEX;
      
      if (!pineconeApiKey || !pineconeIndex) {
        throw new Error('Missing Pinecone configuration');
      }

      const pinecone = new Pinecone({
        apiKey: pineconeApiKey
      });

      const index = pinecone.index(pineconeIndex);
      await index.describeIndexStats();
    } catch (error) {
      validationErrors.push({
        service: 'pinecone',
        message: error instanceof Error ? error.message : 'Failed to validate Pinecone configuration'
      });
    }

    // Validate YouTube API Key if provided
    if (process.env.YOUTUBE_API_KEY) {
      try {
        const response = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&q=test&key=${process.env.YOUTUBE_API_KEY}&maxResults=1`
        );
        if (!response.ok) {
          throw new Error('Invalid YouTube API key');
        }
      } catch (error) {
        validationErrors.push({
          service: 'youtube',
          message: 'Invalid YouTube API key'
        });
      }
    }

    // If there are validation errors, return them
    if (validationErrors.length > 0) {
      return res.status(200).json({
        configured: false,
        missingSecrets: [],
        message: 'Configuration validation failed',
        details: {
          openai: !validationErrors.some(error => error.service === 'openai'),
          pinecone: !validationErrors.some(error => error.service === 'pinecone'),
          youtube: !validationErrors.some(error => error.service === 'youtube')
        }
      });
    }

    // All checks passed
    return res.status(200).json({
      configured: true,
      missingSecrets: [],
      message: 'Configuration complete',
      details: {
        openai: true,
        pinecone: true,
        youtube: true
      }
    });
  } catch (error) {
    console.error('Config status check error:', error);
    return res.status(200).json({
      configured: false,
      missingSecrets: [],
      message: error instanceof Error ? error.message : 'Failed to validate configuration',
      details: {
        openai: false,
        pinecone: false,
        youtube: false
      }
    });
  }
}
