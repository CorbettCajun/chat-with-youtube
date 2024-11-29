import { NextApiRequest, NextApiResponse } from 'next';
import { Pinecone } from '@pinecone-database/pinecone';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Initialize Pinecone
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    });

    const index = pinecone.index(process.env.PINECONE_INDEX!);

    // Fetch document metadata 
    // Note: This is a simplified approach. In a real-world scenario, 
    // you might want to implement pagination and more advanced filtering
    const neutralVector = new Array(1536).fill(0); // Adjust based on your embedding dimension

    // Fetch vector metadata 
    const queryResponse = await index.query({
      topK: 100, // Adjust as needed
      vector: neutralVector,
      includeMetadata: true,
    });

    // Process and format documents
    const documents = queryResponse.matches?.map(match => ({
      id: match.id,
      title: match.metadata?.title as string || 'Untitled',
      description: typeof match.metadata?.text === 'string' 
        ? (match.metadata.text as string).slice(0, 200) 
        : 'No description',
      type: match.metadata?.source as string || 'unknown',
      dateAdded: match.metadata?.uploadTimestamp as string || new Date().toISOString(),
      chunks: match.metadata?.chunks as number || 1,
      contentType: match.metadata?.contentType as string || 'text',
      tags: match.metadata?.tags as string[] || []
    })) || [];

    // Remove duplicates based on ID
    const uniqueDocuments = Array.from(
      new Map(documents.map(doc => [doc.id, doc])).values()
    );

    return res.status(200).json(uniqueDocuments);

  } catch (error) {
    console.error('Error fetching documents:', error);
    return res.status(500).json({ 
      message: 'Error fetching documents', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}
