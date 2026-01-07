/**
 * @fileoverview Unit tests for the Trend Analysis Service.
 *
 * These tests verify the price and volume trend analysis logic,
 * including calculating price changes, identifying volume trends,
 * and handling edge cases with missing or insufficient data.
 * Written following TDD methodology.
 *
 * @module tests/services/trend-analysis.test
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  TrendAnalysisService,
  type PriceTrend,
  type PriceDataPoint,
  type VolumeDataPoint,
  type TrendDataAccess,
} from "../../server/services/trend-analysis.service";
import type { Price, PriceHistory } from "../../server/db/schema";

/**
 * Creates a mock price for testing.
 */
function createMockPrice(overrides: Partial<Price> = {}): Price {
  return {
    itemId: 1,
    buyPrice: 100,
    buyQuantity: 1000,
    sellPrice: 120,
    sellQuantity: 500,
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Creates a mock price history record for testing.
 */
function createMockPriceHistory(overrides: Partial<PriceHistory> = {}): PriceHistory {
  return {
    id: 1,
    itemId: 1,
    buyPrice: 100,
    buyQuantity: 1000,
    sellPrice: 120,
    sellQuantity: 500,
    recordedAt: new Date(),
    ...overrides,
  };
}

/**
 * Creates price history records for a range of days.
 *
 * @param itemId - Item ID for the history records
 * @param days - Number of days of history to create
 * @param basePrice - Base sell price (will vary slightly)
 * @param baseVolume - Base sell quantity (will vary slightly)
 * @param priceDirection - "up", "down", or "stable"
 * @param volumeDirection - "up", "down", or "stable"
 */
function createPriceHistoryRange(
  itemId: number,
  days: number,
  basePrice: number,
  baseVolume: number,
  priceDirection: "up" | "down" | "stable" = "stable",
  volumeDirection: "up" | "down" | "stable" = "stable"
): PriceHistory[] {
  const history: PriceHistory[] = [];
  const now = new Date();

  for (let i = 0; i < days * 24; i++) {
    const hoursAgo = i;
    const recordedAt = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);

    // Calculate price based on direction
    let priceMultiplier = 1;
    if (priceDirection === "up") {
      priceMultiplier = 1 + (hoursAgo / (days * 24)) * 0.2; // 20% increase over period
    } else if (priceDirection === "down") {
      priceMultiplier = 1 - (hoursAgo / (days * 24)) * 0.2; // 20% decrease over period
    }

    // Calculate volume based on direction
    let volumeMultiplier = 1;
    if (volumeDirection === "up") {
      volumeMultiplier = 1 - (hoursAgo / (days * 24)) * 0.5; // Was 50% lower before
    } else if (volumeDirection === "down") {
      volumeMultiplier = 1 + (hoursAgo / (days * 24)) * 0.5; // Was 50% higher before
    }

    history.push(
      createMockPriceHistory({
        id: i + 1,
        itemId,
        sellPrice: Math.round(basePrice * priceMultiplier),
        buyPrice: Math.round(basePrice * priceMultiplier * 0.9),
        sellQuantity: Math.round(baseVolume * volumeMultiplier),
        buyQuantity: Math.round(baseVolume * volumeMultiplier * 2),
        recordedAt,
      })
    );
  }

  return history;
}

/**
 * Mock data repository for testing.
 */
interface MockDataRepository {
  prices: Map<number, Price>;
  priceHistory: PriceHistory[];
}

/**
 * Creates a mock data access object for testing.
 */
function createMockDataAccess(data: MockDataRepository): TrendDataAccess {
  return {
    getPrice: vi.fn(async (itemId: number) => data.prices.get(itemId) ?? null),
    getPriceHistory: vi.fn(async (itemId: number, fromDate: Date) => {
      return data.priceHistory.filter(
        (h) => h.itemId === itemId && h.recordedAt >= fromDate
      );
    }),
  };
}

describe("TrendAnalysisService", () => {
  let service: TrendAnalysisService;
  let mockData: MockDataRepository;
  let mockDataAccess: TrendDataAccess;

  beforeEach(() => {
    mockData = {
      prices: new Map(),
      priceHistory: [],
    };
    mockDataAccess = createMockDataAccess(mockData);
    service = new TrendAnalysisService(mockDataAccess);
  });

  describe("getPriceTrend", () => {
    it("should return null for items with no current price", async () => {
      // No price data set up

      const result = await service.getPriceTrend(12345);

      expect(result).toBeNull();
    });

    it("should return null for items with no history", async () => {
      // Set up current price but no history
      mockData.prices.set(1, createMockPrice({ itemId: 1, sellPrice: 1000 }));

      const result = await service.getPriceTrend(1);

      expect(result).toBeNull();
    });

    it("should calculate 24h price change correctly", async () => {
      const itemId = 1;
      const currentPrice = 1200; // Current sell price
      const price24hAgo = 1000; // Price 24 hours ago

      mockData.prices.set(itemId, createMockPrice({ itemId, sellPrice: currentPrice }));

      // Create history with stable prices except 24h ago
      const now = new Date();
      const history: PriceHistory[] = [];

      // Current hour
      history.push(
        createMockPriceHistory({
          id: 1,
          itemId,
          sellPrice: currentPrice,
          sellQuantity: 500,
          recordedAt: now,
        })
      );

      // 24 hours ago
      history.push(
        createMockPriceHistory({
          id: 2,
          itemId,
          sellPrice: price24hAgo,
          sellQuantity: 500,
          recordedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        })
      );

      mockData.priceHistory = history;

      const result = await service.getPriceTrend(itemId);

      expect(result).not.toBeNull();
      expect(result!.priceChange24h).toBe(200); // 1200 - 1000
      expect(result!.priceChangePercent24h).toBe(20); // 20% increase
    });

    it("should calculate 7d price change correctly", async () => {
      const itemId = 1;
      const currentPrice = 1500;
      const price7dAgo = 1000;

      mockData.prices.set(itemId, createMockPrice({ itemId, sellPrice: currentPrice }));

      const now = new Date();
      const history: PriceHistory[] = [
        createMockPriceHistory({
          id: 1,
          itemId,
          sellPrice: currentPrice,
          sellQuantity: 500,
          recordedAt: now,
        }),
        createMockPriceHistory({
          id: 2,
          itemId,
          sellPrice: price7dAgo,
          sellQuantity: 500,
          recordedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        }),
      ];

      mockData.priceHistory = history;

      const result = await service.getPriceTrend(itemId, 7);

      expect(result).not.toBeNull();
      expect(result!.priceChange7d).toBe(500); // 1500 - 1000
      expect(result!.priceChangePercent7d).toBe(50); // 50% increase
    });

    it("should identify increasing volume trend", async () => {
      const itemId = 1;
      mockData.prices.set(itemId, createMockPrice({ itemId, sellPrice: 1000 }));

      // Create 7 days of history with increasing volume
      mockData.priceHistory = createPriceHistoryRange(
        itemId,
        7,
        1000,
        500,
        "stable",
        "up" // Volume increasing
      );

      const result = await service.getPriceTrend(itemId, 7);

      expect(result).not.toBeNull();
      expect(result!.volumeTrend).toBe("increasing");
    });

    it("should identify decreasing volume trend", async () => {
      const itemId = 1;
      mockData.prices.set(itemId, createMockPrice({ itemId, sellPrice: 1000 }));

      // Create 7 days of history with decreasing volume
      mockData.priceHistory = createPriceHistoryRange(
        itemId,
        7,
        1000,
        500,
        "stable",
        "down" // Volume decreasing
      );

      const result = await service.getPriceTrend(itemId, 7);

      expect(result).not.toBeNull();
      expect(result!.volumeTrend).toBe("decreasing");
    });

    it("should identify stable volume trend", async () => {
      const itemId = 1;
      mockData.prices.set(itemId, createMockPrice({ itemId, sellPrice: 1000 }));

      // Create 7 days of history with stable volume
      mockData.priceHistory = createPriceHistoryRange(
        itemId,
        7,
        1000,
        500,
        "stable",
        "stable" // Volume stable
      );

      const result = await service.getPriceTrend(itemId, 7);

      expect(result).not.toBeNull();
      expect(result!.volumeTrend).toBe("stable");
    });

    it("should calculate average daily volume", async () => {
      const itemId = 1;
      const dailyVolume = 500; // Sell quantity per snapshot

      mockData.prices.set(itemId, createMockPrice({ itemId, sellPrice: 1000 }));

      // Create exactly 24 hours of history (24 snapshots)
      const now = new Date();
      const history: PriceHistory[] = [];
      for (let i = 0; i < 24; i++) {
        history.push(
          createMockPriceHistory({
            id: i + 1,
            itemId,
            sellPrice: 1000,
            sellQuantity: dailyVolume,
            recordedAt: new Date(now.getTime() - i * 60 * 60 * 1000),
          })
        );
      }
      mockData.priceHistory = history;

      const result = await service.getPriceTrend(itemId, 1);

      expect(result).not.toBeNull();
      expect(result!.avgDailyVolume).toBe(dailyVolume);
    });
  });

  describe("getPriceHistory", () => {
    it("should return empty array for items with no history", async () => {
      const result = await service.getPriceHistory(12345, 7);

      expect(result).toEqual([]);
    });

    it("should return price data points sorted by time", async () => {
      const itemId = 1;
      const now = new Date();

      mockData.priceHistory = [
        createMockPriceHistory({
          id: 1,
          itemId,
          sellPrice: 100,
          recordedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
        }),
        createMockPriceHistory({
          id: 2,
          itemId,
          sellPrice: 110,
          recordedAt: new Date(now.getTime() - 1 * 60 * 60 * 1000),
        }),
        createMockPriceHistory({
          id: 3,
          itemId,
          sellPrice: 120,
          recordedAt: now,
        }),
      ];

      const result = await service.getPriceHistory(itemId, 1);

      expect(result).toHaveLength(3);
      expect(result[0].sellPrice).toBe(100);
      expect(result[1].sellPrice).toBe(110);
      expect(result[2].sellPrice).toBe(120);
    });

    it("should only return data within the requested days range", async () => {
      const itemId = 1;
      const now = new Date();

      mockData.priceHistory = [
        createMockPriceHistory({
          id: 1,
          itemId,
          sellPrice: 100,
          recordedAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
        }),
        createMockPriceHistory({
          id: 2,
          itemId,
          sellPrice: 110,
          recordedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        }),
        createMockPriceHistory({
          id: 3,
          itemId,
          sellPrice: 120,
          recordedAt: now, // Now
        }),
      ];

      const result = await service.getPriceHistory(itemId, 7);

      expect(result).toHaveLength(2); // Only 5 days ago and now
    });
  });

  describe("getVolumeHistory", () => {
    it("should return empty array for items with no history", async () => {
      const result = await service.getVolumeHistory(12345, 7);

      expect(result).toEqual([]);
    });

    it("should return volume data points", async () => {
      const itemId = 1;
      const now = new Date();

      mockData.priceHistory = [
        createMockPriceHistory({
          id: 1,
          itemId,
          sellQuantity: 500,
          buyQuantity: 1000,
          recordedAt: now,
        }),
      ];

      const result = await service.getVolumeHistory(itemId, 1);

      expect(result).toHaveLength(1);
      expect(result[0].sellQuantity).toBe(500);
      expect(result[0].buyQuantity).toBe(1000);
    });
  });

  describe("edge cases", () => {
    it("should handle negative price changes", async () => {
      const itemId = 1;
      const currentPrice = 800; // Current sell price
      const price24hAgo = 1000; // Price 24 hours ago (was higher)

      mockData.prices.set(itemId, createMockPrice({ itemId, sellPrice: currentPrice }));

      const now = new Date();
      mockData.priceHistory = [
        createMockPriceHistory({
          id: 1,
          itemId,
          sellPrice: currentPrice,
          sellQuantity: 500,
          recordedAt: now,
        }),
        createMockPriceHistory({
          id: 2,
          itemId,
          sellPrice: price24hAgo,
          sellQuantity: 500,
          recordedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        }),
      ];

      const result = await service.getPriceTrend(itemId);

      expect(result).not.toBeNull();
      expect(result!.priceChange24h).toBe(-200); // 800 - 1000
      expect(result!.priceChangePercent24h).toBe(-20); // -20% (decrease)
    });

    it("should handle zero base price gracefully", async () => {
      const itemId = 1;
      mockData.prices.set(itemId, createMockPrice({ itemId, sellPrice: 100 }));

      const now = new Date();
      mockData.priceHistory = [
        createMockPriceHistory({
          id: 1,
          itemId,
          sellPrice: 100,
          sellQuantity: 500,
          recordedAt: now,
        }),
        createMockPriceHistory({
          id: 2,
          itemId,
          sellPrice: 0, // Zero price 24h ago
          sellQuantity: 500,
          recordedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        }),
      ];

      const result = await service.getPriceTrend(itemId);

      expect(result).not.toBeNull();
      // When base price is 0, percentage should be handled gracefully
      expect(result!.priceChangePercent24h).toBe(0);
    });
  });
});

