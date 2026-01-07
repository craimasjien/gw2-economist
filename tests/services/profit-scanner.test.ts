/**
 * @fileoverview Unit tests for the Profit Opportunity Scanner Service.
 *
 * These tests verify the profit opportunity scanning logic, including
 * profit calculations, ranking by profit score, and filtering options.
 * Written following TDD methodology.
 *
 * @module tests/services/profit-scanner.test
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  ProfitOpportunityScannerService,
  type ProfitableItem,
  type ProfitScannerDataAccess,
} from "../../server/services/profit-scanner.service";
import type { Item, Recipe, Price } from "../../server/db/schema";
import type { PriceTrend } from "../../server/services/trend-analysis.service";

/**
 * Creates a mock item for testing.
 */
function createMockItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 1,
    name: "Test Item",
    description: null,
    type: "CraftingMaterial",
    rarity: "Fine",
    level: 0,
    icon: null,
    vendorValue: 0,
    chatLink: "[&AgEAAA==]",
    flags: [],
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Creates a mock recipe for testing.
 */
function createMockRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 100,
    type: "Refinement",
    outputItemId: 1,
    outputItemCount: 1,
    minRating: 0,
    timeToCraft: 1000,
    disciplines: ["Tailor"],
    flags: [],
    ingredients: [],
    guildIngredients: [],
    chatLink: "[&CAAABQA=]",
    updatedAt: new Date(),
    ...overrides,
  };
}

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
 * Creates a mock price trend for testing.
 */
function createMockPriceTrend(overrides: Partial<PriceTrend> = {}): PriceTrend {
  return {
    itemId: 1,
    currentPrice: 1000,
    priceChange24h: 0,
    priceChangePercent24h: 0,
    priceChange7d: 0,
    priceChangePercent7d: 0,
    avgDailyVolume: 100,
    volumeTrend: "stable",
    ...overrides,
  };
}

/**
 * Mock data repository for testing.
 */
interface MockDataRepository {
  items: Map<number, Item>;
  recipes: Recipe[];
  prices: Map<number, Price>;
  trends: Map<number, PriceTrend>;
  craftCosts: Map<number, number>;
}

/**
 * Creates a mock data access object for testing.
 */
function createMockDataAccess(data: MockDataRepository): ProfitScannerDataAccess {
  return {
    getAllCraftableItems: vi.fn(async () => {
      // Return items that have recipes
      const craftableItemIds = new Set(data.recipes.map((r) => r.outputItemId));
      return Array.from(craftableItemIds)
        .map((id) => data.items.get(id))
        .filter((item): item is Item => item !== undefined);
    }),
    getRecipesByOutputItem: vi.fn(async (itemId: number) => {
      return data.recipes.filter((r) => r.outputItemId === itemId);
    }),
    getPrice: vi.fn(async (itemId: number) => data.prices.get(itemId) ?? null),
    getPriceTrend: vi.fn(async (itemId: number) => data.trends.get(itemId) ?? null),
    getCraftCost: vi.fn(async (itemId: number) => data.craftCosts.get(itemId) ?? null),
  };
}

describe("ProfitOpportunityScannerService", () => {
  let service: ProfitOpportunityScannerService;
  let mockData: MockDataRepository;
  let mockDataAccess: ProfitScannerDataAccess;

  beforeEach(() => {
    mockData = {
      items: new Map(),
      recipes: [],
      prices: new Map(),
      trends: new Map(),
      craftCosts: new Map(),
    };
    mockDataAccess = createMockDataAccess(mockData);
    service = new ProfitOpportunityScannerService(mockDataAccess);
  });

  describe("getTopProfitableItems", () => {
    it("should return empty array when no craftable items exist", async () => {
      const result = await service.getTopProfitableItems({});

      expect(result).toEqual([]);
    });

    it("should calculate net profit after 15% TP tax", async () => {
      // Item sells for 1000c, costs 500c to craft
      // Net profit = 1000 * 0.85 - 500 = 850 - 500 = 350
      const item = createMockItem({ id: 1, name: "Profitable Item" });
      const recipe = createMockRecipe({ id: 100, outputItemId: 1 });

      mockData.items.set(1, item);
      mockData.recipes.push(recipe);
      mockData.prices.set(1, createMockPrice({ itemId: 1, sellPrice: 1000 }));
      mockData.trends.set(1, createMockPriceTrend({ itemId: 1, avgDailyVolume: 100 }));
      mockData.craftCosts.set(1, 500);

      const result = await service.getTopProfitableItems({});

      expect(result).toHaveLength(1);
      expect(result[0].profit).toBe(350); // 1000 * 0.85 - 500
    });

    it("should calculate profit margin correctly", async () => {
      // Net sell = 1000 * 0.85 = 850
      // Profit = 850 - 500 = 350
      // Margin = 350 / 850 = ~0.4117
      const item = createMockItem({ id: 1, name: "Test Item" });
      const recipe = createMockRecipe({ id: 100, outputItemId: 1 });

      mockData.items.set(1, item);
      mockData.recipes.push(recipe);
      mockData.prices.set(1, createMockPrice({ itemId: 1, sellPrice: 1000 }));
      mockData.trends.set(1, createMockPriceTrend({ itemId: 1, avgDailyVolume: 100 }));
      mockData.craftCosts.set(1, 500);

      const result = await service.getTopProfitableItems({});

      expect(result[0].profitMargin).toBeCloseTo(0.4117, 2);
    });

    it("should rank items by profit score (profit × sqrt(volume))", async () => {
      // Item 1: profit 100, volume 100 -> score = 100 * 10 = 1000
      // Item 2: profit 200, volume 25 -> score = 200 * 5 = 1000 (tie, but let's check ordering)
      // Item 3: profit 50, volume 400 -> score = 50 * 20 = 1000
      const items = [
        createMockItem({ id: 1, name: "Item A" }),
        createMockItem({ id: 2, name: "Item B" }),
        createMockItem({ id: 3, name: "Item C" }),
      ];

      items.forEach((item) => mockData.items.set(item.id, item));

      mockData.recipes.push(
        createMockRecipe({ id: 100, outputItemId: 1 }),
        createMockRecipe({ id: 101, outputItemId: 2 }),
        createMockRecipe({ id: 102, outputItemId: 3 })
      );

      // Set up prices and costs to achieve specific profits
      // Item 1: sell 200, cost 100 -> profit = 200*0.85 - 100 = 70
      mockData.prices.set(1, createMockPrice({ itemId: 1, sellPrice: 200 }));
      mockData.craftCosts.set(1, 100);
      mockData.trends.set(1, createMockPriceTrend({ itemId: 1, avgDailyVolume: 100 }));

      // Item 2: sell 400, cost 100 -> profit = 400*0.85 - 100 = 240
      mockData.prices.set(2, createMockPrice({ itemId: 2, sellPrice: 400 }));
      mockData.craftCosts.set(2, 100);
      mockData.trends.set(2, createMockPriceTrend({ itemId: 2, avgDailyVolume: 25 }));

      // Item 3: sell 150, cost 50 -> profit = 150*0.85 - 50 = 77.5
      mockData.prices.set(3, createMockPrice({ itemId: 3, sellPrice: 150 }));
      mockData.craftCosts.set(3, 50);
      mockData.trends.set(3, createMockPriceTrend({ itemId: 3, avgDailyVolume: 400 }));

      const result = await service.getTopProfitableItems({});

      // Item 3 has highest score: 77.5 * 20 = 1550
      // Item 2: 240 * 5 = 1200
      // Item 1: 70 * 10 = 700
      expect(result[0].item.id).toBe(3);
      expect(result[1].item.id).toBe(2);
      expect(result[2].item.id).toBe(1);
    });

    it("should filter by minimum daily volume", async () => {
      const items = [
        createMockItem({ id: 1, name: "High Volume" }),
        createMockItem({ id: 2, name: "Low Volume" }),
      ];

      items.forEach((item) => mockData.items.set(item.id, item));

      mockData.recipes.push(
        createMockRecipe({ id: 100, outputItemId: 1 }),
        createMockRecipe({ id: 101, outputItemId: 2 })
      );

      mockData.prices.set(1, createMockPrice({ itemId: 1, sellPrice: 1000 }));
      mockData.prices.set(2, createMockPrice({ itemId: 2, sellPrice: 1000 }));
      mockData.craftCosts.set(1, 500);
      mockData.craftCosts.set(2, 500);

      mockData.trends.set(1, createMockPriceTrend({ itemId: 1, avgDailyVolume: 100 }));
      mockData.trends.set(2, createMockPriceTrend({ itemId: 2, avgDailyVolume: 5 }));

      const result = await service.getTopProfitableItems({ minDailyVolume: 50 });

      expect(result).toHaveLength(1);
      expect(result[0].item.id).toBe(1);
    });

    it("should filter by minimum profit margin", async () => {
      const items = [
        createMockItem({ id: 1, name: "High Margin" }),
        createMockItem({ id: 2, name: "Low Margin" }),
      ];

      items.forEach((item) => mockData.items.set(item.id, item));

      mockData.recipes.push(
        createMockRecipe({ id: 100, outputItemId: 1 }),
        createMockRecipe({ id: 101, outputItemId: 2 })
      );

      // Item 1: high margin (50% profit margin)
      // Net sell = 1000 * 0.85 = 850, cost = 400, profit = 450, margin = 450/850 = 52.9%
      mockData.prices.set(1, createMockPrice({ itemId: 1, sellPrice: 1000 }));
      mockData.craftCosts.set(1, 400);

      // Item 2: low margin (5% profit margin)
      // Net sell = 1000 * 0.85 = 850, cost = 800, profit = 50, margin = 50/850 = 5.9%
      mockData.prices.set(2, createMockPrice({ itemId: 2, sellPrice: 1000 }));
      mockData.craftCosts.set(2, 800);

      mockData.trends.set(1, createMockPriceTrend({ itemId: 1, avgDailyVolume: 100 }));
      mockData.trends.set(2, createMockPriceTrend({ itemId: 2, avgDailyVolume: 100 }));

      const result = await service.getTopProfitableItems({ minProfitMargin: 0.2 });

      expect(result).toHaveLength(1);
      expect(result[0].item.id).toBe(1);
    });

    it("should exclude items that cannot be crafted (no craft cost)", async () => {
      const item = createMockItem({ id: 1, name: "Uncraftable" });
      const recipe = createMockRecipe({ id: 100, outputItemId: 1 });

      mockData.items.set(1, item);
      mockData.recipes.push(recipe);
      mockData.prices.set(1, createMockPrice({ itemId: 1, sellPrice: 1000 }));
      mockData.trends.set(1, createMockPriceTrend({ itemId: 1, avgDailyVolume: 100 }));
      // No craft cost set - simulates item that can't be priced

      const result = await service.getTopProfitableItems({});

      expect(result).toEqual([]);
    });

    it("should exclude items with negative profit", async () => {
      const item = createMockItem({ id: 1, name: "Loss Maker" });
      const recipe = createMockRecipe({ id: 100, outputItemId: 1 });

      mockData.items.set(1, item);
      mockData.recipes.push(recipe);
      mockData.prices.set(1, createMockPrice({ itemId: 1, sellPrice: 100 }));
      mockData.craftCosts.set(1, 200); // Costs more to craft than sell price
      mockData.trends.set(1, createMockPriceTrend({ itemId: 1, avgDailyVolume: 100 }));

      const result = await service.getTopProfitableItems({});

      expect(result).toEqual([]);
    });

    it("should limit results to requested count", async () => {
      // Create 10 profitable items
      for (let i = 1; i <= 10; i++) {
        const item = createMockItem({ id: i, name: `Item ${i}` });
        mockData.items.set(i, item);
        mockData.recipes.push(createMockRecipe({ id: 100 + i, outputItemId: i }));
        mockData.prices.set(i, createMockPrice({ itemId: i, sellPrice: 1000 }));
        mockData.craftCosts.set(i, 500);
        mockData.trends.set(i, createMockPriceTrend({ itemId: i, avgDailyVolume: 100 }));
      }

      const result = await service.getTopProfitableItems({ limit: 5 });

      expect(result).toHaveLength(5);
    });

    it("should filter by crafting disciplines", async () => {
      const items = [
        createMockItem({ id: 1, name: "Tailor Item" }),
        createMockItem({ id: 2, name: "Armorsmith Item" }),
      ];

      items.forEach((item) => mockData.items.set(item.id, item));

      mockData.recipes.push(
        createMockRecipe({ id: 100, outputItemId: 1, disciplines: ["Tailor"] }),
        createMockRecipe({ id: 101, outputItemId: 2, disciplines: ["Armorsmith"] })
      );

      mockData.prices.set(1, createMockPrice({ itemId: 1, sellPrice: 1000 }));
      mockData.prices.set(2, createMockPrice({ itemId: 2, sellPrice: 1000 }));
      mockData.craftCosts.set(1, 500);
      mockData.craftCosts.set(2, 500);
      mockData.trends.set(1, createMockPriceTrend({ itemId: 1, avgDailyVolume: 100 }));
      mockData.trends.set(2, createMockPriceTrend({ itemId: 2, avgDailyVolume: 100 }));

      const result = await service.getTopProfitableItems({
        disciplines: ["Tailor"],
      });

      expect(result).toHaveLength(1);
      expect(result[0].item.id).toBe(1);
    });
  });

  describe("profit score calculation", () => {
    it("should use sqrt(volume) in profit score formula", async () => {
      const item = createMockItem({ id: 1, name: "Test Item" });
      const recipe = createMockRecipe({ id: 100, outputItemId: 1 });

      mockData.items.set(1, item);
      mockData.recipes.push(recipe);

      // Profit = 1000 * 0.85 - 500 = 350
      // Volume = 100
      // Score = 350 * sqrt(100) = 350 * 10 = 3500
      mockData.prices.set(1, createMockPrice({ itemId: 1, sellPrice: 1000 }));
      mockData.craftCosts.set(1, 500);
      mockData.trends.set(1, createMockPriceTrend({ itemId: 1, avgDailyVolume: 100 }));

      const result = await service.getTopProfitableItems({});

      expect(result[0].profitScore).toBe(3500);
    });
  });
});

