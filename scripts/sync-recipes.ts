/**
 * @fileoverview Script to synchronize all GW2 recipes from the API to the database.
 *
 * This script fetches all recipe IDs from the GW2 API, then batch-fetches the recipe
 * details and upserts them into the database. Progress is logged to the console.
 *
 * @module scripts/sync-recipes
 *
 * @example
 * ```bash
 * # Run the sync script
 * pnpm sync:recipes
 *
 * # Or with tsx directly
 * npx tsx scripts/sync-recipes.ts
 * ```
 */

import "dotenv/config";
import { db, recipes } from "../server/db";
import { gw2Api } from "../server/services/gw2-api";
import type { GW2Recipe } from "../server/services/gw2-api";
import type { NewRecipe, RecipeIngredient, GuildUpgradeIngredient } from "../server/db/schema";

/**
 * Batch size for database upserts.
 */
const DB_BATCH_SIZE = 500;

/**
 * Transforms a GW2 API recipe response to a database record.
 *
 * @param apiRecipe - Recipe data from the GW2 API
 * @returns Database-ready recipe record
 */
function transformRecipe(apiRecipe: GW2Recipe): NewRecipe {
  // Transform ingredients to our schema format
  const ingredients: RecipeIngredient[] = apiRecipe.ingredients.map((ing) => ({
    itemId: ing.item_id,
    count: ing.count,
  }));

  // Transform guild ingredients if present
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
 *
 * @param recipeBatch - Array of recipes to upsert
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
 * Main sync function that orchestrates the recipe synchronization process.
 */
async function syncRecipes(): Promise<void> {
  const startTime = Date.now();

  console.log("🔄 Starting recipe sync...");
  console.log("━".repeat(50));

  // Step 1: Fetch all recipe IDs
  console.log("📥 Fetching recipe IDs from GW2 API...");
  const recipeIds = await gw2Api.getAllRecipeIds();
  console.log(`   Found ${recipeIds.length.toLocaleString()} recipes`);

  // Step 2: Batch fetch recipes from API with progress
  console.log("\n📦 Fetching recipe details...");
  const { items: apiRecipes, failedIds, errors } = await gw2Api.getRecipesBatch(
    recipeIds,
    (progress) => {
      const percent = Math.round((progress.current / progress.total) * 100);
      process.stdout.write(
        `\r   Progress: ${progress.current.toLocaleString()}/${progress.total.toLocaleString()} (${percent}%)`
      );
    }
  );
  console.log(); // New line after progress

  if (failedIds.length > 0) {
    console.log(`   ⚠️  ${failedIds.length} recipes failed to fetch`);
  }
  if (errors.length > 0) {
    console.log(`   ⚠️  Errors: ${errors.slice(0, 3).join(", ")}${errors.length > 3 ? "..." : ""}`);
  }

  // Step 3: Transform and upsert to database in batches
  console.log("\n💾 Syncing to database...");
  const transformedRecipes = apiRecipes.map(transformRecipe);
  let upsertedCount = 0;

  for (let i = 0; i < transformedRecipes.length; i += DB_BATCH_SIZE) {
    const batch = transformedRecipes.slice(i, i + DB_BATCH_SIZE);
    await upsertRecipes(batch);
    upsertedCount += batch.length;

    const percent = Math.round((upsertedCount / transformedRecipes.length) * 100);
    process.stdout.write(
      `\r   Progress: ${upsertedCount.toLocaleString()}/${transformedRecipes.length.toLocaleString()} (${percent}%)`
    );
  }
  console.log(); // New line after progress

  // Summary
  console.log("\n━".repeat(50));
  console.log("✅ Recipe sync complete!");
  console.log(`   📊 Recipes synced: ${upsertedCount.toLocaleString()}`);
  console.log(`   ⏱️  Duration: ${formatDuration(startTime)}`);
  console.log("━".repeat(50));
}

// Run the sync
syncRecipes()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Sync failed:", error);
    process.exit(1);
  });

