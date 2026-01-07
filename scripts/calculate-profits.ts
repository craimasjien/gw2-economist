/**
 * @fileoverview Script to pre-calculate profitable crafting opportunities.
 *
 * This script scans all craftable items, calculates profit potential, and stores
 * the top opportunities in the profit_opportunities table. This makes the
 * opportunities page load instantly instead of calculating on-demand.
 *
 * Should be run after sync:prices-with-history completes.
 *
 * @module scripts/calculate-profits
 *
 * @example
 * ```bash
 * pnpm calculate:profits
 * ```
 */

import "dotenv/config";
import { db, profitOpportunities, recipes, items, prices } from "../server/db";
import { sql, inArray } from "drizzle-orm";
import type { NewProfitOpportunity } from "../server/db/schema";
import { createExtendedDataAccess } from "../server/services/data-access";
import { CraftCalculatorService } from "../server/services/craft-calculator.service";

/**
 * Trading post tax rate (15%).
 */
const TP_TAX_RATE = 0.15;

/**
 * Maximum number of opportunities to store.
 */
const MAX_OPPORTUNITIES = 500;

/**
 * Minimum profit to be considered an opportunity (in copper).
 */
const MIN_PROFIT = 100; // 1 silver

/**
 * Formats elapsed time as human-readable string.
 */
function formatDuration(startTime: number): string {
  const elapsed = Date.now() - startTime;
  const seconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Main function to calculate and store profit opportunities.
 */
async function calculateProfits(): Promise<void> {
  const startTime = Date.now();
  const calculatedAt = new Date();

  console.log("💰 Calculating profit opportunities...");
  console.log("━".repeat(50));

  // Step 1: Get all recipes with their items and prices in batch
  console.log("\n📥 Loading recipes, items, and prices...");

  const allRecipes = await db.select().from(recipes);
  console.log(`   Found ${allRecipes.length.toLocaleString()} recipes`);

  if (allRecipes.length === 0) {
    console.log("\n⚠️  No recipes found. Run sync:recipes first.");
    return;
  }

  // Collect all item IDs we need
  const allItemIds = new Set<number>();
  for (const recipe of allRecipes) {
    allItemIds.add(recipe.outputItemId);
    for (const ing of recipe.ingredients) {
      allItemIds.add(ing.itemId);
    }
  }

  // Batch fetch items and prices
  const itemIdArray = [...allItemIds];
  const [allItems, allPrices] = await Promise.all([
    db.select().from(items).where(inArray(items.id, itemIdArray)),
    db.select().from(prices).where(inArray(prices.itemId, itemIdArray)),
  ]);

  console.log(`   Loaded ${allItems.length.toLocaleString()} items`);
  console.log(`   Loaded ${allPrices.length.toLocaleString()} prices`);

  // Build lookup maps
  const itemMap = new Map(allItems.map((i) => [i.id, i]));
  const priceMap = new Map(allPrices.map((p) => [p.itemId, p]));

  // Step 2: Create craft calculator for accurate cost calculations
  const dataAccess = createExtendedDataAccess(db);
  const calculator = new CraftCalculatorService(dataAccess);

  // Step 3: Calculate profits for each recipe
  console.log("\n🔄 Analyzing recipes for profit potential...");

  const opportunities: NewProfitOpportunity[] = [];
  let analyzed = 0;
  let profitable = 0;

  for (const recipe of allRecipes) {
    analyzed++;

    // Progress update every 1000 recipes
    if (analyzed % 1000 === 0) {
      process.stdout.write(
        `\r   Progress: ${analyzed.toLocaleString()}/${allRecipes.length.toLocaleString()} (${profitable} profitable)`
      );
    }

    const item = itemMap.get(recipe.outputItemId);
    const price = priceMap.get(recipe.outputItemId);

    // Skip if no item or no sellable price
    if (!item || !price || price.sellPrice === 0) {
      continue;
    }

    // Quick estimate from ingredient buy prices
    let estimatedCraftCost = 0;
    let hasAllPrices = true;

    for (const ing of recipe.ingredients) {
      const ingPrice = priceMap.get(ing.itemId);
      if (!ingPrice || ingPrice.buyPrice === 0) {
        hasAllPrices = false;
        break;
      }
      estimatedCraftCost += ingPrice.buyPrice * ing.count;
    }

    if (!hasAllPrices) {
      continue;
    }

    // Adjust for output count
    estimatedCraftCost = Math.ceil(estimatedCraftCost / recipe.outputItemCount);

    // Quick profit check before expensive calculation
    const netSellPrice = price.sellPrice * (1 - TP_TAX_RATE);
    const estimatedProfit = netSellPrice - estimatedCraftCost;

    if (estimatedProfit < MIN_PROFIT) {
      continue;
    }

    // Get accurate craft cost using the calculator
    try {
      const analysis = await calculator.analyze(recipe.outputItemId);
      if (!analysis) {
        continue;
      }

      const profit = Math.round(netSellPrice - analysis.craftCost);
      if (profit < MIN_PROFIT) {
        continue;
      }

      // Calculate metrics
      const profitMarginBps = Math.round((profit / netSellPrice) * 10000); // Basis points
      const dailyVolume = price.sellQuantity; // Use current sell quantity as volume proxy
      const profitScore = Math.round(profit * Math.sqrt(dailyVolume));

      profitable++;

      opportunities.push({
        itemId: item.id,
        recipeId: recipe.id,
        itemName: item.name,
        itemIcon: item.icon,
        itemRarity: item.rarity,
        disciplines: recipe.disciplines,
        craftCost: analysis.craftCost,
        sellPrice: price.sellPrice,
        profit,
        profitMarginBps,
        dailyVolume,
        profitScore,
        calculatedAt,
      });
    } catch {
      // Skip items that fail calculation
      continue;
    }
  }

  console.log(
    `\r   Progress: ${analyzed.toLocaleString()}/${allRecipes.length.toLocaleString()} (${profitable} profitable)`
  );

  // Step 4: Sort by profit score and take top N
  opportunities.sort((a, b) => b.profitScore - a.profitScore);
  const topOpportunities = opportunities.slice(0, MAX_OPPORTUNITIES);

  // Step 5: Replace table contents
  console.log(`\n💾 Saving top ${topOpportunities.length} opportunities...`);

  // Truncate existing data
  await db.delete(profitOpportunities);

  // Insert new opportunities in batches
  const BATCH_SIZE = 100;
  for (let i = 0; i < topOpportunities.length; i += BATCH_SIZE) {
    const batch = topOpportunities.slice(i, i + BATCH_SIZE);
    await db.insert(profitOpportunities).values(batch);
  }

  // Summary
  console.log("\n━".repeat(50));
  console.log("✅ Profit calculation complete!");
  console.log(`   📊 Recipes analyzed: ${analyzed.toLocaleString()}`);
  console.log(`   💎 Profitable items found: ${profitable.toLocaleString()}`);
  console.log(`   📈 Top opportunities saved: ${topOpportunities.length}`);
  console.log(`   ⏱️  Duration: ${formatDuration(startTime)}`);
  console.log("━".repeat(50));
}

// Run the calculation
calculateProfits()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Profit calculation failed:", error);
    process.exit(1);
  });

