import { PineconeStore } from '@langchain/pinecone';
import { OpenAIEmbeddings } from '@langchain/openai';
import { Pinecone } from '@pinecone-database/pinecone';
import { env } from '~/env.mjs';

export async function validatePineconeCredentials(apiKey: string, indexName: string): Promise<{ valid: boolean; error?: string }> {
  try {
    // Initialize Pinecone client with the correct configuration
    const client = new Pinecone({
      apiKey,
    });

    // Get index instance and try to access it
    const index = client.Index(indexName);
    
    // Check if index exists by trying to fetch stats
    await index.describeIndexStats();

    return { valid: true };
  } catch (err) {
    const error = err as Error;
    if (error.message.includes('Unauthorized')) {
      return {
        valid: false,
        error: 'Invalid Pinecone API key',
      };
    }
    
    return {
      valid: false,
      error: `Pinecone validation error: ${error.message}`,
    };
  }
}
