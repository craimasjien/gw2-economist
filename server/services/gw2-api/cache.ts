/**
 * @fileoverview File-based cache adapter for GW2 API responses.
 *
 * This module provides a caching layer that stores API responses as JSON files
 * on the local filesystem. It supports TTL-based cache invalidation and can be
 * toggled on/off via the USE_FILE_CACHE environment variable.
 *
 * Cache files are organized by endpoint type and stored in the CACHE_DIR directory
 * (defaults to ./cache). Each cached response includes metadata for TTL tracking.
 *
 * @module server/services/gw2-api/cache
 *
 * @example
 * ```typescript
 * import { FileCache } from './cache';
 *
 * const cache = new FileCache();
 *
 * // Store data
 * await cache.set('items/12345', itemData, 3600000); // 1 hour TTL
 *
 * // Retrieve data
 * const item = await cache.get<GW2Item>('items/12345');
 *
 * // Check existence
 * const exists = await cache.has('items/12345');
 * ```
 */

import { promises as fs } from "fs";
import path from "path";

/**
 * Interface for cache adapter implementations.
 *
 * @interface CacheAdapter
 */
export interface CacheAdapter {
  /**
   * Retrieves a cached value by key.
   *
   * @template T - The expected type of the cached data
   * @param key - Cache key (e.g., "items/12345")
   * @returns The cached data or null if not found/expired
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Stores a value in the cache.
   *
   * @template T - The type of data being cached
   * @param key - Cache key (e.g., "items/12345")
   * @param data - The data to cache
   * @param ttl - Time-to-live in milliseconds (optional)
   */
  set<T>(key: string, data: T, ttl?: number): Promise<void>;

  /**
   * Checks if a valid cache entry exists for the key.
   *
   * @param key - Cache key to check
   * @returns True if a valid (non-expired) cache entry exists
   */
  has(key: string): Promise<boolean>;

  /**
   * Deletes a cache entry.
   *
   * @param key - Cache key to delete
   */
  delete(key: string): Promise<void>;

  /**
   * Clears all cache entries.
   */
  clear(): Promise<void>;
}

/**
 * Metadata wrapper for cached data with TTL support.
 *
 * @interface CacheEntry
 * @template T - Type of the cached data
 */
interface CacheEntry<T> {
  /**
   * The cached data payload.
   */
  data: T;

  /**
   * Timestamp when the cache entry was created.
   */
  createdAt: number;

  /**
   * Timestamp when the cache entry expires (null = never).
   */
  expiresAt: number | null;
}

/**
 * Default cache TTL in milliseconds (24 hours).
 * Used when no TTL is specified.
 */
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * File-based cache implementation using JSON files.
 *
 * @class FileCache
 * @implements {CacheAdapter}
 *
 * @remarks
 * - Files are stored as `{cacheDir}/{key}.json`
 * - Nested keys (e.g., "items/12345") create nested directories
 * - Cache entries include TTL metadata for expiration
 * - Thread-safe for single-process use
 *
 * @example
 * ```typescript
 * const cache = new FileCache('./cache');
 *
 * // Cache item data for 1 hour
 * await cache.set('items/12345', itemData, 3600000);
 *
 * // Retrieve cached data
 * const item = await cache.get<GW2Item>('items/12345');
 * if (item) {
 *   console.log(item.name);
 * }
 * ```
 */
export class FileCache implements CacheAdapter {
  /**
   * Base directory for cache files.
   */
  private readonly cacheDir: string;

  /**
   * Whether caching is enabled.
   */
  private readonly enabled: boolean;

  /**
   * Creates a new FileCache instance.
   *
   * @param cacheDir - Directory to store cache files (defaults to CACHE_DIR env or ./cache)
   */
  constructor(cacheDir?: string) {
    this.cacheDir = cacheDir ?? process.env.CACHE_DIR ?? "./cache";
    this.enabled = process.env.USE_FILE_CACHE !== "false";
  }

  /**
   * Resolves a cache key to a filesystem path.
   *
   * @param key - Cache key
   * @returns Absolute path to the cache file
   */
  private getFilePath(key: string): string {
    // Sanitize key to prevent directory traversal
    const sanitizedKey = key.replace(/\.\./g, "_").replace(/[<>:"|?*]/g, "_");
    return path.join(this.cacheDir, `${sanitizedKey}.json`);
  }

  /**
   * Ensures the directory for a cache file exists.
   *
   * @param filePath - Path to the cache file
   */
  private async ensureDirectory(filePath: string): Promise<void> {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
  }

  /**
   * Retrieves a cached value by key.
   *
   * @template T - The expected type of the cached data
   * @param key - Cache key (e.g., "items/12345")
   * @returns The cached data or null if not found, expired, or caching disabled
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.enabled) {
      return null;
    }

    const filePath = this.getFilePath(key);

    try {
      const content = await fs.readFile(filePath, "utf-8");
      const entry = JSON.parse(content) as CacheEntry<T>;

      // Check if entry has expired
      if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
        // Clean up expired entry
        await this.delete(key);
        return null;
      }

      return entry.data;
    } catch (error) {
      // File doesn't exist or is invalid
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.warn(`Cache read error for key "${key}":`, error);
      }
      return null;
    }
  }

  /**
   * Stores a value in the cache.
   *
   * @template T - The type of data being cached
   * @param key - Cache key (e.g., "items/12345")
   * @param data - The data to cache
   * @param ttl - Time-to-live in milliseconds (defaults to 24 hours)
   */
  async set<T>(key: string, data: T, ttl: number = DEFAULT_TTL_MS): Promise<void> {
    if (!this.enabled) {
      return;
    }

    const filePath = this.getFilePath(key);
    const now = Date.now();

    const entry: CacheEntry<T> = {
      data,
      createdAt: now,
      expiresAt: ttl > 0 ? now + ttl : null,
    };

    try {
      await this.ensureDirectory(filePath);
      await fs.writeFile(filePath, JSON.stringify(entry, null, 2), "utf-8");
    } catch (error) {
      console.error(`Cache write error for key "${key}":`, error);
    }
  }

  /**
   * Checks if a valid (non-expired) cache entry exists.
   *
   * @param key - Cache key to check
   * @returns True if a valid cache entry exists
   */
  async has(key: string): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    const data = await this.get(key);
    return data !== null;
  }

  /**
   * Deletes a cache entry.
   *
   * @param key - Cache key to delete
   */
  async delete(key: string): Promise<void> {
    const filePath = this.getFilePath(key);

    try {
      await fs.unlink(filePath);
    } catch (error) {
      // Ignore if file doesn't exist
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.error(`Cache delete error for key "${key}":`, error);
      }
    }
  }

  /**
   * Clears all cache entries by removing the cache directory.
   *
   * @remarks
   * This is a destructive operation that removes all cached files.
   */
  async clear(): Promise<void> {
    try {
      await fs.rm(this.cacheDir, { recursive: true, force: true });
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (error) {
      console.error("Cache clear error:", error);
    }
  }

  /**
   * Stores multiple items in the cache efficiently.
   *
   * @template T - The type of data being cached
   * @param entries - Array of [key, data] tuples to cache
   * @param ttl - Time-to-live in milliseconds (applies to all entries)
   */
  async setMany<T>(
    entries: Array<[string, T]>,
    ttl: number = DEFAULT_TTL_MS
  ): Promise<void> {
    if (!this.enabled) {
      return;
    }

    await Promise.all(
      entries.map(([key, data]) => this.set(key, data, ttl))
    );
  }

  /**
   * Retrieves multiple cached values by keys.
   *
   * @template T - The expected type of the cached data
   * @param keys - Array of cache keys
   * @returns Map of key to data (missing/expired entries are omitted)
   */
  async getMany<T>(keys: string[]): Promise<Map<string, T>> {
    if (!this.enabled) {
      return new Map();
    }

    const results = new Map<string, T>();
    
    await Promise.all(
      keys.map(async (key) => {
        const data = await this.get<T>(key);
        if (data !== null) {
          results.set(key, data);
        }
      })
    );

    return results;
  }

  /**
   * Checks if caching is enabled.
   *
   * @returns True if caching is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Gets the cache directory path.
   *
   * @returns The cache directory path
   */
  getCacheDir(): string {
    return this.cacheDir;
  }
}

/**
 * Singleton cache instance for shared use across the application.
 */
export const fileCache = new FileCache();

