/**
 * @fileoverview Order Book Calculator for GW2 Trading Post bulk purchases.
 *
 * This module provides utilities for calculating the true cost of purchasing
 * items in bulk from the trading post, taking into account the order book depth.
 * When buying large quantities, the price may increase as cheaper listings are
 * exhausted, making the effective price higher than the displayed instant-buy price.
 *
 * @module server/services/order-book-calculator
 *
 * @example
 * ```typescript
 * import { OrderBookCalculator } from './order-book-calculator';
 * import type { GW2ListingEntry } from './gw2-api/types';
 *
 * const sellListings: GW2ListingEntry[] = [
 *   { listings: 5, quantity: 100, unit_price: 500 },
 *   { listings: 3, quantity: 50, unit_price: 600 },
 * ];
 *
 * // Calculate cost to buy 120 units
 * const result = OrderBookCalculator.calculateBulkPurchaseCost(sellListings, 120);
 * console.log(`Total cost: ${result.totalCost}`);
 * console.log(`Average price: ${result.averagePrice}`);
 * ```
 */

import type { GW2ListingEntry } from "./gw2-api/types";

/**
 * Breakdown of purchases at each price level.
 *
 * @interface PriceLevelBreakdown
 */
export interface PriceLevelBreakdown {
  /**
   * Unit price at this level in copper.
   */
  unitPrice: number;

  /**
   * Quantity purchased at this price level.
   */
  quantity: number;

  /**
   * Subtotal cost for this price level (unitPrice * quantity).
   */
  subtotal: number;
}

/**
 * Result of calculating bulk purchase costs.
 *
 * @interface BulkPurchaseResult
 */
export interface BulkPurchaseResult {
  /**
   * Total cost in copper for all purchases.
   */
  totalCost: number;

  /**
   * Weighted average price per unit in copper.
   */
  averagePrice: number;

  /**
   * Number of units that could be filled from available supply.
   */
  quantityFilled: number;

  /**
   * Whether the entire requested quantity was filled.
   */
  fullyFilled: boolean;

  /**
   * Breakdown of purchases at each price level.
   */
  priceBreakdown: PriceLevelBreakdown[];
}

/**
 * Result of calculating price impact for bulk purchases.
 *
 * @interface PriceImpactResult
 */
export interface PriceImpactResult {
  /**
   * The lowest available price (instant buy for 1 unit).
   */
  basePrice: number;

  /**
   * The effective price per unit for the requested quantity.
   */
  effectivePrice: number;

  /**
   * Percentage increase from base price due to order book depth.
   * Formula: ((effectivePrice - basePrice) / basePrice) * 100
   */
  priceImpactPercent: number;
}

/**
 * Calculator for order book depth and bulk purchase costs.
 *
 * This class provides static methods for analyzing trading post order books
 * to determine the true cost of bulk purchases. It accounts for the fact that
 * buying large quantities will exhaust cheaper listings, driving up the
 * effective price.
 *
 * @class OrderBookCalculator
 *
 * @remarks
 * All prices are in copper (the base currency unit in GW2).
 * Sell listings should be sorted by unit_price in ascending order.
 */
export class OrderBookCalculator {
  /**
   * Calculates the total cost and breakdown for buying a specific quantity.
   *
   * Iterates through sell listings from lowest to highest price,
   * accumulating purchases until the requested quantity is filled or
   * supply is exhausted.
   *
   * @param sellListings - Array of sell listings sorted by price (lowest first)
   * @param quantity - Number of units to purchase
   * @returns Calculation result with total cost, average price, and breakdown
   *
   * @example
   * ```typescript
   * const result = OrderBookCalculator.calculateBulkPurchaseCost(
   *   [
   *     { listings: 5, quantity: 100, unit_price: 500 },
   *     { listings: 3, quantity: 50, unit_price: 600 },
   *   ],
   *   120
   * );
   * // Result: 100 @ 500 + 20 @ 600 = 62,000 copper
   * ```
   */
  static calculateBulkPurchaseCost(
    sellListings: GW2ListingEntry[],
    quantity: number
  ): BulkPurchaseResult {
    // Handle edge case of zero quantity
    if (quantity <= 0) {
      return {
        totalCost: 0,
        averagePrice: 0,
        quantityFilled: 0,
        fullyFilled: true,
        priceBreakdown: [],
      };
    }

    // Handle edge case of no listings
    if (sellListings.length === 0) {
      return {
        totalCost: 0,
        averagePrice: 0,
        quantityFilled: 0,
        fullyFilled: false,
        priceBreakdown: [],
      };
    }

    let remaining = quantity;
    let totalCost = 0;
    const priceBreakdown: PriceLevelBreakdown[] = [];

    for (const entry of sellListings) {
      if (remaining <= 0) break;
      if (entry.quantity <= 0) continue;

      const take = Math.min(remaining, entry.quantity);
      const subtotal = take * entry.unit_price;

      totalCost += subtotal;
      remaining -= take;

      priceBreakdown.push({
        unitPrice: entry.unit_price,
        quantity: take,
        subtotal,
      });
    }

    const quantityFilled = quantity - remaining;
    const averagePrice = quantityFilled > 0 ? totalCost / quantityFilled : 0;

    return {
      totalCost,
      averagePrice,
      quantityFilled,
      fullyFilled: remaining <= 0,
      priceBreakdown,
    };
  }

  /**
   * Calculates the price impact of buying a specific quantity.
   *
   * Compares the effective average price to the base (instant buy) price
   * to determine how much the price increases due to order book depth.
   *
   * @param sellListings - Array of sell listings sorted by price (lowest first)
   * @param quantity - Number of units to purchase
   * @returns Price impact analysis
   *
   * @example
   * ```typescript
   * const impact = OrderBookCalculator.calculatePriceImpact(listings, 500);
   * console.log(`Price impact: +${impact.priceImpactPercent.toFixed(1)}%`);
   * ```
   */
  static calculatePriceImpact(
    sellListings: GW2ListingEntry[],
    quantity: number
  ): PriceImpactResult {
    const basePrice = this.getInstantBuyPrice(sellListings);

    if (basePrice === 0 || quantity <= 0) {
      return {
        basePrice: 0,
        effectivePrice: 0,
        priceImpactPercent: 0,
      };
    }

    const result = this.calculateBulkPurchaseCost(sellListings, quantity);
    const effectivePrice = result.averagePrice;
    const priceImpactPercent =
      basePrice > 0 ? ((effectivePrice - basePrice) / basePrice) * 100 : 0;

    return {
      basePrice,
      effectivePrice,
      priceImpactPercent,
    };
  }

  /**
   * Gets the instant buy price (lowest sell listing price).
   *
   * @param sellListings - Array of sell listings
   * @returns Lowest unit price, or 0 if no listings available
   */
  static getInstantBuyPrice(sellListings: GW2ListingEntry[]): number {
    for (const entry of sellListings) {
      if (entry.quantity > 0) {
        return entry.unit_price;
      }
    }
    return 0;
  }

  /**
   * Gets the total supply across all price levels.
   *
   * @param sellListings - Array of sell listings
   * @returns Total quantity available for purchase
   */
  static getTotalSupply(sellListings: GW2ListingEntry[]): number {
    return sellListings.reduce((sum, entry) => sum + entry.quantity, 0);
  }

  /**
   * Finds the maximum quantity that can be purchased without exceeding
   * a price threshold (average price per unit).
   *
   * Uses binary search to efficiently find the break-even quantity where
   * buying more would push the average price above the threshold.
   *
   * @param sellListings - Array of sell listings sorted by price (lowest first)
   * @param priceThreshold - Maximum acceptable average price per unit
   * @returns Maximum quantity that can be bought at or below the threshold
   *
   * @example
   * ```typescript
   * // Find how many items can be bought before avg price exceeds craft cost
   * const craftCost = 550;
   * const maxQuantity = OrderBookCalculator.findBreakEvenQuantity(listings, craftCost);
   * console.log(`Can buy up to ${maxQuantity} units before crafting is cheaper`);
   * ```
   */
  static findBreakEvenQuantity(
    sellListings: GW2ListingEntry[],
    priceThreshold: number
  ): number {
    if (sellListings.length === 0) {
      return 0;
    }

    // If even the first price is above threshold, can't buy any
    const basePrice = this.getInstantBuyPrice(sellListings);
    if (basePrice > priceThreshold) {
      return 0;
    }

    const totalSupply = this.getTotalSupply(sellListings);

    // If all prices are below threshold, can buy everything
    const fullResult = this.calculateBulkPurchaseCost(sellListings, totalSupply);
    if (fullResult.averagePrice <= priceThreshold) {
      return totalSupply;
    }

    // Binary search for break-even point
    let low = 1;
    let high = totalSupply;
    let result = 0;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const calc = this.calculateBulkPurchaseCost(sellListings, mid);

      if (calc.averagePrice <= priceThreshold) {
        result = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    return result;
  }
}

