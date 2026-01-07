/**
 * @fileoverview Data access layer for database queries.
 *
 * This module provides a data access interface that abstracts database queries
 * for items, recipes, and prices. It implements the DataAccess interface required
 * by the CraftCalculatorService.
 *
 * Supports both basic data access and quantity-aware data access with order book
 * (listing) support for bulk purchase analysis.
 *
 * @module server/services/data-access
 *
 * @example
 * ```typescript
 * import { createDataAccess, createQuantityAwareDataAccess } from './data-access';
 * import { db } from '../db';
 *
 * const dataAccess = createDataAccess(db);
 * const item = await dataAccess.getItem(12345);
 *
 * // For quantity-aware analysis
 * const quantityAccess = createQuantityAwareDataAccess(db);
 * const listing = await quantityAccess.getListing(12345);
 * ```
 */

import { eq, like, sql, gte, desc, inArray, and } from "drizzle-orm";
import type { Database } from "../db";
import { items, recipes, prices, priceHistory } from "../db/schema";
import type { Item, Recipe, Price, PriceHistory } from "../db/schema";
import type { DataAccess, QuantityAwareDataAccess } from "./craft-calculator.service";
import type { GW2Listing } from "./gw2-api/types";
import { GW2ApiClient } from "./gw2-api/client";
import { TrendAnalysisService, type TrendDataAccess } from "./trend-analysis.service";
import type { ProfitScannerDataAccess, RecipeWithPrices } from "./profit-scanner.service";

/**
 * Creates a data access implementation for the given database.
 *
 * @param db - Drizzle database instance
 * @returns DataAccess implementation
 */
export function createDataAccess(db: Database): DataAccess {
  return {
    /**
     * Retrieves an item by ID.
     *
     * @param id - Item ID
     * @returns Item or null if not found
     */
    async getItem(id: number): Promise<Item | null> {
      const result = await db
        .select()
        .from(items)
        .where(eq(items.id, id))
        .limit(1);

      return result[0] ?? null;
    },

    /**
     * Retrieves all recipes that produce the given item.
     *
     * @param itemId - Output item ID
     * @returns Array of recipes
     */
    async getRecipesByOutputItem(itemId: number): Promise<Recipe[]> {
      return db
        .select()
        .from(recipes)
        .where(eq(recipes.outputItemId, itemId));
    },

    /**
     * Retrieves the current trading post price for an item.
     *
     * @param itemId - Item ID
     * @returns Price or null if not tradable
     */
    async getPrice(itemId: number): Promise<Price | null> {
      const result = await db
        .select()
        .from(prices)
        .where(eq(prices.itemId, itemId))
        .limit(1);

      return result[0] ?? null;
    },
  };
}

/**
 * Extended data access with additional query methods.
 *
 * @interface ExtendedDataAccess
 */
export interface ExtendedDataAccess extends DataAccess {
  /**
   * Searches items by name.
   *
   * @param query - Search query string
   * @param limit - Maximum results to return
   * @returns Matching items with prices
   */
  searchItems(
    query: string,
    limit?: number
  ): Promise<Array<{ item: Item; price: Price | null }>>;

  /**
   * Gets multiple items by ID.
   *
   * @param ids - Array of item IDs
   * @returns Map of item ID to item
   */
  getItems(ids: number[]): Promise<Map<number, Item>>;

  /**
   * Gets multiple prices by item ID.
   *
   * @param itemIds - Array of item IDs
   * @returns Map of item ID to price
   */
  getPrices(itemIds: number[]): Promise<Map<number, Price>>;
}

/**
 * Creates an extended data access implementation with additional query methods.
 *
 * @param db - Drizzle database instance
 * @returns ExtendedDataAccess implementation
 */
export function createExtendedDataAccess(db: Database): ExtendedDataAccess {
  const baseAccess = createDataAccess(db);

  return {
    ...baseAccess,

    /**
     * Searches items by name using case-insensitive LIKE query.
     *
     * @param query - Search query
     * @param limit - Maximum results (default 20)
     * @returns Items with their prices
     */
    async searchItems(
      query: string,
      limit = 20
    ): Promise<Array<{ item: Item; price: Price | null }>> {
      const searchPattern = `%${query}%`;

      const itemResults = await db
        .select()
        .from(items)
        .where(sql`LOWER(${items.name}) LIKE LOWER(${searchPattern})`)
        .limit(limit);

      // Fetch prices for found items
      const itemIds = itemResults.map((i) => i.id);
      const priceMap = await this.getPrices(itemIds);

      return itemResults.map((item) => ({
        item,
        price: priceMap.get(item.id) ?? null,
      }));
    },

    /**
     * Gets multiple items by ID in a single query.
     *
     * @param ids - Item IDs
     * @returns Map of ID to Item
     */
    async getItems(ids: number[]): Promise<Map<number, Item>> {
      if (ids.length === 0) {
        return new Map();
      }

      const results = await db
        .select()
        .from(items)
        .where(sql`${items.id} IN ${ids}`);

      return new Map(results.map((item) => [item.id, item]));
    },

    /**
     * Gets multiple prices by item ID in a single query.
     *
     * @param itemIds - Item IDs
     * @returns Map of item ID to Price
     */
    async getPrices(itemIds: number[]): Promise<Map<number, Price>> {
      if (itemIds.length === 0) {
        return new Map();
      }

      const results = await db
        .select()
        .from(prices)
        .where(sql`${prices.itemId} IN ${itemIds}`);

      return new Map(results.map((price) => [price.itemId, price]));
    },
  };
}

/**
 * Creates a quantity-aware data access implementation that includes
 * order book (listing) support from the GW2 API.
 *
 * @param db - Drizzle database instance
 * @param apiClient - Optional GW2 API client (creates default if not provided)
 * @returns QuantityAwareDataAccess implementation
 *
 * @example
 * ```typescript
 * const quantityAccess = createQuantityAwareDataAccess(db);
 * const listing = await quantityAccess.getListing(12345);
 * if (listing) {
 *   console.log(`${listing.sells.length} price levels available`);
 * }
 * ```
 */
export function createQuantityAwareDataAccess(
  db: Database,
  apiClient?: GW2ApiClient
): QuantityAwareDataAccess & ExtendedDataAccess {
  const extendedAccess = createExtendedDataAccess(db);
  const client = apiClient ?? new GW2ApiClient();

  return {
    ...extendedAccess,

    /**
     * Retrieves the full order book (listings) for an item from the GW2 API.
     *
     * @param itemId - Item ID
     * @returns Listing data or null if not tradable
     */
    async getListing(itemId: number): Promise<GW2Listing | null> {
      return client.getListing(itemId);
    },
  };
}

/**
 * Creates a trend data access implementation for trend analysis.
 *
 * @param db - Drizzle database instance
 * @returns TrendDataAccess implementation
 */
export function createTrendDataAccess(db: Database): TrendDataAccess {
  const baseAccess = createDataAccess(db);

  return {
    getPrice: baseAccess.getPrice,

    /**
     * Retrieves price history for an item from a given date.
     *
     * @param itemId - Item ID
     * @param fromDate - Start date for history
     * @returns Array of price history records
     */
    async getPriceHistory(itemId: number, fromDate: Date): Promise<PriceHistory[]> {
      return db
        .select()
        .from(priceHistory)
        .where(
          and(
            eq(priceHistory.itemId, itemId),
            gte(priceHistory.recordedAt, fromDate)
          )
        )
        .orderBy(priceHistory.recordedAt);
    },
  };
}

/**
 * Creates a profit scanner data access implementation.
 *
 * @param db - Drizzle database instance
 * @param trendAccess - Trend data access for volume data
 * @param craftCalculator - Optional craft calculator for cost calculations
 * @returns ProfitScannerDataAccess implementation
 */
export function createProfitScannerDataAccess(
  db: Database,
  getCraftCostFn: (itemId: number) => Promise<number | null>
): ProfitScannerDataAccess {
  const baseAccess = createDataAccess(db);
  const trendAccess = createTrendDataAccess(db);
  const trendService = new TrendAnalysisService(trendAccess);

  return {
    /**
     * Retrieves all items that have crafting recipes.
     */
    async getAllCraftableItems(): Promise<Item[]> {
      // Get unique item IDs that have recipes
      const recipeOutputs = await db
        .select({ outputItemId: recipes.outputItemId })
        .from(recipes);

      const uniqueItemIds = [...new Set(recipeOutputs.map((r) => r.outputItemId))];

      if (uniqueItemIds.length === 0) {
        return [];
      }

      // Fetch all those items
      return db
        .select()
        .from(items)
        .where(inArray(items.id, uniqueItemIds));
    },

    /**
     * Fast path: Gets recipes with estimated craft costs in batch.
     * This avoids expensive per-item analysis for initial filtering.
     */
    async getRecipesWithPriceEstimates(): Promise<RecipeWithPrices[]> {
      // Get all recipes
      const allRecipes = await db.select().from(recipes);

      if (allRecipes.length === 0) {
        return [];
      }

      // Collect all item IDs we need (outputs + ingredients)
      const allItemIds = new Set<number>();
      for (const recipe of allRecipes) {
        allItemIds.add(recipe.outputItemId);
        for (const ing of recipe.ingredients) {
          allItemIds.add(ing.itemId);
        }
      }

      // Batch fetch all items and prices
      const itemIdArray = [...allItemIds];
      const [allItems, allPrices] = await Promise.all([
        db.select().from(items).where(inArray(items.id, itemIdArray)),
        db.select().from(prices).where(inArray(prices.itemId, itemIdArray)),
      ]);

      // Build lookup maps
      const itemMap = new Map(allItems.map((i) => [i.id, i]));
      const priceMap = new Map(allPrices.map((p) => [p.itemId, p]));

      // Build results with estimated costs
      const results: RecipeWithPrices[] = [];

      for (const recipe of allRecipes) {
        const item = itemMap.get(recipe.outputItemId);
        const price = priceMap.get(recipe.outputItemId);

        // Skip if no item or no sellable price
        if (!item || !price || price.sellPrice === 0) {
          continue;
        }

        // Estimate craft cost from ingredient buy prices
        let estimatedCraftCost = 0;
        let hasAllIngredientPrices = true;

        for (const ing of recipe.ingredients) {
          const ingPrice = priceMap.get(ing.itemId);
          if (!ingPrice || ingPrice.buyPrice === 0) {
            hasAllIngredientPrices = false;
            break;
          }
          estimatedCraftCost += ingPrice.buyPrice * ing.count;
        }

        // Skip if we can't estimate cost
        if (!hasAllIngredientPrices) {
          continue;
        }

        // Adjust for output count
        estimatedCraftCost = Math.ceil(estimatedCraftCost / recipe.outputItemCount);

        results.push({
          recipe,
          item,
          sellPrice: price.sellPrice,
          sellQuantity: price.sellQuantity,
          estimatedCraftCost,
        });
      }

      return results;
    },

    getRecipesByOutputItem: baseAccess.getRecipesByOutputItem,
    getPrice: baseAccess.getPrice,

    /**
     * Retrieves price trend data for an item.
     */
    async getPriceTrend(itemId: number) {
      return trendService.getPriceTrend(itemId, 7);
    },

    /**
     * Retrieves the calculated craft cost for an item.
     */
    getCraftCost: getCraftCostFn,
  };
}

