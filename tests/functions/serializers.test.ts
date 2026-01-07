/**
 * @fileoverview Unit tests for the serialization utilities.
 *
 * Tests the serializeItem and serializeCraftAnalysis functions
 * to ensure proper conversion of database entities to JSON-safe formats.
 *
 * @module tests/functions/serializers.test
 */

import { describe, it, expect } from "vitest";
import {
  serializeItem,
  serializeCraftAnalysis,
  type SerializedItem,
  type SerializedCraftAnalysis,
} from "../../server/functions/serializers";
import type { Item, Recipe } from "../../server/db/schema";
import type { CraftAnalysis, MaterialBreakdown } from "../../server/services/craft-calculator.service";

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
  icon: "https://render.guildwars2.com/file/icon.png",
  vendorValue: 8,
  chatLink: "[&AgEwMwAA]",
  createdAt: new Date("2024-01-01T00:00:00Z"),
  updatedAt: new Date("2024-01-02T00:00:00Z"),
};

/**
 * Mock recipe for testing.
 */
const mockRecipe: Recipe = {
  id: 8000,
  type: "Refinement",
  outputItemId: 12345,
  outputItemCount: 1,
  timeToCraftMs: 0,
  disciplines: ["Tailor", "Armorsmith"],
  minRating: 400,
  flags: [],
  ingredients: [{ itemId: 100, count: 5 }],
  guildIngredients: [],
  chatLink: "[&CQAAAA==]",
  createdAt: new Date("2024-01-01T00:00:00Z"),
  updatedAt: new Date("2024-01-02T00:00:00Z"),
};

/**
 * Mock material item for testing.
 */
const mockMaterialItem: Item = {
  id: 100,
  name: "Bolt of Silk",
  description: "A piece of silk fabric",
  type: "CraftingMaterial",
  rarity: "Fine",
  level: 0,
  icon: "https://render.guildwars2.com/file/silk.png",
  vendorValue: 4,
  chatLink: "[&AgFkAAA=]",
  createdAt: new Date("2024-01-01T00:00:00Z"),
  updatedAt: new Date("2024-01-02T00:00:00Z"),
};

describe("serializeItem", () => {
  it("should serialize all required fields", () => {
    const result = serializeItem(mockItem);

    expect(result).toEqual({
      id: 12345,
      name: "Gossamer Scrap",
      description: "A fine crafting material",
      type: "CraftingMaterial",
      rarity: "Fine",
      level: 0,
      icon: "https://render.guildwars2.com/file/icon.png",
      vendorValue: 8,
      chatLink: "[&AgEwMwAA]",
    });
  });

  it("should exclude createdAt field", () => {
    const result = serializeItem(mockItem);

    expect(result).not.toHaveProperty("createdAt");
  });

  it("should exclude updatedAt field", () => {
    const result = serializeItem(mockItem);

    expect(result).not.toHaveProperty("updatedAt");
  });

  it("should handle null description", () => {
    const itemWithNullDesc: Item = { ...mockItem, description: null };
    const result = serializeItem(itemWithNullDesc);

    expect(result.description).toBeNull();
  });

  it("should handle null icon", () => {
    const itemWithNullIcon: Item = { ...mockItem, icon: null };
    const result = serializeItem(itemWithNullIcon);

    expect(result.icon).toBeNull();
  });

  it("should handle null chatLink", () => {
    const itemWithNullChatLink: Item = { ...mockItem, chatLink: null };
    const result = serializeItem(itemWithNullChatLink);

    expect(result.chatLink).toBeNull();
  });

  it("should preserve numeric fields as numbers", () => {
    const result = serializeItem(mockItem);

    expect(typeof result.id).toBe("number");
    expect(typeof result.level).toBe("number");
    expect(typeof result.vendorValue).toBe("number");
  });

  it("should preserve string fields as strings", () => {
    const result = serializeItem(mockItem);

    expect(typeof result.name).toBe("string");
    expect(typeof result.type).toBe("string");
    expect(typeof result.rarity).toBe("string");
  });
});

describe("serializeCraftAnalysis", () => {
  /**
   * Creates a mock CraftAnalysis for testing.
   */
  function createMockAnalysis(
    overrides: Partial<CraftAnalysis> = {}
  ): CraftAnalysis {
    return {
      item: mockItem,
      recipe: mockRecipe,
      buyPrice: 200,
      craftCost: 100,
      recommendation: "craft",
      savings: 100,
      savingsPercent: 50.0,
      materials: [],
      ...overrides,
    };
  }

  it("should serialize item correctly", () => {
    const analysis = createMockAnalysis();
    const result = serializeCraftAnalysis(analysis);

    expect(result.item).toEqual(serializeItem(mockItem));
  });

  it("should serialize recipe fields correctly", () => {
    const analysis = createMockAnalysis();
    const result = serializeCraftAnalysis(analysis);

    expect(result.recipe).toEqual({
      id: 8000,
      type: "Refinement",
      outputItemId: 12345,
      outputItemCount: 1,
      disciplines: ["Tailor", "Armorsmith"],
    });
  });

  it("should serialize price and cost fields", () => {
    const analysis = createMockAnalysis();
    const result = serializeCraftAnalysis(analysis);

    expect(result.buyPrice).toBe(200);
    expect(result.craftCost).toBe(100);
    expect(result.savings).toBe(100);
    expect(result.savingsPercent).toBe(50.0);
  });

  it("should serialize craft recommendation", () => {
    const craftAnalysis = createMockAnalysis({ recommendation: "craft" });
    const buyAnalysis = createMockAnalysis({ recommendation: "buy" });

    expect(serializeCraftAnalysis(craftAnalysis).recommendation).toBe("craft");
    expect(serializeCraftAnalysis(buyAnalysis).recommendation).toBe("buy");
  });

  it("should serialize empty materials array", () => {
    const analysis = createMockAnalysis({ materials: [] });
    const result = serializeCraftAnalysis(analysis);

    expect(result.materials).toEqual([]);
  });

  it("should serialize materials without nested craft analysis", () => {
    const material: MaterialBreakdown = {
      item: mockMaterialItem,
      quantity: 5,
      unitPrice: 20,
      totalPrice: 100,
      canCraft: false,
      usedBuyPrice: true,
    };

    const analysis = createMockAnalysis({ materials: [material] });
    const result = serializeCraftAnalysis(analysis);

    expect(result.materials).toHaveLength(1);
    expect(result.materials[0]).toEqual({
      item: serializeItem(mockMaterialItem),
      quantity: 5,
      unitPrice: 20,
      totalPrice: 100,
      canCraft: false,
      usedBuyPrice: true,
      craftAnalysis: undefined,
    });
  });

  it("should serialize materials with nested craft analysis", () => {
    const nestedAnalysis: CraftAnalysis = {
      item: mockMaterialItem,
      recipe: { ...mockRecipe, id: 8001, outputItemId: 100 },
      buyPrice: 50,
      craftCost: 30,
      recommendation: "craft",
      savings: 20,
      savingsPercent: 40.0,
      materials: [],
    };

    const material: MaterialBreakdown = {
      item: mockMaterialItem,
      quantity: 5,
      unitPrice: 6, // Using craft price
      totalPrice: 30,
      canCraft: true,
      usedBuyPrice: false,
      craftAnalysis: nestedAnalysis,
    };

    const analysis = createMockAnalysis({ materials: [material] });
    const result = serializeCraftAnalysis(analysis);

    expect(result.materials[0].canCraft).toBe(true);
    expect(result.materials[0].usedBuyPrice).toBe(false);
    expect(result.materials[0].craftAnalysis).toBeDefined();
    expect(result.materials[0].craftAnalysis?.item.id).toBe(100);
    expect(result.materials[0].craftAnalysis?.recommendation).toBe("craft");
  });

  it("should handle deeply nested craft analyses", () => {
    // Level 3: Raw material (no further crafting)
    const rawMaterial: MaterialBreakdown = {
      item: { ...mockMaterialItem, id: 200, name: "Raw Silk" },
      quantity: 3,
      unitPrice: 5,
      totalPrice: 15,
      canCraft: false,
      usedBuyPrice: true,
    };

    // Level 2: Intermediate material
    const level2Analysis: CraftAnalysis = {
      item: { ...mockMaterialItem, id: 150, name: "Silk Thread" },
      recipe: { ...mockRecipe, id: 8002, outputItemId: 150 },
      buyPrice: 25,
      craftCost: 15,
      recommendation: "craft",
      savings: 10,
      savingsPercent: 40.0,
      materials: [rawMaterial],
    };

    const level2Material: MaterialBreakdown = {
      item: { ...mockMaterialItem, id: 150, name: "Silk Thread" },
      quantity: 2,
      unitPrice: 7.5,
      totalPrice: 15,
      canCraft: true,
      usedBuyPrice: false,
      craftAnalysis: level2Analysis,
    };

    // Level 1: Top-level analysis
    const topAnalysis = createMockAnalysis({ materials: [level2Material] });
    const result = serializeCraftAnalysis(topAnalysis);

    // Verify nested structure
    expect(result.materials[0].craftAnalysis).toBeDefined();
    expect(result.materials[0].craftAnalysis?.materials[0].item.name).toBe(
      "Raw Silk"
    );
    expect(result.materials[0].craftAnalysis?.materials[0].canCraft).toBe(false);
  });

  it("should serialize multiple materials", () => {
    const material1: MaterialBreakdown = {
      item: mockMaterialItem,
      quantity: 5,
      unitPrice: 20,
      totalPrice: 100,
      canCraft: false,
      usedBuyPrice: true,
    };

    const material2: MaterialBreakdown = {
      item: { ...mockMaterialItem, id: 101, name: "Thread" },
      quantity: 10,
      unitPrice: 5,
      totalPrice: 50,
      canCraft: false,
      usedBuyPrice: true,
    };

    const analysis = createMockAnalysis({ materials: [material1, material2] });
    const result = serializeCraftAnalysis(analysis);

    expect(result.materials).toHaveLength(2);
    expect(result.materials[0].item.name).toBe("Bolt of Silk");
    expect(result.materials[1].item.name).toBe("Thread");
  });

  it("should exclude recipe database metadata", () => {
    const analysis = createMockAnalysis();
    const result = serializeCraftAnalysis(analysis);

    expect(result.recipe).not.toHaveProperty("createdAt");
    expect(result.recipe).not.toHaveProperty("updatedAt");
    expect(result.recipe).not.toHaveProperty("timeToCraftMs");
    expect(result.recipe).not.toHaveProperty("minRating");
    expect(result.recipe).not.toHaveProperty("flags");
    expect(result.recipe).not.toHaveProperty("ingredients");
    expect(result.recipe).not.toHaveProperty("guildIngredients");
    expect(result.recipe).not.toHaveProperty("chatLink");
  });

  it("should return a JSON-serializable object", () => {
    const material: MaterialBreakdown = {
      item: mockMaterialItem,
      quantity: 5,
      unitPrice: 20,
      totalPrice: 100,
      canCraft: true,
      usedBuyPrice: false,
      craftAnalysis: createMockAnalysis({ item: mockMaterialItem }),
    };

    const analysis = createMockAnalysis({ materials: [material] });
    const result = serializeCraftAnalysis(analysis);

    // Should not throw when serializing to JSON
    expect(() => JSON.stringify(result)).not.toThrow();

    // Should round-trip through JSON correctly
    const roundTripped = JSON.parse(JSON.stringify(result));
    expect(roundTripped.item.id).toBe(result.item.id);
    expect(roundTripped.materials[0].craftAnalysis.item.id).toBe(
      result.materials[0].craftAnalysis?.item.id
    );
  });
});

