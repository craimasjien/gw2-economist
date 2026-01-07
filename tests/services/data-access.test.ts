/**
 * @fileoverview Unit tests for the data access layer.
 *
 * Tests the data access functions that abstract database queries
 * for items, recipes, and prices.
 *
 * @module tests/services/data-access.test
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createDataAccess,
  createExtendedDataAccess,
} from "../../server/services/data-access";
import type { Item, Recipe, Price } from "../../server/db/schema";

/**
 * Mock item for testing.
 */
const mockItem: Item = {
  id: 12345,
  name: "Gossamer Scrap",
  description: "A fine crafting material",
  type: "CraftingMaterial",
  rarity: "Fine",
  level: 0,
  icon: "https://example.com/icon.png",
  vendorValue: 8,
  chatLink: "[&AgEwMwAA]",
  createdAt: new Date(),
  updatedAt: new Date(),
};

/**
 * Mock recipe for testing.
 */
const mockRecipe: Recipe = {
  id: 8000,
  type: "RefinementEctoplasm",
  outputItemId: 12345,
  outputItemCount: 1,
  timeToCraftMs: 0,
  disciplines: ["Tailor"],
  minRating: 400,
  flags: [],
  ingredients: [{ itemId: 100, count: 2 }],
  guildIngredients: [],
  chatLink: "[&CQAAAA==]",
  createdAt: new Date(),
  updatedAt: new Date(),
};

/**
 * Mock price for testing.
 */
const mockPrice: Price = {
  itemId: 12345,
  buyPrice: 100,
  buyQuantity: 500,
  sellPrice: 150,
  sellQuantity: 300,
  lastUpdated: new Date(),
};

/**
 * Creates a mock database for testing with proper chaining.
 */
function createMockDb() {
  let resolveValue: unknown[] = [];

  const chainMock = {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
  };

  // Configure chaining - each method returns the chain
  chainMock.select.mockImplementation(() => chainMock);
  chainMock.from.mockImplementation(() => chainMock);
  chainMock.where.mockImplementation(() => {
    // For getRecipesByOutputItem, where is the terminal operation
    return Object.assign(Promise.resolve(resolveValue), chainMock);
  });
  chainMock.limit.mockImplementation(() => Promise.resolve(resolveValue));

  return {
    ...chainMock,
    setResolveValue: (value: unknown[]) => {
      resolveValue = value;
    },
  };
}

describe("createDataAccess", () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
  });

  describe("getItem", () => {
    it("should return item when found", async () => {
      mockDb.setResolveValue([mockItem]);
      const dataAccess = createDataAccess(mockDb as any);

      const result = await dataAccess.getItem(12345);

      expect(result).toEqual(mockItem);
    });

    it("should return null when item not found", async () => {
      mockDb.setResolveValue([]);
      const dataAccess = createDataAccess(mockDb as any);

      const result = await dataAccess.getItem(99999);

      expect(result).toBeNull();
    });

    it("should query with correct item ID", async () => {
      mockDb.setResolveValue([mockItem]);
      const dataAccess = createDataAccess(mockDb as any);

      await dataAccess.getItem(12345);

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
      expect(mockDb.limit).toHaveBeenCalledWith(1);
    });
  });

  describe("getRecipesByOutputItem", () => {
    it("should return recipes for item", async () => {
      mockDb.setResolveValue([mockRecipe]);
      const dataAccess = createDataAccess(mockDb as any);

      const result = await dataAccess.getRecipesByOutputItem(12345);

      expect(result).toEqual([mockRecipe]);
    });

    it("should return empty array when no recipes found", async () => {
      mockDb.setResolveValue([]);
      const dataAccess = createDataAccess(mockDb as any);

      const result = await dataAccess.getRecipesByOutputItem(99999);

      expect(result).toEqual([]);
    });

    it("should return multiple recipes when item has multiple", async () => {
      const recipe2 = { ...mockRecipe, id: 8001, type: "Refinement" };
      mockDb.setResolveValue([mockRecipe, recipe2]);
      const dataAccess = createDataAccess(mockDb as any);

      const result = await dataAccess.getRecipesByOutputItem(12345);

      expect(result).toHaveLength(2);
    });
  });

  describe("getPrice", () => {
    it("should return price when found", async () => {
      mockDb.setResolveValue([mockPrice]);
      const dataAccess = createDataAccess(mockDb as any);

      const result = await dataAccess.getPrice(12345);

      expect(result).toEqual(mockPrice);
    });

    it("should return null when price not found", async () => {
      mockDb.setResolveValue([]);
      const dataAccess = createDataAccess(mockDb as any);

      const result = await dataAccess.getPrice(99999);

      expect(result).toBeNull();
    });
  });
});

describe("createExtendedDataAccess", () => {
  describe("getItems", () => {
    it("should return map of items by ID", async () => {
      const item2 = { ...mockItem, id: 12346, name: "Item 2" };
      const mockDb = createMockDb();
      mockDb.setResolveValue([mockItem, item2]);
      const dataAccess = createExtendedDataAccess(mockDb as any);

      const result = await dataAccess.getItems([12345, 12346]);

      expect(result.get(12345)).toEqual(mockItem);
      expect(result.get(12346)).toEqual(item2);
    });

    it("should return empty map for empty array", async () => {
      const mockDb = createMockDb();
      const dataAccess = createExtendedDataAccess(mockDb as any);

      const result = await dataAccess.getItems([]);

      expect(result.size).toBe(0);
      expect(mockDb.select).not.toHaveBeenCalled();
    });
  });

  describe("getPrices", () => {
    it("should return map of prices by item ID", async () => {
      const price2 = { ...mockPrice, itemId: 12346 };
      const mockDb = createMockDb();
      mockDb.setResolveValue([mockPrice, price2]);
      const dataAccess = createExtendedDataAccess(mockDb as any);

      const result = await dataAccess.getPrices([12345, 12346]);

      expect(result.get(12345)).toEqual(mockPrice);
      expect(result.get(12346)).toEqual(price2);
    });

    it("should return empty map for empty array", async () => {
      const mockDb = createMockDb();
      const dataAccess = createExtendedDataAccess(mockDb as any);

      const result = await dataAccess.getPrices([]);

      expect(result.size).toBe(0);
      expect(mockDb.select).not.toHaveBeenCalled();
    });
  });

  describe("inherited methods", () => {
    it("should have getItem from base access", async () => {
      const mockDb = createMockDb();
      mockDb.setResolveValue([mockItem]);
      const dataAccess = createExtendedDataAccess(mockDb as any);

      const result = await dataAccess.getItem(12345);

      expect(result).toEqual(mockItem);
    });

    it("should have getRecipesByOutputItem from base access", async () => {
      const mockDb = createMockDb();
      mockDb.setResolveValue([mockRecipe]);
      const dataAccess = createExtendedDataAccess(mockDb as any);

      const result = await dataAccess.getRecipesByOutputItem(12345);

      expect(result).toEqual([mockRecipe]);
    });

    it("should have getPrice from base access", async () => {
      const mockDb = createMockDb();
      mockDb.setResolveValue([mockPrice]);
      const dataAccess = createExtendedDataAccess(mockDb as any);

      const result = await dataAccess.getPrice(12345);

      expect(result).toEqual(mockPrice);
    });
  });
});
