/**
 * @fileoverview Unit tests for the database schema definitions.
 *
 * These tests validate that the Drizzle schema is correctly defined with
 * the expected columns, types, and constraints. Tests are written following
 * TDD methodology to verify schema structure before relying on it elsewhere.
 *
 * @module tests/db/schema.test
 */

import { describe, it, expect } from "vitest";
import { getTableColumns, getTableName } from "drizzle-orm";
import {
  items,
  recipes,
  prices,
  type RecipeIngredient,
  type GuildUpgradeIngredient,
} from "../../server/db/schema";

describe("Database Schema", () => {
  describe("items table", () => {
    it("should be named 'items'", () => {
      expect(getTableName(items)).toBe("items");
    });

    it("should have all required columns", () => {
      const columns = getTableColumns(items);
      const columnNames = Object.keys(columns);

      expect(columnNames).toContain("id");
      expect(columnNames).toContain("name");
      expect(columnNames).toContain("description");
      expect(columnNames).toContain("type");
      expect(columnNames).toContain("rarity");
      expect(columnNames).toContain("level");
      expect(columnNames).toContain("icon");
      expect(columnNames).toContain("vendorValue");
      expect(columnNames).toContain("chatLink");
      expect(columnNames).toContain("flags");
      expect(columnNames).toContain("updatedAt");
    });

    it("should have id as primary key", () => {
      const columns = getTableColumns(items);
      expect(columns.id.primary).toBe(true);
    });

    it("should have name as not null", () => {
      const columns = getTableColumns(items);
      expect(columns.name.notNull).toBe(true);
    });

    it("should have type as not null", () => {
      const columns = getTableColumns(items);
      expect(columns.type.notNull).toBe(true);
    });

    it("should have rarity as not null", () => {
      const columns = getTableColumns(items);
      expect(columns.rarity.notNull).toBe(true);
    });

    it("should allow null for optional fields", () => {
      const columns = getTableColumns(items);
      expect(columns.description.notNull).toBe(false);
      expect(columns.icon.notNull).toBe(false);
    });
  });

  describe("recipes table", () => {
    it("should be named 'recipes'", () => {
      expect(getTableName(recipes)).toBe("recipes");
    });

    it("should have all required columns", () => {
      const columns = getTableColumns(recipes);
      const columnNames = Object.keys(columns);

      expect(columnNames).toContain("id");
      expect(columnNames).toContain("type");
      expect(columnNames).toContain("outputItemId");
      expect(columnNames).toContain("outputItemCount");
      expect(columnNames).toContain("minRating");
      expect(columnNames).toContain("timeToCraft");
      expect(columnNames).toContain("disciplines");
      expect(columnNames).toContain("flags");
      expect(columnNames).toContain("ingredients");
      expect(columnNames).toContain("guildIngredients");
      expect(columnNames).toContain("chatLink");
      expect(columnNames).toContain("updatedAt");
    });

    it("should have id as primary key", () => {
      const columns = getTableColumns(recipes);
      expect(columns.id.primary).toBe(true);
    });

    it("should have outputItemId as not null", () => {
      const columns = getTableColumns(recipes);
      expect(columns.outputItemId.notNull).toBe(true);
    });

    it("should store ingredients as JSONB", () => {
      const columns = getTableColumns(recipes);
      expect(columns.ingredients.dataType).toBe("json");
    });

    it("should store disciplines as JSONB", () => {
      const columns = getTableColumns(recipes);
      expect(columns.disciplines.dataType).toBe("json");
    });
  });

  describe("prices table", () => {
    it("should be named 'prices'", () => {
      expect(getTableName(prices)).toBe("prices");
    });

    it("should have all required columns", () => {
      const columns = getTableColumns(prices);
      const columnNames = Object.keys(columns);

      expect(columnNames).toContain("itemId");
      expect(columnNames).toContain("buyPrice");
      expect(columnNames).toContain("buyQuantity");
      expect(columnNames).toContain("sellPrice");
      expect(columnNames).toContain("sellQuantity");
      expect(columnNames).toContain("updatedAt");
    });

    it("should have itemId as primary key", () => {
      const columns = getTableColumns(prices);
      expect(columns.itemId.primary).toBe(true);
    });

    it("should have all price fields as not null", () => {
      const columns = getTableColumns(prices);
      expect(columns.buyPrice.notNull).toBe(true);
      expect(columns.buyQuantity.notNull).toBe(true);
      expect(columns.sellPrice.notNull).toBe(true);
      expect(columns.sellQuantity.notNull).toBe(true);
    });
  });

  describe("RecipeIngredient interface", () => {
    it("should have correct structure", () => {
      const ingredient: RecipeIngredient = {
        itemId: 12345,
        count: 10,
      };

      expect(ingredient.itemId).toBe(12345);
      expect(ingredient.count).toBe(10);
    });
  });

  describe("GuildUpgradeIngredient interface", () => {
    it("should have correct structure", () => {
      const guildIngredient: GuildUpgradeIngredient = {
        upgradeId: 999,
        count: 1,
      };

      expect(guildIngredient.upgradeId).toBe(999);
      expect(guildIngredient.count).toBe(1);
    });
  });
});

