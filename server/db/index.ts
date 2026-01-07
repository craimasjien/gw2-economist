/**
 * @fileoverview Database client configuration using Drizzle ORM with PostgreSQL.
 *
 * This module exports a configured Drizzle ORM database client connected to
 * PostgreSQL via the postgres.js driver. The connection is established using
 * the DATABASE_URL environment variable.
 *
 * @module server/db
 *
 * @example
 * ```typescript
 * import { db } from './server/db';
 * import { items, recipes, prices } from './server/db/schema';
 * import { eq } from 'drizzle-orm';
 *
 * // Query items
 * const allItems = await db.select().from(items);
 *
 * // Query with conditions
 * const exoticItems = await db.select()
 *   .from(items)
 *   .where(eq(items.rarity, 'Exotic'));
 *
 * // Insert a new price
 * await db.insert(prices).values({
 *   itemId: 12345,
 *   buyPrice: 1000,
 *   buyQuantity: 500,
 *   sellPrice: 1200,
 *   sellQuantity: 300,
 * });
 * ```
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Retrieves the database connection URL from environment variables.
 *
 * @throws {Error} If DATABASE_URL environment variable is not set
 * @returns {string} The PostgreSQL connection URL
 */
function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL environment variable is required. " +
        "Please ensure your .env file is configured correctly."
    );
  }
  return url;
}

/**
 * PostgreSQL connection client using postgres.js driver.
 *
 * @remarks
 * This client is configured for standard query operations.
 * For migrations, use a separate client with `max: 1` to ensure sequential execution.
 *
 * @see https://github.com/porsager/postgres
 */
const queryClient = postgres(getDatabaseUrl());

/**
 * Drizzle ORM database client with full schema typing.
 *
 * @remarks
 * The `schema` option enables relation queries and provides
 * full TypeScript intellisense for table columns and relationships.
 *
 * @example
 * ```typescript
 * import { db } from './server/db';
 * import { items } from './server/db/schema';
 * import { eq, like } from 'drizzle-orm';
 *
 * // Search for items by name
 * const searchResults = await db.select()
 *   .from(items)
 *   .where(like(items.name, '%Gossamer%'))
 *   .limit(10);
 * ```
 */
export const db = drizzle(queryClient, { schema });

/**
 * Re-export schema for convenient access.
 */
export * from "./schema";

/**
 * Type representing the database client instance.
 * Useful for dependency injection and testing.
 */
export type Database = typeof db;

