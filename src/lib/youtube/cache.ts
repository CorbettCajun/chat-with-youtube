interface CacheOptions {
  enabled?: boolean;
  maxSize?: number;
  ttl?: number;
}

interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

export class Cache {
  private cache: Map<string, CacheEntry<any>>;
  private enabled: boolean;
  private maxSize: number;
  private ttl: number;

  constructor(options: CacheOptions = {}) {
    this.cache = new Map();
    this.enabled = options.enabled ?? true;
    this.maxSize = options.maxSize ?? 1000;
    this.ttl = options.ttl ?? 24 * 60 * 60 * 1000; // 24 hours default TTL

    // Start cleanup interval
    setInterval(() => this.cleanup(), 60 * 60 * 1000); // Cleanup every hour
  }

  public async get<T>(key: string): Promise<T | null> {
    if (!this.enabled) return null;

    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if entry has expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  public async set<T>(key: string, value: T): Promise<void> {
    if (!this.enabled) return;

    // Evict oldest entries if cache is full
    while (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
    });
  }

  public delete(key: string): void {
    this.cache.delete(key);
  }

  public clear(): void {
    this.cache.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
      }
    }
  }

  public getStats(): {
    size: number;
    maxSize: number;
    enabled: boolean;
    ttl: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      enabled: this.enabled,
      ttl: this.ttl,
    };
  }
}
