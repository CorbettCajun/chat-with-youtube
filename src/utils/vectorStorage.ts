import { PineconeClient } from '@pinecone-database/pinecone';
import { Document } from 'langchain/document';
import { OpenAIEmbeddings } from '@langchain/openai';
import { analyzeContent } from './smartCorrection';

interface MetadataWithCategories {
  sourceType: 'file' | 'text' | 'url';
  platform?: string;
  contentType?: string;
  format?: string;
  confidence?: {
    platform: number;
    contentType: number;
    format: number;
  };
  title?: string;
  url?: string;
  timestamp?: string;
}

export class EnhancedVectorStorage {
  private client: PineconeClient;
  private embeddings: OpenAIEmbeddings;
  private namespace: string;
  private index: string;

  constructor() {
    this.client = new PineconeClient();
    this.embeddings = new OpenAIEmbeddings({
      modelName: 'text-embedding-ada-002',
      stripNewLines: true,
    });
    this.namespace = process.env.PINECONE_NAMESPACE || 'default';
    this.index = process.env.PINECONE_INDEX || '';
  }

  async initialize() {
    await this.client.init({
      apiKey: process.env.PINECONE_API_KEY || '',
      environment: process.env.PINECONE_ENVIRONMENT || '',
    });
  }

  async addDocument(
    text: string,
    metadata: Omit<MetadataWithCategories, 'platform' | 'contentType' | 'format' | 'confidence'>
  ) {
    const index = this.client.Index(this.index);
    
    // Analyze content for categorization
    const contentAnalysis = analyzeContent(text);
    
    // Generate embedding
    const embedding = await this.embeddings.embedQuery(text);
    
    // Combine base metadata with content analysis
    const enhancedMetadata: MetadataWithCategories = {
      ...metadata,
      platform: contentAnalysis.platform,
      contentType: contentAnalysis.contentType,
      format: contentAnalysis.format,
      confidence: contentAnalysis.confidence,
    };

    // Store in Pinecone with enhanced metadata
    await index.upsert({
      upsertRequest: {
        vectors: [{
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          values: embedding,
          metadata: enhancedMetadata,
        }],
        namespace: this.namespace,
      },
    });
  }

  async semanticSearch(
    query: string,
    filters?: {
      platform?: string[];
      contentType?: string[];
      format?: string[];
      sourceType?: ('file' | 'text' | 'url')[];
    },
    topK: number = 5
  ) {
    const index = this.client.Index(this.index);
    const queryEmbedding = await this.embeddings.embedQuery(query);

    // Build filter conditions
    const filterConditions: any = {};
    if (filters?.platform) {
      filterConditions.platform = { $in: filters.platform };
    }
    if (filters?.contentType) {
      filterConditions.contentType = { $in: filters.contentType };
    }
    if (filters?.format) {
      filterConditions.format = { $in: filters.format };
    }
    if (filters?.sourceType) {
      filterConditions.sourceType = { $in: filters.sourceType };
    }

    // Query Pinecone with filters
    const queryResponse = await index.query({
      queryRequest: {
        vector: queryEmbedding,
        topK,
        namespace: this.namespace,
        filter: Object.keys(filterConditions).length > 0 ? filterConditions : undefined,
      },
    });

    return queryResponse.matches?.map(match => ({
      score: match.score,
      metadata: match.metadata as MetadataWithCategories,
    }));
  }

  async getContentStats() {
    const index = this.client.Index(this.index);
    const stats = await index.describeIndexStats({
      describeIndexStatsRequest: {
        filter: {},
      },
    });

    return {
      totalVectors: stats.totalVectorCount,
      namespaceVectors: stats.namespaceStats?.[this.namespace]?.vectorCount || 0,
    };
  }

  async getSimilarContent(
    documentId: string,
    options: {
      samePlatform?: boolean;
      sameContentType?: boolean;
      sameFormat?: boolean;
      topK?: number;
    } = {}
  ) {
    const index = this.client.Index(this.index);
    
    // Fetch original document's vector
    const originalVector = await index.fetch({
      ids: [documentId],
      namespace: this.namespace,
    });

    if (!originalVector.vectors?.[documentId]) {
      throw new Error('Original document not found');
    }

    const vector = originalVector.vectors[documentId];
    const metadata = vector.metadata as MetadataWithCategories;

    // Build filter based on options
    const filterConditions: any = {};
    if (options.samePlatform && metadata.platform) {
      filterConditions.platform = { $eq: metadata.platform };
    }
    if (options.sameContentType && metadata.contentType) {
      filterConditions.contentType = { $eq: metadata.contentType };
    }
    if (options.sameFormat && metadata.format) {
      filterConditions.format = { $eq: metadata.format };
    }

    // Query similar content
    const queryResponse = await index.query({
      queryRequest: {
        vector: vector.values,
        topK: options.topK || 5,
        namespace: this.namespace,
        filter: Object.keys(filterConditions).length > 0 ? filterConditions : undefined,
      },
    });

    return queryResponse.matches?.filter(match => match.id !== documentId).map(match => ({
      score: match.score,
      metadata: match.metadata as MetadataWithCategories,
    }));
  }
}
