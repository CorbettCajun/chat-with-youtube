import NodeCache from 'node-cache';
import { createHash } from 'crypto';
import { performance } from 'perf_hooks';

interface CacheConfig {
  stdTTL?: number;        // Time to live in seconds
  checkperiod?: number;   // Time in seconds to check for expired keys
  maxKeys?: number;       // Maximum number of keys in cache
  useClones?: boolean;    // Use cloned objects
}

interface CacheStats {
  hits: number;
  misses: number;
  keys: number;
  ksize: number;
  vsize: number;
}

interface CacheMetrics {
  hitRate: number;
  missRate: number;
  averageAccessTime: number;
  totalQueries: number;
}

export class CacheManager {
  private cache: NodeCache;
  private metrics: {
    hits: number;
    misses: number;
    totalAccessTime: number;
    queries: number;
  };

  constructor(config: CacheConfig = {}) {
    this.cache = new NodeCache({
      stdTTL: config.stdTTL || 3600,          // 1 hour default TTL
      checkperiod: config.checkperiod || 600,  // Check expired keys every 10 minutes
      maxKeys: config.maxKeys || 1000,         // Maximum 1000 keys
      useClones: config.useClones ?? true,
    });

    this.metrics = {
      hits: 0,
      misses: 0,
      totalAccessTime: 0,
      queries: 0,
    };

    // Setup automatic cleaning
    this.setupAutoClean();
  }

  private generateKey(query: string, filters?: any): string {
    const content = JSON.stringify({ query, filters });
    return createHash('sha256').update(content).digest('hex');
  }

  private setupAutoClean() {
    // Clean up expired keys
    this.cache.on('expired', (key, value) => {
      console.log(`Cache key expired: ${key}`);
    });

    // Monitor cache size
    setInterval(() => {
      const stats = this.cache.getStats();
      if (stats.keys > (this.cache.options.maxKeys || 1000) * 0.9) {
        this.cleanCache();
      }
    }, 300000); // Check every 5 minutes
  }

  private async cleanCache() {
    const stats = this.cache.getStats();
    const keys = this.cache.keys();
    
    if (keys.length <= (this.cache.options.maxKeys || 1000) * 0.7) {
      return; // No need to clean if we're below 70% capacity
    }

    // Get access patterns
    const accessPatterns = new Map<string, number>();
    keys.forEach(key => {
      const value = this.cache.get<any>(key);
      if (value && value._accessCount) {
        accessPatterns.set(key, value._accessCount);
      }
    });

    // Sort by access count and remove least accessed items
    const sortedKeys = Array.from(accessPatterns.entries())
      .sort((a, b) => a[1] - b[1])
      .map(([key]) => key);

    // Remove bottom 30% of least accessed items
    const removeCount = Math.floor(sortedKeys.length * 0.3);
    sortedKeys.slice(0, removeCount).forEach(key => {
      this.cache.del(key);
    });
  }

  async get<T>(
    query: string,
    filters?: any,
    fetchFunction?: () => Promise<T>,
    ttl?: number
  ): Promise<T | null> {
    const startTime = performance.now();
    const key = this.generateKey(query, filters);

    try {
      // Attempt to get from cache
      let value = this.cache.get<T>(key);
      
      if (value !== undefined) {
        // Update access count
        const metadata = this.cache.get<any>(`${key}_metadata`);
        if (metadata) {
          metadata._accessCount = (metadata._accessCount || 0) + 1;
          this.cache.set(`${key}_metadata`, metadata);
        }

        this.metrics.hits++;
        this.updateMetrics(startTime);
        return value;
      }

      this.metrics.misses++;

      // If no fetch function provided, return null
      if (!fetchFunction) {
        this.updateMetrics(startTime);
        return null;
      }

      // Fetch new value
      value = await fetchFunction();

      // Store in cache with metadata
      this.cache.set(key, value, ttl);
      this.cache.set(`${key}_metadata`, {
        _accessCount: 1,
        _createdAt: Date.now(),
        query,
        filters,
      });

      this.updateMetrics(startTime);
      return value;
    } catch (error) {
      console.error('Cache error:', error);
      this.updateMetrics(startTime);
      return null;
    }
  }

  private updateMetrics(startTime: number) {
    const accessTime = performance.now() - startTime;
    this.metrics.totalAccessTime += accessTime;
    this.metrics.queries++;
  }

  getMetrics(): CacheMetrics {
    return {
      hitRate: this.metrics.hits / (this.metrics.hits + this.metrics.misses),
      missRate: this.metrics.misses / (this.metrics.hits + this.metrics.misses),
      averageAccessTime: this.metrics.totalAccessTime / this.metrics.queries,
      totalQueries: this.metrics.queries,
    };
  }

  getStats(): CacheStats {
    return this.cache.getStats();
  }

  clear() {
    this.cache.flushAll();
    this.metrics = {
      hits: 0,
      misses: 0,
      totalAccessTime: 0,
      queries: 0,
    };
  }
}
