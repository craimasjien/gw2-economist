/**
 * @fileoverview Serialization utilities for craft analysis data.
 *
 * This module provides functions to convert database entities and analysis
 * results into serializable formats suitable for JSON transport between
 * server and client.
 *
 * @module server/functions/serializers
 *
 * @example
 * ```typescript
 * import { serializeItem, serializeCraftAnalysis } from './serializers';
 *
 * // Serialize an item for API response
 * const serializedItem = serializeItem(dbItem);
 *
 * // Serialize a full craft analysis
 * const serializedAnalysis = serializeCraftAnalysis(analysisResult);
 * ```
 */

import type { Item } from "../db/schema";
import type { CraftAnalysis } from "../services/craft-calculator.service";

/**
 * Serializable item type for JSON transport.
 *
 * Excludes database metadata fields (createdAt, updatedAt) that aren't
 * needed by the frontend.
 */
export interface SerializedItem {
  /** Unique item identifier */
  id: number;
  /** Item display name */
  name: string;
  /** Item description (may be null) */
  description: string | null;
  /** Item type category */
  type: string;
  /** Item rarity tier */
  rarity: string;
  /** Required level to use */
  level: number;
  /** URL to item icon (may be null) */
  icon: string | null;
  /** Value when sold to vendor (in copper) */
  vendorValue: number;
  /** In-game chat link code */
  chatLink: string | null;
}

/**
 * Serializable material breakdown for craft analysis.
 */
export interface SerializedMaterialBreakdown {
  /** The material item */
  item: SerializedItem;
  /** Quantity needed */
  quantity: number;
  /** Unit price (in copper) */
  unitPrice: number;
  /** Total price for this material (in copper) */
  totalPrice: number;
  /** Whether this material can be crafted */
  canCraft: boolean;
  /** Whether the buy price was used (vs craft price) */
  usedBuyPrice: boolean;
  /** Nested craft analysis if material is craftable */
  craftAnalysis?: SerializedCraftAnalysis;
}

/**
 * Serializable version of CraftAnalysis for JSON transport.
 *
 * Converts all nested objects to serializable formats and excludes
 * database metadata fields.
 */
export interface SerializedCraftAnalysis {
  /** The item being analyzed */
  item: SerializedItem;
  /** Recipe details */
  recipe: {
    /** Recipe ID */
    id: number;
    /** Recipe type */
    type: string;
    /** Output item ID */
    outputItemId: number;
    /** Quantity produced */
    outputItemCount: number;
    /** Crafting disciplines that can make this */
    disciplines: string[];
  };
  /** Trading post buy price (in copper) */
  buyPrice: number;
  /** Total crafting cost (in copper) */
  craftCost: number;
  /** Recommendation: buy or craft */
  recommendation: "buy" | "craft";
  /** Amount saved by following recommendation (in copper) */
  savings: number;
  /** Percentage saved */
  savingsPercent: number;
  /** Material breakdown */
  materials: SerializedMaterialBreakdown[];
}

/**
 * Converts a database Item entity to a serializable format.
 *
 * Strips out database metadata (createdAt, updatedAt) and retains only
 * the fields needed by the frontend.
 *
 * @param item - Database item entity
 * @returns Serializable item object
 *
 * @example
 * ```typescript
 * const dbItem = await dataAccess.getItem(12345);
 * const serialized = serializeItem(dbItem);
 * // { id: 12345, name: "Gossamer Scrap", ... }
 * ```
 */
export function serializeItem(item: Item): SerializedItem {
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
 * Converts a CraftAnalysis result to a serializable format.
 *
 * Recursively serializes all nested items and material breakdowns,
 * including any nested craft analyses for craftable materials.
 *
 * @param analysis - Craft analysis result from CraftCalculatorService
 * @returns Serializable craft analysis object
 *
 * @example
 * ```typescript
 * const analysis = await calculator.analyze(itemId);
 * if (analysis) {
 *   const serialized = serializeCraftAnalysis(analysis);
 *   return Response.json(serialized);
 * }
 * ```
 */
export function serializeCraftAnalysis(
  analysis: CraftAnalysis
): SerializedCraftAnalysis {
  return {
    item: serializeItem(analysis.item),
    recipe: {
      id: analysis.recipe.id,
      type: analysis.recipe.type,
      outputItemId: analysis.recipe.outputItemId,
      outputItemCount: analysis.recipe.outputItemCount,
      disciplines: analysis.recipe.disciplines,
    },
    buyPrice: analysis.buyPrice,
    craftCost: analysis.craftCost,
    recommendation: analysis.recommendation,
    savings: analysis.savings,
    savingsPercent: analysis.savingsPercent,
    materials: analysis.materials.map((m) => ({
      item: serializeItem(m.item),
      quantity: m.quantity,
      unitPrice: m.unitPrice,
      totalPrice: m.totalPrice,
      canCraft: m.canCraft,
      usedBuyPrice: m.usedBuyPrice,
      craftAnalysis: m.craftAnalysis
        ? serializeCraftAnalysis(m.craftAnalysis)
        : undefined,
    })),
  };
}

