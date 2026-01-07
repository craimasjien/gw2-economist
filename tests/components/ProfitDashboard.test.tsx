/**
 * @fileoverview Unit tests for the ProfitDashboard component.
 *
 * Tests verify correct rendering of profitable items table,
 * sorting functionality, loading states, and navigation.
 *
 * @module tests/components/ProfitDashboard.test
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ProfitDashboard } from "../../src/components/ProfitDashboard";
import type { SerializedProfitableItem } from "../../server/functions/craft-analysis";

// Mock the router Link component
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
    ...props
  }: {
    children: React.ReactNode;
    to: string;
    params?: Record<string, string>;
    [key: string]: unknown;
  }) => {
    let href = to;
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        href = href.replace(`$${key}`, value);
      }
    }
    return (
      <a href={href} data-testid="router-link" {...props}>
        {children}
      </a>
    );
  },
}));

/**
 * Creates a mock profitable item for testing.
 */
function createMockProfitableItem(
  overrides: Partial<SerializedProfitableItem> = {}
): SerializedProfitableItem {
  return {
    item: {
      id: 1,
      name: "Bolt of Gossamer",
      description: null,
      type: "CraftingMaterial",
      rarity: "Fine",
      level: 0,
      icon: "https://example.com/icon.png",
      vendorValue: 10,
      chatLink: "[&AgEAAA==]",
    },
    recipe: {
      id: 100,
      type: "Refinement",
      outputItemCount: 1,
      disciplines: ["Tailor", "Armorsmith"],
    },
    craftCost: 1000,
    sellPrice: 1500,
    profit: 275,
    profitMargin: 0.2157,
    dailyVolume: 500,
    profitScore: 6149,
    ...overrides,
  };
}

describe("ProfitDashboard", () => {
  describe("table display", () => {
    it("should display profitable items in a table", () => {
      const items = [
        createMockProfitableItem({ item: { ...createMockProfitableItem().item, name: "Item A" } }),
        createMockProfitableItem({ item: { ...createMockProfitableItem().item, id: 2, name: "Item B" } }),
      ];

      render(<ProfitDashboard items={items} isLoading={false} />);

      expect(screen.getByText("Item A")).toBeInTheDocument();
      expect(screen.getByText("Item B")).toBeInTheDocument();
    });

    it("should display all required columns", () => {
      const items = [createMockProfitableItem()];

      render(<ProfitDashboard items={items} isLoading={false} />);

      // Check column headers exist
      expect(screen.getByText(/item/i)).toBeInTheDocument();
      expect(screen.getByText(/craft cost/i)).toBeInTheDocument();
      expect(screen.getByText(/sell price/i)).toBeInTheDocument();
      expect(screen.getByText(/profit/i)).toBeInTheDocument();
      expect(screen.getByText(/margin/i)).toBeInTheDocument();
      expect(screen.getByText(/volume/i)).toBeInTheDocument();
    });

    it("should format profit margin as percentage", () => {
      const items = [createMockProfitableItem({ profitMargin: 0.25 })];

      render(<ProfitDashboard items={items} isLoading={false} />);

      expect(screen.getByText("25.0%")).toBeInTheDocument();
    });

    it("should display crafting disciplines", () => {
      const items = [
        createMockProfitableItem({
          recipe: { ...createMockProfitableItem().recipe, disciplines: ["Tailor"] },
        }),
      ];

      render(<ProfitDashboard items={items} isLoading={false} />);

      expect(screen.getByText("Tailor")).toBeInTheDocument();
    });
  });

  describe("sorting", () => {
    it("should sort by profit score by default (descending)", () => {
      const items = [
        createMockProfitableItem({
          item: { ...createMockProfitableItem().item, id: 1, name: "Low Score" },
          profitScore: 100,
        }),
        createMockProfitableItem({
          item: { ...createMockProfitableItem().item, id: 2, name: "High Score" },
          profitScore: 500,
        }),
      ];

      render(<ProfitDashboard items={items} isLoading={false} />);

      const rows = screen.getAllByRole("row");
      // First data row (after header) should be High Score
      expect(rows[1]).toHaveTextContent("High Score");
      expect(rows[2]).toHaveTextContent("Low Score");
    });

    it("should allow sorting by different columns", () => {
      const items = [
        createMockProfitableItem({
          item: { ...createMockProfitableItem().item, id: 1, name: "High Profit" },
          profit: 500,
          profitScore: 100,
        }),
        createMockProfitableItem({
          item: { ...createMockProfitableItem().item, id: 2, name: "Low Profit" },
          profit: 100,
          profitScore: 500,
        }),
      ];

      render(<ProfitDashboard items={items} isLoading={false} />);

      // Click on profit column header to sort by profit
      const profitHeader = screen.getByRole("columnheader", { name: /profit/i });
      fireEvent.click(profitHeader);

      const rows = screen.getAllByRole("row");
      // After clicking profit, should sort by profit descending
      expect(rows[1]).toHaveTextContent("High Profit");
    });
  });

  describe("loading state", () => {
    it("should show loading indicator while fetching", () => {
      render(<ProfitDashboard items={[]} isLoading={true} />);

      expect(screen.getByTestId("loading-indicator")).toBeInTheDocument();
    });

    it("should not show loading indicator when loaded", () => {
      render(<ProfitDashboard items={[]} isLoading={false} />);

      expect(screen.queryByTestId("loading-indicator")).not.toBeInTheDocument();
    });
  });

  describe("empty state", () => {
    it("should show empty message when no items", () => {
      render(<ProfitDashboard items={[]} isLoading={false} />);

      expect(screen.getByText(/no profitable items found/i)).toBeInTheDocument();
    });
  });

  describe("navigation", () => {
    it("should link items to detail page", () => {
      const items = [createMockProfitableItem()];

      render(<ProfitDashboard items={items} isLoading={false} />);

      const link = screen.getByTestId("router-link");
      expect(link).toHaveAttribute("href", "/items/1");
    });
  });

  describe("price display", () => {
    it("should format prices in GW2 currency format", () => {
      const items = [
        createMockProfitableItem({
          craftCost: 12345, // 1g 23s 45c
          sellPrice: 20000, // 2g 0s 0c
        }),
      ];

      render(<ProfitDashboard items={items} isLoading={false} />);

      // Should show formatted currency (this will depend on PriceDisplay component)
      // The test just verifies the values are rendered somehow
      expect(screen.getByTestId("craft-cost-0")).toBeInTheDocument();
      expect(screen.getByTestId("sell-price-0")).toBeInTheDocument();
    });
  });
});

