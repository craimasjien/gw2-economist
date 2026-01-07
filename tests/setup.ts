/**
 * @fileoverview Global test setup for Vitest test suite.
 *
 * This module configures the test environment before any tests run.
 * It imports jest-dom matchers for enhanced DOM assertions and sets up
 * required environment variables for testing database connections and caching.
 *
 * @module tests/setup
 *
 * @remarks
 * This file is automatically loaded by Vitest as configured in vitest.config.ts.
 * Environment variables set here are available to all test files.
 */

import "@testing-library/jest-dom/vitest";
import { beforeAll, afterAll } from "vitest";

/**
 * Global setup hook that runs before all tests.
 *
 * Configures test environment variables:
 * - DATABASE_URL: PostgreSQL connection string for test database
 * - USE_FILE_CACHE: Disables file caching during tests
 * - CACHE_DIR: Directory for any cache files
 */
beforeAll(() => {
  // Set up test environment variables
  process.env.DATABASE_URL =
    "postgres://test:test@localhost:5432/gw2economist_test";
  process.env.USE_FILE_CACHE = "false";
  process.env.CACHE_DIR = "./cache";
});

/**
 * Global teardown hook that runs after all tests complete.
 *
 * Performs cleanup operations such as closing database connections
 * or clearing temporary files.
 */
afterAll(() => {
  // Cleanup after all tests
});

