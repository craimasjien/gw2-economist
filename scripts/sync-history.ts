/**
 * @fileoverview Script to record historical price snapshots from the prices table.
 *
 * This script copies current prices from the `prices` table into the `price_history`
 * table for trend analysis. It checks if the last snapshot was more than 1 hour ago
 * to prevent duplicate entries when run multiple times.
 *
 * @module scripts/sync-history
 *
 * @example
 * ```bash
 * # Run the sync script
 * pnpm sync:history
 *
 * # Force snapshot regardless of time
 * pnpm sync:history -- --force
 * pnpm sync:history -- -f
 *
 * # Or with tsx directly
 * npx tsx scripts/sync-history.ts --force
 *
 * # Run after price sync (recommended)
 * pnpm sync:all-with-history
 * ```
 */

import "dotenv/config";
import { db, prices, priceHistory } from "../server/db";
import { desc, sql } from "drizzle-orm";
import type { NewPriceHistory } from "../server/db/schema";

/**
 * Minimum interval between snapshots in milliseconds (1 hour).
 */
const MIN_SNAPSHOT_INTERVAL_MS = 60 * 60 * 1000;

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
 * Gets the timestamp of the most recent price history snapshot.
 *
 * @returns The most recent recordedAt timestamp, or null if no snapshots exist
 */
async function getLastSnapshotTime(): Promise<Date | null> {
  const result = await db
    .select({ recordedAt: priceHistory.recordedAt })
    .from(priceHistory)
    .orderBy(desc(priceHistory.recordedAt))
    .limit(1);

  return result.length > 0 ? result[0].recordedAt : null;
}

/**
 * Checks if enough time has passed since the last snapshot.
 *
 * @param lastSnapshot - Timestamp of the last snapshot
 * @returns True if a new snapshot should be taken
 */
function shouldTakeSnapshot(lastSnapshot: Date | null): boolean {
  if (!lastSnapshot) {
    return true;
  }

  const timeSinceLastSnapshot = Date.now() - lastSnapshot.getTime();
  return timeSinceLastSnapshot >= MIN_SNAPSHOT_INTERVAL_MS;
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
 * Parses command line arguments for the --force/-f flag.
 *
 * @returns True if force flag is present
 */
function parseArgs(): { force: boolean } {
  const args = process.argv.slice(2);
  const force = args.includes("--force") || args.includes("-f");
  return { force };
}

/**
 * Main sync function that records price history snapshots.
 *
 * @param force - If true, skip the time check and always take a snapshot
 */
async function syncHistory(force = false): Promise<void> {
  const startTime = Date.now();
  const snapshotTime = new Date();

  console.log("📸 Starting price history snapshot...");
  if (force) {
    console.log("⚡ Force mode enabled - skipping time check");
  }
  console.log("━".repeat(50));

  // Step 1: Check if we should take a snapshot (unless force mode)
  if (!force) {
    console.log("🔍 Checking last snapshot time...");
    const lastSnapshot = await getLastSnapshotTime();

    if (lastSnapshot) {
      const minutesSince = Math.round((Date.now() - lastSnapshot.getTime()) / 60000);
      console.log(`   Last snapshot: ${minutesSince} minutes ago`);
    } else {
      console.log("   No previous snapshots found");
    }

    if (!shouldTakeSnapshot(lastSnapshot)) {
      const minutesRemaining = Math.ceil(
        (MIN_SNAPSHOT_INTERVAL_MS - (Date.now() - lastSnapshot!.getTime())) / 60000
      );
      console.log(`\n⏳ Skipping snapshot - next one in ${minutesRemaining} minutes`);
      console.log("   Use --force or -f to override");
      console.log("━".repeat(50));
      return;
    }
  }

  // Step 2: Fetch current prices from the prices table
  console.log("\n📥 Fetching current prices from database...");
  const currentPrices = await db.select().from(prices);
  console.log(`   Found ${currentPrices.length.toLocaleString()} prices`);

  if (currentPrices.length === 0) {
    console.log("\n⚠️  No prices found. Run sync:prices first.");
    console.log("━".repeat(50));
    return;
  }

  // Step 3: Transform prices to history records
  const historyRecords: NewPriceHistory[] = currentPrices.map((price) => ({
    itemId: price.itemId,
    buyPrice: price.buyPrice,
    buyQuantity: price.buyQuantity,
    sellPrice: price.sellPrice,
    sellQuantity: price.sellQuantity,
    recordedAt: snapshotTime,
  }));

  // Step 4: Insert history records in batches
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

  // Step 5: Get total history record count
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

// Parse arguments and run the sync
const { force } = parseArgs();
syncHistory(force)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ History sync failed:", error);
    process.exit(1);
  });

