/**
 * @fileoverview Profit Opportunity Scanner Service.
 *
 * This service scans all craftable items to find profitable crafting opportunities.
 * It calculates profit after trading post tax, ranks items by a profit score that
 * considers both profit margin and trading volume, and filters by various criteria.
 *
 * @module server/services/profit-scanner.service
 *
 * @example
 * ```typescript
 * import { ProfitOpportunityScannerService } from './profit-scanner.service';
 *
 * const scanner = new ProfitOpportunityScannerService(dataAccess);
 *
 * // Get top 50 profitable items
 * const opportunities = await scanner.getTopProfitableItems({
 *   limit: 50,
 *   minDailyVolume: 10,
 *   minProfitMargin: 0.05,
 * });
 *
 * for (const item of opportunities) {
 *   console.log(`${item.item.name}: ${item.profit}c profit, score: ${item.profitScore}`);
 * }
 * ```
 */

import type { Item, Recipe, Price } from "../db/schema";
import type { PriceTrend } from "./trend-analysis.service";

/**
 * Trading post tax rate (15%).
 */
const TP_TAX_RATE = 0.15;

/**
 * Result of a profitable item analysis.
 *
 * @interface ProfitableItem
 */
export interface ProfitableItem {
  /**
   * The item being analyzed.
   */
  item: Item;

  /**
   * The recipe used for crafting.
   */
  recipe: Recipe;

  /**
   * Total cost to craft the item (in copper).
   */
  craftCost: number;

  /**
   * Current sell price on trading post (in copper).
   */
  sellPrice: number;

  /**
   * Net profit after 15% TP tax (in copper).
   * Formula: sellPrice * 0.85 - craftCost
   */
  profit: number;

  /**
   * Profit margin as a decimal.
   * Formula: profit / (sellPrice * 0.85)
   */
  profitMargin: number;

  /**
   * Average daily trading volume.
   */
  dailyVolume: number;

  /**
   * Composite score for ranking.
   * Formula: profit * sqrt(dailyVolume)
   */
  profitScore: number;
}

/**
 * Options for filtering profitable items.
 *
 * @interface ProfitScannerOptions
 */
export interface ProfitScannerOptions {
  /**
   * Maximum number of results to return.
   */
  limit?: number;

  /**
   * Minimum daily trading volume.
   */
  minDailyVolume?: number;

  /**
   * Minimum profit margin (0-1).
   */
  minProfitMargin?: number;

  /**
   * Filter to specific crafting disciplines.
   */
  disciplines?: string[];
}

/**
 * Recipe with price data for quick filtering.
 */
export interface RecipeWithPrices {
  recipe: Recipe;
  item: Item;
  sellPrice: number;
  sellQuantity: number;
  estimatedCraftCost: number;
}

/**
 * Data access interface for profit scanning.
 *
 * @interface ProfitScannerDataAccess
 */
export interface ProfitScannerDataAccess {
  /**
   * Retrieves all items that have crafting recipes.
   */
  getAllCraftableItems(): Promise<Item[]>;

  /**
   * Retrieves recipes with pre-calculated price estimates for quick filtering.
   * This is much faster than analyzing each item individually.
   */
  getRecipesWithPriceEstimates?(): Promise<RecipeWithPrices[]>;

  /**
   * Retrieves all recipes that produce the given item.
   */
  getRecipesByOutputItem(itemId: number): Promise<Recipe[]>;

  /**
   * Retrieves the current trading post price for an item.
   */
  getPrice(itemId: number): Promise<Price | null>;

  /**
   * Retrieves price trend data for an item.
   */
  getPriceTrend(itemId: number): Promise<PriceTrend | null>;

  /**
   * Retrieves the calculated craft cost for an item.
   * Returns null if craft cost cannot be determined.
   */
  getCraftCost(itemId: number): Promise<number | null>;
}

/**
 * Service for scanning and ranking profitable crafting opportunities.
 *
 * @class ProfitOpportunityScannerService
 */
export class ProfitOpportunityScannerService {
  /**
   * Data access layer for database queries.
   */
  private readonly dataAccess: ProfitScannerDataAccess;

  /**
   * Creates a new ProfitOpportunityScannerService.
   *
   * @param dataAccess - Data access implementation
   */
  constructor(dataAccess: ProfitScannerDataAccess) {
    this.dataAccess = dataAccess;
  }

  /**
   * Finds the top profitable items for crafting.
   *
   * Uses a two-phase approach for performance:
   * 1. Quick pre-filter using estimated costs (fast)
   * 2. Full analysis only on promising candidates (slow but accurate)
   *
   * @param options - Filtering and sorting options
   * @returns Array of profitable items sorted by profit score
   */
  async getTopProfitableItems(
    options: ProfitScannerOptions = {}
  ): Promise<ProfitableItem[]> {
    const {
      limit = 50,
      minDailyVolume = 0,
      minProfitMargin = 0,
      disciplines,
    } = options;

    // Try to use the optimized path if available
    if (this.dataAccess.getRecipesWithPriceEstimates) {
      return this.getTopProfitableItemsFast(options);
    }

    // Fallback to slower method but with early termination
    return this.getTopProfitableItemsSlow(options);
  }

  /**
   * Fast path: Uses pre-calculated estimates for quick filtering.
   */
  private async getTopProfitableItemsFast(
    options: ProfitScannerOptions
  ): Promise<ProfitableItem[]> {
    const {
      limit = 50,
      minDailyVolume = 0,
      minProfitMargin = 0,
      disciplines,
    } = options;

    const recipesWithPrices = await this.dataAccess.getRecipesWithPriceEstimates!();

    // Quick filter based on estimates
    const candidates = recipesWithPrices
      .filter((r) => {
        // Filter by disciplines if specified
        if (disciplines && disciplines.length > 0) {
          if (!r.recipe.disciplines.some((d) => disciplines.includes(d))) {
            return false;
          }
        }

        // Filter by volume
        if (r.sellQuantity < minDailyVolume) {
          return false;
        }

        // Quick profit check using estimate
        const netSell = r.sellPrice * (1 - TP_TAX_RATE);
        const estimatedProfit = netSell - r.estimatedCraftCost;
        const estimatedMargin = netSell > 0 ? estimatedProfit / netSell : 0;

        return estimatedProfit > 0 && estimatedMargin >= minProfitMargin * 0.5; // Use 50% of margin for pre-filter
      })
      // Sort by estimated profit potential
      .sort((a, b) => {
        const aProfit = a.sellPrice * (1 - TP_TAX_RATE) - a.estimatedCraftCost;
        const bProfit = b.sellPrice * (1 - TP_TAX_RATE) - b.estimatedCraftCost;
        return bProfit * Math.sqrt(b.sellQuantity) - aProfit * Math.sqrt(a.sellQuantity);
      })
      // Take top candidates for full analysis (3x limit for safety)
      .slice(0, limit * 3);

    // Full analysis on candidates
    const profitableItems: ProfitableItem[] = [];

    for (const candidate of candidates) {
      const result = await this.analyzeItemDirect(candidate, minDailyVolume, minProfitMargin);
      if (result) {
        profitableItems.push(result);
      }
    }

    // Final sort and limit
    profitableItems.sort((a, b) => b.profitScore - a.profitScore);
    return profitableItems.slice(0, limit);
  }

  /**
   * Slow path: Analyzes items one by one but with early termination.
   */
  private async getTopProfitableItemsSlow(
    options: ProfitScannerOptions
  ): Promise<ProfitableItem[]> {
    const {
      limit = 50,
      minDailyVolume = 0,
      minProfitMargin = 0,
      disciplines,
    } = options;

    // Get all craftable items
    const craftableItems = await this.dataAccess.getAllCraftableItems();

    const profitableItems: ProfitableItem[] = [];
    let analyzed = 0;
    const maxAnalyze = 500; // Limit how many items we fully analyze

    for (const item of craftableItems) {
      // Early termination if we've analyzed enough
      if (analyzed >= maxAnalyze && profitableItems.length >= limit) {
        break;
      }

      const result = await this.analyzeItem(item, disciplines);
      analyzed++;

      if (!result) {
        continue;
      }

      // Apply filters
      if (result.dailyVolume < minDailyVolume) {
        continue;
      }

      if (result.profitMargin < minProfitMargin) {
        continue;
      }

      if (result.profit <= 0) {
        continue;
      }

      profitableItems.push(result);
    }

    // Sort by profit score (descending)
    profitableItems.sort((a, b) => b.profitScore - a.profitScore);

    // Apply limit
    return profitableItems.slice(0, limit);
  }

  /**
   * Analyzes a pre-filtered candidate item.
   */
  private async analyzeItemDirect(
    candidate: RecipeWithPrices,
    minDailyVolume: number,
    minProfitMargin: number
  ): Promise<ProfitableItem | null> {
    const { recipe, item, sellPrice, sellQuantity } = candidate;

    // Get actual craft cost (this is the expensive operation)
    const craftCost = await this.dataAccess.getCraftCost(item.id);
    if (craftCost === null) {
      return null;
    }

    // Get trend data for volume, fallback to current sell quantity if no history or 0 volume
    const trend = await this.dataAccess.getPriceTrend(item.id);
    const dailyVolume = trend?.avgDailyVolume || sellQuantity;

    if (dailyVolume < minDailyVolume) {
      return null;
    }

    // Calculate profit (after 15% TP tax)
    const netSellPrice = sellPrice * (1 - TP_TAX_RATE);
    const profit = Math.round(netSellPrice - craftCost);

    if (profit <= 0) {
      return null;
    }

    // Calculate profit margin
    const profitMargin = netSellPrice > 0 ? profit / netSellPrice : 0;

    if (profitMargin < minProfitMargin) {
      return null;
    }

    // Calculate profit score: profit × sqrt(dailyVolume)
    const profitScore = profit * Math.sqrt(dailyVolume);

    return {
      item,
      recipe,
      craftCost,
      sellPrice,
      profit,
      profitMargin,
      dailyVolume,
      profitScore,
    };
  }

  /**
   * Analyzes a single item for profitability.
   *
   * @param item - The item to analyze
   * @param disciplines - Optional filter for crafting disciplines
   * @returns Profitable item analysis or null if not profitable/applicable
   */
  private async analyzeItem(
    item: Item,
    disciplines?: string[]
  ): Promise<ProfitableItem | null> {
    // Get recipes for this item
    const recipes = await this.dataAccess.getRecipesByOutputItem(item.id);
    if (recipes.length === 0) {
      return null;
    }

    // Filter by disciplines if specified
    let filteredRecipes = recipes;
    if (disciplines && disciplines.length > 0) {
      filteredRecipes = recipes.filter((recipe) =>
        recipe.disciplines.some((d) => disciplines.includes(d))
      );
      if (filteredRecipes.length === 0) {
        return null;
      }
    }

    // Use the first matching recipe (could be enhanced to pick best)
    const recipe = filteredRecipes[0];

    // Get current price
    const price = await this.dataAccess.getPrice(item.id);
    if (!price || price.sellPrice === 0) {
      return null;
    }

    // Get craft cost
    const craftCost = await this.dataAccess.getCraftCost(item.id);
    if (craftCost === null) {
      return null;
    }

    // Get trend data for volume, fallback to current sell quantity if no history or 0 volume
    const trend = await this.dataAccess.getPriceTrend(item.id);
    const dailyVolume = trend?.avgDailyVolume || price.sellQuantity;

    // Calculate profit (after 15% TP tax)
    const netSellPrice = price.sellPrice * (1 - TP_TAX_RATE);
    const profit = Math.round(netSellPrice - craftCost);

    // Calculate profit margin
    const profitMargin = netSellPrice > 0 ? profit / netSellPrice : 0;

    // Calculate profit score: profit × sqrt(dailyVolume)
    const profitScore = profit * Math.sqrt(dailyVolume);

    return {
      item,
      recipe,
      craftCost,
      sellPrice: price.sellPrice,
      profit,
      profitMargin,
      dailyVolume,
      profitScore,
    };
  }
}

