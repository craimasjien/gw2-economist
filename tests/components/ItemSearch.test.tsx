/**
 * @fileoverview Unit tests for the ItemSearch component.
 *
 * Tests the autocomplete search functionality including input handling,
 * debouncing, keyboard navigation, and result display.
 *
 * @module tests/components/ItemSearch.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";

// Mock the server function
vi.mock("../../server/functions/craft-analysis", () => ({
  searchItems: vi.fn(),
}));

// Mock the router
const mockNavigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

import { ItemSearch } from "../../src/components/ItemSearch";
import { searchItems } from "../../server/functions/craft-analysis";

const mockSearchItems = vi.mocked(searchItems);

/**
 * Mock item search results for testing.
 */
const mockResults = [
  {
    item: {
      id: 12345,
      name: "Gossamer Scrap",
      description: "Crafting material",
      type: "CraftingMaterial",
      rarity: "Fine",
      level: 0,
      icon: "https://example.com/icon.png",
      vendorValue: 8,
      chatLink: "[&AgEwMwAA]",
    },
    price: {
      itemId: 12345,
      buyPrice: 100,
      buyQuantity: 500,
      sellPrice: 150,
      sellQuantity: 300,
      lastUpdated: new Date(),
    },
    hasCraftingRecipe: true,
  },
  {
    item: {
      id: 12346,
      name: "Gossamer Patch",
      description: "Used in crafting",
      type: "CraftingMaterial",
      rarity: "Rare",
      level: 0,
      icon: "https://example.com/icon2.png",
      vendorValue: 16,
      chatLink: "[&AgExMwAA]",
    },
    price: {
      itemId: 12346,
      buyPrice: 200,
      buyQuantity: 400,
      sellPrice: 250,
      sellQuantity: 200,
      lastUpdated: new Date(),
    },
    hasCraftingRecipe: false,
  },
];

describe("ItemSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchItems.mockResolvedValue([]);
  });

  describe("rendering", () => {
    it("should render the search input", () => {
      render(<ItemSearch />);

      expect(screen.getByTestId("search-input")).toBeInTheDocument();
    });

    it("should display default placeholder", () => {
      render(<ItemSearch />);

      expect(
        screen.getByPlaceholderText("Search items...")
      ).toBeInTheDocument();
    });

    it("should display custom placeholder when provided", () => {
      render(<ItemSearch placeholder="Find an item..." />);

      expect(
        screen.getByPlaceholderText("Find an item...")
      ).toBeInTheDocument();
    });

    it("should apply custom className", () => {
      render(<ItemSearch className="custom-class" />);

      expect(screen.getByTestId("item-search")).toHaveClass("custom-class");
    });

    it("should auto-focus when autoFocus is true", () => {
      render(<ItemSearch autoFocus />);

      expect(screen.getByTestId("search-input")).toHaveFocus();
    });
  });

  describe("search behavior", () => {
    it("should not search when query is less than 2 characters", async () => {
      vi.useFakeTimers();
      render(<ItemSearch />);

      const input = screen.getByTestId("search-input");
      fireEvent.change(input, { target: { value: "a" } });

      await act(async () => {
        vi.advanceTimersByTime(350);
      });

      expect(mockSearchItems).not.toHaveBeenCalled();
      vi.useRealTimers();
    });

    it("should search after debounce when query is 2+ characters", async () => {
      vi.useFakeTimers();
      mockSearchItems.mockResolvedValue(mockResults);
      render(<ItemSearch />);

      const input = screen.getByTestId("search-input");
      fireEvent.change(input, { target: { value: "go" } });

      await act(async () => {
        vi.advanceTimersByTime(350);
      });

      expect(mockSearchItems).toHaveBeenCalledWith({
        data: { query: "go", limit: 15 },
      });
      vi.useRealTimers();
    });

    it("should debounce multiple rapid inputs", async () => {
      vi.useFakeTimers();
      mockSearchItems.mockResolvedValue(mockResults);
      render(<ItemSearch />);

      const input = screen.getByTestId("search-input");

      fireEvent.change(input, { target: { value: "g" } });
      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      fireEvent.change(input, { target: { value: "go" } });
      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      fireEvent.change(input, { target: { value: "gos" } });
      await act(async () => {
        vi.advanceTimersByTime(350);
      });

      // Should only be called once with the final value
      expect(mockSearchItems).toHaveBeenCalledTimes(1);
      expect(mockSearchItems).toHaveBeenCalledWith({
        data: { query: "gos", limit: 15 },
      });
      vi.useRealTimers();
    });
  });

  describe("results display", () => {
    it("should display results when search returns items", async () => {
      mockSearchItems.mockResolvedValue(mockResults);
      render(<ItemSearch />);

      const input = screen.getByTestId("search-input");
      fireEvent.change(input, { target: { value: "gossamer" } });

      await waitFor(
        () => {
          expect(screen.getByTestId("search-results")).toBeInTheDocument();
        },
        { timeout: 1000 }
      );

      expect(screen.getByText("Gossamer Scrap")).toBeInTheDocument();
      expect(screen.getByText("Gossamer Patch")).toBeInTheDocument();
    });

    it("should display item types", async () => {
      mockSearchItems.mockResolvedValue(mockResults);
      render(<ItemSearch />);

      const input = screen.getByTestId("search-input");
      fireEvent.change(input, { target: { value: "gossamer" } });

      await waitFor(
        () => {
          expect(screen.getAllByText("CraftingMaterial")).toHaveLength(2);
        },
        { timeout: 1000 }
      );
    });

    it("should show craftable badge for items with recipes", async () => {
      mockSearchItems.mockResolvedValue(mockResults);
      render(<ItemSearch />);

      const input = screen.getByTestId("search-input");
      fireEvent.change(input, { target: { value: "gossamer" } });

      await waitFor(
        () => {
          expect(screen.getByText("Craftable")).toBeInTheDocument();
        },
        { timeout: 1000 }
      );
    });

    it("should close dropdown when search returns empty results", async () => {
      mockSearchItems.mockResolvedValue([]);
      render(<ItemSearch />);

      const input = screen.getByTestId("search-input");
      fireEvent.change(input, { target: { value: "xyz123" } });

      // Wait for the search to complete
      await waitFor(
        () => {
          expect(mockSearchItems).toHaveBeenCalled();
        },
        { timeout: 1000 }
      );

      // Dropdown should not be visible when no results
      expect(screen.queryByTestId("search-results")).not.toBeInTheDocument();
    });
  });

  describe("item selection", () => {
    it("should call onSelect when an item is clicked", async () => {
      const onSelect = vi.fn();
      mockSearchItems.mockResolvedValue(mockResults);
      render(<ItemSearch onSelect={onSelect} />);

      const input = screen.getByTestId("search-input");
      fireEvent.change(input, { target: { value: "gossamer" } });

      await waitFor(
        () => {
          expect(screen.getByText("Gossamer Scrap")).toBeInTheDocument();
        },
        { timeout: 1000 }
      );

      fireEvent.click(screen.getByTestId("search-result-12345"));

      expect(onSelect).toHaveBeenCalledWith(mockResults[0]);
    });

    it("should navigate to item page when no onSelect is provided", async () => {
      mockSearchItems.mockResolvedValue(mockResults);
      render(<ItemSearch />);

      const input = screen.getByTestId("search-input");
      fireEvent.change(input, { target: { value: "gossamer" } });

      await waitFor(
        () => {
          expect(screen.getByText("Gossamer Scrap")).toBeInTheDocument();
        },
        { timeout: 1000 }
      );

      fireEvent.click(screen.getByTestId("search-result-12345"));

      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/items/$itemId",
        params: { itemId: "12345" },
      });
    });

    it("should update input value on selection", async () => {
      mockSearchItems.mockResolvedValue(mockResults);
      render(<ItemSearch />);

      const input = screen.getByTestId("search-input") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "gossamer" } });

      await waitFor(
        () => {
          expect(screen.getByText("Gossamer Scrap")).toBeInTheDocument();
        },
        { timeout: 1000 }
      );

      fireEvent.click(screen.getByTestId("search-result-12345"));

      expect(input.value).toBe("Gossamer Scrap");
    });

    it("should close dropdown on selection", async () => {
      mockSearchItems.mockResolvedValue(mockResults);
      render(<ItemSearch />);

      const input = screen.getByTestId("search-input");
      fireEvent.change(input, { target: { value: "gossamer" } });

      await waitFor(
        () => {
          expect(screen.getByTestId("search-results")).toBeInTheDocument();
        },
        { timeout: 1000 }
      );

      fireEvent.click(screen.getByTestId("search-result-12345"));

      expect(screen.queryByTestId("search-results")).not.toBeInTheDocument();
    });
  });

  describe("keyboard navigation", () => {
    it("should navigate down with ArrowDown", async () => {
      mockSearchItems.mockResolvedValue(mockResults);
      render(<ItemSearch />);

      const input = screen.getByTestId("search-input");
      fireEvent.change(input, { target: { value: "gossamer" } });

      await waitFor(
        () => {
          expect(screen.getByTestId("search-results")).toBeInTheDocument();
        },
        { timeout: 1000 }
      );

      fireEvent.keyDown(input, { key: "ArrowDown" });

      // First item should be highlighted (using inline styles with CSS variables)
      const firstResult = screen.getByTestId("search-result-12345");
      expect(firstResult).toHaveStyle({ background: "var(--gw2-bg-light)" });
    });

    it("should navigate up with ArrowUp", async () => {
      mockSearchItems.mockResolvedValue(mockResults);
      render(<ItemSearch />);

      const input = screen.getByTestId("search-input");
      fireEvent.change(input, { target: { value: "gossamer" } });

      await waitFor(
        () => {
          expect(screen.getByTestId("search-results")).toBeInTheDocument();
        },
        { timeout: 1000 }
      );

      // Navigate down twice
      fireEvent.keyDown(input, { key: "ArrowDown" });
      fireEvent.keyDown(input, { key: "ArrowDown" });

      // Second item should be highlighted (using inline styles with CSS variables)
      expect(screen.getByTestId("search-result-12346")).toHaveStyle({
        background: "var(--gw2-bg-light)",
      });

      // Navigate up
      fireEvent.keyDown(input, { key: "ArrowUp" });

      // First item should be highlighted again
      expect(screen.getByTestId("search-result-12345")).toHaveStyle({
        background: "var(--gw2-bg-light)",
      });
    });

    it("should select item with Enter", async () => {
      const onSelect = vi.fn();
      mockSearchItems.mockResolvedValue(mockResults);
      render(<ItemSearch onSelect={onSelect} />);

      const input = screen.getByTestId("search-input");
      fireEvent.change(input, { target: { value: "gossamer" } });

      await waitFor(
        () => {
          expect(screen.getByTestId("search-results")).toBeInTheDocument();
        },
        { timeout: 1000 }
      );

      fireEvent.keyDown(input, { key: "ArrowDown" });
      fireEvent.keyDown(input, { key: "Enter" });

      expect(onSelect).toHaveBeenCalledWith(mockResults[0]);
    });

    it("should close dropdown with Escape", async () => {
      mockSearchItems.mockResolvedValue(mockResults);
      render(<ItemSearch />);

      const input = screen.getByTestId("search-input");
      fireEvent.change(input, { target: { value: "gossamer" } });

      await waitFor(
        () => {
          expect(screen.getByTestId("search-results")).toBeInTheDocument();
        },
        { timeout: 1000 }
      );

      fireEvent.keyDown(input, { key: "Escape" });

      expect(screen.queryByTestId("search-results")).not.toBeInTheDocument();
    });
  });

  describe("click outside", () => {
    it("should close dropdown when clicking outside", async () => {
      mockSearchItems.mockResolvedValue(mockResults);
      render(
        <div>
          <ItemSearch />
          <button data-testid="outside-element">Outside</button>
        </div>
      );

      const input = screen.getByTestId("search-input");
      fireEvent.change(input, { target: { value: "gossamer" } });

      await waitFor(
        () => {
          expect(screen.getByTestId("search-results")).toBeInTheDocument();
        },
        { timeout: 1000 }
      );

      // Click outside
      fireEvent.mouseDown(screen.getByTestId("outside-element"));

      expect(screen.queryByTestId("search-results")).not.toBeInTheDocument();
    });
  });

  describe("error handling", () => {
    it("should handle search errors gracefully", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      mockSearchItems.mockRejectedValue(new Error("Network error"));
      render(<ItemSearch />);

      const input = screen.getByTestId("search-input");
      fireEvent.change(input, { target: { value: "gossamer" } });

      await waitFor(
        () => {
          expect(consoleSpy).toHaveBeenCalledWith(
            "Search failed:",
            expect.any(Error)
          );
        },
        { timeout: 1000 }
      );

      expect(screen.queryByTestId("search-results")).not.toBeInTheDocument();
      consoleSpy.mockRestore();
    });
  });

  describe("focus behavior", () => {
    it("should reopen dropdown on focus when results exist", async () => {
      mockSearchItems.mockResolvedValue(mockResults);
      render(
        <div>
          <ItemSearch />
          <button data-testid="outside-element">Outside</button>
        </div>
      );

      const input = screen.getByTestId("search-input");
      fireEvent.change(input, { target: { value: "gossamer" } });

      await waitFor(
        () => {
          expect(screen.getByTestId("search-results")).toBeInTheDocument();
        },
        { timeout: 1000 }
      );

      // Click outside to close
      fireEvent.mouseDown(screen.getByTestId("outside-element"));
      expect(screen.queryByTestId("search-results")).not.toBeInTheDocument();

      // Focus input again
      fireEvent.focus(input);
      expect(screen.getByTestId("search-results")).toBeInTheDocument();
    });
  });
});
