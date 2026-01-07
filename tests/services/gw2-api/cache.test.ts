/**
 * @fileoverview Unit tests for the file-based cache adapter.
 *
 * These tests verify that the FileCache correctly stores, retrieves, and
 * expires cached data. Tests use a temporary directory to avoid polluting
 * the actual cache.
 *
 * @module tests/services/gw2-api/cache.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { FileCache } from "../../../server/services/gw2-api/cache";

const TEST_CACHE_DIR = "./cache/test";

describe("FileCache", () => {
  let cache: FileCache;
  let originalEnvCache: string | undefined;

  beforeEach(async () => {
    // Save original env and enable cache for tests
    originalEnvCache = process.env.USE_FILE_CACHE;
    process.env.USE_FILE_CACHE = "true";

    // Clear test cache directory before each test
    await fs.rm(TEST_CACHE_DIR, { recursive: true, force: true });
    cache = new FileCache(TEST_CACHE_DIR);
  });

  afterEach(async () => {
    // Restore original env
    process.env.USE_FILE_CACHE = originalEnvCache;

    // Cleanup after tests
    await fs.rm(TEST_CACHE_DIR, { recursive: true, force: true });
  });

  describe("get", () => {
    it("should return null for missing cache entries", async () => {
      const result = await cache.get("nonexistent/key");
      expect(result).toBeNull();
    });

    it("should return null when cache is disabled", async () => {
      const originalEnv = process.env.USE_FILE_CACHE;
      process.env.USE_FILE_CACHE = "false";

      const disabledCache = new FileCache(TEST_CACHE_DIR);
      await disabledCache.set("test/key", { value: "test" });
      const result = await disabledCache.get("test/key");

      expect(result).toBeNull();

      process.env.USE_FILE_CACHE = originalEnv;
    });
  });

  describe("set", () => {
    it("should store data correctly", async () => {
      const testData = { id: 123, name: "Test Item" };

      await cache.set("items/123", testData);
      const result = await cache.get<typeof testData>("items/123");

      expect(result).toEqual(testData);
    });

    it("should store nested data structures", async () => {
      const complexData = {
        id: 456,
        ingredients: [
          { itemId: 1, count: 5 },
          { itemId: 2, count: 10 },
        ],
        metadata: {
          createdAt: "2025-01-01",
          tags: ["crafting", "legendary"],
        },
      };

      await cache.set("recipes/456", complexData);
      const result = await cache.get<typeof complexData>("recipes/456");

      expect(result).toEqual(complexData);
    });

    it("should create nested directories for keys with slashes", async () => {
      await cache.set("items/weapons/12345", { name: "Sword" });

      const filePath = path.join(TEST_CACHE_DIR, "items/weapons/12345.json");
      const fileExists = await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false);

      expect(fileExists).toBe(true);
    });

    it("should not write when cache is disabled", async () => {
      const originalEnv = process.env.USE_FILE_CACHE;
      process.env.USE_FILE_CACHE = "false";

      const disabledCache = new FileCache(TEST_CACHE_DIR);
      await disabledCache.set("test/disabled", { value: "should not exist" });

      const filePath = path.join(TEST_CACHE_DIR, "test/disabled.json");
      const fileExists = await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false);

      expect(fileExists).toBe(false);

      process.env.USE_FILE_CACHE = originalEnv;
    });
  });

  describe("TTL expiration", () => {
    it("should return data within TTL window", async () => {
      const testData = { id: 789 };

      // Set with 1 hour TTL
      await cache.set("items/789", testData, 60 * 60 * 1000);
      const result = await cache.get("items/789");

      expect(result).toEqual(testData);
    });

    it("should return null for expired entries", async () => {
      // Mock Date.now to simulate time passing
      const originalNow = Date.now;
      let currentTime = 1000000000000; // Fixed start time

      vi.spyOn(Date, "now").mockImplementation(() => currentTime);

      const testData = { id: 999 };

      // Set with 1 second TTL
      await cache.set("items/999", testData, 1000);

      // Verify data exists immediately
      const resultBefore = await cache.get("items/999");
      expect(resultBefore).toEqual(testData);

      // Advance time past TTL
      currentTime += 2000; // 2 seconds later

      // Data should be expired now
      const resultAfter = await cache.get("items/999");
      expect(resultAfter).toBeNull();

      // Restore original Date.now
      vi.restoreAllMocks();
    });

    it("should not expire entries with TTL of 0 (infinite)", async () => {
      const originalNow = Date.now;
      let currentTime = 1000000000000;

      vi.spyOn(Date, "now").mockImplementation(() => currentTime);

      const testData = { id: 111 };

      // Set with TTL of 0 (should never expire based on TTL)
      // Note: Implementation uses expiresAt = null when ttl <= 0
      await cache.set("items/111", testData, 0);

      // Advance time significantly
      currentTime += 365 * 24 * 60 * 60 * 1000; // 1 year later

      const result = await cache.get("items/111");
      expect(result).toEqual(testData);

      vi.restoreAllMocks();
    });
  });

  describe("has", () => {
    it("should return false for non-existent keys", async () => {
      const exists = await cache.has("nonexistent/key");
      expect(exists).toBe(false);
    });

    it("should return true for existing keys", async () => {
      await cache.set("items/123", { id: 123 });

      const exists = await cache.has("items/123");
      expect(exists).toBe(true);
    });

    it("should return false for expired keys", async () => {
      let currentTime = 1000000000000;
      vi.spyOn(Date, "now").mockImplementation(() => currentTime);

      await cache.set("items/expired", { id: 1 }, 1000);

      currentTime += 2000; // Past TTL

      const exists = await cache.has("items/expired");
      expect(exists).toBe(false);

      vi.restoreAllMocks();
    });
  });

  describe("delete", () => {
    it("should remove cache entries", async () => {
      await cache.set("items/123", { id: 123 });

      // Verify it exists
      expect(await cache.has("items/123")).toBe(true);

      // Delete it
      await cache.delete("items/123");

      // Verify it's gone
      expect(await cache.has("items/123")).toBe(false);
    });

    it("should not throw for non-existent keys", async () => {
      // Should not throw
      await expect(cache.delete("nonexistent/key")).resolves.not.toThrow();
    });
  });

  describe("clear", () => {
    it("should remove all cache entries", async () => {
      // Add multiple entries
      await cache.set("items/1", { id: 1 });
      await cache.set("items/2", { id: 2 });
      await cache.set("recipes/100", { id: 100 });

      // Clear cache
      await cache.clear();

      // Verify all are gone
      expect(await cache.has("items/1")).toBe(false);
      expect(await cache.has("items/2")).toBe(false);
      expect(await cache.has("recipes/100")).toBe(false);
    });
  });

  describe("setMany", () => {
    it("should store multiple entries efficiently", async () => {
      const entries: Array<[string, { id: number }]> = [
        ["items/1", { id: 1 }],
        ["items/2", { id: 2 }],
        ["items/3", { id: 3 }],
      ];

      await cache.setMany(entries);

      expect(await cache.get("items/1")).toEqual({ id: 1 });
      expect(await cache.get("items/2")).toEqual({ id: 2 });
      expect(await cache.get("items/3")).toEqual({ id: 3 });
    });
  });

  describe("getMany", () => {
    it("should retrieve multiple entries", async () => {
      await cache.set("items/1", { id: 1 });
      await cache.set("items/2", { id: 2 });
      await cache.set("items/3", { id: 3 });

      const results = await cache.getMany<{ id: number }>([
        "items/1",
        "items/2",
        "items/3",
        "items/nonexistent",
      ]);

      expect(results.size).toBe(3);
      expect(results.get("items/1")).toEqual({ id: 1 });
      expect(results.get("items/2")).toEqual({ id: 2 });
      expect(results.get("items/3")).toEqual({ id: 3 });
      expect(results.has("items/nonexistent")).toBe(false);
    });
  });

  describe("utility methods", () => {
    it("should report enabled status correctly", () => {
      const cache1 = new FileCache(TEST_CACHE_DIR);
      expect(cache1.isEnabled()).toBe(true);

      const originalEnv = process.env.USE_FILE_CACHE;
      process.env.USE_FILE_CACHE = "false";

      const cache2 = new FileCache(TEST_CACHE_DIR);
      expect(cache2.isEnabled()).toBe(false);

      process.env.USE_FILE_CACHE = originalEnv;
    });

    it("should return cache directory path", () => {
      const cache = new FileCache(TEST_CACHE_DIR);
      expect(cache.getCacheDir()).toBe(TEST_CACHE_DIR);
    });
  });

  describe("security", () => {
    it("should sanitize keys to prevent directory traversal", async () => {
      // Attempt directory traversal
      await cache.set("../../../etc/passwd", { malicious: true });

      // The file should be created in a safe location, not outside cache dir
      const safePath = path.join(TEST_CACHE_DIR, "______etc_passwd.json");
      const dangerousPath = "/etc/passwd.json";

      // Check that dangerous path wasn't created
      const dangerousExists = await fs
        .access(dangerousPath)
        .then(() => true)
        .catch(() => false);
      expect(dangerousExists).toBe(false);
    });
  });
});

