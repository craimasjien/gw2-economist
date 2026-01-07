/**
 * @fileoverview Script to record historical price snapshots from the prices table.
 *
 * This script copies current prices from the `prices` table into the `price_history`
 * table for trend analysis. Each run creates a new snapshot regardless of when the
 * last snapshot was taken.
 *
 * @module scripts/sync-history
 *
 * @example
 * ```bash
 * # Run the sync script
 * pnpm sync:history
 *
 * # Run after price sync (recommended)
 * pnpm sync:prices-with-history
 * ```
 */

import "dotenv/config";
import { db, prices, priceHistory } from "../server/db";
import { sql } from "drizzle-orm";
import type { NewPriceHistory } from "../server/db/schema";

/**
 * Batch size for database inserts.
 */
const DB_BATCH_SIZE = 1000;

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
 * Inserts a batch of price history records.
 *
 * @param historyBatch - Array of price history records to insert
 */
async function insertHistoryBatch(historyBatch: NewPriceHistory[]): Promise<void> {
  if (historyBatch.length === 0) return;

  await db.insert(priceHistory).values(historyBatch);
}

/**
 * Main sync function that records price history snapshots.
 */
async function syncHistory(): Promise<void> {
  const startTime = Date.now();
  const snapshotTime = new Date();

  console.log("📸 Starting price history snapshot...");
  console.log("━".repeat(50));

  // Step 1: Fetch current prices from the prices table
  console.log("\n📥 Fetching current prices from database...");
  const currentPrices = await db.select().from(prices);
  console.log(`   Found ${currentPrices.length.toLocaleString()} prices`);

  if (currentPrices.length === 0) {
    console.log("\n⚠️  No prices found. Run sync:prices first.");
    console.log("━".repeat(50));
    return;
  }

  // Step 2: Transform prices to history records
  const historyRecords: NewPriceHistory[] = currentPrices.map((price) => ({
    itemId: price.itemId,
    buyPrice: price.buyPrice,
    buyQuantity: price.buyQuantity,
    sellPrice: price.sellPrice,
    sellQuantity: price.sellQuantity,
    recordedAt: snapshotTime,
  }));

  // Step 3: Insert history records in batches
  console.log("\n💾 Recording price history...");
  let insertedCount = 0;

  for (let i = 0; i < historyRecords.length; i += DB_BATCH_SIZE) {
    const batch = historyRecords.slice(i, i + DB_BATCH_SIZE);
    await insertHistoryBatch(batch);
    insertedCount += batch.length;

    const percent = Math.round((insertedCount / historyRecords.length) * 100);
    process.stdout.write(
      `\r   Progress: ${insertedCount.toLocaleString()}/${historyRecords.length.toLocaleString()} (${percent}%)`
    );
  }
  console.log(); // New line after progress

  // Step 4: Get total history record count
  const totalCountResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(priceHistory);
  const totalCount = totalCountResult[0]?.count ?? 0;

  // Summary
  console.log("\n━".repeat(50));
  console.log("✅ Price history snapshot complete!");
  console.log(`   📊 Records added: ${insertedCount.toLocaleString()}`);
  console.log(`   📈 Total history records: ${Number(totalCount).toLocaleString()}`);
  console.log(`   ⏱️  Duration: ${formatDuration(startTime)}`);
  console.log("━".repeat(50));
}

// Run the sync
syncHistory()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ History sync failed:", error);
    process.exit(1);
  });
