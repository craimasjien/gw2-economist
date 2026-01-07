/**
 * @fileoverview GW2 API integration module exports.
 *
 * This module re-exports all GW2 API-related functionality including the
 * API client, cache adapter, and type definitions. Import from this module
 * for a clean interface to the GW2 API integration layer.
 *
 * @module server/services/gw2-api
 *
 * @example
 * ```typescript
 * import { gw2Api, GW2ApiClient, FileCache } from './server/services/gw2-api';
 * import type { GW2Item, GW2Recipe, GW2Price } from './server/services/gw2-api';
 *
 * // Use the singleton client
 * const items = await gw2Api.getItems([12345, 12346]);
 *
 * // Or create a custom client
 * const customClient = new GW2ApiClient({ apiKey: 'my-key' });
 * ```
 */

export { GW2ApiClient, gw2Api, type GW2ApiClientOptions } from "./client";
export { FileCache, fileCache, type CacheAdapter } from "./cache";
export type {
  GW2Item,
  GW2ItemType,
  GW2Rarity,
  GW2ItemFlag,
  GW2GameType,
  GW2UpgradeInfo,
  GW2ItemDetails,
  GW2InfixUpgrade,
  GW2Attribute,
  GW2Recipe,
  GW2RecipeType,
  GW2Discipline,
  GW2RecipeFlag,
  GW2Ingredient,
  GW2GuildIngredient,
  GW2Price,
  GW2PriceData,
  GW2Listing,
  GW2ListingEntry,
  GW2ApiError,
  GW2BatchResult,
} from "./types";

