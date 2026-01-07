/**
 * @fileoverview Server functions for craft analysis and item search.
 *
 * This module exports TanStack Start server functions that provide the API
 * for the craft calculator frontend. These functions are called from React
 * components and execute on the server with direct database access.
 *
 * @module server/functions/craft-analysis
 *
 * @example
 * ```typescript
 * // In a React component
 * import { searchItems, analyzeCraftCost } from '../../server/functions/craft-analysis';
 *
 * // Search for items
 * const results = await searchItems({ data: { query: "gossamer" } });
 *
 * // Analyze an item
 * const analysis = await analyzeCraftCost({ data: { itemId: 12345 } });
 * ```
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "../db";
import { createExtendedDataAccess, createQuantityAwareDataAccess } from "../services/data-access";
import { CraftCalculatorService, type QuantityAwareCraftAnalysis, type OptimalQuantityResult } from "../services/craft-calculator.service";
import type { Item, Price } from "../db/schema";
import {
  serializeItem,
  serializeCraftAnalysis,
  type SerializedItem,
  type SerializedCraftAnalysis,
} from "./serializers";

/**
 * Schema for item search input validation.
 */
const searchInputSchema = z.object({
  query: z.string().min(1).max(100),
  limit: z.number().int().min(1).max(50).optional().default(20),
});

/**
 * Schema for craft analysis input validation.
 */
const analyzeInputSchema = z.object({
  itemId: z.number().int().positive(),
});

/**
 * Schema for quantity-aware analysis input validation.
 */
const quantityAnalyzeInputSchema = z.object({
  itemId: z.number().int().positive(),
  quantity: z.number().int().positive().max(10000),
});

/**
 * Schema for optimal quantity analysis input validation.
 */
const optimalQuantityInputSchema = z.object({
  itemId: z.number().int().positive(),
  maxQuantity: z.number().int().positive().max(10000).optional().default(1000),
});

/**
 * Result type for item search.
 */
export interface ItemSearchResult {
  item: Item;
  price: Price | null;
  hasCraftingRecipe: boolean;
}

// Re-export serializer types for consumers
export type { SerializedItem, SerializedCraftAnalysis };

/**
 * Server function to search for items by name.
 *
 * Performs a case-insensitive search on item names and returns matching
 * items along with their current trading post prices and whether they
 * have a crafting recipe.
 *
 * @param data.query - Search query string
 * @param data.limit - Maximum results to return (default 20)
 * @returns Array of matching items with prices and recipe info
 */
export const searchItems = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => {
    return searchInputSchema.parse(input);
  })
  .handler(async ({ data }): Promise<ItemSearchResult[]> => {
    const dataAccess = createExtendedDataAccess(db);

    const results = await dataAccess.searchItems(data.query, data.limit);

    // Check which items have recipes
    const itemsWithRecipeInfo = await Promise.all(
      results.map(async ({ item, price }) => {
        const recipes = await dataAccess.getRecipesByOutputItem(item.id);
        return {
          item,
          price,
          hasCraftingRecipe: recipes.length > 0,
        };
      })
    );

    return itemsWithRecipeInfo;
  });

/**
 * Server function to analyze craft cost for an item.
 *
 * Performs a recursive analysis of the item's crafting recipe(s) to
 * determine whether it's cheaper to buy the item directly or craft it
 * from materials. Handles nested recipes automatically.
 *
 * @param data.itemId - The item ID to analyze
 * @returns CraftAnalysis result or null if item can't be crafted
 */
export const analyzeCraftCost = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => {
    return analyzeInputSchema.parse(input);
  })
  .handler(async ({ data }): Promise<SerializedCraftAnalysis | null> => {
    const dataAccess = createExtendedDataAccess(db);
    const calculator = new CraftCalculatorService(dataAccess);

    const analysis = await calculator.analyze(data.itemId);

    if (!analysis) {
      return null;
    }

    return serializeCraftAnalysis(analysis);
  });

/**
 * Server function to get an item by ID with its price.
 *
 * @param data.itemId - The item ID to fetch
 * @returns Item with price or null if not found
 */
export const getItemWithPrice = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => {
    return analyzeInputSchema.parse(input);
  })
  .handler(
    async ({ data }): Promise<{ item: Item; price: Price | null } | null> => {
      const dataAccess = createExtendedDataAccess(db);

      const item = await dataAccess.getItem(data.itemId);
      if (!item) {
        return null;
      }

      const price = await dataAccess.getPrice(data.itemId);

      return { item, price };
    }
  );

/**
 * Server function to get flattened material list for an item.
 *
 * Returns a flat list of all raw materials needed to craft an item,
 * with quantities aggregated across all nested recipes.
 *
 * @param data.itemId - The item ID to analyze
 * @returns Array of flattened materials or null if item can't be crafted
 */
export const getFlattenedMaterials = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => {
    return analyzeInputSchema.parse(input);
  })
  .handler(
    async ({
      data,
    }): Promise<Array<{
      item: SerializedItem;
      quantity: number;
      unitPrice: number;
      totalCost: number;
    }> | null> => {
      const dataAccess = createExtendedDataAccess(db);
      const calculator = new CraftCalculatorService(dataAccess);

      const materials = await calculator.calculateFlattenedMaterials(
        data.itemId
      );

      if (!materials) {
        return null;
      }

      return materials.map((m) => ({
        item: serializeItem(m.item),
        quantity: m.quantity,
        unitPrice: m.unitPrice,
        totalCost: m.totalCost,
      }));
    }
  );

/**
 * Serialized quantity-aware craft analysis for JSON transport.
 *
 * @interface SerializedQuantityAnalysis
 */
export interface SerializedQuantityAnalysis {
  item: SerializedItem;
  quantity: number;
  canCraft: boolean;
  recipe?: {
    id: number;
    type: string;
    outputItemCount: number;
  };
  totalBuyCost: number;
  averageBuyPrice: number;
  totalCraftCost: number;
  averageCraftCost: number;
  recommendation: "buy" | "craft";
  savings: number;
  savingsPercent: number;
  buyPriceImpact: number;
  supplyAvailable: number;
  supplyShortfall: number;
  canFillOrder: boolean;
  materialBreakdown?: Array<{
    item: SerializedItem;
    quantity: number;
    unitCost: number;
    totalCost: number;
    decision: "buy" | "craft";
  }>;
}

/**
 * Serializes a quantity-aware craft analysis for JSON transport.
 *
 * @param analysis - Analysis to serialize
 * @returns Serialized analysis
 */
function serializeQuantityAnalysis(
  analysis: QuantityAwareCraftAnalysis
): SerializedQuantityAnalysis {
  return {
    item: serializeItem(analysis.item),
    quantity: analysis.quantity,
    canCraft: analysis.canCraft,
    recipe: analysis.recipe
      ? {
          id: analysis.recipe.id,
          type: analysis.recipe.type,
          outputItemCount: analysis.recipe.outputItemCount,
        }
      : undefined,
    totalBuyCost: analysis.totalBuyCost,
    averageBuyPrice: analysis.averageBuyPrice,
    totalCraftCost: analysis.totalCraftCost,
    averageCraftCost: analysis.averageCraftCost,
    recommendation: analysis.recommendation,
    savings: analysis.savings,
    savingsPercent: analysis.savingsPercent,
    buyPriceImpact: analysis.buyPriceImpact,
    supplyAvailable: analysis.supplyAvailable,
    supplyShortfall: analysis.supplyShortfall,
    canFillOrder: analysis.canFillOrder,
    materialBreakdown: analysis.materialBreakdown?.map((m) => ({
      item: serializeItem(m.item),
      quantity: m.quantity,
      unitCost: m.unitCost,
      totalCost: m.totalCost,
      decision: m.decision,
    })),
  };
}

/**
 * Server function to analyze craft cost for a specific quantity.
 *
 * Performs quantity-aware analysis that considers order book depth
 * to determine the true cost of buying vs. crafting in bulk.
 *
 * @param data.itemId - The item ID to analyze
 * @param data.quantity - Number of items to analyze
 * @returns QuantityAwareCraftAnalysis result or null if item not found
 *
 * @example
 * ```typescript
 * // In a React component
 * const analysis = await analyzeForQuantity({ data: { itemId: 12345, quantity: 100 } });
 * if (analysis) {
 *   console.log(`Buying 100 costs ${analysis.totalBuyCost}c`);
 *   console.log(`Crafting 100 costs ${analysis.totalCraftCost}c`);
 *   console.log(`Price impact from bulk: +${analysis.buyPriceImpact.toFixed(1)}%`);
 * }
 * ```
 */
export const analyzeForQuantity = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => {
    return quantityAnalyzeInputSchema.parse(input);
  })
  .handler(async ({ data }): Promise<SerializedQuantityAnalysis | null> => {
    const dataAccess = createQuantityAwareDataAccess(db);
    const calculator = new CraftCalculatorService(dataAccess);

    const analysis = await calculator.analyzeForQuantity(data.itemId, data.quantity);

    if (!analysis) {
      return null;
    }

    return serializeQuantityAnalysis(analysis);
  });

/**
 * Serialized optimal quantity result for JSON transport.
 *
 * @interface SerializedOptimalQuantity
 */
export interface SerializedOptimalQuantity {
  item: SerializedItem;
  craftBetterAt: number;
  hasCrossover: boolean;
  baseBuyPrice: number;
  baseCraftCost: number;
}

/**
 * Server function to find the quantity at which crafting becomes better than buying.
 *
 * Uses binary search to find the crossover point where bulk buy prices
 * make crafting more economical than purchasing.
 *
 * @param data.itemId - The item ID to analyze
 * @param data.maxQuantity - Maximum quantity to search (default 1000)
 * @returns OptimalQuantity result or null if item not found
 *
 * @example
 * ```typescript
 * const optimal = await findOptimalQuantity({ data: { itemId: 12345 } });
 * if (optimal?.hasCrossover) {
 *   console.log(`Crafting becomes better at ${optimal.craftBetterAt}+ items`);
 * }
 * ```
 */
export const findOptimalQuantity = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => {
    return optimalQuantityInputSchema.parse(input);
  })
  .handler(async ({ data }): Promise<SerializedOptimalQuantity | null> => {
    const dataAccess = createQuantityAwareDataAccess(db);
    const calculator = new CraftCalculatorService(dataAccess);

    const result = await calculator.findOptimalQuantity(data.itemId, data.maxQuantity);

    if (!result) {
      return null;
    }

    return {
      item: serializeItem(result.item),
      craftBetterAt: result.craftBetterAt,
      hasCrossover: result.hasCrossover,
      baseBuyPrice: result.baseBuyPrice,
      baseCraftCost: result.baseCraftCost,
    };
  });

