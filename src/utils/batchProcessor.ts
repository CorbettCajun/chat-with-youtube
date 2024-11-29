import { EnhancedVectorStorage } from './vectorStorage';
import { TextSplitter } from 'langchain/text_splitter';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import pLimit from 'p-limit';
import { chunk } from 'lodash';
import { performance } from 'perf_hooks';

interface BatchProcessingOptions {
  chunkSize?: number;
  overlapSize?: number;
  batchSize?: number;
  concurrentBatches?: number;
  maxRetries?: number;
  retryDelay?: number;
}

interface ProcessingMetrics {
  totalChunks: number;
  processedChunks: number;
  failedChunks: number;
  processingTime: number;
  averageChunkTime: number;
  retryCount: number;
}

interface ProcessingBatch {
  text: string;
  metadata: Record<string, any>;
}

export class BatchProcessor {
  private vectorStorage: EnhancedVectorStorage;
  private textSplitter!: TextSplitter;
  private options: BatchProcessingOptions;
  private metrics: ProcessingMetrics;

  constructor(
    options: BatchProcessingOptions = {}
  ) {
    this.vectorStorage = new EnhancedVectorStorage();
    this.options = {
      chunkSize: options.chunkSize || 1000,
      overlapSize: options.overlapSize || 200,
      batchSize: options.batchSize || 10,
      concurrentBatches: options.concurrentBatches || 3,
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
    };

    this.metrics = {
      totalChunks: 0,
      processedChunks: 0,
      failedChunks: 0,
      processingTime: 0,
      averageChunkTime: 0,
      retryCount: 0,
    };
  }

  async initialize(): Promise<void> {
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: this.options.chunkSize,
      chunkOverlap: this.options.overlapSize,
    });
    await this.vectorStorage.initialize();

    // Reset metrics
    this.metrics = {
      totalChunks: 0,
      processedChunks: 0,
      failedChunks: 0,
      processingTime: 0,
      averageChunkTime: 0,
      retryCount: 0,
    };
  }

  private async processChunkWithRetry(
    chunk: string,
    metadata: any,
    retryCount = 0
  ): Promise<boolean> {
    try {
      const startTime = performance.now();
      await this.vectorStorage.addDocument(chunk, metadata);
      const endTime = performance.now();
      
      this.metrics.processedChunks++;
      this.metrics.processingTime += (endTime - startTime);
      this.metrics.averageChunkTime = this.metrics.processingTime / this.metrics.processedChunks;
      
      return true;
    } catch (error) {
      if (retryCount < (this.options.maxRetries || 3)) {
        await new Promise(resolve => 
          setTimeout(resolve, (this.options.retryDelay || 1000) * Math.pow(2, retryCount))
        );
        return this.processChunkWithRetry(chunk, metadata, retryCount + 1);
      }
      
      this.metrics.failedChunks++;
      console.error(`Failed to process chunk after ${retryCount} retries:`, error);
      return false;
    }
  }

  async processBatch(
    documents: Array<{ text: string; metadata: any }>,
    progressCallback?: (progress: number, metrics: ProcessingMetrics) => void
  ): Promise<ProcessingMetrics> {
    const allChunks: Array<{ text: string; metadata: any }> = [];

    // Split documents into chunks
    for (const doc of documents) {
      const chunks = await this.textSplitter.splitText(doc.text);
      allChunks.push(...chunks.map(chunk => ({
        text: chunk,
        metadata: { ...doc.metadata, chunkIndex: allChunks.length }
      })));
    }

    this.metrics.totalChunks = allChunks.length;

    // Create batches
    const batches = chunk(allChunks, this.options.batchSize || 10);
    const limit = pLimit(this.options.concurrentBatches || 3);

    // Process batches concurrently
    const startTime = performance.now();
    
    await Promise.all(
      batches.map((batch, batchIndex) =>
        limit(async () => {
          const batchPromises = batch.map(({ text, metadata }) =>
            this.processChunkWithRetry(text, metadata)
          );

          await Promise.all(batchPromises);

          if (progressCallback) {
            const progress = ((batchIndex + 1) / batches.length) * 100;
            progressCallback(progress, { ...this.metrics });
          }
        })
      )
    );

    this.metrics.processingTime = performance.now() - startTime;
    return { ...this.metrics };
  }

  async processLargeDocument(
    text: string,
    metadata: Record<string, any>,
    chunkProcessor: (chunk: string, index: number) => Promise<void>
  ): Promise<ProcessingMetrics> {
    const chunks = await this.textSplitter.splitText(text);
    this.metrics.totalChunks = chunks.length;

    // Process chunks in batches
    const batches = [];
    for (let i = 0; i < chunks.length; i += this.options.batchSize || 10) {
      batches.push(chunks.slice(i, i + (this.options.batchSize || 10)));
    }

    const startTime = performance.now();

    for (const [batchIndex, batch] of batches.entries()) {
      await Promise.all(
        batch.map(async (chunk, chunkIndex) => {
          const globalIndex = batchIndex * (this.options.batchSize || 10) + chunkIndex;
          try {
            await chunkProcessor(chunk, globalIndex);
            this.metrics.processedChunks++;
          } catch (error) {
            console.error(`Error processing chunk ${globalIndex}:`, error);
            this.metrics.failedChunks++;
            this.metrics.retryCount++;
            if (this.metrics.retryCount > (this.options.maxRetries || 3)) {
              throw new Error('Too many failed chunks');
            }
          }
        })
      );
    }

    this.metrics.processingTime = performance.now() - startTime;
    this.metrics.averageChunkTime = 
      this.metrics.processingTime / this.metrics.processedChunks;

    return { ...this.metrics };
  }

  getMetrics(): ProcessingMetrics {
    return { ...this.metrics };
  }

  resetMetrics() {
    this.metrics = {
      totalChunks: 0,
      processedChunks: 0,
      failedChunks: 0,
      processingTime: 0,
      averageChunkTime: 0,
      retryCount: 0,
    };
  }
}
