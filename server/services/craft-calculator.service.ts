/**
 * @fileoverview Craft Calculator Service for analyzing buy vs. craft decisions.
 *
 * This service recursively analyzes crafting recipes to determine whether it's
 * cheaper to buy an item directly from the trading post or craft it from materials.
 * It handles nested recipes, multiple recipe options, and edge cases like account-bound items.
 *
 * Supports both single-item analysis and quantity-aware bulk analysis that considers
 * order book depth to calculate true costs when buying/crafting in bulk.
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
 *
 * // Quantity-aware analysis
 * const bulkAnalysis = await calculator.analyzeForQuantity(12345, 100);
 * if (bulkAnalysis) {
 *   console.log(`For 100 items: ${bulkAnalysis.recommendation}`);
 *   console.log(`Price impact: +${bulkAnalysis.buyPriceImpact.toFixed(1)}%`);
 * }
 * ```
 */

import type { Item, Recipe, Price } from "../db/schema";
import type { GW2Listing } from "./gw2-api/types";
import { OrderBookCalculator } from "./order-book-calculator";

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
 * Extended data access interface with order book (listing) support.
 *
 * @interface QuantityAwareDataAccess
 */
export interface QuantityAwareDataAccess extends DataAccess {
  /**
   * Retrieves the full order book (listings) for an item.
   *
   * @param itemId - Item ID
   * @returns Listing data or null if not tradable
   */
  getListing(itemId: number): Promise<GW2Listing | null>;
}

/**
 * Result of quantity-aware craft analysis.
 *
 * @interface QuantityAwareCraftAnalysis
 */
export interface QuantityAwareCraftAnalysis {
  /**
   * The item being analyzed.
   */
  item: Item;

  /**
   * Quantity being analyzed.
   */
  quantity: number;

  /**
   * Whether this item can be crafted (has a recipe).
   */
  canCraft: boolean;

  /**
   * Recipe used for crafting (if craftable).
   */
  recipe?: Recipe;

  /**
   * Total cost to buy the requested quantity from trading post.
   */
  totalBuyCost: number;

  /**
   * Average price per unit when buying.
   */
  averageBuyPrice: number;

  /**
   * Total cost to craft the requested quantity.
   */
  totalCraftCost: number;

  /**
   * Average cost per unit when crafting.
   */
  averageCraftCost: number;

  /**
   * Recommendation based on bulk prices.
   */
  recommendation: "buy" | "craft";

  /**
   * Absolute savings by following the recommendation.
   */
  savings: number;

  /**
   * Percentage savings relative to the more expensive option.
   */
  savingsPercent: number;

  /**
   * Percentage price increase from base price due to order book depth.
   */
  buyPriceImpact: number;

  /**
   * Total supply available on the trading post.
   */
  supplyAvailable: number;

  /**
   * Amount of the order that cannot be filled due to supply limits.
   */
  supplyShortfall: number;

  /**
   * Whether the full order can be filled from available supply.
   */
  canFillOrder: boolean;

  /**
   * Breakdown of material costs for crafting.
   */
  materialBreakdown?: QuantityMaterialBreakdown[];
}

/**
 * Breakdown of material costs for quantity analysis.
 *
 * @interface QuantityMaterialBreakdown
 */
export interface QuantityMaterialBreakdown {
  /**
   * The material item.
   */
  item: Item;

  /**
   * Total quantity needed.
   */
  quantity: number;

  /**
   * Cost per unit considering order book depth.
   */
  unitCost: number;

  /**
   * Total cost for all required materials.
   */
  totalCost: number;

  /**
   * Whether buying or crafting is cheaper for this material.
   */
  decision: "buy" | "craft";
}

/**
 * Result of finding optimal quantity crossover point.
 *
 * @interface OptimalQuantityResult
 */
export interface OptimalQuantityResult {
  /**
   * Item being analyzed.
   */
  item: Item;

  /**
   * Quantity at which crafting becomes cheaper than buying.
   * 0 if crafting is never cheaper; Infinity if always cheaper.
   */
  craftBetterAt: number;

  /**
   * Whether there's a crossover point.
   */
  hasCrossover: boolean;

  /**
   * Base buy price (single item).
   */
  baseBuyPrice: number;

  /**
   * Base craft cost (single item).
   */
  baseCraftCost: number;
}

/**
 * Maximum recursion depth to prevent infinite loops.
 */
const MAX_RECURSION_DEPTH = 10;

/**
 * Type guard to check if data access supports listings.
 *
 * @param dataAccess - Data access object
 * @returns True if listings are supported
 */
function hasListingSupport(
  dataAccess: DataAccess
): dataAccess is QuantityAwareDataAccess {
  return "getListing" in dataAccess;
}

/**
 * Service for calculating and comparing craft costs vs. buy costs.
 *
 * @class CraftCalculatorService
 */
export class CraftCalculatorService {
  /**
   * Data access layer for database queries.
   */
  private readonly dataAccess: DataAccess | QuantityAwareDataAccess;

  /**
   * Creates a new CraftCalculatorService.
   *
   * @param dataAccess - Data access implementation for database queries.
   *                     Supports optional QuantityAwareDataAccess for bulk analysis.
   */
  constructor(dataAccess: DataAccess | QuantityAwareDataAccess) {
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

  /**
   * Analyzes an item for a specific quantity, considering order book depth.
   *
   * This method calculates the true cost of buying or crafting a bulk quantity,
   * taking into account that prices increase as cheaper listings are exhausted.
   *
   * @param itemId - The item ID to analyze
   * @param quantity - Number of items to analyze
   * @returns Quantity-aware analysis or null if item not found
   *
   * @example
   * ```typescript
   * const analysis = await calculator.analyzeForQuantity(12345, 100);
   * if (analysis) {
   *   console.log(`Buying 100 costs ${analysis.totalBuyCost}c`);
   *   console.log(`Crafting 100 costs ${analysis.totalCraftCost}c`);
   *   console.log(`Recommendation: ${analysis.recommendation}`);
   * }
   * ```
   */
  async analyzeForQuantity(
    itemId: number,
    quantity: number
  ): Promise<QuantityAwareCraftAnalysis | null> {
    const item = await this.dataAccess.getItem(itemId);
    if (!item) {
      return null;
    }

    // Get order book data if available
    const listing = hasListingSupport(this.dataAccess)
      ? await this.dataAccess.getListing(itemId)
      : null;

    const price = await this.dataAccess.getPrice(itemId);
    const recipes = await this.dataAccess.getRecipesByOutputItem(itemId);
    const canCraft = recipes.length > 0;

    // Calculate buy cost using order book or flat price
    let totalBuyCost: number;
    let averageBuyPrice: number;
    let buyPriceImpact: number;
    let supplyAvailable: number;
    let canFillOrder: boolean;

    if (listing && listing.sells.length > 0) {
      const buyResult = OrderBookCalculator.calculateBulkPurchaseCost(
        listing.sells,
        quantity
      );
      totalBuyCost = buyResult.totalCost;
      averageBuyPrice = buyResult.averagePrice;
      supplyAvailable = OrderBookCalculator.getTotalSupply(listing.sells);
      canFillOrder = buyResult.fullyFilled;

      const impact = OrderBookCalculator.calculatePriceImpact(
        listing.sells,
        quantity
      );
      buyPriceImpact = impact.priceImpactPercent;
    } else {
      // Fall back to flat price
      const unitPrice = price?.sellPrice ?? 0;
      totalBuyCost = unitPrice * quantity;
      averageBuyPrice = unitPrice;
      buyPriceImpact = 0;
      supplyAvailable = price?.sellQuantity ?? 0;
      canFillOrder = supplyAvailable >= quantity;
    }

    const supplyShortfall = Math.max(0, quantity - supplyAvailable);

    // Calculate craft cost if craftable
    let totalCraftCost = 0;
    let averageCraftCost = 0;
    let bestRecipe: Recipe | undefined;
    let materialBreakdown: QuantityMaterialBreakdown[] = [];

    if (canCraft) {
      // Find cheapest recipe for this quantity
      let cheapestCost = Infinity;

      for (const recipe of recipes) {
        const { cost, breakdown } = await this.calculateCraftCostForQuantity(
          recipe,
          quantity
        );

        if (cost < cheapestCost) {
          cheapestCost = cost;
          bestRecipe = recipe;
          materialBreakdown = breakdown;
        }
      }

      totalCraftCost = cheapestCost === Infinity ? 0 : cheapestCost;
      averageCraftCost =
        quantity > 0 && totalCraftCost > 0 ? totalCraftCost / quantity : 0;
    }

    // Determine recommendation
    let recommendation: "buy" | "craft";
    if (!canCraft || totalCraftCost === 0) {
      recommendation = "buy";
    } else if (totalBuyCost === 0) {
      recommendation = "craft";
    } else {
      recommendation = totalBuyCost <= totalCraftCost ? "buy" : "craft";
    }

    // Calculate savings
    const maxCost = Math.max(totalBuyCost, totalCraftCost);
    const minCost = canCraft
      ? Math.min(totalBuyCost || Infinity, totalCraftCost || Infinity)
      : totalBuyCost;
    const savings = maxCost > 0 ? maxCost - minCost : 0;
    const savingsPercent = maxCost > 0 ? (savings / maxCost) * 100 : 0;

    return {
      item,
      quantity,
      canCraft,
      recipe: bestRecipe,
      totalBuyCost,
      averageBuyPrice,
      totalCraftCost,
      averageCraftCost,
      recommendation,
      savings,
      savingsPercent,
      buyPriceImpact,
      supplyAvailable,
      supplyShortfall,
      canFillOrder,
      materialBreakdown,
    };
  }

  /**
   * Calculates craft cost for a recipe at a specific quantity.
   *
   * @param recipe - Recipe to analyze
   * @param quantity - Number of items to craft
   * @returns Total cost and material breakdown
   */
  private async calculateCraftCostForQuantity(
    recipe: Recipe,
    quantity: number
  ): Promise<{
    cost: number;
    breakdown: QuantityMaterialBreakdown[];
  }> {
    // Calculate how many crafts needed (accounting for output count)
    const craftsNeeded = Math.ceil(quantity / recipe.outputItemCount);
    let totalCost = 0;
    const breakdown: QuantityMaterialBreakdown[] = [];

    for (const ingredient of recipe.ingredients) {
      const materialItem = await this.dataAccess.getItem(ingredient.itemId);
      if (!materialItem) {
        continue;
      }

      const materialQuantity = ingredient.count * craftsNeeded;

      // Get material cost using order book if available
      let materialCost: number;
      let unitCost: number;
      let decision: "buy" | "craft" = "buy";

      const materialListing = hasListingSupport(this.dataAccess)
        ? await this.dataAccess.getListing(ingredient.itemId)
        : null;

      if (materialListing && materialListing.sells.length > 0) {
        const buyResult = OrderBookCalculator.calculateBulkPurchaseCost(
          materialListing.sells,
          materialQuantity
        );
        materialCost = buyResult.totalCost;
        unitCost = buyResult.averagePrice;
      } else {
        const materialPrice = await this.dataAccess.getPrice(ingredient.itemId);
        unitCost = materialPrice?.sellPrice ?? 0;
        materialCost = unitCost * materialQuantity;
      }

      // Check if crafting the material is cheaper (recursive)
      const materialRecipes = await this.dataAccess.getRecipesByOutputItem(
        ingredient.itemId
      );
      if (materialRecipes.length > 0) {
        const subAnalysis = await this.analyzeForQuantity(
          ingredient.itemId,
          materialQuantity
        );
        if (subAnalysis && subAnalysis.totalCraftCost < materialCost) {
          materialCost = subAnalysis.totalCraftCost;
          unitCost = subAnalysis.averageCraftCost;
          decision = "craft";
        }
      }

      totalCost += materialCost;
      breakdown.push({
        item: materialItem,
        quantity: materialQuantity,
        unitCost,
        totalCost: materialCost,
        decision,
      });
    }

    return { cost: totalCost, breakdown };
  }

  /**
   * Finds the quantity at which crafting becomes more cost-effective than buying.
   *
   * Uses binary search to find the crossover point where the average buy price
   * exceeds the craft cost threshold.
   *
   * @param itemId - Item ID to analyze
   * @param maxQuantity - Maximum quantity to search up to (default 1000)
   * @returns Optimal quantity result or null if item not found
   *
   * @example
   * ```typescript
   * const optimal = await calculator.findOptimalQuantity(12345);
   * if (optimal && optimal.hasCrossover) {
   *   console.log(`Crafting is better at ${optimal.craftBetterAt}+ items`);
   * }
   * ```
   */
  async findOptimalQuantity(
    itemId: number,
    maxQuantity = 1000
  ): Promise<OptimalQuantityResult | null> {
    const item = await this.dataAccess.getItem(itemId);
    if (!item) {
      return null;
    }

    // Get base prices
    const singleAnalysis = await this.analyzeForQuantity(itemId, 1);
    if (!singleAnalysis) {
      return null;
    }

    const baseBuyPrice = singleAnalysis.averageBuyPrice;
    const baseCraftCost = singleAnalysis.averageCraftCost;

    // If item can't be crafted, no crossover
    if (!singleAnalysis.canCraft || baseCraftCost === 0) {
      return {
        item,
        craftBetterAt: 0,
        hasCrossover: false,
        baseBuyPrice,
        baseCraftCost: 0,
      };
    }

    // If crafting is already cheaper at quantity 1, it's always better
    if (baseCraftCost < baseBuyPrice) {
      return {
        item,
        craftBetterAt: 1,
        hasCrossover: true,
        baseBuyPrice,
        baseCraftCost,
      };
    }

    // Binary search for crossover point
    let low = 1;
    let high = maxQuantity;
    let crossoverAt = 0;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const analysis = await this.analyzeForQuantity(itemId, mid);

      if (!analysis) {
        break;
      }

      if (analysis.recommendation === "craft") {
        // Crafting is better, search for earlier crossover
        crossoverAt = mid;
        high = mid - 1;
      } else {
        // Buying is still better, search higher quantities
        low = mid + 1;
      }
    }

    return {
      item,
      craftBetterAt: crossoverAt,
      hasCrossover: crossoverAt > 0,
      baseBuyPrice,
      baseCraftCost,
    };
  }
}

