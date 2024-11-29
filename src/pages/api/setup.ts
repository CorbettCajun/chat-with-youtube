import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';
import { writeFile } from 'fs/promises';
import path from 'path';
import { validatePineconeCredentials } from '../../utils/pinecone';

type SetupRequest = {
  openaiKey: string;
  pineconeKey: string;
  pineconeIndex: string;
  youtubeKey: string;
};

type SetupResponse = {
  success: boolean;
  message?: string;
  step?: string;
  details?: any;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SetupResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { openaiKey, pineconeKey, pineconeIndex, youtubeKey } = req.body as SetupRequest;

    // Validate inputs
    if (!openaiKey || !pineconeKey || !pineconeIndex || !youtubeKey) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required',
      });
    }

    // Validate OpenAI API key format
    if (!openaiKey.startsWith('sk-')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OpenAI API key format',
        step: 'openai_validation',
      });
    }

    // Validate OpenAI API key
    try {
      const openai = new OpenAI({
        apiKey: openaiKey
      });
      await openai.models.list();
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: 'Failed to validate OpenAI API key: ' + (error.message || 'Unknown error'),
        step: 'openai_validation',
      });
    }

    // Validate Pinecone credentials
    try {
      const pineconeValidation = await validatePineconeCredentials(pineconeKey, pineconeIndex);
      if (!pineconeValidation.valid) {
        return res.status(400).json({
          success: false,
          message: pineconeValidation.error || 'Failed to validate Pinecone credentials',
          step: 'pinecone_validation',
          details: pineconeValidation,
        });
      }

      // Validate Pinecone API key and index
      const pinecone = new Pinecone({
        apiKey: pineconeKey,
      });
      
      const index = pinecone.index(pineconeIndex);
      await index.describeIndexStats();
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: 'Failed to validate Pinecone credentials: ' + (error.message || 'Unknown error'),
        step: 'pinecone_validation',
      });
    }

    // Validate YouTube API key
    try {
      const { google } = require('googleapis');
      const youtube = google.youtube({
        version: 'v3',
        auth: youtubeKey,
      });

      // Test the API key with a simple search request
      await youtube.search.list({
        part: ['snippet'],
        q: 'test',
        maxResults: 1,
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: 'Failed to validate YouTube API key: ' + (error.message || 'Unknown error'),
        step: 'youtube_validation',
      });
    }

    // Write environment variables to .env file
    const envContent = `OPENAI_API_KEY=${openaiKey}
PINECONE_API_KEY=${pineconeKey}
PINECONE_INDEX=${pineconeIndex}
PINECONE_ENVIRONMENT=${process.env.PINECONE_ENVIRONMENT || 'gcp-starter'}
YOUTUBE_API_KEY=${youtubeKey}`;

    const envPath = path.join(process.cwd(), '.env');
    await writeFile(envPath, envContent, 'utf-8');

    return res.status(200).json({
      success: true,
      message: 'Configuration saved successfully',
    });
  } catch (error: any) {
    console.error('Setup error:', error);
    return res.status(500).json({
      success: false,
      message: 'Setup failed: ' + (error.message || 'Unknown error'),
    });
  }
}
