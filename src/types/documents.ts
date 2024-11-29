export interface DocumentMetadata {
  id: string;
  title: string;
  type: 'youtube' | 'document';
  url?: string;
  createdAt: string;
  chunks?: number;
  summary?: string;
  duration?: string;
  author?: string;
  thumbnailUrl?: string;
  categories?: string[];
  description?: string;
  sourceType?: string;
  contentType?: string;
  status?: 'processing' | 'completed' | 'error';
  error?: string;
  metadata?: Record<string, any>;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  parentId?: string;
  metadata?: Record<string, any>;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  index: number;
  embedding?: number[];
  metadata?: Record<string, any>;
}

export interface SearchResult {
  document: DocumentMetadata;
  relevanceScore: number;
  matchedChunks: DocumentChunk[];
}
