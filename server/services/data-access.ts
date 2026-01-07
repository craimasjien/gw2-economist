/**
 * @fileoverview Data access layer for database queries.
 *
 * This module provides a data access interface that abstracts database queries
 * for items, recipes, and prices. It implements the DataAccess interface required
 * by the CraftCalculatorService.
 *
 * @module server/services/data-access
 *
 * @example
 * ```typescript
 * import { createDataAccess } from './data-access';
 * import { db } from '../db';
 *
 * const dataAccess = createDataAccess(db);
 * const item = await dataAccess.getItem(12345);
 * ```
 */

import { eq, like, sql } from "drizzle-orm";
import type { Database } from "../db";
import { items, recipes, prices } from "../db/schema";
import type { Item, Recipe, Price } from "../db/schema";
import type { DataAccess } from "./craft-calculator.service";

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

