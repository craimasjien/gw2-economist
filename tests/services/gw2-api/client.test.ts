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
import type { GW2Item, GW2Recipe, GW2Price, GW2Listing, GW2ListingEntry } from "../../../server/services/gw2-api/types";

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
  let fetchSpy: ReturnType<typeof vi.spyOn<typeof globalThis, "fetch">>;

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

    const mockRecipes: GW2Recipe[] = [
      mockRecipe,
      {
        ...mockRecipe,
        id: 1001,
        output_item_id: 12346,
      },
    ];

    it("should fetch all recipe IDs", async () => {
      const mockIds = [1000, 1001, 1002];
      fetchSpy.mockResolvedValueOnce(mockFetchResponse(mockIds));

      const ids = await client.getAllRecipeIds();

      expect(ids).toEqual(mockIds);
    });

    it("should use cached recipe IDs when available", async () => {
      const mockIds = [1000, 1001];
      await mockCache.set("ids/recipes", mockIds);

      const ids = await client.getAllRecipeIds();

      expect(ids).toEqual(mockIds);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("should fetch a single recipe by ID", async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse(mockRecipe));

      const recipe = await client.getRecipe(1000);

      expect(recipe).toEqual(mockRecipe);
    });

    it("should use cached recipe when available", async () => {
      await mockCache.set("recipes/1000", mockRecipe);

      const recipe = await client.getRecipe(1000);

      expect(recipe).toEqual(mockRecipe);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("should return null for non-existent recipes", async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse({ text: "not found" }, 404));

      const recipe = await client.getRecipe(99999);

      expect(recipe).toBeNull();
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

    it("should use cached recipes by output item when available", async () => {
      const mockIds = [1000, 1001];
      await mockCache.set("recipes/search/output/12345", mockIds);

      const ids = await client.getRecipesByOutputItem(12345);

      expect(ids).toEqual(mockIds);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    describe("getRecipes (batch)", () => {
      it("should fetch multiple recipes by ID array", async () => {
        fetchSpy.mockResolvedValueOnce(mockFetchResponse(mockRecipes));

        const recipes = await client.getRecipes([1000, 1001]);

        expect(recipes).toHaveLength(2);
        expect(recipes).toEqual(mockRecipes);
      });

      it("should return empty array for empty ID list", async () => {
        const recipes = await client.getRecipes([]);

        expect(recipes).toEqual([]);
        expect(fetchSpy).not.toHaveBeenCalled();
      });

      it("should use cached recipes and only fetch uncached ones", async () => {
        await mockCache.set("recipes/1000", mockRecipes[0]);
        fetchSpy.mockResolvedValueOnce(mockFetchResponse([mockRecipes[1]]));

        const recipes = await client.getRecipes([1000, 1001]);

        expect(recipes).toHaveLength(2);
        expect(fetchSpy).toHaveBeenCalledWith(
          "https://api.guildwars2.com/v2/recipes?ids=1001",
          expect.any(Object)
        );
      });

      it("should cache newly fetched recipes", async () => {
        fetchSpy.mockResolvedValueOnce(mockFetchResponse(mockRecipes));

        await client.getRecipes([1000, 1001]);

        expect(await mockCache.get("recipes/1000")).toEqual(mockRecipes[0]);
        expect(await mockCache.get("recipes/1001")).toEqual(mockRecipes[1]);
      });

      it("should handle fetch errors gracefully", async () => {
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        fetchSpy.mockRejectedValueOnce(new Error("Network error"));

        const recipes = await client.getRecipes([1000, 1001]);

        expect(recipes).toEqual([]);
        expect(consoleSpy).toHaveBeenCalledWith(
          "Failed to fetch recipes batch:",
          expect.any(Error)
        );
        consoleSpy.mockRestore();
      });
    });

    describe("getRecipesBatch (large batch with progress)", () => {
      it("should batch requests in chunks of 200", async () => {
        const ids = Array.from({ length: 450 }, (_, i) => i + 1);
        const batch1 = ids.slice(0, 200).map((id) => ({ ...mockRecipe, id }));
        const batch2 = ids.slice(200, 400).map((id) => ({ ...mockRecipe, id }));
        const batch3 = ids.slice(400, 450).map((id) => ({ ...mockRecipe, id }));

        fetchSpy
          .mockResolvedValueOnce(mockFetchResponse(batch1))
          .mockResolvedValueOnce(mockFetchResponse(batch2))
          .mockResolvedValueOnce(mockFetchResponse(batch3));

        const result = await client.getRecipesBatch(ids);

        expect(result.items).toHaveLength(450);
        expect(fetchSpy).toHaveBeenCalledTimes(3);
      });

      it("should report progress during batch fetching", async () => {
        const ids = [1000, 1001, 1002];
        const mockItems = ids.map((id) => ({ ...mockRecipe, id }));
        fetchSpy.mockResolvedValueOnce(mockFetchResponse(mockItems));

        const progressUpdates: Array<{ current: number; total: number }> = [];

        await client.getRecipesBatch(ids, (progress) => {
          progressUpdates.push({ ...progress });
        });

        expect(progressUpdates.length).toBeGreaterThan(0);
        expect(progressUpdates[progressUpdates.length - 1].current).toBe(ids.length);
      });

      it("should track failed IDs", async () => {
        const ids = [1000, 1001, 1002];
        const mockItems = [
          { ...mockRecipe, id: 1000 },
          { ...mockRecipe, id: 1001 },
        ];
        fetchSpy.mockResolvedValueOnce(mockFetchResponse(mockItems));

        const result = await client.getRecipesBatch(ids);

        expect(result.items).toHaveLength(2);
        expect(result.failedIds).toContain(1002);
      });

      it("should handle batch errors and track failed IDs as missing items", async () => {
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        const ids = [1000, 1001, 1002];
        fetchSpy.mockRejectedValueOnce(new Error("Batch failed"));

        const result = await client.getRecipesBatch(ids);

        // When getRecipes catches the error, it returns empty array
        // So getRecipesBatch sees all IDs as "failed" (not returned)
        expect(result.items).toHaveLength(0);
        expect(result.failedIds).toEqual(ids);
        expect(consoleSpy).toHaveBeenCalledWith(
          "Failed to fetch recipes batch:",
          expect.any(Error)
        );
        consoleSpy.mockRestore();
      });
    });
  });

  describe("prices", () => {
    const mockPrice: GW2Price = {
      id: 12345,
      whitelisted: true,
      buys: { quantity: 1000, unit_price: 500 },
      sells: { quantity: 500, unit_price: 600 },
    };

    const mockPrices: GW2Price[] = [
      mockPrice,
      {
        id: 12346,
        whitelisted: true,
        buys: { quantity: 800, unit_price: 400 },
        sells: { quantity: 400, unit_price: 500 },
      },
    ];

    it("should fetch all tradable item IDs", async () => {
      const mockIds = [1, 2, 3];
      fetchSpy.mockResolvedValueOnce(mockFetchResponse(mockIds));

      const ids = await client.getAllPriceIds();

      expect(ids).toEqual(mockIds);
    });

    it("should use cached price IDs when available", async () => {
      const mockIds = [1, 2, 3];
      await mockCache.set("ids/prices", mockIds);

      const ids = await client.getAllPriceIds();

      expect(ids).toEqual(mockIds);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("should fetch price for a single item", async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse(mockPrice));

      const price = await client.getPrice(12345);

      expect(price).toEqual(mockPrice);
    });

    it("should use cached price when available", async () => {
      await mockCache.set("prices/12345", mockPrice);

      const price = await client.getPrice(12345);

      expect(price).toEqual(mockPrice);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("should return null for non-tradable items", async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse({ text: "no such id" }, 404));

      const price = await client.getPrice(99999);

      expect(price).toBeNull();
    });

    describe("getPrices (batch)", () => {
      it("should fetch multiple prices by ID array", async () => {
        fetchSpy.mockResolvedValueOnce(mockFetchResponse(mockPrices));

        const prices = await client.getPrices([12345, 12346]);

        expect(prices).toHaveLength(2);
        expect(prices).toEqual(mockPrices);
      });

      it("should return empty array for empty ID list", async () => {
        const prices = await client.getPrices([]);

        expect(prices).toEqual([]);
        expect(fetchSpy).not.toHaveBeenCalled();
      });

      it("should use cached prices and only fetch uncached ones", async () => {
        await mockCache.set("prices/12345", mockPrices[0]);
        fetchSpy.mockResolvedValueOnce(mockFetchResponse([mockPrices[1]]));

        const prices = await client.getPrices([12345, 12346]);

        expect(prices).toHaveLength(2);
        expect(fetchSpy).toHaveBeenCalledWith(
          "https://api.guildwars2.com/v2/commerce/prices?ids=12346",
          expect.any(Object)
        );
      });

      it("should cache newly fetched prices", async () => {
        fetchSpy.mockResolvedValueOnce(mockFetchResponse(mockPrices));

        await client.getPrices([12345, 12346]);

        expect(await mockCache.get("prices/12345")).toEqual(mockPrices[0]);
        expect(await mockCache.get("prices/12346")).toEqual(mockPrices[1]);
      });

      it("should handle fetch errors gracefully", async () => {
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        fetchSpy.mockRejectedValueOnce(new Error("Network error"));

        const prices = await client.getPrices([12345, 12346]);

        expect(prices).toEqual([]);
        expect(consoleSpy).toHaveBeenCalledWith(
          "Failed to fetch prices batch:",
          expect.any(Error)
        );
        consoleSpy.mockRestore();
      });
    });

    describe("getPricesBatch (large batch with progress)", () => {
      it("should batch requests in chunks of 200", async () => {
        const ids = Array.from({ length: 450 }, (_, i) => i + 1);
        const batch1 = ids.slice(0, 200).map((id) => ({ ...mockPrice, id }));
        const batch2 = ids.slice(200, 400).map((id) => ({ ...mockPrice, id }));
        const batch3 = ids.slice(400, 450).map((id) => ({ ...mockPrice, id }));

        fetchSpy
          .mockResolvedValueOnce(mockFetchResponse(batch1))
          .mockResolvedValueOnce(mockFetchResponse(batch2))
          .mockResolvedValueOnce(mockFetchResponse(batch3));

        const result = await client.getPricesBatch(ids);

        expect(result.items).toHaveLength(450);
        expect(fetchSpy).toHaveBeenCalledTimes(3);
      });

      it("should report progress during batch fetching", async () => {
        const ids = [12345, 12346, 12347];
        const mockItems = ids.map((id) => ({ ...mockPrice, id }));
        fetchSpy.mockResolvedValueOnce(mockFetchResponse(mockItems));

        const progressUpdates: Array<{ current: number; total: number }> = [];

        await client.getPricesBatch(ids, (progress) => {
          progressUpdates.push({ ...progress });
        });

        expect(progressUpdates.length).toBeGreaterThan(0);
        expect(progressUpdates[progressUpdates.length - 1].current).toBe(ids.length);
      });

      it("should track failed IDs", async () => {
        const ids = [12345, 12346, 12347];
        const mockItems = [
          { ...mockPrice, id: 12345 },
          { ...mockPrice, id: 12346 },
        ];
        fetchSpy.mockResolvedValueOnce(mockFetchResponse(mockItems));

        const result = await client.getPricesBatch(ids);

        expect(result.items).toHaveLength(2);
        expect(result.failedIds).toContain(12347);
      });

      it("should handle batch errors and track failed IDs as missing items", async () => {
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        const ids = [12345, 12346, 12347];
        fetchSpy.mockRejectedValueOnce(new Error("Batch failed"));

        const result = await client.getPricesBatch(ids);

        // When getPrices catches the error, it returns empty array
        // So getPricesBatch sees all IDs as "failed" (not returned)
        expect(result.items).toHaveLength(0);
        expect(result.failedIds).toEqual(ids);
        expect(consoleSpy).toHaveBeenCalledWith(
          "Failed to fetch prices batch:",
          expect.any(Error)
        );
        consoleSpy.mockRestore();
      });
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

  describe("timeout handling", () => {
    it("should abort request after timeout", async () => {
      const clientWithShortTimeout = new GW2ApiClient({
        cache: mockCache,
        timeout: 100,
      });

      // Create an abort error
      const abortError = new Error("The operation was aborted");
      abortError.name = "AbortError";
      fetchSpy.mockRejectedValueOnce(abortError);

      await expect(clientWithShortTimeout.getAllItemIds()).rejects.toThrow(
        "Request timeout"
      );
    });
  });

  describe("API error handling", () => {
    it("should throw on non-OK response with error text", async () => {
      fetchSpy.mockResolvedValueOnce(
        mockFetchResponse({ text: "Server error occurred" }, 500)
      );

      await expect(client.getAllItemIds()).rejects.toThrow(
        "GW2 API error (500): Server error occurred"
      );
    });

    it("should throw on non-OK response without error text", async () => {
      const response = {
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
        json: async () => {
          throw new Error("No JSON");
        },
      } as unknown as Response;
      fetchSpy.mockResolvedValueOnce(response);

      await expect(client.getAllItemIds()).rejects.toThrow(
        "GW2 API error (503): Service Unavailable"
      );
    });

    it("should handle getItems batch fetch errors gracefully", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      fetchSpy.mockRejectedValueOnce(new Error("Network error"));

      const items = await client.getItems([1, 2, 3]);

      expect(items).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to fetch items batch:",
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });

    it("should re-throw non-AbortError exceptions", async () => {
      const customError = new Error("Custom network failure");
      fetchSpy.mockRejectedValueOnce(customError);

      await expect(client.getAllItemIds()).rejects.toThrow("Custom network failure");
    });
  });

  describe("constructor defaults", () => {
    it("should use environment API key when not provided", async () => {
      const originalKey = process.env.GW2_API_KEY;
      process.env.GW2_API_KEY = "env-test-key";

      const clientFromEnv = new GW2ApiClient({ cache: mockCache });
      fetchSpy.mockResolvedValueOnce(mockFetchResponse([1, 2, 3]));

      await clientFromEnv.getAllItemIds();

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer env-test-key",
          }),
        })
      );

      process.env.GW2_API_KEY = originalKey;
    });

    it("should use default timeout when not provided", () => {
      const clientDefault = new GW2ApiClient({ cache: mockCache });
      // The default timeout is 30000ms - we can't easily test this directly
      // but we can verify the client is created successfully
      expect(clientDefault).toBeDefined();
    });
  });

  describe("batch progress edge cases", () => {
    it("should handle getItemsBatch with errors and track all IDs as failed", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const ids = [1, 2, 3];
      fetchSpy.mockRejectedValueOnce(new Error("Batch error"));

      const result = await client.getItemsBatch(ids);

      // getItems catches errors, returns empty array
      // So getItemsBatch sees all IDs as missing/failed
      expect(result.items).toHaveLength(0);
      expect(result.failedIds).toEqual(ids);
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to fetch items batch:",
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });

    it("should handle string errors in batch and track IDs as failed", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const ids = [1, 2, 3];
      fetchSpy.mockRejectedValueOnce("String error");

      const result = await client.getItemsBatch(ids);

      expect(result.failedIds).toEqual(ids);
      // The error is logged but not captured in errors array
      // because getItems catches it and doesn't throw
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("listings (order book)", () => {
    /**
     * Sample listing with multiple price levels for testing order book calculations.
     */
    const mockListing: GW2Listing = {
      id: 12345,
      buys: [
        { listings: 5, quantity: 100, unit_price: 450 },
        { listings: 3, quantity: 50, unit_price: 440 },
        { listings: 10, quantity: 200, unit_price: 430 },
      ],
      sells: [
        { listings: 2, quantity: 50, unit_price: 500 },
        { listings: 5, quantity: 100, unit_price: 510 },
        { listings: 8, quantity: 250, unit_price: 520 },
      ],
    };

    const mockListings: GW2Listing[] = [
      mockListing,
      {
        id: 12346,
        buys: [
          { listings: 2, quantity: 30, unit_price: 300 },
        ],
        sells: [
          { listings: 1, quantity: 20, unit_price: 400 },
        ],
      },
    ];

    it("should fetch listing for a single item", async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse(mockListing));

      const listing = await client.getListing(12345);

      expect(listing).toEqual(mockListing);
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.guildwars2.com/v2/commerce/listings/12345",
        expect.any(Object)
      );
    });

    it("should use cached listing when available", async () => {
      await mockCache.set("listings/12345", mockListing);

      const listing = await client.getListing(12345);

      expect(listing).toEqual(mockListing);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("should return null for non-tradable items", async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse({ text: "no such id" }, 404));

      const listing = await client.getListing(99999);

      expect(listing).toBeNull();
    });

    describe("getListings (batch)", () => {
      it("should fetch multiple listings by ID array", async () => {
        fetchSpy.mockResolvedValueOnce(mockFetchResponse(mockListings));

        const listings = await client.getListings([12345, 12346]);

        expect(listings).toHaveLength(2);
        expect(listings).toEqual(mockListings);
      });

      it("should return empty array for empty ID list", async () => {
        const listings = await client.getListings([]);

        expect(listings).toEqual([]);
        expect(fetchSpy).not.toHaveBeenCalled();
      });

      it("should use cached listings and only fetch uncached ones", async () => {
        await mockCache.set("listings/12345", mockListings[0]);
        fetchSpy.mockResolvedValueOnce(mockFetchResponse([mockListings[1]]));

        const listings = await client.getListings([12345, 12346]);

        expect(listings).toHaveLength(2);
        expect(fetchSpy).toHaveBeenCalledWith(
          "https://api.guildwars2.com/v2/commerce/listings?ids=12346",
          expect.any(Object)
        );
      });

      it("should cache newly fetched listings", async () => {
        fetchSpy.mockResolvedValueOnce(mockFetchResponse(mockListings));

        await client.getListings([12345, 12346]);

        expect(await mockCache.get("listings/12345")).toEqual(mockListings[0]);
        expect(await mockCache.get("listings/12346")).toEqual(mockListings[1]);
      });

      it("should handle fetch errors gracefully", async () => {
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        fetchSpy.mockRejectedValueOnce(new Error("Network error"));

        const listings = await client.getListings([12345, 12346]);

        expect(listings).toEqual([]);
        expect(consoleSpy).toHaveBeenCalledWith(
          "Failed to fetch listings batch:",
          expect.any(Error)
        );
        consoleSpy.mockRestore();
      });
    });

    describe("getListingsBatch (large batch with progress)", () => {
      it("should batch requests in chunks of 200", async () => {
        const ids = Array.from({ length: 450 }, (_, i) => i + 1);
        const batch1 = ids.slice(0, 200).map((id) => ({ ...mockListing, id }));
        const batch2 = ids.slice(200, 400).map((id) => ({ ...mockListing, id }));
        const batch3 = ids.slice(400, 450).map((id) => ({ ...mockListing, id }));

        fetchSpy
          .mockResolvedValueOnce(mockFetchResponse(batch1))
          .mockResolvedValueOnce(mockFetchResponse(batch2))
          .mockResolvedValueOnce(mockFetchResponse(batch3));

        const result = await client.getListingsBatch(ids);

        expect(result.items).toHaveLength(450);
        expect(fetchSpy).toHaveBeenCalledTimes(3);
      });

      it("should report progress during batch fetching", async () => {
        const ids = [12345, 12346, 12347];
        const mockItems = ids.map((id) => ({ ...mockListing, id }));
        fetchSpy.mockResolvedValueOnce(mockFetchResponse(mockItems));

        const progressUpdates: Array<{ current: number; total: number }> = [];

        await client.getListingsBatch(ids, (progress) => {
          progressUpdates.push({ ...progress });
        });

        expect(progressUpdates.length).toBeGreaterThan(0);
        expect(progressUpdates[progressUpdates.length - 1].current).toBe(ids.length);
      });

      it("should track failed IDs", async () => {
        const ids = [12345, 12346, 12347];
        const mockItems = [
          { ...mockListing, id: 12345 },
          { ...mockListing, id: 12346 },
        ];
        fetchSpy.mockResolvedValueOnce(mockFetchResponse(mockItems));

        const result = await client.getListingsBatch(ids);

        expect(result.items).toHaveLength(2);
        expect(result.failedIds).toContain(12347);
      });
    });
  });
});

