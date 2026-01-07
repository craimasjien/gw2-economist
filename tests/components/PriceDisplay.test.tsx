/**
 * @fileoverview Unit tests for the PriceDisplay component.
 *
 * Tests verify correct formatting of GW2 currency (copper) into
 * gold, silver, and copper display format.
 *
 * @module tests/components/PriceDisplay.test
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PriceDisplay, formatPrice } from "../../src/components/PriceDisplay";

describe("PriceDisplay", () => {
  describe("formatPrice utility", () => {
    it("formats 12345 copper as 1g 23s 45c", () => {
      const result = formatPrice(12345);
      expect(result).toEqual({ gold: 1, silver: 23, copper: 45 });
    });

    it("formats 100 copper as 0g 1s 0c", () => {
      const result = formatPrice(100);
      expect(result).toEqual({ gold: 0, silver: 1, copper: 0 });
    });

    it("formats 50 copper as 0g 0s 50c", () => {
      const result = formatPrice(50);
      expect(result).toEqual({ gold: 0, silver: 0, copper: 50 });
    });

    it("formats 0 copper correctly", () => {
      const result = formatPrice(0);
      expect(result).toEqual({ gold: 0, silver: 0, copper: 0 });
    });

    it("formats large values correctly", () => {
      // 999g 99s 99c = 9999999 copper
      const result = formatPrice(9999999);
      expect(result).toEqual({ gold: 999, silver: 99, copper: 99 });
    });
  });

  describe("PriceDisplay component", () => {
    it("renders gold, silver, and copper for full values", () => {
      render(<PriceDisplay copper={12345} />);

      expect(screen.getByText("1")).toBeInTheDocument();
      expect(screen.getByText("23")).toBeInTheDocument();
      expect(screen.getByText("45")).toBeInTheDocument();
    });

    it("omits gold when value is less than 1 gold (10000c)", () => {
      render(<PriceDisplay copper={2345} />);

      // Should not show gold
      expect(screen.queryByTestId("gold-value")).not.toBeInTheDocument();
      expect(screen.getByText("23")).toBeInTheDocument();
      expect(screen.getByText("45")).toBeInTheDocument();
    });

    it("omits gold and silver when less than 1 silver (100c)", () => {
      render(<PriceDisplay copper={45} />);

      expect(screen.queryByTestId("gold-value")).not.toBeInTheDocument();
      expect(screen.queryByTestId("silver-value")).not.toBeInTheDocument();
      expect(screen.getByText("45")).toBeInTheDocument();
    });

    it("handles zero value", () => {
      render(<PriceDisplay copper={0} />);

      expect(screen.getByText("0")).toBeInTheDocument();
    });

    it("shows all units when showAll prop is true", () => {
      render(<PriceDisplay copper={45} showAll />);

      expect(screen.getByTestId("gold-value")).toBeInTheDocument();
      expect(screen.getByTestId("silver-value")).toBeInTheDocument();
      expect(screen.getByTestId("copper-value")).toBeInTheDocument();
    });

    it("applies custom className", () => {
      render(<PriceDisplay copper={100} className="custom-class" />);

      const container = screen.getByTestId("price-display");
      expect(container).toHaveClass("custom-class");
    });
  });
});

