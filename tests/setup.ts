import "@testing-library/jest-dom/vitest";
import { beforeAll, afterAll } from "vitest";

// Global test setup
beforeAll(() => {
  // Set up test environment variables
  process.env.DATABASE_URL =
    "postgres://test:test@localhost:5432/gw2economist_test";
  process.env.USE_FILE_CACHE = "false";
  process.env.CACHE_DIR = "./cache";
});

afterAll(() => {
  // Cleanup after all tests
});

