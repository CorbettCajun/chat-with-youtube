import { NextApiRequest, NextApiResponse } from 'next';
import { BatchProcessor } from '../../../utils/batchProcessor';
import { CacheManager } from '../../../utils/cacheManager';
import { WorkerPool } from '../../../utils/workerPool';
import { cleanText } from '../../../utils/textProcessing';
import { detectContentType } from '../../../utils/contentTypeDetection';
import path from 'path';
import { OpenAIEmbeddings } from '@langchain/openai';
import { Pinecone } from '@pinecone-database/pinecone';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { v4 as uuidv4 } from 'uuid';

interface TextUploadRequest {
  title: string;
  text: string;
  tags?: string[];
  language?: string;
}

// Validation function
function validateTextUpload(data: TextUploadRequest): string[] {
  const errors: string[] = [];

  if (!data.title || data.title.trim().length === 0) {
    errors.push('Title is required');
  }

  if (!data.text || data.text.trim().length === 0) {
    errors.push('Text content is required');
  }

  if (data.title && data.title.length > 200) {
    errors.push('Title must be less than 200 characters');
  }

  if (data.text && data.text.length > 100000) {
    errors.push('Text content must be less than 100,000 characters');
  }

  return errors;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      message: 'Method not allowed', 
      supportedMethods: ['POST'] 
    });
  }

  try {
    const uploadData: TextUploadRequest = req.body;

    // Validate input
    const validationErrors = validateTextUpload(uploadData);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    // Clean and process text
    const cleanedText = cleanText(uploadData.text, {
      removeUrls: true,
      removeEmails: true,
      removeSpecialChars: true,
      removeExtraSpaces: true,
    });

    // Detect content type
    const contentType = detectContentType(uploadData.text, {
      preferredLanguage: uploadData.language
    });

    // Initialize text splitter with adaptive chunk size
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: contentType === 'technical' ? 1500 : 1000,
      chunkOverlap: 200,
    });

    // Split text into chunks
    const docs = await splitter.createDocuments([cleanedText]);

    // Initialize Pinecone
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    });

    const index = pinecone.index(process.env.PINECONE_INDEX!);
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    // Create vectors from chunks with enhanced metadata
    const vectors = await Promise.all(
      docs.map(async (doc, index) => {
        const embedding = await embeddings.embedQuery(doc.pageContent);
        return {
          id: `text_${uuidv4()}_${index}`,
          values: embedding,
          metadata: {
            text: doc.pageContent,
            source: 'text_upload',
            title: uploadData.title,
            contentType: contentType,
            tags: uploadData.tags || [],
            language: uploadData.language || 'unknown',
            uploadTimestamp: new Date().toISOString(),
          }
        };
      })
    );

    // Upsert vectors to Pinecone
    await index.upsert(vectors);

    return res.status(200).json({ 
      message: 'Text uploaded and processed successfully', 
      chunks: vectors.length,
      contentType: contentType,
      title: uploadData.title,
    });

  } catch (error) {
    console.error('Text upload error:', error);
    return res.status(500).json({ 
      message: 'Internal server error during text upload', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}
