/**
 * @fileoverview Vitest configuration for the GW2 Economist test suite.
 *
 * This module configures Vitest for running unit and integration tests with
 * React Testing Library support. It sets up JSDOM environment, global test
 * utilities, and code coverage reporting.
 *
 * @module vitest.config
 *
 * @example
 * ```bash
 * # Run tests
 * pnpm test
 *
 * # Run tests with coverage
 * pnpm test --coverage
 *
 * # Run tests in watch mode
 * pnpm test --watch
 * ```
 */

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

/**
 * Vitest configuration for React component and unit testing.
 *
 * Features:
 * - JSDOM environment for DOM testing
 * - Global test utilities (describe, it, expect, etc.)
 * - React plugin for component testing
 * - TypeScript path alias support
 * - V8 coverage provider with text, JSON, and HTML reports
 */
export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      reportsDirectory: "./coverage",
      exclude: [
        "node_modules/",
        "tests/**",
        "**/*.test.{ts,tsx}",
        "**/*.spec.{ts,tsx}",
        "**/*.d.ts",
        "**/types.ts",
        // Generated files
        "src/routeTree.gen.ts",
        // Build/config files
        "drizzle/**",
        "scripts/**",
        "vite.config.ts",
        "vitest.config.ts",
        "drizzle.config.ts",
        // Route files (TanStack Router config, not business logic)
        "src/routes/**",
        "src/router.tsx",
        // Barrel exports (re-exports only)
        "server/services/gw2-api/index.ts",
        // Database connection (requires real DB)
        "server/db/index.ts",
        // Demo/sample data
        "src/data/**",
        // Server function handlers (require integration tests)
        "server/functions/craft-analysis.ts",
      ],
      include: ["src/**/*.{ts,tsx}", "server/**/*.{ts,tsx}"],
      all: true,
    },
  },
});

