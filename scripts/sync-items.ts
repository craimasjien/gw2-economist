/**
 * @fileoverview Script to synchronize all GW2 items from the API to the database.
 *
 * This script fetches all item IDs from the GW2 API, then batch-fetches the item
 * details and upserts them into the database. Progress is logged to the console.
 *
 * @module scripts/sync-items
 *
 * @example
 * ```bash
 * # Run the sync script
 * pnpm sync:items
 *
 * # Or with tsx directly
 * npx tsx scripts/sync-items.ts
 * ```
 */

import "dotenv/config";
import { db, items } from "../server/db";
import { gw2Api } from "../server/services/gw2-api";
import type { GW2Item } from "../server/services/gw2-api";
import type { NewItem } from "../server/db/schema";

/**
 * Batch size for database upserts.
 * Using smaller batches to avoid memory issues with large datasets.
 */
const DB_BATCH_SIZE = 500;

/**
 * Transforms a GW2 API item response to a database record.
 *
 * @param apiItem - Item data from the GW2 API
 * @returns Database-ready item record
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
 *
 * @param itemBatch - Array of items to upsert
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
 * Main sync function that orchestrates the item synchronization process.
 */
async function syncItems(): Promise<void> {
  const startTime = Date.now();

  console.log("🔄 Starting item sync...");
  console.log("━".repeat(50));

  // Step 1: Fetch all item IDs
  console.log("📥 Fetching item IDs from GW2 API...");
  const itemIds = await gw2Api.getAllItemIds();
  console.log(`   Found ${itemIds.length.toLocaleString()} items`);

  // Step 2: Batch fetch items from API with progress
  console.log("\n📦 Fetching item details...");
  const { items: apiItems, failedIds, errors } = await gw2Api.getItemsBatch(
    itemIds,
    (progress) => {
      const percent = Math.round((progress.current / progress.total) * 100);
      process.stdout.write(
        `\r   Progress: ${progress.current.toLocaleString()}/${progress.total.toLocaleString()} (${percent}%)`
      );
    }
  );
  console.log(); // New line after progress

  if (failedIds.length > 0) {
    console.log(`   ⚠️  ${failedIds.length} items failed to fetch`);
  }
  if (errors.length > 0) {
    console.log(`   ⚠️  Errors: ${errors.slice(0, 3).join(", ")}${errors.length > 3 ? "..." : ""}`);
  }

  // Step 3: Transform and upsert to database in batches
  console.log("\n💾 Syncing to database...");
  const transformedItems = apiItems.map(transformItem);
  let upsertedCount = 0;

  for (let i = 0; i < transformedItems.length; i += DB_BATCH_SIZE) {
    const batch = transformedItems.slice(i, i + DB_BATCH_SIZE);
    await upsertItems(batch);
    upsertedCount += batch.length;

    const percent = Math.round((upsertedCount / transformedItems.length) * 100);
    process.stdout.write(
      `\r   Progress: ${upsertedCount.toLocaleString()}/${transformedItems.length.toLocaleString()} (${percent}%)`
    );
  }
  console.log(); // New line after progress

  // Summary
  console.log("\n━".repeat(50));
  console.log("✅ Item sync complete!");
  console.log(`   📊 Items synced: ${upsertedCount.toLocaleString()}`);
  console.log(`   ⏱️  Duration: ${formatDuration(startTime)}`);
  console.log("━".repeat(50));
}

// Run the sync
syncItems()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Sync failed:", error);
    process.exit(1);
  });

