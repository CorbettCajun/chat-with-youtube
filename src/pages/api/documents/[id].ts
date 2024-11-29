import { NextApiRequest, NextApiResponse } from 'next';
import { Pinecone } from '@pinecone-database/pinecone';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (req.method === 'DELETE') {
    try {
      // Initialize Pinecone
      const pinecone = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY!,
      });

      const index = pinecone.index(process.env.PINECONE_INDEX!);
      const namespace = process.env.PINECONE_NAMESPACE || 'default';

      // Delete the specific vector
      await index.deleteOne(id as string);

      return res.status(200).json({ message: 'Document deleted successfully' });

    } catch (error) {
      console.error('Error deleting document:', error);
      return res.status(500).json({ 
        message: 'Error deleting document', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  } else {
    return res.status(405).json({ message: 'Method not allowed' });
  }
}
