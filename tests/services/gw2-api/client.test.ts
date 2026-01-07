/**
 * @fileoverview Unit tests for the GW2 API client.
 *
 * These tests verify the API client's behavior including fetching, caching,
 * batching, and error handling. External API calls are mocked to ensure
 * tests are fast and deterministic.
 *
 * @module tests/services/gw2-api/client.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GW2ApiClient } from "../../../server/services/gw2-api/client";
import type { CacheAdapter } from "../../../server/services/gw2-api/cache";
import type { GW2Item, GW2Recipe, GW2Price } from "../../../server/services/gw2-api/types";

/**
 * Mock cache adapter for testing.
 */
class MockCache implements CacheAdapter {
  private store = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | null> {
    return (this.store.get(key) as T) ?? null;
  }

  async set<T>(key: string, data: T): Promise<void> {
    this.store.set(key, data);
  }

  async has(key: string): Promise<boolean> {
    return this.store.has(key);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  // Test helper
  getStore(): Map<string, unknown> {
    return this.store;
  }
}

/**
 * Creates a mock fetch response.
 */
function mockFetchResponse<T>(data: T, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: async () => data,
  } as Response;
}

describe("GW2ApiClient", () => {
  let client: GW2ApiClient;
  let mockCache: MockCache;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockCache = new MockCache();
    client = new GW2ApiClient({ cache: mockCache });

    // Mock global fetch
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getAllItemIds", () => {
    it("should fetch all item IDs from the API", async () => {
      const mockIds = [1, 2, 3, 4, 5];
      fetchSpy.mockResolvedValueOnce(mockFetchResponse(mockIds));

      const ids = await client.getAllItemIds();

      expect(ids).toEqual(mockIds);
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.guildwars2.com/v2/items",
        expect.any(Object)
      );
    });

    it("should use cached IDs when available", async () => {
      const mockIds = [1, 2, 3];
      await mockCache.set("ids/items", mockIds);

      const ids = await client.getAllItemIds();

      expect(ids).toEqual(mockIds);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("should cache fetched IDs", async () => {
      const mockIds = [100, 200, 300];
      fetchSpy.mockResolvedValueOnce(mockFetchResponse(mockIds));

      await client.getAllItemIds();

      expect(await mockCache.get("ids/items")).toEqual(mockIds);
    });
  });

  describe("getItem", () => {
    const mockItem: GW2Item = {
      id: 12345,
      name: "Test Item",
      type: "Weapon",
      rarity: "Exotic",
      level: 80,
      vendor_value: 100,
      chat_link: "[&AgEAAAB]",
      flags: [],
      game_types: ["Pve"],
      restrictions: [],
    };

    it("should fetch a single item by ID", async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse(mockItem));

      const item = await client.getItem(12345);

      expect(item).toEqual(mockItem);
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.guildwars2.com/v2/items/12345",
        expect.any(Object)
      );
    });

    it("should use cached item when available", async () => {
      await mockCache.set("items/12345", mockItem);

      const item = await client.getItem(12345);

      expect(item).toEqual(mockItem);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("should return null for non-existent items", async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse({ text: "not found" }, 404));

      const item = await client.getItem(99999);

      expect(item).toBeNull();
    });
  });

  describe("getItems (batch)", () => {
    const mockItems: GW2Item[] = [
      {
        id: 1,
        name: "Item 1",
        type: "Weapon",
        rarity: "Rare",
        level: 50,
        vendor_value: 50,
        chat_link: "[&AgEBAAB]",
        flags: [],
        game_types: ["Pve"],
        restrictions: [],
      },
      {
        id: 2,
        name: "Item 2",
        type: "Armor",
        rarity: "Exotic",
        level: 80,
        vendor_value: 100,
        chat_link: "[&AgECAAB]",
        flags: [],
        game_types: ["Pve"],
        restrictions: [],
      },
    ];

    it("should fetch multiple items by ID array", async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse(mockItems));

      const items = await client.getItems([1, 2]);

      expect(items).toHaveLength(2);
      expect(items).toEqual(mockItems);
    });

    it("should return empty array for empty ID list", async () => {
      const items = await client.getItems([]);

      expect(items).toEqual([]);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("should use cached items and only fetch uncached ones", async () => {
      // Cache one item
      await mockCache.set("items/1", mockItems[0]);

      // Mock API to return only item 2
      fetchSpy.mockResolvedValueOnce(mockFetchResponse([mockItems[1]]));

      const items = await client.getItems([1, 2]);

      expect(items).toHaveLength(2);
      // Verify only item 2 was fetched
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.guildwars2.com/v2/items?ids=2",
        expect.any(Object)
      );
    });

    it("should cache newly fetched items", async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse(mockItems));

      await client.getItems([1, 2]);

      expect(await mockCache.get("items/1")).toEqual(mockItems[0]);
      expect(await mockCache.get("items/2")).toEqual(mockItems[1]);
    });
  });

  describe("getItemsBatch (large batch with progress)", () => {
    it("should batch requests in chunks of 200", async () => {
      // Create array of 450 IDs
      const ids = Array.from({ length: 450 }, (_, i) => i + 1);

      // Mock responses for 3 batches (200 + 200 + 50)
      const batch1 = ids.slice(0, 200).map((id) => ({ id, name: `Item ${id}` }));
      const batch2 = ids.slice(200, 400).map((id) => ({ id, name: `Item ${id}` }));
      const batch3 = ids.slice(400, 450).map((id) => ({ id, name: `Item ${id}` }));

      fetchSpy
        .mockResolvedValueOnce(mockFetchResponse(batch1))
        .mockResolvedValueOnce(mockFetchResponse(batch2))
        .mockResolvedValueOnce(mockFetchResponse(batch3));

      const result = await client.getItemsBatch(ids);

      expect(result.items).toHaveLength(450);
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });

    it("should report progress during batch fetching", async () => {
      const ids = [1, 2, 3];
      const mockItems = ids.map((id) => ({ id, name: `Item ${id}` }));
      fetchSpy.mockResolvedValueOnce(mockFetchResponse(mockItems));

      const progressUpdates: Array<{ current: number; total: number }> = [];

      await client.getItemsBatch(ids, (progress) => {
        progressUpdates.push({ ...progress });
      });

      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[progressUpdates.length - 1].current).toBe(ids.length);
    });

    it("should track failed IDs", async () => {
      const ids = [1, 2, 3];
      // Return only items 1 and 2 (item 3 "failed")
      const mockItems = [
        { id: 1, name: "Item 1" },
        { id: 2, name: "Item 2" },
      ];
      fetchSpy.mockResolvedValueOnce(mockFetchResponse(mockItems));

      const result = await client.getItemsBatch(ids);

      expect(result.items).toHaveLength(2);
      expect(result.failedIds).toContain(3);
    });
  });

  describe("recipes", () => {
    const mockRecipe: GW2Recipe = {
      id: 1000,
      type: "Refinement",
      output_item_id: 12345,
      output_item_count: 1,
      time_to_craft_ms: 1000,
      disciplines: ["Armorsmith"],
      min_rating: 400,
      flags: [],
      ingredients: [{ item_id: 100, count: 5 }],
      chat_link: "[&CAAABQA=]",
    };

    it("should fetch all recipe IDs", async () => {
      const mockIds = [1000, 1001, 1002];
      fetchSpy.mockResolvedValueOnce(mockFetchResponse(mockIds));

      const ids = await client.getAllRecipeIds();

      expect(ids).toEqual(mockIds);
    });

    it("should fetch a single recipe by ID", async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse(mockRecipe));

      const recipe = await client.getRecipe(1000);

      expect(recipe).toEqual(mockRecipe);
    });

    it("should fetch recipes by output item ID", async () => {
      const mockIds = [1000, 1001];
      fetchSpy.mockResolvedValueOnce(mockFetchResponse(mockIds));

      const ids = await client.getRecipesByOutputItem(12345);

      expect(ids).toEqual(mockIds);
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.guildwars2.com/v2/recipes/search?output=12345",
        expect.any(Object)
      );
    });
  });

  describe("prices", () => {
    const mockPrice: GW2Price = {
      id: 12345,
      whitelisted: true,
      buys: { quantity: 1000, unit_price: 500 },
      sells: { quantity: 500, unit_price: 600 },
    };

    it("should fetch all tradable item IDs", async () => {
      const mockIds = [1, 2, 3];
      fetchSpy.mockResolvedValueOnce(mockFetchResponse(mockIds));

      const ids = await client.getAllPriceIds();

      expect(ids).toEqual(mockIds);
    });

    it("should fetch price for a single item", async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse(mockPrice));

      const price = await client.getPrice(12345);

      expect(price).toEqual(mockPrice);
    });

    it("should return null for non-tradable items", async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse({ text: "no such id" }, 404));

      const price = await client.getPrice(99999);

      expect(price).toBeNull();
    });
  });

  describe("rate limiting", () => {
    it("should retry with exponential backoff on 429", async () => {
      const mockIds = [1, 2, 3];

      // First call returns 429, second succeeds
      fetchSpy
        .mockResolvedValueOnce(mockFetchResponse({ text: "rate limited" }, 429))
        .mockResolvedValueOnce(mockFetchResponse(mockIds));

      // Use fake timers to speed up the test
      vi.useFakeTimers();

      const promise = client.getAllItemIds();

      // Advance past backoff delay
      await vi.advanceTimersByTimeAsync(2000);

      const ids = await promise;

      expect(ids).toEqual(mockIds);
      expect(fetchSpy).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it("should fail after max retries on persistent 429", async () => {
      // All calls return 429
      fetchSpy.mockResolvedValue(mockFetchResponse({ text: "rate limited" }, 429));

      vi.useFakeTimers();

      // Immediately attach catch handler to prevent unhandled rejection
      let caughtError: Error | null = null;
      const promise = client.getAllItemIds().catch((error) => {
        caughtError = error;
      });

      // Advance through all retries
      for (let i = 0; i < 6; i++) {
        await vi.advanceTimersByTimeAsync(60000);
        await vi.runAllTimersAsync();
      }

      // Wait for the promise to settle
      await promise;

      expect(caughtError).not.toBeNull();
      expect(caughtError!.message).toMatch(/Rate limited after/);

      vi.useRealTimers();
    });
  });

  describe("authorization", () => {
    it("should include Authorization header when API key is set", async () => {
      const clientWithKey = new GW2ApiClient({
        cache: mockCache,
        apiKey: "test-api-key",
      });

      fetchSpy.mockResolvedValueOnce(mockFetchResponse([1, 2, 3]));

      await clientWithKey.getAllItemIds();

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-api-key",
          }),
        })
      );
    });

    it("should not include Authorization header when no API key", async () => {
      const clientNoKey = new GW2ApiClient({ cache: mockCache });

      fetchSpy.mockResolvedValueOnce(mockFetchResponse([1, 2, 3]));

      await clientNoKey.getAllItemIds();

      const callHeaders = (fetchSpy.mock.calls[0][1] as RequestInit).headers as Record<
        string,
        string
      >;
      expect(callHeaders.Authorization).toBeUndefined();
    });
  });

  describe("clearCache", () => {
    it("should clear all cached data", async () => {
      // Add some cached data
      await mockCache.set("items/1", { id: 1 });
      await mockCache.set("recipes/1", { id: 1 });

      await client.clearCache();

      expect(mockCache.getStore().size).toBe(0);
    });
  });
});

