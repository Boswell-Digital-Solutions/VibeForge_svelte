/**
 * Prediction Cache Utility
 * Phase 3.7.3: Performance Optimizations
 *
 * Caches success predictions to reduce redundant calculations
 */

import type { SuccessPrediction, PredictSuccessRequest } from '$lib/types/success-prediction';

// ============================================================================
// Types
// ============================================================================

interface CacheKey {
  patternId: string;
  stackId?: string;
  userId?: string;
  hash: string; // simpleHash of the sorted metadata
}

interface CacheEntry {
  prediction: SuccessPrediction;
  timestamp: number;
  ttl: number; // milliseconds
}

// ============================================================================
// Cache Implementation
// ============================================================================

class PredictionCache {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Generate cache key from request
   */
  private generateKey(request: PredictSuccessRequest): string {
    const metadataHash = this.hashMetadata(request.metadata || {});

    return `${request.patternId}|${request.stackId || 'none'}|${request.userId || 'none'}|${metadataHash}`;
  }

  /**
   * Hash metadata object for cache key
   */
  private hashMetadata(metadata: any): string {
    if (!metadata || Object.keys(metadata).length === 0) {
      return 'no-metadata';
    }

    // Sort keys for consistent hashing
    const sorted = Object.keys(metadata)
      .sort()
      .reduce((acc, key) => {
        acc[key] = metadata[key];
        return acc;
      }, {} as Record<string, any>);

    // Simple string hash (browser-compatible)
    const str = JSON.stringify(sorted);
    return this.simpleHash(str);
  }

  /**
   * Simple string hash (browser-compatible alternative to crypto.createHash)
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Get cached prediction if valid
   */
  get(request: PredictSuccessRequest): SuccessPrediction | null {
    const key = this.generateKey(request);
    const entry = this.cache.get(key);

    if (!entry) return null;

    const now = Date.now();
    const age = now - entry.timestamp;

    // Check if cache is still valid
    if (age < entry.ttl) {
      return entry.prediction;
    }

    // Cache expired, remove it
    this.cache.delete(key);
    return null;
  }

  /**
   * Set prediction in cache
   */
  set(request: PredictSuccessRequest, prediction: SuccessPrediction, ttl?: number): void {
    const key = this.generateKey(request);

    this.cache.set(key, {
      prediction,
      timestamp: Date.now(),
      ttl: ttl || this.DEFAULT_TTL,
    });
  }

  /**
   * Invalidate cache for a specific pattern
   */
  invalidatePattern(patternId: string): void {
    const keysToDelete: string[] = [];

    for (const [key] of this.cache) {
      if (key.startsWith(patternId)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.cache.delete(key));
  }

  /**
   * Invalidate cache for a specific stack
   */
  invalidateStack(stackId: string): void {
    const keysToDelete: string[] = [];

    for (const [key] of this.cache) {
      if (key.includes(`|${stackId}|`)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.cache.delete(key));
  }

  /**
   * Invalidate cache for a specific user
   */
  invalidateUser(userId: string): void {
    const keysToDelete: string[] = [];

    for (const [key] of this.cache) {
      if (key.includes(`|${userId}|`)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.cache.delete(key));
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    entries: Array<{ key: string; age: number; ttl: number }>;
  } {
    const now = Date.now();
    const entries: Array<{ key: string; age: number; ttl: number }> = [];

    for (const [key, entry] of this.cache) {
      entries.push({
        key,
        age: now - entry.timestamp,
        ttl: entry.ttl,
      });
    }

    return {
      size: this.cache.size,
      entries,
    };
  }

  /**
   * Clean up expired entries
   */
  cleanup(): number {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache) {
      const age = now - entry.timestamp;
      if (age >= entry.ttl) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.cache.delete(key));
    return keysToDelete.length;
  }
}

// ============================================================================
// Export Singleton Instance
// ============================================================================

export const predictionCache = new PredictionCache();

// Run cleanup every minute
if (typeof window !== 'undefined') {
  setInterval(() => {
    predictionCache.cleanup();
  }, 60 * 1000);
}
