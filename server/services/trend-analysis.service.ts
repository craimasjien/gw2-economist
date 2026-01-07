/**
 * @fileoverview Trend Analysis Service for price and volume trend calculations.
 *
 * This service analyzes historical price data to identify trends, calculate
 * price changes over different time periods, and determine volume trends.
 * Used for finding profitable crafting opportunities.
 *
 * @module server/services/trend-analysis.service
 *
 * @example
 * ```typescript
 * import { TrendAnalysisService, createTrendDataAccess } from './trend-analysis.service';
 * import { db } from '../db';
 *
 * const service = new TrendAnalysisService(createTrendDataAccess(db));
 *
 * // Get price trends for an item
 * const trend = await service.getPriceTrend(12345, 7);
 * if (trend) {
 *   console.log(`24h change: ${trend.priceChangePercent24h}%`);
 *   console.log(`Volume trend: ${trend.volumeTrend}`);
 * }
 * ```
 */

import type { Price, PriceHistory } from "../db/schema";

/**
 * Result of price trend analysis for an item.
 *
 * @interface PriceTrend
 */
export interface PriceTrend {
  /**
   * The item ID being analyzed.
   */
  itemId: number;

  /**
   * Current sell price (instant buy price).
   */
  currentPrice: number;

  /**
   * Absolute price change over the last 24 hours (in copper).
   */
  priceChange24h: number;

  /**
   * Percentage price change over the last 24 hours.
   */
  priceChangePercent24h: number;

  /**
   * Absolute price change over the last 7 days (in copper).
   */
  priceChange7d: number;

  /**
   * Percentage price change over the last 7 days.
   */
  priceChangePercent7d: number;

  /**
   * Average daily sell quantity (volume).
   */
  avgDailyVolume: number;

  /**
   * Volume trend direction.
   */
  volumeTrend: "increasing" | "stable" | "decreasing";
}

/**
 * A single price data point for charting.
 *
 * @interface PriceDataPoint
 */
export interface PriceDataPoint {
  /**
   * Timestamp of the data point.
   */
  timestamp: Date;

  /**
   * Buy price (highest buy order).
   */
  buyPrice: number;

  /**
   * Sell price (lowest sell listing).
   */
  sellPrice: number;
}

/**
 * A single volume data point for charting.
 *
 * @interface VolumeDataPoint
 */
export interface VolumeDataPoint {
  /**
   * Timestamp of the data point.
   */
  timestamp: Date;

  /**
   * Buy order quantity.
   */
  buyQuantity: number;

  /**
   * Sell listing quantity.
   */
  sellQuantity: number;
}

/**
 * Data access interface for trend analysis.
 *
 * @interface TrendDataAccess
 */
export interface TrendDataAccess {
  /**
   * Retrieves the current trading post price for an item.
   */
  getPrice(itemId: number): Promise<Price | null>;

  /**
   * Retrieves price history for an item from a given date.
   */
  getPriceHistory(itemId: number, fromDate: Date): Promise<PriceHistory[]>;
}

/**
 * Threshold for determining if volume is "stable" (within +/- 10%).
 */
const VOLUME_STABILITY_THRESHOLD = 0.1;

/**
 * Service for analyzing price and volume trends.
 *
 * @class TrendAnalysisService
 */
export class TrendAnalysisService {
  /**
   * Data access layer for database queries.
   */
  private readonly dataAccess: TrendDataAccess;

  /**
   * Creates a new TrendAnalysisService.
   *
   * @param dataAccess - Data access implementation for database queries
   */
  constructor(dataAccess: TrendDataAccess) {
    this.dataAccess = dataAccess;
  }

  /**
   * Analyzes price and volume trends for an item.
   *
   * @param itemId - The item ID to analyze
   * @param days - Number of days of history to consider (default: 7)
   * @returns Price trend analysis or null if insufficient data
   */
  async getPriceTrend(itemId: number, days = 7): Promise<PriceTrend | null> {
    // Get current price
    const currentPrice = await this.dataAccess.getPrice(itemId);
    if (!currentPrice) {
      return null;
    }

    // Get price history
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const history = await this.dataAccess.getPriceHistory(itemId, fromDate);
    if (history.length === 0) {
      return null;
    }

    // Sort history by timestamp (oldest first)
    const sortedHistory = [...history].sort(
      (a, b) => a.recordedAt.getTime() - b.recordedAt.getTime()
    );

    // Calculate 24h price change
    const price24hAgo = this.findPriceAtHoursAgo(sortedHistory, 24);
    const { change: priceChange24h, percent: priceChangePercent24h } =
      this.calculatePriceChange(currentPrice.sellPrice, price24hAgo);

    // Calculate 7d price change
    const price7dAgo = this.findPriceAtHoursAgo(sortedHistory, 7 * 24);
    const { change: priceChange7d, percent: priceChangePercent7d } =
      this.calculatePriceChange(currentPrice.sellPrice, price7dAgo);

    // Calculate average daily volume
    const avgDailyVolume = this.calculateAverageDailyVolume(sortedHistory);

    // Determine volume trend
    const volumeTrend = this.determineVolumeTrend(sortedHistory);

    return {
      itemId,
      currentPrice: currentPrice.sellPrice,
      priceChange24h,
      priceChangePercent24h,
      priceChange7d,
      priceChangePercent7d,
      avgDailyVolume,
      volumeTrend,
    };
  }

  /**
   * Gets price history data points for charting.
   *
   * @param itemId - The item ID
   * @param days - Number of days of history
   * @returns Array of price data points sorted by time
   */
  async getPriceHistory(itemId: number, days: number): Promise<PriceDataPoint[]> {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const history = await this.dataAccess.getPriceHistory(itemId, fromDate);

    return history
      .map((h) => ({
        timestamp: h.recordedAt,
        buyPrice: h.buyPrice,
        sellPrice: h.sellPrice,
      }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Gets volume history data points for charting.
   *
   * @param itemId - The item ID
   * @param days - Number of days of history
   * @returns Array of volume data points sorted by time
   */
  async getVolumeHistory(itemId: number, days: number): Promise<VolumeDataPoint[]> {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const history = await this.dataAccess.getPriceHistory(itemId, fromDate);

    return history
      .map((h) => ({
        timestamp: h.recordedAt,
        buyQuantity: h.buyQuantity,
        sellQuantity: h.sellQuantity,
      }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Finds the price closest to a specific number of hours ago.
   *
   * @param history - Sorted price history (oldest first)
   * @param hoursAgo - Number of hours ago to find
   * @returns The sell price at that time, or null if not found
   */
  private findPriceAtHoursAgo(
    history: PriceHistory[],
    hoursAgo: number
  ): number | null {
    const targetTime = Date.now() - hoursAgo * 60 * 60 * 1000;
    const tolerance = 2 * 60 * 60 * 1000; // 2 hour tolerance

    let closestRecord: PriceHistory | null = null;
    let closestDiff = Infinity;

    for (const record of history) {
      const diff = Math.abs(record.recordedAt.getTime() - targetTime);
      if (diff < closestDiff && diff <= tolerance) {
        closestDiff = diff;
        closestRecord = record;
      }
    }

    return closestRecord?.sellPrice ?? null;
  }

  /**
   * Calculates price change and percentage.
   *
   * @param currentPrice - Current price
   * @param oldPrice - Price from the past
   * @returns Object with change and percentage
   */
  private calculatePriceChange(
    currentPrice: number,
    oldPrice: number | null
  ): { change: number; percent: number } {
    if (oldPrice === null || oldPrice === 0) {
      return { change: 0, percent: 0 };
    }

    const change = currentPrice - oldPrice;
    const percent = Math.round((change / oldPrice) * 100);

    return { change, percent };
  }

  /**
   * Estimates daily trading volume from quantity changes between snapshots.
   *
   * This method tracks decreases in sellQuantity between consecutive snapshots
   * to estimate how many items were actually sold. Increases are ignored as
   * they represent new listings, not sales.
   *
   * @param history - Price history records (sorted oldest first)
   * @returns Estimated items sold in the history period
   */
  private calculateAverageDailyVolume(history: PriceHistory[]): number {
    if (history.length < 2) {
      return 0;
    }

    // Calculate total items sold by summing decreases in sellQuantity
    let totalSold = 0;

    for (let i = 1; i < history.length; i++) {
      const previousQuantity = history[i - 1].sellQuantity;
      const currentQuantity = history[i].sellQuantity;
      const delta = previousQuantity - currentQuantity;

      // Only count decreases (items sold), ignore increases (new listings)
      if (delta > 0) {
        totalSold += delta;
      }
    }

    // Calculate the time span in days
    const firstTime = history[0].recordedAt.getTime();
    const lastTime = history[history.length - 1].recordedAt.getTime();
    const daysCovered = (lastTime - firstTime) / (24 * 60 * 60 * 1000);

    // If less than 1 day of data, return total sold as-is
    if (daysCovered < 1) {
      return totalSold;
    }

    // Extrapolate to daily volume
    return Math.round(totalSold / daysCovered);
  }

  /**
   * Determines the volume trend direction.
   *
   * @param history - Sorted price history (oldest first)
   * @returns Volume trend direction
   */
  private determineVolumeTrend(
    history: PriceHistory[]
  ): "increasing" | "stable" | "decreasing" {
    if (history.length < 2) {
      return "stable";
    }

    // Compare first half average to second half average
    const midpoint = Math.floor(history.length / 2);
    const firstHalf = history.slice(0, midpoint);
    const secondHalf = history.slice(midpoint);

    const firstHalfAvg =
      firstHalf.reduce((sum, h) => sum + h.sellQuantity, 0) / firstHalf.length;
    const secondHalfAvg =
      secondHalf.reduce((sum, h) => sum + h.sellQuantity, 0) / secondHalf.length;

    // Prevent division by zero
    if (firstHalfAvg === 0) {
      return secondHalfAvg > 0 ? "increasing" : "stable";
    }

    const changeRatio = (secondHalfAvg - firstHalfAvg) / firstHalfAvg;

    if (changeRatio > VOLUME_STABILITY_THRESHOLD) {
      return "increasing";
    } else if (changeRatio < -VOLUME_STABILITY_THRESHOLD) {
      return "decreasing";
    }

    return "stable";
  }
}

