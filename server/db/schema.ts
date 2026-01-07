/**
 * @fileoverview Drizzle ORM schema definitions for the GW2 Economist database.
 *
 * This module defines the database schema for storing Guild Wars 2 item data,
 * crafting recipes, and trading post prices. The schema is designed to support
 * efficient craft cost calculations and buy vs. craft recommendations.
 *
 * @module server/db/schema
 *
 * @example
 * ```typescript
 * import { items, recipes, prices } from './schema';
 * import { db } from './index';
 *
 * // Query an item by ID
 * const item = await db.select().from(items).where(eq(items.id, 12345));
 *
 * // Get all recipes that output a specific item
 * const itemRecipes = await db.select().from(recipes).where(eq(recipes.outputItemId, 12345));
 * ```
 */

import {
  pgTable,
  integer,
  text,
  timestamp,
  jsonb,
  varchar,
  bigint,
  index,
  primaryKey,
  serial,
} from "drizzle-orm/pg-core";

/**
 * Represents a crafting ingredient with item ID and quantity.
 *
 * @interface RecipeIngredient
 * @property {number} itemId - The GW2 item ID of the ingredient
 * @property {number} count - The quantity required
 */
export interface RecipeIngredient {
  itemId: number;
  count: number;
}

/**
 * Represents the guild upgrade requirement for certain recipes.
 *
 * @interface GuildUpgradeIngredient
 * @property {number} upgradeId - The guild upgrade ID
 * @property {number} count - The quantity required
 */
export interface GuildUpgradeIngredient {
  upgradeId: number;
  count: number;
}

/**
 * Items table storing all GW2 item metadata.
 *
 * @remarks
 * Contains core item information fetched from the GW2 API `/v2/items` endpoint.
 * Items are identified by their unique GW2 item ID.
 *
 * @see https://wiki.guildwars2.com/wiki/API:2/items
 */
export const items = pgTable(
  "items",
  {
    /**
     * Unique GW2 item ID (primary key).
     * This matches the ID from the GW2 API.
     */
    id: integer("id").primaryKey(),

    /**
     * Localized item name (English).
     */
    name: text("name").notNull(),

    /**
     * Item description, may contain HTML formatting.
     */
    description: text("description"),

    /**
     * Item type (e.g., "Weapon", "Armor", "Consumable", "CraftingMaterial").
     */
    type: varchar("type", { length: 50 }).notNull(),

    /**
     * Item rarity (e.g., "Junk", "Basic", "Fine", "Masterwork", "Rare", "Exotic", "Ascended", "Legendary").
     */
    rarity: varchar("rarity", { length: 20 }).notNull(),

    /**
     * Required character level to use the item.
     */
    level: integer("level").notNull().default(0),

    /**
     * URL to the item's icon image.
     */
    icon: text("icon"),

    /**
     * Vendor sell value in copper coins.
     */
    vendorValue: integer("vendor_value").notNull().default(0),

    /**
     * Chat link code for linking the item in-game.
     */
    chatLink: varchar("chat_link", { length: 50 }),

    /**
     * Array of item flags (e.g., "AccountBound", "SoulBindOnAcquire", "NoSell").
     */
    flags: jsonb("flags").$type<string[]>().default([]),

    /**
     * Timestamp when this record was last updated from the API.
     */
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    /**
     * Index for text search on item names.
     */
    index("items_name_idx").on(table.name),

    /**
     * Index for filtering by item type.
     */
    index("items_type_idx").on(table.type),

    /**
     * Index for filtering by rarity.
     */
    index("items_rarity_idx").on(table.rarity),
  ]
);

/**
 * Recipes table storing all GW2 crafting recipes.
 *
 * @remarks
 * Contains recipe data from the GW2 API `/v2/recipes` endpoint.
 * Each recipe defines how to craft one or more output items from a set of ingredients.
 *
 * @see https://wiki.guildwars2.com/wiki/API:2/recipes
 */
export const recipes = pgTable(
  "recipes",
  {
    /**
     * Unique GW2 recipe ID (primary key).
     */
    id: integer("id").primaryKey(),

    /**
     * Recipe type (e.g., "Refinement", "Component", "Insignia", "Inscription").
     */
    type: varchar("type", { length: 50 }).notNull(),

    /**
     * The item ID produced by this recipe.
     */
    outputItemId: integer("output_item_id").notNull(),

    /**
     * Number of items produced per craft.
     */
    outputItemCount: integer("output_item_count").notNull().default(1),

    /**
     * Minimum crafting level required.
     */
    minRating: integer("min_rating").notNull().default(0),

    /**
     * Time to craft in milliseconds.
     */
    timeToCraft: integer("time_to_craft").notNull().default(0),

    /**
     * Array of crafting disciplines that can use this recipe.
     * (e.g., ["Armorsmith", "Weaponsmith", "Leatherworker"])
     */
    disciplines: jsonb("disciplines").$type<string[]>().notNull().default([]),

    /**
     * Recipe flags (e.g., "AutoLearned", "LearnedFromItem").
     */
    flags: jsonb("flags").$type<string[]>().default([]),

    /**
     * Array of item ingredients required for crafting.
     */
    ingredients: jsonb("ingredients")
      .$type<RecipeIngredient[]>()
      .notNull()
      .default([]),

    /**
     * Optional guild upgrade ingredients (for guild-related recipes).
     */
    guildIngredients: jsonb("guild_ingredients")
      .$type<GuildUpgradeIngredient[]>()
      .default([]),

    /**
     * Chat link code for linking the recipe in-game.
     */
    chatLink: varchar("chat_link", { length: 50 }),

    /**
     * Timestamp when this record was last updated from the API.
     */
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    /**
     * Index for looking up recipes by their output item.
     * Critical for craft cost calculations.
     */
    index("recipes_output_item_id_idx").on(table.outputItemId),

    /**
     * Index for filtering by recipe type.
     */
    index("recipes_type_idx").on(table.type),

    /**
     * Index for filtering by minimum rating.
     */
    index("recipes_min_rating_idx").on(table.minRating),
  ]
);

/**
 * Prices table storing trading post price data.
 *
 * @remarks
 * Contains price data from the GW2 API `/v2/commerce/prices` endpoint.
 * Prices are stored in copper coins (the base unit in GW2).
 * This table should be synced frequently (hourly) as prices change often.
 *
 * @see https://wiki.guildwars2.com/wiki/API:2/commerce/prices
 */
export const prices = pgTable("prices", {
  /**
   * GW2 item ID (primary key).
   * References the items table.
   */
  itemId: integer("item_id").primaryKey(),

  /**
   * Highest buy order price in copper.
   * This is what sellers receive if they instant-sell.
   */
  buyPrice: integer("buy_price").notNull().default(0),

  /**
   * Number of buy orders at the buy price.
   */
  buyQuantity: integer("buy_quantity").notNull().default(0),

  /**
   * Lowest sell listing price in copper.
   * This is what buyers pay if they instant-buy.
   */
  sellPrice: integer("sell_price").notNull().default(0),

  /**
   * Number of sell listings at the sell price.
   */
  sellQuantity: integer("sell_quantity").notNull().default(0),

  /**
   * Timestamp when this price data was last updated.
   */
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Price history table storing hourly snapshots of trading post prices.
 *
 * @remarks
 * Contains historical price data for trend analysis and profit discovery.
 * Each row represents a snapshot of an item's price at a specific point in time.
 * Data is retained for 1 year before cleanup.
 *
 * @see https://wiki.guildwars2.com/wiki/API:2/commerce/prices
 */
export const priceHistory = pgTable(
  "price_history",
  {
    /**
     * Auto-incrementing primary key.
     */
    id: serial("id").primaryKey(),

    /**
     * GW2 item ID.
     * References the items table.
     */
    itemId: integer("item_id").notNull(),

    /**
     * Highest buy order price in copper at snapshot time.
     */
    buyPrice: integer("buy_price").notNull(),

    /**
     * Number of buy orders at the snapshot time.
     */
    buyQuantity: integer("buy_quantity").notNull(),

    /**
     * Lowest sell listing price in copper at snapshot time.
     */
    sellPrice: integer("sell_price").notNull(),

    /**
     * Number of sell listings at the snapshot time.
     */
    sellQuantity: integer("sell_quantity").notNull(),

    /**
     * Timestamp when this price snapshot was recorded.
     */
    recordedAt: timestamp("recorded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    /**
     * Index for looking up history by item ID.
     */
    index("price_history_item_id_idx").on(table.itemId),

    /**
     * Index for time-based queries and cleanup.
     */
    index("price_history_recorded_at_idx").on(table.recordedAt),

    /**
     * Composite index for efficient item + time range queries.
     * Critical for trend analysis queries.
     */
    index("price_history_item_time_idx").on(table.itemId, table.recordedAt),
  ]
);

/**
 * TypeScript type for inserting a new item record.
 */
export type NewItem = typeof items.$inferInsert;

/**
 * TypeScript type for a selected item record.
 */
export type Item = typeof items.$inferSelect;

/**
 * TypeScript type for inserting a new recipe record.
 */
export type NewRecipe = typeof recipes.$inferInsert;

/**
 * TypeScript type for a selected recipe record.
 */
export type Recipe = typeof recipes.$inferSelect;

/**
 * TypeScript type for inserting a new price record.
 */
export type NewPrice = typeof prices.$inferInsert;

/**
 * TypeScript type for a selected price record.
 */
export type Price = typeof prices.$inferSelect;

/**
 * TypeScript type for inserting a new price history record.
 */
export type NewPriceHistory = typeof priceHistory.$inferInsert;

/**
 * TypeScript type for a selected price history record.
 */
export type PriceHistory = typeof priceHistory.$inferSelect;

