/**
 * @fileoverview Combined sync script that runs all data synchronization tasks.
 *
 * This script orchestrates the synchronization of all GW2 data in the correct order:
 * 1. Items - Base item metadata
 * 2. Recipes - Crafting recipes (references items)
 * 3. Prices - Trading post prices (references items)
 *
 * Use this script for initial data population or full refreshes.
 * For regular updates, consider running only `sync:prices` as prices change most frequently.
 *
 * @module scripts/sync-all
 *
 * @example
 * ```bash
 * # Run full sync
 * pnpm sync:all
 *
 * # Or with tsx directly
 * npx tsx scripts/sync-all.ts
 * ```
 */

import "dotenv/config";
import { db, items, recipes, prices } from "../server/db";
import { gw2Api } from "../server/services/gw2-api";
import type { GW2Item, GW2Recipe, GW2Price } from "../server/services/gw2-api";
import type {
  NewItem,
  NewRecipe,
  NewPrice,
  RecipeIngredient,
  GuildUpgradeIngredient,
} from "../server/db/schema";

/**
 * Batch size for database upserts.
 */
const DB_BATCH_SIZE = 500;

/**
 * Formats elapsed time as human-readable string.
 *
 * @param startTime - Start timestamp in milliseconds
 * @returns Formatted duration string
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

// ============================================================================
// Item Sync
// ============================================================================

/**
 * Transforms a GW2 API item response to a database record.
 */
function transformItem(apiItem: GW2Item): NewItem {
  return {
    id: apiItem.id,
    name: apiItem.name,
    description: apiItem.description ?? null,
    type: apiItem.type,
    rarity: apiItem.rarity,
    level: apiItem.level,
    icon: apiItem.icon ?? null,
    vendorValue: apiItem.vendor_value,
    chatLink: apiItem.chat_link,
    flags: apiItem.flags,
    updatedAt: new Date(),
  };
}

/**
 * Upserts a batch of items into the database.
 */
async function upsertItems(itemBatch: NewItem[]): Promise<void> {
  if (itemBatch.length === 0) return;

  await db
    .insert(items)
    .values(itemBatch)
    .onConflictDoUpdate({
      target: items.id,
      set: {
        name: items.name,
        description: items.description,
        type: items.type,
        rarity: items.rarity,
        level: items.level,
        icon: items.icon,
        vendorValue: items.vendorValue,
        chatLink: items.chatLink,
        flags: items.flags,
        updatedAt: new Date(),
      },
    });
}

/**
 * Syncs all items from the GW2 API.
 */
async function syncItems(): Promise<number> {
  console.log("\n📦 SYNCING ITEMS");
  console.log("─".repeat(40));

  const itemIds = await gw2Api.getAllItemIds();
  console.log(`   Found ${itemIds.length.toLocaleString()} items`);

  const { items: apiItems, failedIds } = await gw2Api.getItemsBatch(
    itemIds,
    (progress) => {
      const percent = Math.round((progress.current / progress.total) * 100);
      process.stdout.write(
        `\r   Fetching: ${progress.current.toLocaleString()}/${progress.total.toLocaleString()} (${percent}%)`
      );
    }
  );
  console.log();

  if (failedIds.length > 0) {
    console.log(`   ⚠️  ${failedIds.length} items failed`);
  }

  const transformedItems = apiItems.map(transformItem);
  let count = 0;

  for (let i = 0; i < transformedItems.length; i += DB_BATCH_SIZE) {
    const batch = transformedItems.slice(i, i + DB_BATCH_SIZE);
    await upsertItems(batch);
    count += batch.length;

    const percent = Math.round((count / transformedItems.length) * 100);
    process.stdout.write(
      `\r   Saving:   ${count.toLocaleString()}/${transformedItems.length.toLocaleString()} (${percent}%)`
    );
  }
  console.log();

  return count;
}

// ============================================================================
// Recipe Sync
// ============================================================================

/**
 * Transforms a GW2 API recipe response to a database record.
 */
function transformRecipe(apiRecipe: GW2Recipe): NewRecipe {
  const ingredients: RecipeIngredient[] = apiRecipe.ingredients.map((ing) => ({
    itemId: ing.item_id,
    count: ing.count,
  }));

  const guildIngredients: GuildUpgradeIngredient[] = (
    apiRecipe.guild_ingredients ?? []
  ).map((ing) => ({
    upgradeId: ing.upgrade_id,
    count: ing.count,
  }));

  return {
    id: apiRecipe.id,
    type: apiRecipe.type,
    outputItemId: apiRecipe.output_item_id,
    outputItemCount: apiRecipe.output_item_count,
    minRating: apiRecipe.min_rating,
    timeToCraft: apiRecipe.time_to_craft_ms,
    disciplines: apiRecipe.disciplines,
    flags: apiRecipe.flags,
    ingredients,
    guildIngredients,
    chatLink: apiRecipe.chat_link,
    updatedAt: new Date(),
  };
}

/**
 * Upserts a batch of recipes into the database.
 */
async function upsertRecipes(recipeBatch: NewRecipe[]): Promise<void> {
  if (recipeBatch.length === 0) return;

  await db
    .insert(recipes)
    .values(recipeBatch)
    .onConflictDoUpdate({
      target: recipes.id,
      set: {
        type: recipes.type,
        outputItemId: recipes.outputItemId,
        outputItemCount: recipes.outputItemCount,
        minRating: recipes.minRating,
        timeToCraft: recipes.timeToCraft,
        disciplines: recipes.disciplines,
        flags: recipes.flags,
        ingredients: recipes.ingredients,
        guildIngredients: recipes.guildIngredients,
        chatLink: recipes.chatLink,
        updatedAt: new Date(),
      },
    });
}

/**
 * Syncs all recipes from the GW2 API.
 */
async function syncRecipes(): Promise<number> {
  console.log("\n📜 SYNCING RECIPES");
  console.log("─".repeat(40));

  const recipeIds = await gw2Api.getAllRecipeIds();
  console.log(`   Found ${recipeIds.length.toLocaleString()} recipes`);

  const { items: apiRecipes, failedIds } = await gw2Api.getRecipesBatch(
    recipeIds,
    (progress) => {
      const percent = Math.round((progress.current / progress.total) * 100);
      process.stdout.write(
        `\r   Fetching: ${progress.current.toLocaleString()}/${progress.total.toLocaleString()} (${percent}%)`
      );
    }
  );
  console.log();

  if (failedIds.length > 0) {
    console.log(`   ⚠️  ${failedIds.length} recipes failed`);
  }

  const transformedRecipes = apiRecipes.map(transformRecipe);
  let count = 0;

  for (let i = 0; i < transformedRecipes.length; i += DB_BATCH_SIZE) {
    const batch = transformedRecipes.slice(i, i + DB_BATCH_SIZE);
    await upsertRecipes(batch);
    count += batch.length;

    const percent = Math.round((count / transformedRecipes.length) * 100);
    process.stdout.write(
      `\r   Saving:   ${count.toLocaleString()}/${transformedRecipes.length.toLocaleString()} (${percent}%)`
    );
  }
  console.log();

  return count;
}

// ============================================================================
// Price Sync
// ============================================================================

/**
 * Transforms a GW2 API price response to a database record.
 */
function transformPrice(apiPrice: GW2Price): NewPrice {
  return {
    itemId: apiPrice.id,
    buyPrice: apiPrice.buys.unit_price,
    buyQuantity: apiPrice.buys.quantity,
    sellPrice: apiPrice.sells.unit_price,
    sellQuantity: apiPrice.sells.quantity,
    updatedAt: new Date(),
  };
}

/**
 * Upserts a batch of prices into the database.
 */
async function upsertPrices(priceBatch: NewPrice[]): Promise<void> {
  if (priceBatch.length === 0) return;

  await db
    .insert(prices)
    .values(priceBatch)
    .onConflictDoUpdate({
      target: prices.itemId,
      set: {
        buyPrice: prices.buyPrice,
        buyQuantity: prices.buyQuantity,
        sellPrice: prices.sellPrice,
        sellQuantity: prices.sellQuantity,
        updatedAt: new Date(),
      },
    });
}

/**
 * Syncs all prices from the GW2 API.
 */
async function syncPrices(): Promise<number> {
  console.log("\n💰 SYNCING PRICES");
  console.log("─".repeat(40));

  const priceIds = await gw2Api.getAllPriceIds();
  console.log(`   Found ${priceIds.length.toLocaleString()} tradable items`);

  const { items: apiPrices, failedIds } = await gw2Api.getPricesBatch(
    priceIds,
    (progress) => {
      const percent = Math.round((progress.current / progress.total) * 100);
      process.stdout.write(
        `\r   Fetching: ${progress.current.toLocaleString()}/${progress.total.toLocaleString()} (${percent}%)`
      );
    }
  );
  console.log();

  if (failedIds.length > 0) {
    console.log(`   ⚠️  ${failedIds.length} prices failed`);
  }

  const transformedPrices = apiPrices.map(transformPrice);
  let count = 0;

  for (let i = 0; i < transformedPrices.length; i += DB_BATCH_SIZE) {
    const batch = transformedPrices.slice(i, i + DB_BATCH_SIZE);
    await upsertPrices(batch);
    count += batch.length;

    const percent = Math.round((count / transformedPrices.length) * 100);
    process.stdout.write(
      `\r   Saving:   ${count.toLocaleString()}/${transformedPrices.length.toLocaleString()} (${percent}%)`
    );
  }
  console.log();

  return count;
}

// ============================================================================
// Main
// ============================================================================

/**
 * Main function that orchestrates the full sync process.
 */
async function syncAll(): Promise<void> {
  const startTime = Date.now();

  console.log("🔄 FULL DATA SYNC");
  console.log("━".repeat(50));
  console.log(`   Started at: ${new Date().toISOString()}`);

  // Sync in order: items first (referenced by recipes and prices)
  const itemCount = await syncItems();
  const recipeCount = await syncRecipes();
  const priceCount = await syncPrices();

  // Summary
  console.log("\n━".repeat(50));
  console.log("✅ SYNC COMPLETE");
  console.log("━".repeat(50));
  console.log(`   📦 Items:   ${itemCount.toLocaleString()}`);
  console.log(`   📜 Recipes: ${recipeCount.toLocaleString()}`);
  console.log(`   💰 Prices:  ${priceCount.toLocaleString()}`);
  console.log(`   ⏱️  Total:   ${formatDuration(startTime)}`);
  console.log("━".repeat(50));
}

// Run the sync
syncAll()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Sync failed:", error);
    process.exit(1);
  });

