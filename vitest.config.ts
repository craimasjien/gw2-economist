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
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "tests/setup.ts"],
    },
  },
});

