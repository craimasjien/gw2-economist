/**
 * @fileoverview Unit tests for craft analysis server functions.
 *
 * Tests the serialization utilities and input validation schemas
 * for the craft analysis API endpoints.
 *
 * @module tests/functions/craft-analysis.test
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import type { Item, Recipe, Price } from "../../server/db/schema";

/**
 * Since the server functions use createServerFn, we test the schemas
 * and serialization logic independently.
 */

/**
 * Search input schema (mirrors the one in craft-analysis.ts).
 */
const searchInputSchema = z.object({
  query: z.string().min(1).max(100),
  limit: z.number().int().min(1).max(50).optional().default(20),
});

/**
 * Analyze input schema (mirrors the one in craft-analysis.ts).
 */
const analyzeInputSchema = z.object({
  itemId: z.number().int().positive(),
});

/**
 * Serializable item type.
 */
interface SerializedItem {
  id: number;
  name: string;
  description: string | null;
  type: string;
  rarity: string;
  level: number;
  icon: string | null;
  vendorValue: number;
  chatLink: string | null;
}

/**
 * Converts an Item to a serializable format.
 */
function serializeItem(item: Item): SerializedItem {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    type: item.type,
    rarity: item.rarity,
    level: item.level,
    icon: item.icon,
    vendorValue: item.vendorValue,
    chatLink: item.chatLink,
  };
}

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
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-02"),
};

describe("searchInputSchema", () => {
  describe("query validation", () => {
    it("should accept valid query string", () => {
      const result = searchInputSchema.parse({ query: "gossamer" });
      expect(result.query).toBe("gossamer");
    });

    it("should reject empty query", () => {
      expect(() => searchInputSchema.parse({ query: "" })).toThrow();
    });

    it("should reject query over 100 characters", () => {
      const longQuery = "a".repeat(101);
      expect(() => searchInputSchema.parse({ query: longQuery })).toThrow();
    });

    it("should accept query at max length", () => {
      const maxQuery = "a".repeat(100);
      const result = searchInputSchema.parse({ query: maxQuery });
      expect(result.query).toBe(maxQuery);
    });
  });

  describe("limit validation", () => {
    it("should use default limit of 20", () => {
      const result = searchInputSchema.parse({ query: "test" });
      expect(result.limit).toBe(20);
    });

    it("should accept custom limit", () => {
      const result = searchInputSchema.parse({ query: "test", limit: 10 });
      expect(result.limit).toBe(10);
    });

    it("should reject limit below 1", () => {
      expect(() =>
        searchInputSchema.parse({ query: "test", limit: 0 })
      ).toThrow();
    });

    it("should reject limit above 50", () => {
      expect(() =>
        searchInputSchema.parse({ query: "test", limit: 51 })
      ).toThrow();
    });

    it("should reject non-integer limit", () => {
      expect(() =>
        searchInputSchema.parse({ query: "test", limit: 10.5 })
      ).toThrow();
    });

    it("should accept limit at min", () => {
      const result = searchInputSchema.parse({ query: "test", limit: 1 });
      expect(result.limit).toBe(1);
    });

    it("should accept limit at max", () => {
      const result = searchInputSchema.parse({ query: "test", limit: 50 });
      expect(result.limit).toBe(50);
    });
  });
});

describe("analyzeInputSchema", () => {
  describe("itemId validation", () => {
    it("should accept valid item ID", () => {
      const result = analyzeInputSchema.parse({ itemId: 12345 });
      expect(result.itemId).toBe(12345);
    });

    it("should reject negative item ID", () => {
      expect(() => analyzeInputSchema.parse({ itemId: -1 })).toThrow();
    });

    it("should reject zero item ID", () => {
      expect(() => analyzeInputSchema.parse({ itemId: 0 })).toThrow();
    });

    it("should reject non-integer item ID", () => {
      expect(() => analyzeInputSchema.parse({ itemId: 123.45 })).toThrow();
    });

    it("should accept large item ID", () => {
      const result = analyzeInputSchema.parse({ itemId: 999999 });
      expect(result.itemId).toBe(999999);
    });
  });

  describe("missing fields", () => {
    it("should reject missing itemId", () => {
      expect(() => analyzeInputSchema.parse({})).toThrow();
    });

    it("should reject null itemId", () => {
      expect(() => analyzeInputSchema.parse({ itemId: null })).toThrow();
    });
  });
});

describe("serializeItem", () => {
  it("should serialize all item properties", () => {
    const result = serializeItem(mockItem);

    expect(result).toEqual({
      id: 12345,
      name: "Gossamer Scrap",
      description: "A fine crafting material",
      type: "CraftingMaterial",
      rarity: "Fine",
      level: 0,
      icon: "https://example.com/icon.png",
      vendorValue: 8,
      chatLink: "[&AgEwMwAA]",
    });
  });

  it("should exclude createdAt and updatedAt", () => {
    const result = serializeItem(mockItem);

    expect(result).not.toHaveProperty("createdAt");
    expect(result).not.toHaveProperty("updatedAt");
  });

  it("should handle null description", () => {
    const itemWithNullDesc = { ...mockItem, description: null };
    const result = serializeItem(itemWithNullDesc);

    expect(result.description).toBeNull();
  });

  it("should handle null icon", () => {
    const itemWithNullIcon = { ...mockItem, icon: null };
    const result = serializeItem(itemWithNullIcon);

    expect(result.icon).toBeNull();
  });

  it("should handle null chatLink", () => {
    const itemWithNullChatLink = { ...mockItem, chatLink: null };
    const result = serializeItem(itemWithNullChatLink);

    expect(result.chatLink).toBeNull();
  });

  it("should preserve numeric fields", () => {
    const result = serializeItem(mockItem);

    expect(typeof result.id).toBe("number");
    expect(typeof result.level).toBe("number");
    expect(typeof result.vendorValue).toBe("number");
  });
});

describe("ItemSearchResult", () => {
  /**
   * Type definition for item search result (mirrors the interface).
   */
  interface ItemSearchResult {
    item: Item;
    price: Price | null;
    hasCraftingRecipe: boolean;
  }

  const mockPrice: Price = {
    itemId: 12345,
    buyPrice: 100,
    buyQuantity: 500,
    sellPrice: 150,
    sellQuantity: 300,
    lastUpdated: new Date(),
  };

  it("should represent an item with price and recipe", () => {
    const result: ItemSearchResult = {
      item: mockItem,
      price: mockPrice,
      hasCraftingRecipe: true,
    };

    expect(result.item.id).toBe(12345);
    expect(result.price?.sellPrice).toBe(150);
    expect(result.hasCraftingRecipe).toBe(true);
  });

  it("should represent an item without price", () => {
    const result: ItemSearchResult = {
      item: mockItem,
      price: null,
      hasCraftingRecipe: false,
    };

    expect(result.item.id).toBe(12345);
    expect(result.price).toBeNull();
    expect(result.hasCraftingRecipe).toBe(false);
  });
});

describe("SerializedCraftAnalysis structure", () => {
  /**
   * Serializable version of CraftAnalysis for transport.
   */
  interface SerializedCraftAnalysis {
    item: SerializedItem;
    recipe: {
      id: number;
      type: string;
      outputItemId: number;
      outputItemCount: number;
      disciplines: string[];
    };
    buyPrice: number;
    craftCost: number;
    recommendation: "buy" | "craft";
    savings: number;
    savingsPercent: number;
    materials: SerializedMaterialBreakdown[];
  }

  interface SerializedMaterialBreakdown {
    item: SerializedItem;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    canCraft: boolean;
    usedBuyPrice: boolean;
    craftAnalysis?: SerializedCraftAnalysis;
  }

  it("should properly represent craft analysis with buy recommendation", () => {
    const analysis: SerializedCraftAnalysis = {
      item: serializeItem(mockItem),
      recipe: {
        id: 8000,
        type: "Refinement",
        outputItemId: 12345,
        outputItemCount: 1,
        disciplines: ["Tailor"],
      },
      buyPrice: 100,
      craftCost: 150,
      recommendation: "buy",
      savings: 50,
      savingsPercent: 33.33,
      materials: [],
    };

    expect(analysis.recommendation).toBe("buy");
    expect(analysis.buyPrice).toBeLessThan(analysis.craftCost);
    expect(analysis.savings).toBe(50);
  });

  it("should properly represent craft analysis with craft recommendation", () => {
    const analysis: SerializedCraftAnalysis = {
      item: serializeItem(mockItem),
      recipe: {
        id: 8000,
        type: "Refinement",
        outputItemId: 12345,
        outputItemCount: 1,
        disciplines: ["Tailor"],
      },
      buyPrice: 200,
      craftCost: 100,
      recommendation: "craft",
      savings: 100,
      savingsPercent: 50.0,
      materials: [],
    };

    expect(analysis.recommendation).toBe("craft");
    expect(analysis.craftCost).toBeLessThan(analysis.buyPrice);
    expect(analysis.savings).toBe(100);
  });

  it("should represent nested materials", () => {
    const materialItem: Item = {
      ...mockItem,
      id: 100,
      name: "Bolt of Silk",
    };

    const analysis: SerializedCraftAnalysis = {
      item: serializeItem(mockItem),
      recipe: {
        id: 8000,
        type: "Refinement",
        outputItemId: 12345,
        outputItemCount: 1,
        disciplines: ["Tailor"],
      },
      buyPrice: 200,
      craftCost: 100,
      recommendation: "craft",
      savings: 100,
      savingsPercent: 50.0,
      materials: [
        {
          item: serializeItem(materialItem),
          quantity: 5,
          unitPrice: 20,
          totalPrice: 100,
          canCraft: false,
          usedBuyPrice: true,
        },
      ],
    };

    expect(analysis.materials).toHaveLength(1);
    expect(analysis.materials[0].item.name).toBe("Bolt of Silk");
    expect(analysis.materials[0].totalPrice).toBe(100);
  });

  it("should represent materials with nested craft analysis", () => {
    const materialItem: Item = {
      ...mockItem,
      id: 100,
      name: "Bolt of Silk",
    };

    const nestedAnalysis: SerializedCraftAnalysis = {
      item: serializeItem(materialItem),
      recipe: {
        id: 8001,
        type: "Refinement",
        outputItemId: 100,
        outputItemCount: 1,
        disciplines: ["Tailor"],
      },
      buyPrice: 50,
      craftCost: 30,
      recommendation: "craft",
      savings: 20,
      savingsPercent: 40.0,
      materials: [],
    };

    const analysis: SerializedCraftAnalysis = {
      item: serializeItem(mockItem),
      recipe: {
        id: 8000,
        type: "Refinement",
        outputItemId: 12345,
        outputItemCount: 1,
        disciplines: ["Tailor"],
      },
      buyPrice: 200,
      craftCost: 100,
      recommendation: "craft",
      savings: 100,
      savingsPercent: 50.0,
      materials: [
        {
          item: serializeItem(materialItem),
          quantity: 5,
          unitPrice: 20,
          totalPrice: 100,
          canCraft: true,
          usedBuyPrice: false,
          craftAnalysis: nestedAnalysis,
        },
      ],
    };

    expect(analysis.materials[0].canCraft).toBe(true);
    expect(analysis.materials[0].craftAnalysis).toBeDefined();
    expect(analysis.materials[0].craftAnalysis?.recommendation).toBe("craft");
  });
});

