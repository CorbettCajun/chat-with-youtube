import { NextApiRequest, NextApiResponse } from 'next';
import { OpenAIEmbeddings } from '@langchain/openai';
import { Document } from '@langchain/core/documents';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { PineconeStore } from '@langchain/pinecone';
import { Pinecone } from '@pinecone-database/pinecone';
import { getErrorMessage } from '~/utils/error';
import { env } from '~/env.mjs';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { text, title, categories = [], description } = req.body;

    if (!text) {
      return res.status(400).json({ message: 'No text provided' });
    }

    if (!env.PINECONE_API_KEY || !env.PINECONE_INDEX) {
      return res.status(500).json({
        message: 'Pinecone API key or index name not found',
      });
    }

    // Create embeddings
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: env.OPENAI_API_KEY,
      modelName: "text-embedding-ada-002",
    });

    // Initialize Pinecone client
    const client = new Pinecone({
      apiKey: env.PINECONE_API_KEY,
    });

    // Get index instance
    const pineconeIndex = client.Index(env.PINECONE_INDEX);

    // Create text splitter and process documents
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const docs = await textSplitter.createDocuments([text]);

    // Add metadata to documents
    const sourceId = `doc-${Date.now()}`;
    const processedDocs = docs.map((doc, index) => ({
      ...doc,
      metadata: {
        ...doc.metadata,
        source_id: sourceId,
        source_type: 'document',
        title: title || 'Untitled Document',
        date_added: new Date().toISOString(),
        chunk_index: index,
        total_chunks: docs.length,
        categories: categories,
        description: description,
      },
    }));

    // Store documents in Pinecone
    await PineconeStore.fromExistingIndex(embeddings, {
      pineconeIndex: pineconeIndex as any, // Type cast to avoid version conflict
      namespace: env.PINECONE_NAMESPACE,
    }).then(store => store.addDocuments(processedDocs));

    return res.status(200).json({ 
      message: 'Successfully processed text',
      documentId: sourceId,
    });
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error);
    return res.status(500).json({ message: errorMessage });
  }
}
