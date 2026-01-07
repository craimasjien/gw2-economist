/**
 * @fileoverview Script to synchronize trading post prices from the GW2 API to the database.
 *
 * This script fetches all tradable item IDs from the commerce endpoint, then batch-fetches
 * the current prices and upserts them into the database. This script should be run frequently
 * (e.g., hourly) as prices change constantly.
 *
 * @module scripts/sync-prices
 *
 * @example
 * ```bash
 * # Run the sync script
 * pnpm sync:prices
 *
 * # Or with tsx directly
 * npx tsx scripts/sync-prices.ts
 * ```
 */

import "dotenv/config";
import { db, prices } from "../server/db";
import { gw2Api } from "../server/services/gw2-api";
import type { GW2Price } from "../server/services/gw2-api";
import type { NewPrice } from "../server/db/schema";

/**
 * Batch size for database upserts.
 */
const DB_BATCH_SIZE = 1000;

/**
 * Transforms a GW2 API price response to a database record.
 *
 * @param apiPrice - Price data from the GW2 API
 * @returns Database-ready price record
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
 *
 * @param priceBatch - Array of prices to upsert
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

/**
 * Main sync function that orchestrates the price synchronization process.
 */
async function syncPrices(): Promise<void> {
  const startTime = Date.now();

  console.log("🔄 Starting price sync...");
  console.log("━".repeat(50));

  // Step 1: Fetch all tradable item IDs
  console.log("📥 Fetching tradable item IDs from GW2 API...");
  const priceIds = await gw2Api.getAllPriceIds();
  console.log(`   Found ${priceIds.length.toLocaleString()} tradable items`);

  // Step 2: Batch fetch prices from API with progress
  console.log("\n📦 Fetching price data...");
  const { items: apiPrices, failedIds, errors } = await gw2Api.getPricesBatch(
    priceIds,
    (progress) => {
      const percent = Math.round((progress.current / progress.total) * 100);
      process.stdout.write(
        `\r   Progress: ${progress.current.toLocaleString()}/${progress.total.toLocaleString()} (${percent}%)`
      );
    }
  );
  console.log(); // New line after progress

  if (failedIds.length > 0) {
    console.log(`   ⚠️  ${failedIds.length} prices failed to fetch`);
  }
  if (errors.length > 0) {
    console.log(`   ⚠️  Errors: ${errors.slice(0, 3).join(", ")}${errors.length > 3 ? "..." : ""}`);
  }

  // Step 3: Transform and upsert to database in batches
  console.log("\n💾 Syncing to database...");
  const transformedPrices = apiPrices.map(transformPrice);
  let upsertedCount = 0;

  for (let i = 0; i < transformedPrices.length; i += DB_BATCH_SIZE) {
    const batch = transformedPrices.slice(i, i + DB_BATCH_SIZE);
    await upsertPrices(batch);
    upsertedCount += batch.length;

    const percent = Math.round((upsertedCount / transformedPrices.length) * 100);
    process.stdout.write(
      `\r   Progress: ${upsertedCount.toLocaleString()}/${transformedPrices.length.toLocaleString()} (${percent}%)`
    );
  }
  console.log(); // New line after progress

  // Summary
  console.log("\n━".repeat(50));
  console.log("✅ Price sync complete!");
  console.log(`   📊 Prices synced: ${upsertedCount.toLocaleString()}`);
  console.log(`   ⏱️  Duration: ${formatDuration(startTime)}`);
  console.log("━".repeat(50));
}

// Run the sync
syncPrices()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Sync failed:", error);
    process.exit(1);
  });

