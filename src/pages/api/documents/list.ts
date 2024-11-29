import type { NextApiRequest, NextApiResponse } from 'next';
import { Pinecone } from '@pinecone-database/pinecone';
import { env } from '~/env.mjs';

type DocumentMetadata = {
  id: string;
  title: string;
  type: 'youtube' | 'document';
  url?: string;
  dateAdded: string;
  chunks: number;
  summary?: string;
  duration?: string;
  author?: string;
  thumbnailUrl?: string;
  categories?: string[];
};

type DocumentListResponse = {
  documents: DocumentMetadata[];
  totalDocuments: number;
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DocumentListResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).end();
  }

  const pineconeKey = env.PINECONE_API_KEY;
  const pineconeIndex = env.PINECONE_INDEX;

  if (!pineconeKey || !pineconeIndex) {
    return res.status(500).json({
      documents: [],
      totalDocuments: 0,
      error: 'Pinecone credentials not configured'
    });
  }

  try {
    const pinecone = new Pinecone({
      apiKey: pineconeKey,
    });

    const index = pinecone.Index(pineconeIndex);
    
    // Query for all document metadata
    const queryResponse = await index.query({
      vector: new Array(1536).fill(0),
      topK: 10000,
      includeMetadata: true,
      filter: { source_id: { $exists: true } }
    });

    // Process and deduplicate documents based on source ID
    const documentMap = new Map<string, DocumentMetadata>();

    queryResponse.matches?.forEach((match) => {
      const metadata = match.metadata as any;
      if (metadata?.source_id && !documentMap.has(metadata.source_id)) {
        documentMap.set(metadata.source_id, {
          id: metadata.source_id,
          title: metadata.title || 'Untitled',
          type: metadata.source_type || 'document',
          url: metadata.url,
          dateAdded: metadata.date_added || new Date().toISOString(),
          chunks: 1,
          summary: metadata.summary,
          duration: metadata.duration,
          author: metadata.author,
          thumbnailUrl: metadata.thumbnail_url,
          categories: metadata.categories,
        });
      } else if (metadata?.source_id) {
        // Increment chunk count for existing documents
        const doc = documentMap.get(metadata.source_id);
        if (doc) {
          doc.chunks += 1;
        }
      }
    });

    // Convert to array and sort by date
    const documents = Array.from(documentMap.values())
      .sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime());

    return res.status(200).json({
      documents,
      totalDocuments: documents.length
    });

  } catch (error: any) {
    console.error('Error fetching documents:', error);
    return res.status(500).json({
      documents: [],
      totalDocuments: 0,
      error: error?.message || 'Failed to fetch documents'
    });
  }
}
