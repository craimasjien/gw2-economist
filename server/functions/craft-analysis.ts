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
import { createExtendedDataAccess } from "../services/data-access";
import { CraftCalculatorService } from "../services/craft-calculator.service";
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

