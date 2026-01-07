/**
 * @fileoverview Unit tests for the Craft Calculator Service.
 *
 * These tests verify the core business logic of the craft cost calculator,
 * including buy vs. craft recommendations, recursive recipe analysis,
 * and handling of edge cases. Written following TDD methodology.
 *
 * @module tests/services/craft-calculator.test
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  CraftCalculatorService,
  type CraftAnalysis,
  type MaterialBreakdown,
} from "../../server/services/craft-calculator.service";
import type { Item, Recipe, Price } from "../../server/db/schema";

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
 * Mock data repository for testing.
 */
interface MockDataRepository {
  items: Map<number, Item>;
  recipes: Map<number, Recipe>;
  recipesByOutput: Map<number, Recipe[]>;
  prices: Map<number, Price>;
}

/**
 * Creates a mock data access object for testing.
 */
function createMockDataAccess(data: MockDataRepository) {
  return {
    getItem: vi.fn(async (id: number) => data.items.get(id) ?? null),
    getRecipesByOutputItem: vi.fn(
      async (itemId: number) => data.recipesByOutput.get(itemId) ?? []
    ),
    getPrice: vi.fn(async (itemId: number) => data.prices.get(itemId) ?? null),
  };
}

describe("CraftCalculatorService", () => {
  let calculator: CraftCalculatorService;
  let mockData: MockDataRepository;
  let mockDataAccess: ReturnType<typeof createMockDataAccess>;

  beforeEach(() => {
    mockData = {
      items: new Map(),
      recipes: new Map(),
      recipesByOutput: new Map(),
      prices: new Map(),
    };
    mockDataAccess = createMockDataAccess(mockData);
    calculator = new CraftCalculatorService(mockDataAccess);
  });

  describe("analyze", () => {
    describe("buy vs craft recommendations", () => {
      it("recommends buying when market price is lower than craft cost", async () => {
        // Setup: Item costs 100c to buy, materials cost 150c total
        const outputItem = createMockItem({ id: 1, name: "Bolt of Silk" });
        const materialItem = createMockItem({ id: 2, name: "Silk Scrap" });

        const recipe = createMockRecipe({
          id: 100,
          outputItemId: 1,
          outputItemCount: 1,
          ingredients: [{ itemId: 2, count: 3 }], // 3 scraps needed
        });

        mockData.items.set(1, outputItem);
        mockData.items.set(2, materialItem);
        mockData.recipes.set(100, recipe);
        mockData.recipesByOutput.set(1, [recipe]);
        mockData.prices.set(1, createMockPrice({ itemId: 1, sellPrice: 100 })); // Buy for 100c
        mockData.prices.set(2, createMockPrice({ itemId: 2, sellPrice: 50 })); // 50c each = 150c total

        const result = await calculator.analyze(1);

        expect(result).not.toBeNull();
        expect(result!.recommendation).toBe("buy");
        expect(result!.buyPrice).toBe(100);
        expect(result!.craftCost).toBe(150);
        expect(result!.savings).toBe(50);
        expect(result!.savingsPercent).toBeCloseTo(33.33, 1);
      });

      it("recommends crafting when cheaper than buying", async () => {
        // Setup: Item costs 200c to buy, materials cost 120c
        const outputItem = createMockItem({ id: 1, name: "Bolt of Gossamer" });
        const materialItem = createMockItem({ id: 2, name: "Gossamer Scrap" });

        const recipe = createMockRecipe({
          id: 100,
          outputItemId: 1,
          outputItemCount: 1,
          ingredients: [{ itemId: 2, count: 2 }], // 2 scraps needed
        });

        mockData.items.set(1, outputItem);
        mockData.items.set(2, materialItem);
        mockData.recipes.set(100, recipe);
        mockData.recipesByOutput.set(1, [recipe]);
        mockData.prices.set(1, createMockPrice({ itemId: 1, sellPrice: 200 }));
        mockData.prices.set(2, createMockPrice({ itemId: 2, sellPrice: 60 })); // 60c each = 120c total

        const result = await calculator.analyze(1);

        expect(result).not.toBeNull();
        expect(result!.recommendation).toBe("craft");
        expect(result!.buyPrice).toBe(200);
        expect(result!.craftCost).toBe(120);
        expect(result!.savings).toBe(80);
        expect(result!.savingsPercent).toBe(40);
      });

      it("accounts for output count when calculating craft cost", async () => {
        // Recipe produces 2 items, so effective cost per item is halved
        const outputItem = createMockItem({ id: 1, name: "Bronze Ingot" });
        const materialItem = createMockItem({ id: 2, name: "Copper Ore" });

        const recipe = createMockRecipe({
          id: 100,
          outputItemId: 1,
          outputItemCount: 2, // Produces 2 ingots
          ingredients: [{ itemId: 2, count: 2 }],
        });

        mockData.items.set(1, outputItem);
        mockData.items.set(2, materialItem);
        mockData.recipesByOutput.set(1, [recipe]);
        mockData.prices.set(1, createMockPrice({ itemId: 1, sellPrice: 100 }));
        mockData.prices.set(2, createMockPrice({ itemId: 2, sellPrice: 50 })); // 100c total / 2 = 50c per item

        const result = await calculator.analyze(1);

        expect(result).not.toBeNull();
        expect(result!.craftCost).toBe(50); // 100c materials / 2 output = 50c per item
        expect(result!.recommendation).toBe("craft");
      });
    });

    describe("recursive recipe analysis", () => {
      it("handles recursive recipes correctly", async () => {
        // Setup: Item A requires Item B, which requires Item C
        // A -> B (x2) -> C (x3 each)
        const itemA = createMockItem({ id: 1, name: "Final Product" });
        const itemB = createMockItem({ id: 2, name: "Intermediate" });
        const itemC = createMockItem({ id: 3, name: "Raw Material" });

        const recipeA = createMockRecipe({
          id: 100,
          outputItemId: 1,
          outputItemCount: 1,
          ingredients: [{ itemId: 2, count: 2 }],
        });

        const recipeB = createMockRecipe({
          id: 101,
          outputItemId: 2,
          outputItemCount: 1,
          ingredients: [{ itemId: 3, count: 3 }],
        });

        mockData.items.set(1, itemA);
        mockData.items.set(2, itemB);
        mockData.items.set(3, itemC);
        mockData.recipesByOutput.set(1, [recipeA]);
        mockData.recipesByOutput.set(2, [recipeB]);
        // No recipe for C - it's a raw material

        mockData.prices.set(1, createMockPrice({ itemId: 1, sellPrice: 1000 }));
        mockData.prices.set(2, createMockPrice({ itemId: 2, sellPrice: 200 })); // Buy B for 200c
        mockData.prices.set(3, createMockPrice({ itemId: 3, sellPrice: 10 })); // 10c each

        const result = await calculator.analyze(1);

        expect(result).not.toBeNull();
        // Crafting B costs 30c (3 * 10c), buying B costs 200c
        // So craft B for 30c each, need 2 = 60c total for A
        expect(result!.craftCost).toBe(60);
        expect(result!.recommendation).toBe("craft");

        // Check material breakdown shows nested structure
        expect(result!.materials).toHaveLength(1);
        expect(result!.materials[0].item.id).toBe(2);
        expect(result!.materials[0].canCraft).toBe(true);
        expect(result!.materials[0].craftAnalysis).toBeDefined();
      });

      it("uses buy price when sub-material is cheaper to buy than craft", async () => {
        // Setup: Intermediate is cheaper to buy than craft
        const itemA = createMockItem({ id: 1, name: "Final Product" });
        const itemB = createMockItem({ id: 2, name: "Intermediate" });
        const itemC = createMockItem({ id: 3, name: "Raw Material" });

        const recipeA = createMockRecipe({
          id: 100,
          outputItemId: 1,
          outputItemCount: 1,
          ingredients: [{ itemId: 2, count: 2 }],
        });

        const recipeB = createMockRecipe({
          id: 101,
          outputItemId: 2,
          outputItemCount: 1,
          ingredients: [{ itemId: 3, count: 3 }],
        });

        mockData.items.set(1, itemA);
        mockData.items.set(2, itemB);
        mockData.items.set(3, itemC);
        mockData.recipesByOutput.set(1, [recipeA]);
        mockData.recipesByOutput.set(2, [recipeB]);

        mockData.prices.set(1, createMockPrice({ itemId: 1, sellPrice: 500 }));
        mockData.prices.set(2, createMockPrice({ itemId: 2, sellPrice: 50 })); // Buy B for 50c
        mockData.prices.set(3, createMockPrice({ itemId: 3, sellPrice: 100 })); // 100c each, craft cost = 300c

        const result = await calculator.analyze(1);

        expect(result).not.toBeNull();
        // B is cheaper to buy (50c) than craft (300c)
        // So total craft cost for A = 2 * 50c = 100c
        expect(result!.craftCost).toBe(100);
        expect(result!.materials[0].usedBuyPrice).toBe(true);
      });

      it("prevents infinite recursion with circular recipes", async () => {
        // Edge case: A requires B, B requires A (shouldn't happen in GW2, but defensive)
        const itemA = createMockItem({ id: 1, name: "Item A" });
        const itemB = createMockItem({ id: 2, name: "Item B" });

        const recipeA = createMockRecipe({
          id: 100,
          outputItemId: 1,
          ingredients: [{ itemId: 2, count: 1 }],
        });

        const recipeB = createMockRecipe({
          id: 101,
          outputItemId: 2,
          ingredients: [{ itemId: 1, count: 1 }],
        });

        mockData.items.set(1, itemA);
        mockData.items.set(2, itemB);
        mockData.recipesByOutput.set(1, [recipeA]);
        mockData.recipesByOutput.set(2, [recipeB]);

        mockData.prices.set(1, createMockPrice({ itemId: 1, sellPrice: 100 }));
        mockData.prices.set(2, createMockPrice({ itemId: 2, sellPrice: 100 }));

        // Should not hang or throw
        const result = await calculator.analyze(1);

        // Should fall back to buy price when recursion detected
        expect(result).not.toBeNull();
      });
    });

    describe("edge cases", () => {
      it("returns null for items without recipes", async () => {
        const item = createMockItem({ id: 1, name: "Raw Material" });
        mockData.items.set(1, item);
        mockData.recipesByOutput.set(1, []); // No recipes
        mockData.prices.set(1, createMockPrice({ itemId: 1, sellPrice: 100 }));

        const result = await calculator.analyze(1);

        expect(result).toBeNull();
      });

      it("returns null for non-existent items", async () => {
        const result = await calculator.analyze(99999);

        expect(result).toBeNull();
      });

      it("handles items with no trading post listing", async () => {
        const outputItem = createMockItem({ id: 1, name: "Account Bound Item" });
        const materialItem = createMockItem({ id: 2, name: "Material" });

        const recipe = createMockRecipe({
          id: 100,
          outputItemId: 1,
          ingredients: [{ itemId: 2, count: 1 }],
        });

        mockData.items.set(1, outputItem);
        mockData.items.set(2, materialItem);
        mockData.recipesByOutput.set(1, [recipe]);
        // No price for item 1 (account bound)
        mockData.prices.set(2, createMockPrice({ itemId: 2, sellPrice: 50 }));

        const result = await calculator.analyze(1);

        // Should still calculate craft cost even if item can't be bought
        expect(result).not.toBeNull();
        expect(result!.buyPrice).toBe(0); // No buy option
        expect(result!.craftCost).toBe(50);
        expect(result!.recommendation).toBe("craft"); // Only option
      });

      it("handles materials with no trading post listing", async () => {
        const outputItem = createMockItem({ id: 1, name: "Craftable" });
        const boundMaterial = createMockItem({ id: 2, name: "Bound Material" });

        const recipe = createMockRecipe({
          id: 100,
          outputItemId: 1,
          ingredients: [{ itemId: 2, count: 1 }],
        });

        mockData.items.set(1, outputItem);
        mockData.items.set(2, boundMaterial);
        mockData.recipesByOutput.set(1, [recipe]);
        mockData.prices.set(1, createMockPrice({ itemId: 1, sellPrice: 100 }));
        // No price for material 2

        const result = await calculator.analyze(1);

        // Can't calculate craft cost without material prices
        // Should return result with craftable = false or high craft cost
        expect(result).not.toBeNull();
        expect(result!.materials[0].unitPrice).toBe(0);
      });

      it("selects the cheapest recipe when multiple exist", async () => {
        const outputItem = createMockItem({ id: 1, name: "Multi-Recipe Item" });
        const material1 = createMockItem({ id: 2, name: "Expensive Material" });
        const material2 = createMockItem({ id: 3, name: "Cheap Material" });

        const expensiveRecipe = createMockRecipe({
          id: 100,
          outputItemId: 1,
          ingredients: [{ itemId: 2, count: 2 }],
        });

        const cheapRecipe = createMockRecipe({
          id: 101,
          outputItemId: 1,
          ingredients: [{ itemId: 3, count: 2 }],
        });

        mockData.items.set(1, outputItem);
        mockData.items.set(2, material1);
        mockData.items.set(3, material2);
        mockData.recipesByOutput.set(1, [expensiveRecipe, cheapRecipe]);

        mockData.prices.set(1, createMockPrice({ itemId: 1, sellPrice: 200 }));
        mockData.prices.set(2, createMockPrice({ itemId: 2, sellPrice: 100 })); // 200c total
        mockData.prices.set(3, createMockPrice({ itemId: 3, sellPrice: 30 })); // 60c total

        const result = await calculator.analyze(1);

        expect(result).not.toBeNull();
        expect(result!.craftCost).toBe(60); // Should use cheaper recipe
        expect(result!.recipe.id).toBe(101);
      });
    });

    describe("material breakdown", () => {
      it("includes complete material breakdown in result", async () => {
        const outputItem = createMockItem({ id: 1, name: "Armor Piece" });
        const mat1 = createMockItem({ id: 2, name: "Metal Ingot" });
        const mat2 = createMockItem({ id: 3, name: "Leather Square" });

        const recipe = createMockRecipe({
          id: 100,
          outputItemId: 1,
          ingredients: [
            { itemId: 2, count: 5 },
            { itemId: 3, count: 3 },
          ],
        });

        mockData.items.set(1, outputItem);
        mockData.items.set(2, mat1);
        mockData.items.set(3, mat2);
        mockData.recipesByOutput.set(1, [recipe]);

        mockData.prices.set(1, createMockPrice({ itemId: 1, sellPrice: 500 }));
        mockData.prices.set(2, createMockPrice({ itemId: 2, sellPrice: 40 }));
        mockData.prices.set(3, createMockPrice({ itemId: 3, sellPrice: 60 }));

        const result = await calculator.analyze(1);

        expect(result).not.toBeNull();
        expect(result!.materials).toHaveLength(2);

        const metalBreakdown = result!.materials.find((m) => m.item.id === 2);
        expect(metalBreakdown).toBeDefined();
        expect(metalBreakdown!.quantity).toBe(5);
        expect(metalBreakdown!.unitPrice).toBe(40);
        expect(metalBreakdown!.totalPrice).toBe(200);

        const leatherBreakdown = result!.materials.find((m) => m.item.id === 3);
        expect(leatherBreakdown).toBeDefined();
        expect(leatherBreakdown!.quantity).toBe(3);
        expect(leatherBreakdown!.unitPrice).toBe(60);
        expect(leatherBreakdown!.totalPrice).toBe(180);
      });
    });
  });

  describe("calculateFlattenedMaterials", () => {
    it("flattens nested materials into a single list", async () => {
      // A requires B (x2), B requires C (x3 each) -> A needs 6 C total
      const itemA = createMockItem({ id: 1, name: "Final" });
      const itemB = createMockItem({ id: 2, name: "Intermediate" });
      const itemC = createMockItem({ id: 3, name: "Raw" });

      const recipeA = createMockRecipe({
        id: 100,
        outputItemId: 1,
        ingredients: [{ itemId: 2, count: 2 }],
      });

      const recipeB = createMockRecipe({
        id: 101,
        outputItemId: 2,
        ingredients: [{ itemId: 3, count: 3 }],
      });

      mockData.items.set(1, itemA);
      mockData.items.set(2, itemB);
      mockData.items.set(3, itemC);
      mockData.recipesByOutput.set(1, [recipeA]);
      mockData.recipesByOutput.set(2, [recipeB]);

      mockData.prices.set(1, createMockPrice({ itemId: 1, sellPrice: 1000 }));
      mockData.prices.set(2, createMockPrice({ itemId: 2, sellPrice: 500 }));
      mockData.prices.set(3, createMockPrice({ itemId: 3, sellPrice: 10 }));

      const flattened = await calculator.calculateFlattenedMaterials(1);

      expect(flattened).not.toBeNull();
      // Should show 6 of item C needed (2 B * 3 C each)
      const rawMaterial = flattened!.find((m) => m.item.id === 3);
      expect(rawMaterial).toBeDefined();
      expect(rawMaterial!.quantity).toBe(6);
    });
  });
});

