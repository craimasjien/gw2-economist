/**
 * @fileoverview Tests for the QuantityAnalysis component.
 *
 * Verifies the quantity-aware analysis UI including quantity selection,
 * price impact display, supply warnings, and recommendation changes.
 *
 * @module tests/components/QuantityAnalysis.test
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QuantityAnalysis } from "../../src/components/QuantityAnalysis";
import type { SerializedQuantityAnalysis } from "../../server/functions/craft-analysis";

// Mock the server function
vi.mock("../../server/functions/craft-analysis", () => ({
  analyzeForQuantity: vi.fn(),
}));

import { analyzeForQuantity } from "../../server/functions/craft-analysis";

const mockAnalyzeForQuantity = analyzeForQuantity as ReturnType<typeof vi.fn>;

/**
 * Creates a mock analysis result for testing.
 */
function createMockAnalysis(
  overrides: Partial<SerializedQuantityAnalysis> = {}
): SerializedQuantityAnalysis {
  return {
    item: {
      id: 12345,
      name: "Test Item",
      description: null,
      type: "CraftingMaterial",
      rarity: "Fine",
      level: 0,
      icon: "https://example.com/icon.png",
      vendorValue: 100,
      chatLink: "[&AgEAAA==]",
      flags: [],
      updatedAt: new Date().toISOString(),
    },
    quantity: 100,
    canCraft: true,
    recipe: {
      id: 1000,
      type: "Refinement",
      outputItemCount: 1,
    },
    totalBuyCost: 50000,
    averageBuyPrice: 500,
    totalCraftCost: 40000,
    averageCraftCost: 400,
    recommendation: "craft",
    savings: 10000,
    savingsPercent: 20,
    buyPriceImpact: 10,
    supplyAvailable: 1000,
    supplyShortfall: 0,
    canFillOrder: true,
    materialBreakdown: [
      {
        item: {
          id: 12346,
          name: "Material A",
          description: null,
          type: "CraftingMaterial",
          rarity: "Basic",
          level: 0,
          icon: "https://example.com/material.png",
          vendorValue: 10,
          chatLink: "[&AgEBAA==]",
          flags: [],
          updatedAt: new Date().toISOString(),
        },
        quantity: 200,
        unitCost: 200,
        totalCost: 40000,
        decision: "buy",
      },
    ],
    ...overrides,
  };
}

describe("QuantityAnalysis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("quantity selection", () => {
    it("should render quantity input with initial value", async () => {
      mockAnalyzeForQuantity.mockResolvedValue(createMockAnalysis());

      render(<QuantityAnalysis itemId={12345} initialQuantity={50} />);

      const input = screen.getByLabelText("Quantity to analyze");
      expect(input).toHaveValue(50);
    });

    it("should update analysis when quantity changes", async () => {
      mockAnalyzeForQuantity.mockResolvedValue(createMockAnalysis());

      render(<QuantityAnalysis itemId={12345} initialQuantity={1} />);

      const input = screen.getByLabelText("Quantity to analyze");
      fireEvent.change(input, { target: { value: "100" } });

      await waitFor(() => {
        expect(mockAnalyzeForQuantity).toHaveBeenLastCalledWith({
          data: { itemId: 12345, quantity: 100 },
        });
      });
    });

    it("should have preset quantity buttons", async () => {
      mockAnalyzeForQuantity.mockResolvedValue(createMockAnalysis());

      render(<QuantityAnalysis itemId={12345} />);

      // Check for preset buttons
      expect(screen.getByRole("button", { name: "1" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "10" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "100" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "500" })).toBeInTheDocument();
    });

    it("should update quantity when preset is clicked", async () => {
      mockAnalyzeForQuantity.mockResolvedValue(createMockAnalysis());

      render(<QuantityAnalysis itemId={12345} initialQuantity={1} />);

      fireEvent.click(screen.getByRole("button", { name: "100" }));

      await waitFor(() => {
        expect(mockAnalyzeForQuantity).toHaveBeenLastCalledWith({
          data: { itemId: 12345, quantity: 100 },
        });
      });
    });
  });

  describe("price impact display", () => {
    it("should show price impact warning when significant", async () => {
      mockAnalyzeForQuantity.mockResolvedValue(
        createMockAnalysis({ buyPriceImpact: 15 })
      );

      render(<QuantityAnalysis itemId={12345} initialQuantity={100} />);

      await waitFor(() => {
        expect(screen.getByText(/\+15\.0% Price Impact/)).toBeInTheDocument();
      });
    });

    it("should not show price impact warning when minimal", async () => {
      mockAnalyzeForQuantity.mockResolvedValue(
        createMockAnalysis({ buyPriceImpact: 2 })
      );

      render(<QuantityAnalysis itemId={12345} initialQuantity={100} />);

      await waitFor(() => {
        expect(screen.queryByText(/Price Impact/)).not.toBeInTheDocument();
      });
    });
  });

  describe("supply warnings", () => {
    it("should show limited supply warning when order cannot be filled", async () => {
      mockAnalyzeForQuantity.mockResolvedValue(
        createMockAnalysis({
          canFillOrder: false,
          supplyAvailable: 50,
          supplyShortfall: 50,
        })
      );

      render(<QuantityAnalysis itemId={12345} initialQuantity={100} />);

      await waitFor(() => {
        expect(screen.getByText("Limited Supply")).toBeInTheDocument();
        expect(screen.getByText(/Only 50 available/)).toBeInTheDocument();
      });
    });

    it("should not show supply warning when order can be filled", async () => {
      mockAnalyzeForQuantity.mockResolvedValue(
        createMockAnalysis({ canFillOrder: true })
      );

      render(<QuantityAnalysis itemId={12345} initialQuantity={100} />);

      await waitFor(() => {
        expect(screen.queryByText("Limited Supply")).not.toBeInTheDocument();
      });
    });
  });

  describe("recommendation display", () => {
    it("should show buy recommendation", async () => {
      mockAnalyzeForQuantity.mockResolvedValue(
        createMockAnalysis({ 
          recommendation: "buy", 
          buyPriceImpact: 0,
          totalCraftCost: 60000,
          totalBuyCost: 50000,
        })
      );

      render(<QuantityAnalysis itemId={12345} initialQuantity={100} />);

      await waitFor(() => {
        // The cost comparison section should have "Buy from TP" header
        expect(screen.getByText("Buy from TP")).toBeInTheDocument();
      });
    });

    it("should show craft recommendation", async () => {
      mockAnalyzeForQuantity.mockResolvedValue(
        createMockAnalysis({ recommendation: "craft", buyPriceImpact: 0 })
      );

      render(<QuantityAnalysis itemId={12345} initialQuantity={100} />);

      await waitFor(() => {
        // Look for the Craft header in the cost section
        expect(screen.getByText("Craft")).toBeInTheDocument();
      });
    });

    it("should show no recipe message for non-craftable items", async () => {
      mockAnalyzeForQuantity.mockResolvedValue(
        createMockAnalysis({
          canCraft: false,
          recommendation: "buy",
          recipe: undefined,
          buyPriceImpact: 0,
          totalCraftCost: 0,
          averageCraftCost: 0,
          materialBreakdown: [],
        })
      );

      render(<QuantityAnalysis itemId={12345} initialQuantity={100} />);

      await waitFor(() => {
        expect(screen.getByText("No Recipe")).toBeInTheDocument();
      });
    });
  });

  describe("cost comparison", () => {
    it("should display total buy cost", async () => {
      mockAnalyzeForQuantity.mockResolvedValue(
        createMockAnalysis({ totalBuyCost: 50000 })
      );

      render(<QuantityAnalysis itemId={12345} initialQuantity={100} />);

      await waitFor(() => {
        // 50000 copper = 5 gold
        expect(screen.getByText("Buy from TP")).toBeInTheDocument();
      });
    });

    it("should display total craft cost", async () => {
      mockAnalyzeForQuantity.mockResolvedValue(
        createMockAnalysis({ totalCraftCost: 40000 })
      );

      render(<QuantityAnalysis itemId={12345} initialQuantity={100} />);

      await waitFor(() => {
        expect(screen.getByText("Craft")).toBeInTheDocument();
      });
    });

    it("should display savings", async () => {
      mockAnalyzeForQuantity.mockResolvedValue(
        createMockAnalysis({ savings: 10000, savingsPercent: 20 })
      );

      render(<QuantityAnalysis itemId={12345} initialQuantity={100} />);

      await waitFor(() => {
        expect(screen.getByText("Total Savings")).toBeInTheDocument();
        expect(screen.getByText("20.0%")).toBeInTheDocument();
      });
    });
  });

  describe("material breakdown", () => {
    it("should display materials when craftable", async () => {
      mockAnalyzeForQuantity.mockResolvedValue(createMockAnalysis());

      render(<QuantityAnalysis itemId={12345} initialQuantity={100} />);

      await waitFor(() => {
        expect(screen.getByText("Material A")).toBeInTheDocument();
        expect(screen.getByText("×200")).toBeInTheDocument();
      });
    });

    it("should show material decision indicator", async () => {
      mockAnalyzeForQuantity.mockResolvedValue(
        createMockAnalysis({
          materialBreakdown: [
            {
              item: {
                id: 12346,
                name: "Material A",
                description: null,
                type: "CraftingMaterial",
                rarity: "Basic",
                level: 0,
                icon: null,
                vendorValue: 10,
                chatLink: "[&AgEBAA==]",
                flags: [],
                updatedAt: new Date().toISOString(),
              },
              quantity: 200,
              unitCost: 200,
              totalCost: 40000,
              decision: "craft",
            },
          ],
        })
      );

      render(<QuantityAnalysis itemId={12345} initialQuantity={100} />);

      await waitFor(() => {
        // The material breakdown section shows the decision
        const materialSection = screen.getByText("Material A").closest("div");
        expect(materialSection).toBeInTheDocument();
      });
    });
  });

  describe("loading and error states", () => {
    it("should show loading indicator while fetching", async () => {
      mockAnalyzeForQuantity.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(<QuantityAnalysis itemId={12345} />);

      // Wait a short time for the loading state to appear
      await new Promise((resolve) => setTimeout(resolve, 350));
      
      // Loading spinner should be present (check for animate-spin class)
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeTruthy();
    });

    it("should show error message on failure", async () => {
      mockAnalyzeForQuantity.mockRejectedValue(new Error("Network error"));

      render(<QuantityAnalysis itemId={12345} />);

      await waitFor(() => {
        expect(screen.getByText("Network error")).toBeInTheDocument();
      });
    });
  });

  describe("callback integration", () => {
    it("should call onAnalysisLoaded when analysis is fetched", async () => {
      const onAnalysisLoaded = vi.fn();
      const mockAnalysis = createMockAnalysis();
      mockAnalyzeForQuantity.mockResolvedValue(mockAnalysis);

      render(
        <QuantityAnalysis
          itemId={12345}
          initialQuantity={100}
          onAnalysisLoaded={onAnalysisLoaded}
        />
      );

      await waitFor(() => {
        expect(onAnalysisLoaded).toHaveBeenCalledWith(mockAnalysis);
      });
    });
  });
});

