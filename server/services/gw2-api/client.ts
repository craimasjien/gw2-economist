/**
 * @fileoverview GW2 API client with file caching and rate limiting.
 *
 * This module provides a client for interacting with the Guild Wars 2 API v2.
 * It includes automatic file-based caching, exponential backoff for rate limiting,
 * and batch request support for efficient data fetching.
 *
 * @module server/services/gw2-api/client
 *
 * @see https://wiki.guildwars2.com/wiki/API:Main
 *
 * @example
 * ```typescript
 * import { GW2ApiClient } from './client';
 *
 * const client = new GW2ApiClient();
 *
 * // Fetch a single item
 * const item = await client.getItem(12345);
 *
 * // Batch fetch multiple items
 * const items = await client.getItems([12345, 12346, 12347]);
 *
 * // Fetch all item IDs
 * const allIds = await client.getAllItemIds();
 * ```
 */

import { FileCache, type CacheAdapter } from "./cache";
import type {
  GW2Item,
  GW2Recipe,
  GW2Price,
  GW2BatchResult,
  GW2ApiError,
} from "./types";

/**
 * Base URL for the GW2 API v2.
 */
const GW2_API_BASE = "https://api.guildwars2.com/v2";

/**
 * Maximum number of IDs per batch request (API limit).
 */
const BATCH_SIZE = 200;

/**
 * Default TTL for cached items in milliseconds (24 hours).
 */
const ITEM_CACHE_TTL = 24 * 60 * 60 * 1000;

/**
 * Default TTL for cached recipes in milliseconds (24 hours).
 */
const RECIPE_CACHE_TTL = 24 * 60 * 60 * 1000;

/**
 * Default TTL for cached prices in milliseconds (1 hour).
 * Prices change more frequently than item/recipe data.
 */
const PRICE_CACHE_TTL = 60 * 60 * 1000;

/**
 * Initial delay for exponential backoff in milliseconds.
 */
const INITIAL_BACKOFF_MS = 1000;

/**
 * Maximum number of retry attempts for rate-limited requests.
 */
const MAX_RETRIES = 5;

/**
 * Configuration options for the GW2 API client.
 *
 * @interface GW2ApiClientOptions
 */
export interface GW2ApiClientOptions {
  /**
   * GW2 API access token (optional, required for authenticated endpoints).
   */
  apiKey?: string;

  /**
   * Custom cache adapter (defaults to FileCache).
   */
  cache?: CacheAdapter;

  /**
   * Request timeout in milliseconds.
   */
  timeout?: number;
}

/**
 * Client for interacting with the Guild Wars 2 API v2.
 *
 * @class GW2ApiClient
 *
 * @remarks
 * Features:
 * - Automatic file-based caching with configurable TTL
 * - Batch requests for efficient bulk data fetching
 * - Exponential backoff for rate limit handling
 * - Support for authenticated and public endpoints
 *
 * @example
 * ```typescript
 * const client = new GW2ApiClient({ apiKey: process.env.GW2_API_KEY });
 *
 * // Fetch items in batches
 * const itemIds = await client.getAllItemIds();
 * const { items, failedIds } = await client.getItemsBatch(itemIds);
 *
 * console.log(`Fetched ${items.length} items, ${failedIds.length} failed`);
 * ```
 */
export class GW2ApiClient {
  /**
   * API access token for authenticated requests.
   */
  private readonly apiKey?: string;

  /**
   * Cache adapter for storing responses.
   */
  private readonly cache: CacheAdapter;

  /**
   * Request timeout in milliseconds.
   */
  private readonly timeout: number;

  /**
   * Creates a new GW2ApiClient instance.
   *
   * @param options - Configuration options
   */
  constructor(options: GW2ApiClientOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.GW2_API_KEY;
    this.cache = options.cache ?? new FileCache();
    this.timeout = options.timeout ?? 30000;
  }

  /**
   * Builds request headers including authorization if API key is set.
   *
   * @returns Headers object for fetch requests
   */
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      Accept: "application/json",
    };

    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    return headers;
  }

  /**
   * Makes a fetch request with timeout support.
   *
   * @param url - URL to fetch
   * @returns Fetch response
   */
  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        headers: this.getHeaders(),
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Makes an API request with exponential backoff for rate limiting.
   *
   * @template T - Expected response type
   * @param url - API endpoint URL
   * @param retryCount - Current retry attempt (internal)
   * @returns Parsed JSON response
   * @throws {Error} If request fails after max retries
   */
  private async fetchWithRetry<T>(url: string, retryCount = 0): Promise<T> {
    try {
      const response = await this.fetchWithTimeout(url);

      // Handle rate limiting (429) with exponential backoff
      if (response.status === 429) {
        if (retryCount >= MAX_RETRIES) {
          throw new Error(`Rate limited after ${MAX_RETRIES} retries: ${url}`);
        }

        const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, retryCount);
        console.warn(
          `Rate limited, retrying in ${backoffMs}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`
        );

        await this.sleep(backoffMs);
        return this.fetchWithRetry<T>(url, retryCount + 1);
      }

      // Handle other errors
      if (!response.ok) {
        const error = (await response.json().catch(() => ({}))) as GW2ApiError;
        throw new Error(
          `GW2 API error (${response.status}): ${error.text ?? response.statusText}`
        );
      }

      return response.json() as Promise<T>;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Request timeout: ${url}`);
      }
      throw error;
    }
  }

  /**
   * Sleeps for the specified duration.
   *
   * @param ms - Duration in milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Fetches all item IDs from the API.
   *
   * @returns Array of all item IDs
   *
   * @example
   * ```typescript
   * const itemIds = await client.getAllItemIds();
   * console.log(`Found ${itemIds.length} items`);
   * ```
   */
  async getAllItemIds(): Promise<number[]> {
    const cacheKey = "ids/items";
    const cached = await this.cache.get<number[]>(cacheKey);

    if (cached) {
      return cached;
    }

    const ids = await this.fetchWithRetry<number[]>(`${GW2_API_BASE}/items`);
    await this.cache.set(cacheKey, ids, ITEM_CACHE_TTL);

    return ids;
  }

  /**
   * Fetches a single item by ID.
   *
   * @param id - Item ID
   * @returns Item data or null if not found
   *
   * @example
   * ```typescript
   * const item = await client.getItem(12345);
   * if (item) {
   *   console.log(item.name, item.rarity);
   * }
   * ```
   */
  async getItem(id: number): Promise<GW2Item | null> {
    const cacheKey = `items/${id}`;
    const cached = await this.cache.get<GW2Item>(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      const item = await this.fetchWithRetry<GW2Item>(
        `${GW2_API_BASE}/items/${id}`
      );
      await this.cache.set(cacheKey, item, ITEM_CACHE_TTL);
      return item;
    } catch {
      return null;
    }
  }

  /**
   * Fetches multiple items by ID (batch request).
   *
   * @param ids - Array of item IDs (max 200)
   * @returns Array of item data
   *
   * @remarks
   * The GW2 API supports fetching up to 200 items per request.
   * For larger batches, use `getItemsBatch`.
   */
  async getItems(ids: number[]): Promise<GW2Item[]> {
    if (ids.length === 0) {
      return [];
    }

    // Check cache first
    const uncachedIds: number[] = [];
    const cachedItems: GW2Item[] = [];

    for (const id of ids) {
      const cached = await this.cache.get<GW2Item>(`items/${id}`);
      if (cached) {
        cachedItems.push(cached);
      } else {
        uncachedIds.push(id);
      }
    }

    // Fetch uncached items
    if (uncachedIds.length > 0) {
      const url = `${GW2_API_BASE}/items?ids=${uncachedIds.join(",")}`;
      try {
        const items = await this.fetchWithRetry<GW2Item[]>(url);

        // Cache fetched items
        for (const item of items) {
          await this.cache.set(`items/${item.id}`, item, ITEM_CACHE_TTL);
        }

        cachedItems.push(...items);
      } catch (error) {
        console.error("Failed to fetch items batch:", error);
      }
    }

    return cachedItems;
  }

  /**
   * Fetches all items in batches with progress tracking.
   *
   * @param ids - Array of all item IDs to fetch
   * @param onProgress - Optional progress callback
   * @returns Batch result with items and any failed IDs
   *
   * @example
   * ```typescript
   * const allIds = await client.getAllItemIds();
   * const result = await client.getItemsBatch(allIds, (progress) => {
   *   console.log(`${progress.current}/${progress.total} items fetched`);
   * });
   *
   * console.log(`Fetched ${result.items.length} items`);
   * ```
   */
  async getItemsBatch(
    ids: number[],
    onProgress?: (progress: { current: number; total: number }) => void
  ): Promise<GW2BatchResult<GW2Item>> {
    const items: GW2Item[] = [];
    const failedIds: number[] = [];
    const errors: string[] = [];
    const total = ids.length;

    // Split into batches of BATCH_SIZE
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batchIds = ids.slice(i, i + BATCH_SIZE);

      try {
        const batchItems = await this.getItems(batchIds);
        items.push(...batchItems);

        // Track any IDs that didn't return
        const returnedIds = new Set(batchItems.map((item) => item.id));
        for (const id of batchIds) {
          if (!returnedIds.has(id)) {
            failedIds.push(id);
          }
        }
      } catch (error) {
        failedIds.push(...batchIds);
        errors.push(
          error instanceof Error ? error.message : "Unknown error"
        );
      }

      // Report progress
      if (onProgress) {
        onProgress({ current: Math.min(i + BATCH_SIZE, total), total });
      }

      // Small delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < ids.length) {
        await this.sleep(100);
      }
    }

    return { items, failedIds, errors };
  }

  /**
   * Fetches all recipe IDs from the API.
   *
   * @returns Array of all recipe IDs
   */
  async getAllRecipeIds(): Promise<number[]> {
    const cacheKey = "ids/recipes";
    const cached = await this.cache.get<number[]>(cacheKey);

    if (cached) {
      return cached;
    }

    const ids = await this.fetchWithRetry<number[]>(`${GW2_API_BASE}/recipes`);
    await this.cache.set(cacheKey, ids, RECIPE_CACHE_TTL);

    return ids;
  }

  /**
   * Fetches a single recipe by ID.
   *
   * @param id - Recipe ID
   * @returns Recipe data or null if not found
   */
  async getRecipe(id: number): Promise<GW2Recipe | null> {
    const cacheKey = `recipes/${id}`;
    const cached = await this.cache.get<GW2Recipe>(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      const recipe = await this.fetchWithRetry<GW2Recipe>(
        `${GW2_API_BASE}/recipes/${id}`
      );
      await this.cache.set(cacheKey, recipe, RECIPE_CACHE_TTL);
      return recipe;
    } catch {
      return null;
    }
  }

  /**
   * Fetches multiple recipes by ID (batch request).
   *
   * @param ids - Array of recipe IDs (max 200)
   * @returns Array of recipe data
   */
  async getRecipes(ids: number[]): Promise<GW2Recipe[]> {
    if (ids.length === 0) {
      return [];
    }

    // Check cache first
    const uncachedIds: number[] = [];
    const cachedRecipes: GW2Recipe[] = [];

    for (const id of ids) {
      const cached = await this.cache.get<GW2Recipe>(`recipes/${id}`);
      if (cached) {
        cachedRecipes.push(cached);
      } else {
        uncachedIds.push(id);
      }
    }

    // Fetch uncached recipes
    if (uncachedIds.length > 0) {
      const url = `${GW2_API_BASE}/recipes?ids=${uncachedIds.join(",")}`;
      try {
        const recipes = await this.fetchWithRetry<GW2Recipe[]>(url);

        // Cache fetched recipes
        for (const recipe of recipes) {
          await this.cache.set(`recipes/${recipe.id}`, recipe, RECIPE_CACHE_TTL);
        }

        cachedRecipes.push(...recipes);
      } catch (error) {
        console.error("Failed to fetch recipes batch:", error);
      }
    }

    return cachedRecipes;
  }

  /**
   * Fetches all recipes in batches with progress tracking.
   *
   * @param ids - Array of all recipe IDs to fetch
   * @param onProgress - Optional progress callback
   * @returns Batch result with recipes and any failed IDs
   */
  async getRecipesBatch(
    ids: number[],
    onProgress?: (progress: { current: number; total: number }) => void
  ): Promise<GW2BatchResult<GW2Recipe>> {
    const items: GW2Recipe[] = [];
    const failedIds: number[] = [];
    const errors: string[] = [];
    const total = ids.length;

    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batchIds = ids.slice(i, i + BATCH_SIZE);

      try {
        const batchItems = await this.getRecipes(batchIds);
        items.push(...batchItems);

        const returnedIds = new Set(batchItems.map((item) => item.id));
        for (const id of batchIds) {
          if (!returnedIds.has(id)) {
            failedIds.push(id);
          }
        }
      } catch (error) {
        failedIds.push(...batchIds);
        errors.push(
          error instanceof Error ? error.message : "Unknown error"
        );
      }

      if (onProgress) {
        onProgress({ current: Math.min(i + BATCH_SIZE, total), total });
      }

      if (i + BATCH_SIZE < ids.length) {
        await this.sleep(100);
      }
    }

    return { items, failedIds, errors };
  }

  /**
   * Fetches recipes that output a specific item.
   *
   * @param itemId - Output item ID
   * @returns Array of recipe IDs that produce this item
   */
  async getRecipesByOutputItem(itemId: number): Promise<number[]> {
    const cacheKey = `recipes/search/output/${itemId}`;
    const cached = await this.cache.get<number[]>(cacheKey);

    if (cached) {
      return cached;
    }

    const ids = await this.fetchWithRetry<number[]>(
      `${GW2_API_BASE}/recipes/search?output=${itemId}`
    );
    await this.cache.set(cacheKey, ids, RECIPE_CACHE_TTL);

    return ids;
  }

  /**
   * Fetches all tradable item IDs from the commerce endpoint.
   *
   * @returns Array of item IDs that can be traded
   */
  async getAllPriceIds(): Promise<number[]> {
    const cacheKey = "ids/prices";
    const cached = await this.cache.get<number[]>(cacheKey);

    if (cached) {
      return cached;
    }

    const ids = await this.fetchWithRetry<number[]>(
      `${GW2_API_BASE}/commerce/prices`
    );
    await this.cache.set(cacheKey, ids, PRICE_CACHE_TTL);

    return ids;
  }

  /**
   * Fetches price data for a single item.
   *
   * @param id - Item ID
   * @returns Price data or null if not tradable
   */
  async getPrice(id: number): Promise<GW2Price | null> {
    const cacheKey = `prices/${id}`;
    const cached = await this.cache.get<GW2Price>(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      const price = await this.fetchWithRetry<GW2Price>(
        `${GW2_API_BASE}/commerce/prices/${id}`
      );
      await this.cache.set(cacheKey, price, PRICE_CACHE_TTL);
      return price;
    } catch {
      return null;
    }
  }

  /**
   * Fetches price data for multiple items (batch request).
   *
   * @param ids - Array of item IDs (max 200)
   * @returns Array of price data
   */
  async getPrices(ids: number[]): Promise<GW2Price[]> {
    if (ids.length === 0) {
      return [];
    }

    // Check cache first
    const uncachedIds: number[] = [];
    const cachedPrices: GW2Price[] = [];

    for (const id of ids) {
      const cached = await this.cache.get<GW2Price>(`prices/${id}`);
      if (cached) {
        cachedPrices.push(cached);
      } else {
        uncachedIds.push(id);
      }
    }

    // Fetch uncached prices
    if (uncachedIds.length > 0) {
      const url = `${GW2_API_BASE}/commerce/prices?ids=${uncachedIds.join(",")}`;
      try {
        const prices = await this.fetchWithRetry<GW2Price[]>(url);

        // Cache fetched prices
        for (const price of prices) {
          await this.cache.set(`prices/${price.id}`, price, PRICE_CACHE_TTL);
        }

        cachedPrices.push(...prices);
      } catch (error) {
        console.error("Failed to fetch prices batch:", error);
      }
    }

    return cachedPrices;
  }

  /**
   * Fetches all prices in batches with progress tracking.
   *
   * @param ids - Array of all item IDs to fetch prices for
   * @param onProgress - Optional progress callback
   * @returns Batch result with prices and any failed IDs
   */
  async getPricesBatch(
    ids: number[],
    onProgress?: (progress: { current: number; total: number }) => void
  ): Promise<GW2BatchResult<GW2Price>> {
    const items: GW2Price[] = [];
    const failedIds: number[] = [];
    const errors: string[] = [];
    const total = ids.length;

    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batchIds = ids.slice(i, i + BATCH_SIZE);

      try {
        const batchItems = await this.getPrices(batchIds);
        items.push(...batchItems);

        const returnedIds = new Set(batchItems.map((item) => item.id));
        for (const id of batchIds) {
          if (!returnedIds.has(id)) {
            failedIds.push(id);
          }
        }
      } catch (error) {
        failedIds.push(...batchIds);
        errors.push(
          error instanceof Error ? error.message : "Unknown error"
        );
      }

      if (onProgress) {
        onProgress({ current: Math.min(i + BATCH_SIZE, total), total });
      }

      if (i + BATCH_SIZE < ids.length) {
        await this.sleep(100);
      }
    }

    return { items, failedIds, errors };
  }

  /**
   * Clears all cached API responses.
   */
  async clearCache(): Promise<void> {
    await this.cache.clear();
  }
}

/**
 * Default GW2 API client instance for shared use.
 */
export const gw2Api = new GW2ApiClient();

