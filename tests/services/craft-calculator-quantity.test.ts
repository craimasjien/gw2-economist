/**
 * @fileoverview Unit tests for quantity-aware craft analysis.
 *
 * These tests verify the craft calculator's ability to analyze bulk
 * purchases considering order book depth. When buying in bulk, the
 * effective price increases as cheaper listings are exhausted.
 *
 * @module tests/services/craft-calculator-quantity.test
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  CraftCalculatorService,
  type QuantityAwareCraftAnalysis,
  type QuantityAwareDataAccess,
} from "../../server/services/craft-calculator.service";
import type { Item, Recipe, Price } from "../../server/db/schema";
import type { GW2Listing, GW2ListingEntry } from "../../server/services/gw2-api/types";

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
 * Creates a mock listing with order book depth.
 */
function createMockListing(
  itemId: number,
  sells: GW2ListingEntry[],
  buys: GW2ListingEntry[] = []
): GW2Listing {
  return {
    id: itemId,
    sells,
    buys,
  };
}

/**
 * Mock data repository for testing.
 */
interface MockDataRepository {
  items: Map<number, Item>;
  recipes: Map<number, Recipe>;
  recipesByOutput: Map<number, Recipe[]>;
  prices: Map<number, Price>;
  listings: Map<number, GW2Listing>;
}

/**
 * Creates a mock quantity-aware data access object for testing.
 */
function createMockQuantityDataAccess(data: MockDataRepository): QuantityAwareDataAccess {
  return {
    getItem: vi.fn(async (id: number) => data.items.get(id) ?? null),
    getRecipesByOutputItem: vi.fn(
      async (itemId: number) => data.recipesByOutput.get(itemId) ?? []
    ),
    getPrice: vi.fn(async (itemId: number) => data.prices.get(itemId) ?? null),
    getListing: vi.fn(async (itemId: number) => data.listings.get(itemId) ?? null),
  };
}

describe("CraftCalculatorService - Quantity Analysis", () => {
  let calculator: CraftCalculatorService;
  let mockData: MockDataRepository;
  let mockDataAccess: QuantityAwareDataAccess;

  beforeEach(() => {
    mockData = {
      items: new Map(),
      recipes: new Map(),
      recipesByOutput: new Map(),
      prices: new Map(),
      listings: new Map(),
    };
    mockDataAccess = createMockQuantityDataAccess(mockData);
    calculator = new CraftCalculatorService(mockDataAccess);
  });

  describe("analyzeForQuantity", () => {
    it("should use order book depth to calculate bulk purchase cost", async () => {
      const outputItem = createMockItem({ id: 1, name: "Bolt of Gossamer" });
      const materialItem = createMockItem({ id: 2, name: "Gossamer Scrap" });

      const recipe = createMockRecipe({
        id: 100,
        outputItemId: 1,
        outputItemCount: 1,
        ingredients: [{ itemId: 2, count: 2 }],
      });

      mockData.items.set(1, outputItem);
      mockData.items.set(2, materialItem);
      mockData.recipesByOutput.set(1, [recipe]);

      // Output item: first 50 at 500, next 50 at 600
      mockData.listings.set(
        1,
        createMockListing(1, [
          { listings: 5, quantity: 50, unit_price: 500 },
          { listings: 5, quantity: 50, unit_price: 600 },
        ])
      );
      mockData.prices.set(1, createMockPrice({ itemId: 1, sellPrice: 500 }));

      // Material: cheap at first, expensive in bulk
      // For 100 bolts, we need 200 scraps
      mockData.listings.set(
        2,
        createMockListing(2, [
          { listings: 10, quantity: 100, unit_price: 200 },
          { listings: 10, quantity: 200, unit_price: 300 },
        ])
      );
      mockData.prices.set(2, createMockPrice({ itemId: 2, sellPrice: 200 }));

      // Analyze for 100 items
      const result = await calculator.analyzeForQuantity(1, 100);

      expect(result).not.toBeNull();
      expect(result!.quantity).toBe(100);

      // Buying 100: 50@500 + 50@600 = 55,000
      expect(result!.totalBuyCost).toBe(55000);
      expect(result!.averageBuyPrice).toBe(550);

      // Crafting 100: need 200 scraps
      // 100@200 + 100@300 = 50,000
      expect(result!.totalCraftCost).toBe(50000);
      expect(result!.averageCraftCost).toBe(500);

      // At bulk prices, crafting is now cheaper!
      expect(result!.recommendation).toBe("craft");
    });

    it("should recommend buying when order book shows better value", async () => {
      const outputItem = createMockItem({ id: 1, name: "Some Item" });
      const materialItem = createMockItem({ id: 2, name: "Material" });

      const recipe = createMockRecipe({
        id: 100,
        outputItemId: 1,
        outputItemCount: 1,
        ingredients: [{ itemId: 2, count: 5 }],
      });

      mockData.items.set(1, outputItem);
      mockData.items.set(2, materialItem);
      mockData.recipesByOutput.set(1, [recipe]);

      // Output: lots of cheap supply
      mockData.listings.set(
        1,
        createMockListing(1, [
          { listings: 100, quantity: 1000, unit_price: 100 },
        ])
      );
      mockData.prices.set(1, createMockPrice({ itemId: 1, sellPrice: 100 }));

      // Material: limited cheap supply, expensive in bulk
      mockData.listings.set(
        2,
        createMockListing(2, [
          { listings: 5, quantity: 10, unit_price: 10 },
          { listings: 50, quantity: 500, unit_price: 50 },
        ])
      );
      mockData.prices.set(2, createMockPrice({ itemId: 2, sellPrice: 10 }));

      // Analyze for 50 items
      const result = await calculator.analyzeForQuantity(1, 50);

      expect(result).not.toBeNull();

      // Buying 50 items: all at 100c = 5,000c
      expect(result!.totalBuyCost).toBe(5000);

      // Crafting 50: need 250 materials
      // 10@10 + 240@50 = 100 + 12,000 = 12,100
      expect(result!.totalCraftCost).toBe(12100);

      // Buying is clearly better at bulk prices
      expect(result!.recommendation).toBe("buy");
    });

    it("should find break-even quantity where recommendation changes", async () => {
      const outputItem = createMockItem({ id: 1, name: "Break Even Item" });
      const materialItem = createMockItem({ id: 2, name: "Material" });

      const recipe = createMockRecipe({
        id: 100,
        outputItemId: 1,
        outputItemCount: 1,
        ingredients: [{ itemId: 2, count: 2 }],
      });

      mockData.items.set(1, outputItem);
      mockData.items.set(2, materialItem);
      mockData.recipesByOutput.set(1, [recipe]);

      // Output: cheap at first, expensive in bulk
      mockData.listings.set(
        1,
        createMockListing(1, [
          { listings: 10, quantity: 100, unit_price: 400 },
          { listings: 10, quantity: 100, unit_price: 800 },
        ])
      );
      mockData.prices.set(1, createMockPrice({ itemId: 1, sellPrice: 400 }));

      // Material: steady supply
      mockData.listings.set(
        2,
        createMockListing(2, [
          { listings: 100, quantity: 1000, unit_price: 250 },
        ])
      );
      mockData.prices.set(2, createMockPrice({ itemId: 2, sellPrice: 250 }));

      // At small quantity (50): buying 50@400 = 20,000; crafting 100 mats@250 = 25,000 -> buy
      const smallResult = await calculator.analyzeForQuantity(1, 50);
      expect(smallResult!.recommendation).toBe("buy");

      // At large quantity (150): buying 100@400 + 50@800 = 80,000; crafting 300 mats@250 = 75,000 -> craft
      const largeResult = await calculator.analyzeForQuantity(1, 150);
      expect(largeResult!.recommendation).toBe("craft");
    });

    it("should calculate price impact percentage", async () => {
      const outputItem = createMockItem({ id: 1, name: "Impact Test" });

      mockData.items.set(1, outputItem);
      mockData.recipesByOutput.set(1, []); // No recipe

      // Price escalates significantly
      mockData.listings.set(
        1,
        createMockListing(1, [
          { listings: 5, quantity: 50, unit_price: 100 },
          { listings: 5, quantity: 50, unit_price: 200 },
        ])
      );
      mockData.prices.set(1, createMockPrice({ itemId: 1, sellPrice: 100 }));

      const result = await calculator.analyzeForQuantity(1, 100);

      expect(result).not.toBeNull();
      // 50@100 + 50@200 = 15,000 / 100 = 150 avg
      // Base price is 100, so impact is 50%
      expect(result!.buyPriceImpact).toBeCloseTo(50, 0);
    });

    it("should handle items that cannot be crafted", async () => {
      const outputItem = createMockItem({ id: 1, name: "Raw Material" });

      mockData.items.set(1, outputItem);
      mockData.recipesByOutput.set(1, []); // No recipes

      mockData.listings.set(
        1,
        createMockListing(1, [
          { listings: 10, quantity: 100, unit_price: 500 },
        ])
      );
      mockData.prices.set(1, createMockPrice({ itemId: 1, sellPrice: 500 }));

      const result = await calculator.analyzeForQuantity(1, 50);

      expect(result).not.toBeNull();
      expect(result!.canCraft).toBe(false);
      expect(result!.recommendation).toBe("buy");
      expect(result!.totalCraftCost).toBe(0);
    });

    it("should fall back to price data when listings unavailable", async () => {
      const outputItem = createMockItem({ id: 1, name: "No Listing Item" });
      const materialItem = createMockItem({ id: 2, name: "Material" });

      const recipe = createMockRecipe({
        id: 100,
        outputItemId: 1,
        outputItemCount: 1,
        ingredients: [{ itemId: 2, count: 2 }],
      });

      mockData.items.set(1, outputItem);
      mockData.items.set(2, materialItem);
      mockData.recipesByOutput.set(1, [recipe]);

      // No listings, only prices
      mockData.prices.set(1, createMockPrice({ itemId: 1, sellPrice: 500 }));
      mockData.prices.set(2, createMockPrice({ itemId: 2, sellPrice: 200 }));

      const result = await calculator.analyzeForQuantity(1, 10);

      expect(result).not.toBeNull();
      // Falls back to flat pricing: 10 * 500 = 5000 buy, 10 * 2 * 200 = 4000 craft
      expect(result!.totalBuyCost).toBe(5000);
      expect(result!.totalCraftCost).toBe(4000);
      expect(result!.recommendation).toBe("craft");
    });

    it("should handle partial fills when supply is limited", async () => {
      const outputItem = createMockItem({ id: 1, name: "Rare Item" });

      mockData.items.set(1, outputItem);
      mockData.recipesByOutput.set(1, []);

      // Only 50 available
      mockData.listings.set(
        1,
        createMockListing(1, [
          { listings: 5, quantity: 50, unit_price: 500 },
        ])
      );
      mockData.prices.set(1, createMockPrice({ itemId: 1, sellPrice: 500 }));

      const result = await calculator.analyzeForQuantity(1, 100);

      expect(result).not.toBeNull();
      expect(result!.supplyAvailable).toBe(50);
      expect(result!.supplyShortfall).toBe(50);
      expect(result!.canFillOrder).toBe(false);
    });
  });

  describe("findOptimalQuantity", () => {
    it("should find quantity where crafting becomes better than buying", async () => {
      const outputItem = createMockItem({ id: 1, name: "Crossover Item" });
      const materialItem = createMockItem({ id: 2, name: "Material" });

      const recipe = createMockRecipe({
        id: 100,
        outputItemId: 1,
        outputItemCount: 1,
        ingredients: [{ itemId: 2, count: 2 }],
      });

      mockData.items.set(1, outputItem);
      mockData.items.set(2, materialItem);
      mockData.recipesByOutput.set(1, [recipe]);

      // Output: cheap then expensive
      mockData.listings.set(
        1,
        createMockListing(1, [
          { listings: 10, quantity: 100, unit_price: 200 },
          { listings: 10, quantity: 200, unit_price: 600 },
        ])
      );
      mockData.prices.set(1, createMockPrice({ itemId: 1, sellPrice: 200 }));

      // Material: steady at 150 each
      mockData.listings.set(
        2,
        createMockListing(2, [
          { listings: 100, quantity: 1000, unit_price: 150 },
        ])
      );
      mockData.prices.set(2, createMockPrice({ itemId: 2, sellPrice: 150 }));

      // Craft cost: 2 * 150 = 300 per item
      // At qty 1: buy 200, craft 300 -> buy
      // At qty 100: buy avg 200, craft 300 -> buy
      // At qty 150: buy avg (100*200 + 50*600)/150 = 333, craft 300 -> craft

      const optimalQty = await calculator.findOptimalQuantity(1, 300);

      // Should find the point where buying average exceeds 300
      expect(optimalQty).not.toBeNull();
      expect(optimalQty!.craftBetterAt).toBeGreaterThan(100);
      expect(optimalQty!.craftBetterAt).toBeLessThanOrEqual(150);
    });
  });
});

