/**
 * @fileoverview Component for displaying price trend information.
 *
 * Shows current price, price changes over 24h and 7d periods,
 * volume trend indicator, and time range selection for charts.
 * Styled with GW2 theme colors.
 *
 * @module components/PriceTrendChart
 *
 * @example
 * ```tsx
 * import { PriceTrendChart } from './PriceTrendChart';
 *
 * <PriceTrendChart
 *   trend={priceTrend}
 *   selectedRange={7}
 *   onRangeChange={(days) => setRange(days)}
 * />
 * ```
 */

import { PriceDisplay } from "./PriceDisplay";
import type { SerializedPriceTrend } from "../../server/functions/craft-analysis";
import { TrendingUp, TrendingDown, Minus, Loader2, BarChart3 } from "lucide-react";

/**
 * Props for the PriceTrendChart component.
 */
export interface PriceTrendChartProps {
  /**
   * Price trend data to display.
   */
  trend: SerializedPriceTrend | null;

  /**
   * Whether data is currently loading.
   */
  isLoading?: boolean;

  /**
   * Currently selected time range in days.
   */
  selectedRange?: number;

  /**
   * Callback when time range is changed.
   */
  onRangeChange?: (days: number) => void;

  /**
   * Additional CSS classes.
   */
  className?: string;
}

/**
 * Available time range options.
 */
const TIME_RANGES = [
  { days: 1, label: "24h" },
  { days: 7, label: "7d" },
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
];

/**
 * Gets the appropriate trend icon component.
 */
function TrendIcon({ trend }: { trend: "increasing" | "stable" | "decreasing" }) {
  switch (trend) {
    case "increasing":
      return <TrendingUp className="w-4 h-4" style={{ color: "var(--gw2-green)" }} />;
    case "decreasing":
      return <TrendingDown className="w-4 h-4" style={{ color: "var(--gw2-red)" }} />;
    default:
      return <Minus className="w-4 h-4" style={{ color: "var(--gw2-text-muted)" }} />;
  }
}

/**
 * Formats a percentage change with sign.
 */
function formatPercentChange(percent: number): string {
  const sign = percent > 0 ? "+" : "";
  return `${sign}${percent}%`;
}

/**
 * Displays price trend information with time range selection.
 *
 * @param props - Component props
 * @returns Price trend display
 */
export function PriceTrendChart({
  trend,
  isLoading = false,
  selectedRange = 7,
  onRangeChange,
  className = "",
}: PriceTrendChartProps) {
  if (isLoading) {
    return (
      <div
        data-testid="trend-loading"
        className={`gw2-card p-6 flex items-center justify-center ${className}`}
      >
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--gw2-gold)" }} />
        <span className="ml-2" style={{ color: "var(--gw2-text-secondary)" }}>
          Loading trend data...
        </span>
      </div>
    );
  }

  if (!trend) {
    return (
      <div className={`gw2-card p-6 text-center ${className}`}>
        <BarChart3 className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--gw2-text-muted)" }} />
        <p style={{ color: "var(--gw2-text-secondary)" }}>
          No trend data available
        </p>
        <p className="text-sm mt-1" style={{ color: "var(--gw2-text-muted)" }}>
          Historical data will appear after price snapshots are recorded.
        </p>
      </div>
    );
  }

  const is24hPositive = trend.priceChangePercent24h >= 0;
  const is7dPositive = trend.priceChangePercent7d >= 0;

  return (
    <div className={`gw2-card overflow-hidden ${className}`}>
      {/* Header with time range selector */}
      <div
        className="px-6 py-4 flex items-center justify-between"
        style={{ borderBottom: "1px solid var(--gw2-border)" }}
      >
        <h3 className="font-semibold" style={{ color: "var(--gw2-text-primary)" }}>
          Price Trends
        </h3>
        <div className="flex gap-1">
          {TIME_RANGES.map(({ days, label }) => (
            <button
              key={days}
              onClick={() => onRangeChange?.(days)}
              data-selected={selectedRange === days}
              className="px-3 py-1 text-sm rounded transition-colors"
              style={{
                backgroundColor:
                  selectedRange === days ? "var(--gw2-gold)" : "var(--gw2-bg-lighter)",
                color:
                  selectedRange === days ? "var(--gw2-bg-dark)" : "var(--gw2-text-secondary)",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Current Price */}
      <div className="p-6">
        <div className="mb-6">
          <p className="text-sm mb-1" style={{ color: "var(--gw2-text-muted)" }}>
            Current Price
          </p>
          <div data-testid="current-price">
            <PriceDisplay copper={trend.currentPrice} size="lg" />
          </div>
        </div>

        {/* Price Changes Grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* 24h Change */}
          <div
            className="p-4 rounded-lg"
            style={{ backgroundColor: "var(--gw2-bg-lighter)" }}
          >
            <p className="text-xs mb-1" style={{ color: "var(--gw2-text-muted)" }}>
              24h Change
            </p>
            <div className="flex items-center gap-2">
              <span
                data-testid="price-change-24h"
                data-positive={is24hPositive}
                className="text-lg font-semibold"
                style={{ color: is24hPositive ? "var(--gw2-green)" : "var(--gw2-red)" }}
              >
                {formatPercentChange(trend.priceChangePercent24h)}
              </span>
            </div>
            <p className="text-xs mt-1" style={{ color: "var(--gw2-text-muted)" }}>
              <PriceDisplay copper={Math.abs(trend.priceChange24h)} size="xs" showSign />
            </p>
          </div>

          {/* 7d Change */}
          <div
            className="p-4 rounded-lg"
            style={{ backgroundColor: "var(--gw2-bg-lighter)" }}
          >
            <p className="text-xs mb-1" style={{ color: "var(--gw2-text-muted)" }}>
              7d Change
            </p>
            <div className="flex items-center gap-2">
              <span
                data-testid="price-change-7d"
                data-positive={is7dPositive}
                className="text-lg font-semibold"
                style={{ color: is7dPositive ? "var(--gw2-green)" : "var(--gw2-red)" }}
              >
                {formatPercentChange(trend.priceChangePercent7d)}
              </span>
            </div>
            <p className="text-xs mt-1" style={{ color: "var(--gw2-text-muted)" }}>
              <PriceDisplay copper={Math.abs(trend.priceChange7d)} size="xs" showSign />
            </p>
          </div>
        </div>

        {/* Volume Info */}
        <div
          className="p-4 rounded-lg"
          style={{ backgroundColor: "var(--gw2-bg-lighter)" }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs mb-1" style={{ color: "var(--gw2-text-muted)" }}>
                Average Daily Volume
              </p>
              <p
                data-testid="avg-volume"
                className="text-lg font-semibold"
                style={{ color: "var(--gw2-text-primary)" }}
              >
                {trend.avgDailyVolume.toLocaleString()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs mb-1" style={{ color: "var(--gw2-text-muted)" }}>
                Volume Trend
              </p>
              <div
                data-testid="volume-trend"
                className="flex items-center gap-2"
              >
                <TrendIcon trend={trend.volumeTrend} />
                <span
                  className="capitalize"
                  style={{
                    color:
                      trend.volumeTrend === "increasing"
                        ? "var(--gw2-green)"
                        : trend.volumeTrend === "decreasing"
                        ? "var(--gw2-red)"
                        : "var(--gw2-text-muted)",
                  }}
                >
                  {trend.volumeTrend}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

