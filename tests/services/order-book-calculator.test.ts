/**
 * @fileoverview Unit tests for the OrderBookCalculator service.
 *
 * These tests verify the calculation of bulk purchase costs based on
 * order book depth. The calculator takes into account multiple price
 * levels in the trading post to determine actual costs for buying
 * specific quantities.
 *
 * @module tests/services/order-book-calculator.test
 */

import { describe, it, expect } from "vitest";
import {
  OrderBookCalculator,
  type BulkPurchaseResult,
} from "../../server/services/order-book-calculator";
import type { GW2ListingEntry } from "../../server/services/gw2-api/types";

describe("OrderBookCalculator", () => {
  describe("calculateBulkPurchaseCost", () => {
    it("should calculate cost when quantity is available at first price level", () => {
      const sellListings: GW2ListingEntry[] = [
        { listings: 10, quantity: 100, unit_price: 500 },
        { listings: 5, quantity: 50, unit_price: 600 },
      ];

      const result = OrderBookCalculator.calculateBulkPurchaseCost(sellListings, 50);

      expect(result.totalCost).toBe(50 * 500); // 25,000
      expect(result.averagePrice).toBe(500);
      expect(result.quantityFilled).toBe(50);
      expect(result.fullyFilled).toBe(true);
      expect(result.priceBreakdown).toHaveLength(1);
      expect(result.priceBreakdown[0]).toEqual({
        unitPrice: 500,
        quantity: 50,
        subtotal: 25000,
      });
    });

    it("should calculate cost spanning multiple price levels", () => {
      const sellListings: GW2ListingEntry[] = [
        { listings: 10, quantity: 100, unit_price: 500 },
        { listings: 5, quantity: 50, unit_price: 600 },
        { listings: 3, quantity: 100, unit_price: 700 },
      ];

      const result = OrderBookCalculator.calculateBulkPurchaseCost(sellListings, 120);

      // 100 @ 500 = 50,000
      // 20 @ 600 = 12,000
      // Total = 62,000
      expect(result.totalCost).toBe(62000);
      expect(result.averagePrice).toBeCloseTo(62000 / 120, 2);
      expect(result.quantityFilled).toBe(120);
      expect(result.fullyFilled).toBe(true);
      expect(result.priceBreakdown).toHaveLength(2);
    });

    it("should handle partial fill when not enough supply", () => {
      const sellListings: GW2ListingEntry[] = [
        { listings: 2, quantity: 30, unit_price: 500 },
        { listings: 1, quantity: 20, unit_price: 600 },
      ];

      const result = OrderBookCalculator.calculateBulkPurchaseCost(sellListings, 100);

      // 30 @ 500 = 15,000
      // 20 @ 600 = 12,000
      // Total = 27,000 (only 50 filled)
      expect(result.totalCost).toBe(27000);
      expect(result.quantityFilled).toBe(50);
      expect(result.fullyFilled).toBe(false);
      expect(result.averagePrice).toBeCloseTo(27000 / 50, 2);
    });

    it("should return zero values for empty listings", () => {
      const result = OrderBookCalculator.calculateBulkPurchaseCost([], 100);

      expect(result.totalCost).toBe(0);
      expect(result.averagePrice).toBe(0);
      expect(result.quantityFilled).toBe(0);
      expect(result.fullyFilled).toBe(false);
    });

    it("should return zero values for zero quantity", () => {
      const sellListings: GW2ListingEntry[] = [
        { listings: 10, quantity: 100, unit_price: 500 },
      ];

      const result = OrderBookCalculator.calculateBulkPurchaseCost(sellListings, 0);

      expect(result.totalCost).toBe(0);
      expect(result.averagePrice).toBe(0);
      expect(result.quantityFilled).toBe(0);
      expect(result.fullyFilled).toBe(true); // 0 quantity is always "filled"
    });

    it("should handle listings where some have zero quantity", () => {
      const sellListings: GW2ListingEntry[] = [
        { listings: 0, quantity: 0, unit_price: 400 },
        { listings: 5, quantity: 50, unit_price: 500 },
      ];

      const result = OrderBookCalculator.calculateBulkPurchaseCost(sellListings, 30);

      expect(result.totalCost).toBe(30 * 500);
      expect(result.quantityFilled).toBe(30);
    });
  });

  describe("calculatePriceImpact", () => {
    it("should calculate price impact for bulk purchases", () => {
      const sellListings: GW2ListingEntry[] = [
        { listings: 5, quantity: 50, unit_price: 500 },
        { listings: 5, quantity: 50, unit_price: 600 },
      ];

      const impact = OrderBookCalculator.calculatePriceImpact(sellListings, 80);

      // Base price: 500
      // 50 @ 500 = 25,000
      // 30 @ 600 = 18,000
      // Total: 43,000 / 80 = 537.5 avg
      // Impact: (537.5 - 500) / 500 * 100 = 7.5%
      expect(impact.basePrice).toBe(500);
      expect(impact.effectivePrice).toBeCloseTo(537.5, 1);
      expect(impact.priceImpactPercent).toBeCloseTo(7.5, 1);
    });

    it("should return zero impact when buying within first level", () => {
      const sellListings: GW2ListingEntry[] = [
        { listings: 10, quantity: 100, unit_price: 500 },
        { listings: 5, quantity: 50, unit_price: 600 },
      ];

      const impact = OrderBookCalculator.calculatePriceImpact(sellListings, 50);

      expect(impact.basePrice).toBe(500);
      expect(impact.effectivePrice).toBe(500);
      expect(impact.priceImpactPercent).toBe(0);
    });

    it("should handle empty listings", () => {
      const impact = OrderBookCalculator.calculatePriceImpact([], 100);

      expect(impact.basePrice).toBe(0);
      expect(impact.effectivePrice).toBe(0);
      expect(impact.priceImpactPercent).toBe(0);
    });
  });

  describe("getInstantBuyPrice", () => {
    it("should return the lowest sell price", () => {
      const sellListings: GW2ListingEntry[] = [
        { listings: 5, quantity: 50, unit_price: 500 },
        { listings: 10, quantity: 100, unit_price: 600 },
      ];

      expect(OrderBookCalculator.getInstantBuyPrice(sellListings)).toBe(500);
    });

    it("should return 0 for empty listings", () => {
      expect(OrderBookCalculator.getInstantBuyPrice([])).toBe(0);
    });

    it("should skip zero-quantity entries", () => {
      const sellListings: GW2ListingEntry[] = [
        { listings: 0, quantity: 0, unit_price: 400 },
        { listings: 5, quantity: 50, unit_price: 500 },
      ];

      expect(OrderBookCalculator.getInstantBuyPrice(sellListings)).toBe(500);
    });
  });

  describe("getTotalSupply", () => {
    it("should sum all quantities across price levels", () => {
      const sellListings: GW2ListingEntry[] = [
        { listings: 5, quantity: 50, unit_price: 500 },
        { listings: 10, quantity: 100, unit_price: 600 },
        { listings: 3, quantity: 30, unit_price: 700 },
      ];

      expect(OrderBookCalculator.getTotalSupply(sellListings)).toBe(180);
    });

    it("should return 0 for empty listings", () => {
      expect(OrderBookCalculator.getTotalSupply([])).toBe(0);
    });
  });

  describe("findBreakEvenQuantity", () => {
    it("should find quantity where average price exceeds threshold", () => {
      const sellListings: GW2ListingEntry[] = [
        { listings: 5, quantity: 100, unit_price: 500 },
        { listings: 5, quantity: 100, unit_price: 700 },
      ];

      // If threshold is 550, we can buy up to the point where avg exceeds 550
      // At 100 units: avg = 500 (below 550)
      // At 150 units: avg = (100*500 + 50*700)/150 = 85000/150 = 566.67 (above 550)
      // Binary search should find ~125 units
      const breakEven = OrderBookCalculator.findBreakEvenQuantity(sellListings, 550);

      // At breakEven quantity, average should be close to or just below 550
      const result = OrderBookCalculator.calculateBulkPurchaseCost(sellListings, breakEven);
      expect(result.averagePrice).toBeLessThanOrEqual(550);

      // One more unit should push it over
      const nextResult = OrderBookCalculator.calculateBulkPurchaseCost(sellListings, breakEven + 1);
      expect(nextResult.averagePrice).toBeGreaterThan(550);
    });

    it("should return total supply when all prices below threshold", () => {
      const sellListings: GW2ListingEntry[] = [
        { listings: 5, quantity: 100, unit_price: 500 },
      ];

      // Threshold 600 is above all prices
      const breakEven = OrderBookCalculator.findBreakEvenQuantity(sellListings, 600);
      expect(breakEven).toBe(100);
    });

    it("should return 0 when lowest price exceeds threshold", () => {
      const sellListings: GW2ListingEntry[] = [
        { listings: 5, quantity: 100, unit_price: 500 },
      ];

      // Threshold 400 is below all prices
      const breakEven = OrderBookCalculator.findBreakEvenQuantity(sellListings, 400);
      expect(breakEven).toBe(0);
    });

    it("should handle empty listings", () => {
      expect(OrderBookCalculator.findBreakEvenQuantity([], 500)).toBe(0);
    });
  });
});

