/**
 * @fileoverview Unit tests for the PriceTrendChart component.
 *
 * Tests verify correct rendering of price trend information,
 * time range selection, and trend indicators.
 *
 * @module tests/components/PriceTrendChart.test
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PriceTrendChart } from "../../src/components/PriceTrendChart";
import type { SerializedPriceTrend } from "../../server/functions/craft-analysis";

/**
 * Creates a mock price trend for testing.
 */
function createMockPriceTrend(
  overrides: Partial<SerializedPriceTrend> = {}
): SerializedPriceTrend {
  return {
    itemId: 1,
    currentPrice: 10000,
    priceChange24h: 500,
    priceChangePercent24h: 5,
    priceChange7d: 1500,
    priceChangePercent7d: 15,
    avgDailyVolume: 250,
    volumeTrend: "stable",
    ...overrides,
  };
}

describe("PriceTrendChart", () => {
  describe("price display", () => {
    it("should display current price", () => {
      const trend = createMockPriceTrend({ currentPrice: 15000 });

      render(<PriceTrendChart trend={trend} />);

      expect(screen.getByTestId("current-price")).toBeInTheDocument();
    });

    it("should display 24h price change", () => {
      const trend = createMockPriceTrend({
        priceChange24h: 500,
        priceChangePercent24h: 10,
      });

      render(<PriceTrendChart trend={trend} />);

      expect(screen.getByTestId("price-change-24h")).toHaveTextContent("+10%");
    });

    it("should display 7d price change", () => {
      const trend = createMockPriceTrend({
        priceChange7d: 2000,
        priceChangePercent7d: 25,
      });

      render(<PriceTrendChart trend={trend} />);

      expect(screen.getByTestId("price-change-7d")).toHaveTextContent("+25%");
    });

    it("should show negative changes with minus sign", () => {
      const trend = createMockPriceTrend({
        priceChange24h: -500,
        priceChangePercent24h: -10,
      });

      render(<PriceTrendChart trend={trend} />);

      expect(screen.getByTestId("price-change-24h")).toHaveTextContent("-10%");
    });
  });

  describe("volume trend display", () => {
    it("should show increasing volume trend indicator", () => {
      const trend = createMockPriceTrend({ volumeTrend: "increasing" });

      render(<PriceTrendChart trend={trend} />);

      const volumeIndicator = screen.getByTestId("volume-trend");
      expect(volumeIndicator).toHaveTextContent(/increasing/i);
    });

    it("should show decreasing volume trend indicator", () => {
      const trend = createMockPriceTrend({ volumeTrend: "decreasing" });

      render(<PriceTrendChart trend={trend} />);

      const volumeIndicator = screen.getByTestId("volume-trend");
      expect(volumeIndicator).toHaveTextContent(/decreasing/i);
    });

    it("should show stable volume trend indicator", () => {
      const trend = createMockPriceTrend({ volumeTrend: "stable" });

      render(<PriceTrendChart trend={trend} />);

      const volumeIndicator = screen.getByTestId("volume-trend");
      expect(volumeIndicator).toHaveTextContent(/stable/i);
    });

    it("should display average daily volume", () => {
      const trend = createMockPriceTrend({ avgDailyVolume: 1500 });

      render(<PriceTrendChart trend={trend} />);

      expect(screen.getByTestId("avg-volume")).toHaveTextContent("1,500");
    });
  });

  describe("time range selection", () => {
    it("should show time range options", () => {
      const trend = createMockPriceTrend();

      render(<PriceTrendChart trend={trend} />);

      expect(screen.getByRole("button", { name: /24h/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /7d/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /30d/i })).toBeInTheDocument();
    });

    it("should call onRangeChange when time range is selected", () => {
      const trend = createMockPriceTrend();
      const onRangeChange = vi.fn();

      render(<PriceTrendChart trend={trend} onRangeChange={onRangeChange} />);

      fireEvent.click(screen.getByRole("button", { name: /30d/i }));

      expect(onRangeChange).toHaveBeenCalledWith(30);
    });

    it("should highlight selected time range", () => {
      const trend = createMockPriceTrend();

      render(<PriceTrendChart trend={trend} selectedRange={7} />);

      const button7d = screen.getByRole("button", { name: /7d/i });
      expect(button7d).toHaveAttribute("data-selected", "true");
    });
  });

  describe("loading state", () => {
    it("should show loading state when no trend data", () => {
      render(<PriceTrendChart trend={null} isLoading={true} />);

      expect(screen.getByTestId("trend-loading")).toBeInTheDocument();
    });
  });

  describe("empty state", () => {
    it("should show message when no trend data available", () => {
      render(<PriceTrendChart trend={null} isLoading={false} />);

      expect(screen.getByText(/no trend data available/i)).toBeInTheDocument();
    });
  });

  describe("price change styling", () => {
    it("should apply positive styling for price increases", () => {
      const trend = createMockPriceTrend({ priceChangePercent24h: 10 });

      render(<PriceTrendChart trend={trend} />);

      const change = screen.getByTestId("price-change-24h");
      expect(change).toHaveAttribute("data-positive", "true");
    });

    it("should apply negative styling for price decreases", () => {
      const trend = createMockPriceTrend({ priceChangePercent24h: -10 });

      render(<PriceTrendChart trend={trend} />);

      const change = screen.getByTestId("price-change-24h");
      expect(change).toHaveAttribute("data-positive", "false");
    });
  });
});

