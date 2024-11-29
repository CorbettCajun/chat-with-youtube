interface BatchProcessorOptions {
  batchSize?: number;
  maxRetries?: number;
  retryDelay?: number;
  maxConcurrent?: number;
}

interface ProcessingMetrics {
  totalItems: number;
  processedItems: number;
  failedItems: number;
  retries: number;
  startTime: number;
  endTime?: number;
}

export class BatchProcessor {
  private batchSize: number;
  private maxRetries: number;
  private retryDelay: number;
  private maxConcurrent: number;
  private metrics: Map<string, ProcessingMetrics>;

  constructor(options: BatchProcessorOptions = {}) {
    this.batchSize = options.batchSize ?? 10;
    this.maxRetries = options.maxRetries ?? 3;
    this.retryDelay = options.retryDelay ?? 1000;
    this.maxConcurrent = options.maxConcurrent ?? 5;
    this.metrics = new Map();
  }

  public async process<T>(
    items: T[],
    processor: (item: T) => Promise<void>,
    batchId: string = Date.now().toString()
  ): Promise<void> {
    this.metrics.set(batchId, {
      totalItems: items.length,
      processedItems: 0,
      failedItems: 0,
      retries: 0,
      startTime: Date.now(),
    });

    // Split items into batches
    const batches = this.createBatches(items);

    try {
      // Process batches with concurrency limit
      for (let i = 0; i < batches.length; i += this.maxConcurrent) {
        const currentBatches = batches.slice(i, i + this.maxConcurrent);
        await Promise.all(
          currentBatches.map((batch) => this.processBatch(batch, processor, batchId))
        );
      }
    } finally {
      const metrics = this.metrics.get(batchId);
      if (metrics) {
        metrics.endTime = Date.now();
      }
    }
  }

  private createBatches<T>(items: T[]): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += this.batchSize) {
      batches.push(items.slice(i, i + this.batchSize));
    }
    return batches;
  }

  private async processBatch<T>(
    batch: T[],
    processor: (item: T) => Promise<void>,
    batchId: string
  ): Promise<void> {
    await Promise.all(
      batch.map((item) => this.processWithRetry(item, processor, batchId))
    );
  }

  private async processWithRetry<T>(
    item: T,
    processor: (item: T) => Promise<void>,
    batchId: string,
    retryCount: number = 0
  ): Promise<void> {
    try {
      await processor(item);
      const metrics = this.metrics.get(batchId);
      if (metrics) {
        metrics.processedItems++;
      }
    } catch (error) {
      if (retryCount < this.maxRetries) {
        const metrics = this.metrics.get(batchId);
        if (metrics) {
          metrics.retries++;
        }
        await new Promise((resolve) => setTimeout(resolve, this.retryDelay));
        return this.processWithRetry(item, processor, batchId, retryCount + 1);
      } else {
        const metrics = this.metrics.get(batchId);
        if (metrics) {
          metrics.failedItems++;
        }
        throw error;
      }
    }
  }

  public getMetrics(batchId: string): ProcessingMetrics | undefined {
    return this.metrics.get(batchId);
  }

  public clearMetrics(batchId: string): void {
    this.metrics.delete(batchId);
  }
}
