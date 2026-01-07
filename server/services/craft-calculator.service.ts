/**
 * @fileoverview Craft Calculator Service for analyzing buy vs. craft decisions.
 *
 * This service recursively analyzes crafting recipes to determine whether it's
 * cheaper to buy an item directly from the trading post or craft it from materials.
 * It handles nested recipes, multiple recipe options, and edge cases like account-bound items.
 *
 * @module server/services/craft-calculator.service
 *
 * @example
 * ```typescript
 * import { CraftCalculatorService } from './craft-calculator.service';
 * import { createDataAccess } from './data-access';
 *
 * const calculator = new CraftCalculatorService(createDataAccess(db));
 * const analysis = await calculator.analyze(12345);
 *
 * if (analysis) {
 *   console.log(`Recommendation: ${analysis.recommendation}`);
 *   console.log(`Savings: ${analysis.savings}c (${analysis.savingsPercent}%)`);
 * }
 * ```
 */

import type { Item, Recipe, Price } from "../db/schema";

/**
 * Result of analyzing an item's craft cost vs. buy cost.
 *
 * @interface CraftAnalysis
 */
export interface CraftAnalysis {
  /**
   * The item being analyzed.
   */
  item: Item;

  /**
   * The recipe used for crafting (cheapest option if multiple exist).
   */
  recipe: Recipe;

  /**
   * Direct purchase cost from trading post (sell price = instant buy).
   * 0 if item has no trading post listing.
   */
  buyPrice: number;

  /**
   * Total cost to craft from materials (per single item).
   */
  craftCost: number;

  /**
   * Whether to buy or craft based on cost comparison.
   */
  recommendation: "buy" | "craft";

  /**
   * Absolute savings by following the recommendation (always positive).
   */
  savings: number;

  /**
   * Percentage savings relative to the more expensive option.
   */
  savingsPercent: number;

  /**
   * Breakdown of materials required for crafting.
   */
  materials: MaterialBreakdown[];
}

/**
 * Breakdown of a single material requirement.
 *
 * @interface MaterialBreakdown
 */
export interface MaterialBreakdown {
  /**
   * The material item.
   */
  item: Item;

  /**
   * Quantity needed for the recipe.
   */
  quantity: number;

  /**
   * Unit price (buy price from trading post).
   */
  unitPrice: number;

  /**
   * Total price for required quantity.
   */
  totalPrice: number;

  /**
   * Whether this material can be crafted.
   */
  canCraft: boolean;

  /**
   * Whether the buy price was used (vs. craft cost) for this material.
   */
  usedBuyPrice: boolean;

  /**
   * Recursive craft analysis if material is craftable.
   */
  craftAnalysis?: CraftAnalysis;
}

/**
 * Flattened material representing raw materials needed.
 *
 * @interface FlattenedMaterial
 */
export interface FlattenedMaterial {
  /**
   * The raw material item.
   */
  item: Item;

  /**
   * Total quantity needed across all recipes.
   */
  quantity: number;

  /**
   * Unit price from trading post.
   */
  unitPrice: number;

  /**
   * Total cost for all required quantity.
   */
  totalCost: number;
}

/**
 * Data access interface for retrieving items, recipes, and prices.
 *
 * @interface DataAccess
 */
export interface DataAccess {
  /**
   * Retrieves an item by ID.
   */
  getItem(id: number): Promise<Item | null>;

  /**
   * Retrieves all recipes that produce the given item.
   */
  getRecipesByOutputItem(itemId: number): Promise<Recipe[]>;

  /**
   * Retrieves the current trading post price for an item.
   */
  getPrice(itemId: number): Promise<Price | null>;
}

/**
 * Maximum recursion depth to prevent infinite loops.
 */
const MAX_RECURSION_DEPTH = 10;

/**
 * Service for calculating and comparing craft costs vs. buy costs.
 *
 * @class CraftCalculatorService
 */
export class CraftCalculatorService {
  /**
   * Data access layer for database queries.
   */
  private readonly dataAccess: DataAccess;

  /**
   * Creates a new CraftCalculatorService.
   *
   * @param dataAccess - Data access implementation for database queries
   */
  constructor(dataAccess: DataAccess) {
    this.dataAccess = dataAccess;
  }

  /**
   * Analyzes an item to determine whether to buy or craft.
   *
   * @param itemId - The item ID to analyze
   * @returns CraftAnalysis result or null if item can't be crafted
   */
  async analyze(itemId: number): Promise<CraftAnalysis | null> {
    return this.analyzeWithDepth(itemId, new Set(), 0);
  }

  /**
   * Internal analysis method with recursion tracking.
   *
   * @param itemId - Item ID to analyze
   * @param visitedIds - Set of already-visited item IDs to detect cycles
   * @param depth - Current recursion depth
   * @returns CraftAnalysis or null
   */
  private async analyzeWithDepth(
    itemId: number,
    visitedIds: Set<number>,
    depth: number
  ): Promise<CraftAnalysis | null> {
    // Prevent infinite recursion
    if (depth > MAX_RECURSION_DEPTH || visitedIds.has(itemId)) {
      return null;
    }

    const item = await this.dataAccess.getItem(itemId);
    if (!item) {
      return null;
    }

    const recipes = await this.dataAccess.getRecipesByOutputItem(itemId);
    if (recipes.length === 0) {
      return null; // Item can't be crafted
    }

    const price = await this.dataAccess.getPrice(itemId);
    const buyPrice = price?.sellPrice ?? 0; // sellPrice is what buyers pay (instant buy)

    // Mark this item as visited for cycle detection
    const newVisitedIds = new Set(visitedIds);
    newVisitedIds.add(itemId);

    // Analyze all recipes and find the cheapest one
    let bestAnalysis: CraftAnalysis | null = null;

    for (const recipe of recipes) {
      const analysis = await this.analyzeRecipe(
        item,
        recipe,
        buyPrice,
        newVisitedIds,
        depth
      );

      if (
        analysis &&
        (bestAnalysis === null || analysis.craftCost < bestAnalysis.craftCost)
      ) {
        bestAnalysis = analysis;
      }
    }

    return bestAnalysis;
  }

  /**
   * Analyzes a specific recipe for an item.
   *
   * @param item - The output item
   * @param recipe - The recipe to analyze
   * @param buyPrice - Buy price from trading post
   * @param visitedIds - Set of visited item IDs
   * @param depth - Current recursion depth
   * @returns CraftAnalysis for this recipe
   */
  private async analyzeRecipe(
    item: Item,
    recipe: Recipe,
    buyPrice: number,
    visitedIds: Set<number>,
    depth: number
  ): Promise<CraftAnalysis | null> {
    const materials: MaterialBreakdown[] = [];
    let totalCraftCost = 0;

    // Analyze each ingredient
    for (const ingredient of recipe.ingredients) {
      const materialItem = await this.dataAccess.getItem(ingredient.itemId);
      if (!materialItem) {
        continue; // Skip unknown materials
      }

      const materialPrice = await this.dataAccess.getPrice(ingredient.itemId);
      const materialBuyPrice = materialPrice?.sellPrice ?? 0;

      // Check if material can be crafted
      const materialRecipes = await this.dataAccess.getRecipesByOutputItem(
        ingredient.itemId
      );
      const canCraft = materialRecipes.length > 0;

      let usedBuyPrice = true;
      let effectivePrice = materialBuyPrice;
      let craftAnalysis: CraftAnalysis | undefined;

      // If material can be crafted, check if it's cheaper
      if (canCraft && depth < MAX_RECURSION_DEPTH) {
        const materialAnalysis = await this.analyzeWithDepth(
          ingredient.itemId,
          visitedIds,
          depth + 1
        );

        if (materialAnalysis) {
          craftAnalysis = materialAnalysis;

          // Use the cheaper option: buy or craft
          if (
            materialAnalysis.craftCost < materialBuyPrice ||
            materialBuyPrice === 0
          ) {
            effectivePrice = materialAnalysis.craftCost;
            usedBuyPrice = false;
          }
        }
      }

      const totalPrice = effectivePrice * ingredient.count;
      totalCraftCost += totalPrice;

      materials.push({
        item: materialItem,
        quantity: ingredient.count,
        unitPrice: effectivePrice,
        totalPrice,
        canCraft,
        usedBuyPrice,
        craftAnalysis,
      });
    }

    // Account for recipes that produce multiple items
    const craftCostPerItem = totalCraftCost / recipe.outputItemCount;

    // Calculate recommendation
    const recommendation: "buy" | "craft" =
      buyPrice > 0 && buyPrice <= craftCostPerItem ? "buy" : "craft";

    // Calculate savings
    const maxCost = Math.max(buyPrice, craftCostPerItem);
    const minCost = buyPrice > 0 ? Math.min(buyPrice, craftCostPerItem) : craftCostPerItem;
    const savings = maxCost - minCost;
    const savingsPercent = maxCost > 0 ? (savings / maxCost) * 100 : 0;

    return {
      item,
      recipe,
      buyPrice,
      craftCost: craftCostPerItem,
      recommendation,
      savings,
      savingsPercent,
      materials,
    };
  }

  /**
   * Calculates a flattened list of all raw materials needed.
   *
   * Recursively expands all craftable materials to their base components,
   * aggregating quantities for duplicate materials.
   *
   * @param itemId - The item ID to analyze
   * @returns Array of flattened materials or null if item can't be crafted
   */
  async calculateFlattenedMaterials(
    itemId: number
  ): Promise<FlattenedMaterial[] | null> {
    const analysis = await this.analyze(itemId);
    if (!analysis) {
      return null;
    }

    const materialMap = new Map<number, FlattenedMaterial>();
    await this.flattenMaterials(analysis.materials, 1, materialMap);

    return Array.from(materialMap.values());
  }

  /**
   * Recursively flattens materials into the accumulator map.
   *
   * @param materials - Materials to flatten
   * @param multiplier - Quantity multiplier from parent recipes
   * @param accumulator - Map to accumulate flattened materials
   */
  private async flattenMaterials(
    materials: MaterialBreakdown[],
    multiplier: number,
    accumulator: Map<number, FlattenedMaterial>
  ): Promise<void> {
    for (const material of materials) {
      const quantity = material.quantity * multiplier;

      // If material is crafted (not bought), recurse into its materials
      if (!material.usedBuyPrice && material.craftAnalysis) {
        await this.flattenMaterials(
          material.craftAnalysis.materials,
          quantity,
          accumulator
        );
      } else {
        // This is a raw material (bought or can't be crafted cheaper)
        const existing = accumulator.get(material.item.id);
        if (existing) {
          existing.quantity += quantity;
          existing.totalCost = existing.quantity * existing.unitPrice;
        } else {
          accumulator.set(material.item.id, {
            item: material.item,
            quantity,
            unitPrice: material.unitPrice,
            totalCost: quantity * material.unitPrice,
          });
        }
      }
    }
  }
}

