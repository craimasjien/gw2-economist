/**
 * @fileoverview Script to clean up old price history records.
 *
 * This script deletes price history records older than the retention period (1 year).
 * It should be run periodically (e.g., weekly via cron) to manage database size.
 *
 * @module scripts/cleanup-history
 *
 * @example
 * ```bash
 * # Run the cleanup script
 * pnpm cleanup:history
 *
 * # Or with tsx directly
 * npx tsx scripts/cleanup-history.ts
 * ```
 */

import "dotenv/config";
import { db, priceHistory } from "../server/db";
import { lt, sql } from "drizzle-orm";

/**
 * Retention period in days (1 year).
 */
const RETENTION_DAYS = 365;

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
 * Formats a number of bytes as human-readable string.
 *
 * @param bytes - Number of bytes
 * @returns Formatted string (e.g., "1.5 GB")
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Gets statistics about the price history table.
 *
 * @returns Object with total count and oldest record date
 */
async function getHistoryStats(): Promise<{
  totalCount: number;
  oldestRecord: Date | null;
  newestRecord: Date | null;
}> {
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(priceHistory);

  const oldestResult = await db
    .select({ recordedAt: priceHistory.recordedAt })
    .from(priceHistory)
    .orderBy(priceHistory.recordedAt)
    .limit(1);

  const newestResult = await db
    .select({ recordedAt: priceHistory.recordedAt })
    .from(priceHistory)
    .orderBy(sql`${priceHistory.recordedAt} DESC`)
    .limit(1);

  return {
    totalCount: Number(countResult[0]?.count ?? 0),
    oldestRecord: oldestResult[0]?.recordedAt ?? null,
    newestRecord: newestResult[0]?.recordedAt ?? null,
  };
}

/**
 * Main cleanup function that removes old price history records.
 */
async function cleanupHistory(): Promise<void> {
  const startTime = Date.now();

  console.log("🧹 Starting price history cleanup...");
  console.log("━".repeat(50));

  // Step 1: Get current stats
  console.log("📊 Getting current statistics...");
  const beforeStats = await getHistoryStats();
  console.log(`   Total records: ${beforeStats.totalCount.toLocaleString()}`);

  if (beforeStats.oldestRecord) {
    const daysOld = Math.round(
      (Date.now() - beforeStats.oldestRecord.getTime()) / (24 * 60 * 60 * 1000)
    );
    console.log(`   Oldest record: ${daysOld} days ago`);
  }

  if (beforeStats.totalCount === 0) {
    console.log("\n✅ No records to clean up.");
    console.log("━".repeat(50));
    return;
  }

  // Step 2: Calculate cutoff date
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

  console.log(`\n🗓️  Retention period: ${RETENTION_DAYS} days`);
  console.log(`   Cutoff date: ${cutoffDate.toISOString().split("T")[0]}`);

  // Step 3: Count records to delete
  const toDeleteResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(priceHistory)
    .where(lt(priceHistory.recordedAt, cutoffDate));

  const toDeleteCount = Number(toDeleteResult[0]?.count ?? 0);

  if (toDeleteCount === 0) {
    console.log("\n✅ No records older than retention period.");
    console.log("━".repeat(50));
    return;
  }

  console.log(`\n🗑️  Records to delete: ${toDeleteCount.toLocaleString()}`);

  // Step 4: Delete old records
  console.log("\n💾 Deleting old records...");
  const deleteResult = await db
    .delete(priceHistory)
    .where(lt(priceHistory.recordedAt, cutoffDate));

  // Step 5: Get stats after cleanup
  const afterStats = await getHistoryStats();
  const deletedCount = beforeStats.totalCount - afterStats.totalCount;

  // Summary
  console.log("\n━".repeat(50));
  console.log("✅ Price history cleanup complete!");
  console.log(`   🗑️  Records deleted: ${deletedCount.toLocaleString()}`);
  console.log(`   📊 Records remaining: ${afterStats.totalCount.toLocaleString()}`);
  console.log(`   ⏱️  Duration: ${formatDuration(startTime)}`);
  console.log("━".repeat(50));
}

// Run the cleanup
cleanupHistory()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Cleanup failed:", error);
    process.exit(1);
  });

