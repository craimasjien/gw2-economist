/**
 * @fileoverview Unit tests for the CraftAnalysis component.
 *
 * Tests verify correct rendering of buy vs craft recommendations,
 * visual highlighting, material breakdown display, and clickable
 * navigation for craftable materials.
 *
 * @module tests/components/CraftAnalysis.test
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CraftAnalysis } from "../../src/components/CraftAnalysis";
import type { SerializedCraftAnalysis } from "../../server/functions/craft-analysis";

// Mock the router Link component
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, params, ...props }: { children: React.ReactNode; to: string; params?: Record<string, string>; [key: string]: unknown }) => {
    // Build the href by replacing $param placeholders with actual values
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
 * Creates a mock craft analysis for testing.
 */
function createMockAnalysis(
  overrides: Partial<SerializedCraftAnalysis> = {}
): SerializedCraftAnalysis {
  return {
    item: {
      id: 1,
      name: "Test Item",
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
      outputItemId: 1,
      outputItemCount: 1,
      disciplines: ["Tailor"],
    },
    buyPrice: 200,
    craftCost: 150,
    recommendation: "craft",
    savings: 50,
    savingsPercent: 25,
    materials: [
      {
        item: {
          id: 2,
          name: "Material 1",
          description: null,
          type: "CraftingMaterial",
          rarity: "Basic",
          level: 0,
          icon: null,
          vendorValue: 0,
          chatLink: null,
        },
        quantity: 3,
        unitPrice: 50,
        totalPrice: 150,
        canCraft: false,
        usedBuyPrice: true,
      },
    ],
    ...overrides,
  };
}

describe("CraftAnalysis", () => {
  describe("recommendation display", () => {
    it("displays craft recommendation with appropriate styling", () => {
      const analysis = createMockAnalysis({ recommendation: "craft" });
      render(<CraftAnalysis analysis={analysis} />);

      const recommendation = screen.getByTestId("recommendation");
      expect(recommendation).toHaveTextContent(/craft/i);
      // Check for craft-specific styling via inline style (red/crimson theme)
      expect(recommendation).toHaveStyle({ borderLeft: expect.stringContaining("var(--gw2-red)") });
    });

    it("displays buy recommendation with appropriate styling", () => {
      const analysis = createMockAnalysis({
        recommendation: "buy",
        buyPrice: 100,
        craftCost: 150,
        savings: 50,
      });
      render(<CraftAnalysis analysis={analysis} />);

      const recommendation = screen.getByTestId("recommendation");
      expect(recommendation).toHaveTextContent(/buy/i);
      // Check for buy-specific styling via inline style (green/success theme)
      expect(recommendation).toHaveStyle({ borderLeft: expect.stringContaining("var(--gw2-success)") });
    });
  });

  describe("price display", () => {
    it("shows buy price and craft cost", () => {
      const analysis = createMockAnalysis({
        buyPrice: 12345,
        craftCost: 9876,
      });
      render(<CraftAnalysis analysis={analysis} />);

      // Check that both prices are displayed
      expect(screen.getByTestId("buy-price")).toBeInTheDocument();
      expect(screen.getByTestId("craft-cost")).toBeInTheDocument();
    });

    it("shows savings amount and percentage", () => {
      const analysis = createMockAnalysis({
        savings: 500,
        savingsPercent: 25,
      });
      render(<CraftAnalysis analysis={analysis} />);

      expect(screen.getByTestId("savings")).toBeInTheDocument();
      expect(screen.getByText(/25\.0%/)).toBeInTheDocument();
    });
  });

  describe("material breakdown", () => {
    it("shows material breakdown tree", () => {
      const analysis = createMockAnalysis({
        materials: [
          {
            item: {
              id: 2,
              name: "Silk Scrap",
              description: null,
              type: "CraftingMaterial",
              rarity: "Fine",
              level: 0,
              icon: null,
              vendorValue: 0,
              chatLink: null,
            },
            quantity: 5,
            unitPrice: 30,
            totalPrice: 150,
            canCraft: false,
            usedBuyPrice: true,
          },
          {
            item: {
              id: 3,
              name: "Thread",
              description: null,
              type: "CraftingMaterial",
              rarity: "Basic",
              level: 0,
              icon: null,
              vendorValue: 0,
              chatLink: null,
            },
            quantity: 1,
            unitPrice: 8,
            totalPrice: 8,
            canCraft: false,
            usedBuyPrice: true,
          },
        ],
      });
      render(<CraftAnalysis analysis={analysis} />);

      expect(screen.getByText("Silk Scrap")).toBeInTheDocument();
      expect(screen.getByText("Thread")).toBeInTheDocument();
      expect(screen.getByText("×5")).toBeInTheDocument();
      expect(screen.getByText("×1")).toBeInTheDocument();
    });

    it("indicates craftable materials", () => {
      const analysis = createMockAnalysis({
        materials: [
          {
            item: {
              id: 2,
              name: "Craftable Material",
              description: null,
              type: "CraftingMaterial",
              rarity: "Fine",
              level: 0,
              icon: null,
              vendorValue: 0,
              chatLink: null,
            },
            quantity: 2,
            unitPrice: 50,
            totalPrice: 100,
            canCraft: true,
            usedBuyPrice: false,
            craftAnalysis: createMockAnalysis({
              item: {
                id: 2,
                name: "Craftable Material",
                description: null,
                type: "CraftingMaterial",
                rarity: "Fine",
                level: 0,
                icon: null,
                vendorValue: 0,
                chatLink: null,
              },
            }),
          },
        ],
      });
      render(<CraftAnalysis analysis={analysis} />);

      // Should show some indicator that it's crafted vs bought
      expect(screen.getByTestId("material-crafted-indicator")).toBeInTheDocument();
    });
  });

  describe("item info", () => {
    it("displays item name and icon", () => {
      const analysis = createMockAnalysis({
        item: {
          id: 1,
          name: "Bolt of Silk",
          description: "Refined silk fabric",
          type: "CraftingMaterial",
          rarity: "Fine",
          level: 0,
          icon: "https://example.com/silk.png",
          vendorValue: 10,
          chatLink: "[&AgEAAA==]",
        },
      });
      render(<CraftAnalysis analysis={analysis} />);

      expect(screen.getByText("Bolt of Silk")).toBeInTheDocument();
      expect(screen.getByRole("img")).toHaveAttribute(
        "src",
        "https://example.com/silk.png"
      );
    });

    it("shows recipe disciplines", () => {
      const analysis = createMockAnalysis({
        recipe: {
          id: 100,
          type: "Refinement",
          outputItemId: 1,
          outputItemCount: 1,
          disciplines: ["Tailor", "Leatherworker"],
        },
      });
      render(<CraftAnalysis analysis={analysis} />);

      expect(screen.getByText(/Tailor/)).toBeInTheDocument();
      expect(screen.getByText(/Leatherworker/)).toBeInTheDocument();
    });
  });

  describe("edge cases", () => {
    it("handles items with no buy price (account bound)", () => {
      const analysis = createMockAnalysis({
        buyPrice: 0,
        craftCost: 100,
        recommendation: "craft",
      });
      render(<CraftAnalysis analysis={analysis} />);

      // Should indicate item can't be bought (may have multiple matching elements)
      const elements = screen.getAllByText(/not tradeable|account bound|craft only/i);
      expect(elements.length).toBeGreaterThan(0);
    });
  });

  describe("material navigation", () => {
    it("makes craftable materials clickable with link to item detail page", () => {
      const analysis = createMockAnalysis({
        materials: [
          {
            item: {
              id: 456,
              name: "Craftable Component",
              description: null,
              type: "CraftingMaterial",
              rarity: "Fine",
              level: 0,
              icon: "https://example.com/craftable.png",
              vendorValue: 0,
              chatLink: null,
            },
            quantity: 2,
            unitPrice: 50,
            totalPrice: 100,
            canCraft: true,
            usedBuyPrice: false,
            craftAnalysis: createMockAnalysis({
              item: {
                id: 456,
                name: "Craftable Component",
                description: null,
                type: "CraftingMaterial",
                rarity: "Fine",
                level: 0,
                icon: "https://example.com/craftable.png",
                vendorValue: 0,
                chatLink: null,
              },
            }),
          },
        ],
      });
      render(<CraftAnalysis analysis={analysis} />);

      // Craftable material should have a link
      const link = screen.getByRole("link", { name: /Craftable Component/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "/items/456");
    });

    it("makes materials with canCraft=true but bought clickable", () => {
      const analysis = createMockAnalysis({
        materials: [
          {
            item: {
              id: 789,
              name: "Buyable Craftable",
              description: null,
              type: "CraftingMaterial",
              rarity: "Rare",
              level: 0,
              icon: null,
              vendorValue: 0,
              chatLink: null,
            },
            quantity: 1,
            unitPrice: 100,
            totalPrice: 100,
            canCraft: true,
            usedBuyPrice: true, // Chose to buy instead of craft
          },
        ],
      });
      render(<CraftAnalysis analysis={analysis} />);

      // Even if we chose to buy, if it can be crafted, it should be clickable
      const link = screen.getByRole("link", { name: /Buyable Craftable/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "/items/789");
    });

    it("does not make non-craftable materials clickable", () => {
      const analysis = createMockAnalysis({
        materials: [
          {
            item: {
              id: 999,
              name: "Raw Material",
              description: null,
              type: "CraftingMaterial",
              rarity: "Basic",
              level: 0,
              icon: null,
              vendorValue: 0,
              chatLink: null,
            },
            quantity: 5,
            unitPrice: 10,
            totalPrice: 50,
            canCraft: false,
            usedBuyPrice: true,
          },
        ],
      });
      render(<CraftAnalysis analysis={analysis} />);

      // Non-craftable material should not be a link
      const materialText = screen.getByText("Raw Material");
      expect(materialText).toBeInTheDocument();
      // The material should not be wrapped in a link
      expect(materialText.closest("a")).toBeNull();
    });

    it("nested craftable materials are also clickable", () => {
      const analysis = createMockAnalysis({
        materials: [
          {
            item: {
              id: 100,
              name: "Top Level Craftable",
              description: null,
              type: "CraftingMaterial",
              rarity: "Exotic",
              level: 0,
              icon: null,
              vendorValue: 0,
              chatLink: null,
            },
            quantity: 1,
            unitPrice: 500,
            totalPrice: 500,
            canCraft: true,
            usedBuyPrice: false,
            craftAnalysis: {
              ...createMockAnalysis(),
              item: {
                id: 100,
                name: "Top Level Craftable",
                description: null,
                type: "CraftingMaterial",
                rarity: "Exotic",
                level: 0,
                icon: null,
                vendorValue: 0,
                chatLink: null,
              },
              materials: [
                {
                  item: {
                    id: 200,
                    name: "Nested Craftable",
                    description: null,
                    type: "CraftingMaterial",
                    rarity: "Rare",
                    level: 0,
                    icon: null,
                    vendorValue: 0,
                    chatLink: null,
                  },
                  quantity: 3,
                  unitPrice: 100,
                  totalPrice: 300,
                  canCraft: true,
                  usedBuyPrice: false,
                  craftAnalysis: createMockAnalysis({
                    item: {
                      id: 200,
                      name: "Nested Craftable",
                      description: null,
                      type: "CraftingMaterial",
                      rarity: "Rare",
                      level: 0,
                      icon: null,
                      vendorValue: 0,
                      chatLink: null,
                    },
                  }),
                },
              ],
            },
          },
        ],
      });
      render(<CraftAnalysis analysis={analysis} />);

      // Both top-level and nested craftable materials should be clickable
      const topLink = screen.getByRole("link", { name: /Top Level Craftable/i });
      expect(topLink).toHaveAttribute("href", "/items/100");

      const nestedLink = screen.getByRole("link", { name: /Nested Craftable/i });
      expect(nestedLink).toHaveAttribute("href", "/items/200");
    });
  });
});
