/**
 * @fileoverview Drizzle ORM configuration for database migrations.
 *
 * This module configures Drizzle Kit for PostgreSQL database schema management.
 * It specifies the schema location, migration output directory, and database
 * connection settings using environment variables.
 *
 * @module drizzle.config
 *
 * @example
 * ```bash
 * # Generate migrations
 * npx drizzle-kit generate
 *
 * # Push schema changes to database
 * npx drizzle-kit push
 *
 * # Open Drizzle Studio
 * npx drizzle-kit studio
 * ```
 */

import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit configuration for PostgreSQL database.
 *
 * @remarks
 * Requires DATABASE_URL environment variable to be set with a valid
 * PostgreSQL connection string.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});

