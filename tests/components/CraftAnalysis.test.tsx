/**
 * @fileoverview Unit tests for the CraftAnalysis component.
 *
 * Tests verify correct rendering of buy vs craft recommendations,
 * visual highlighting, and material breakdown display.
 *
 * @module tests/components/CraftAnalysis.test
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CraftAnalysis } from "../../src/components/CraftAnalysis";
import type { SerializedCraftAnalysis } from "../../server/functions/craft-analysis";

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
      // Check for craft-specific styling (blue/indigo)
      expect(recommendation).toHaveClass(/bg-indigo|bg-blue/);
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
      // Check for buy-specific styling (green/emerald)
      expect(recommendation).toHaveClass(/bg-green|bg-emerald/);
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
});

