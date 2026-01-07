/**
 * @fileoverview Component for displaying quantity-aware craft analysis.
 *
 * Shows how buying in bulk affects the buy vs craft decision by considering
 * order book depth. Displays price impact, supply availability, and the
 * crossover point where crafting becomes more economical.
 *
 * @module components/QuantityAnalysis
 *
 * @example
 * ```tsx
 * import { QuantityAnalysis } from './QuantityAnalysis';
 *
 * <QuantityAnalysis itemId={12345} />
 * ```
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import { PriceDisplay } from "./PriceDisplay";
import {
  analyzeForQuantity,
  type SerializedQuantityAnalysis,
} from "../../server/functions/craft-analysis";
import {
  ShoppingCart,
  Hammer,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Package,
  Info,
} from "lucide-react";

/**
 * Props for the QuantityAnalysis component.
 */
export interface QuantityAnalysisProps {
  /**
   * Item ID to analyze.
   */
  itemId: number;

  /**
   * Initial quantity to analyze (default 1).
   */
  initialQuantity?: number;

  /**
   * Callback when analysis is loaded.
   */
  onAnalysisLoaded?: (analysis: SerializedQuantityAnalysis | null) => void;

  /**
   * Additional CSS classes.
   */
  className?: string;
}

/**
 * Common quantity presets for quick selection.
 */
const QUANTITY_PRESETS = [1, 10, 25, 50, 100, 250, 500] as const;

/**
 * Displays quantity-aware craft analysis with order book impact.
 *
 * @param props - Component props
 * @returns Quantity analysis component
 */
export function QuantityAnalysis({
  itemId,
  initialQuantity = 1,
  onAnalysisLoaded,
  className = "",
}: QuantityAnalysisProps) {
  const [quantity, setQuantity] = useState(initialQuantity);
  const [inputValue, setInputValue] = useState(String(initialQuantity));
  const [analysis, setAnalysis] = useState<SerializedQuantityAnalysis | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetches analysis for the current quantity.
   */
  const fetchAnalysis = useCallback(async () => {
    if (quantity < 1) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await analyzeForQuantity({ data: { itemId, quantity } });
      setAnalysis(result);
      onAnalysisLoaded?.(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analysis");
      setAnalysis(null);
    } finally {
      setIsLoading(false);
    }
  }, [itemId, quantity, onAnalysisLoaded]);

  // Fetch analysis when quantity changes (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(fetchAnalysis, 300);
    return () => clearTimeout(timeoutId);
  }, [fetchAnalysis]);

  /**
   * Handles quantity input change.
   */
  const handleQuantityChange = useCallback((value: string) => {
    setInputValue(value);
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 10000) {
      setQuantity(parsed);
    }
  }, []);

  /**
   * Handles preset button click.
   */
  const handlePresetClick = useCallback((preset: number) => {
    setQuantity(preset);
    setInputValue(String(preset));
  }, []);

  /**
   * Price impact indicator color.
   */
  const priceImpactColor = useMemo(() => {
    if (!analysis) return "var(--gw2-text-muted)";
    if (analysis.buyPriceImpact < 5) return "var(--gw2-success)";
    if (analysis.buyPriceImpact < 15) return "var(--gw2-gold)";
    return "var(--gw2-red)";
  }, [analysis]);

  if (error) {
    return (
      <div
        className={`gw2-card p-6 ${className}`}
        style={{ border: "1px solid var(--gw2-red)" }}
      >
        <div className="flex items-center gap-3 text-center justify-center">
          <AlertTriangle style={{ color: "var(--gw2-red)" }} />
          <span style={{ color: "var(--gw2-red)" }}>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`gw2-card overflow-hidden ${className}`}>
      {/* Quantity Selector */}
      <div
        className="p-4"
        style={{ borderBottom: "1px solid var(--gw2-border)" }}
      >
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Package
              className="w-5 h-5"
              style={{ color: "var(--gw2-text-muted)" }}
            />
            <label
              htmlFor="quantity-input"
              className="font-semibold"
              style={{
                fontFamily: "var(--font-display)",
                color: "var(--gw2-text-primary)",
              }}
            >
              Quantity:
            </label>
            <input
              id="quantity-input"
              type="number"
              value={inputValue}
              onChange={(e) => handleQuantityChange(e.target.value)}
              min={1}
              max={10000}
              className="w-24 px-3 py-1.5 rounded-lg text-center font-mono"
              style={{
                background: "var(--gw2-bg-light)",
                border: "1px solid var(--gw2-border)",
                color: "var(--gw2-text-primary)",
              }}
              aria-label="Quantity to analyze"
            />
          </div>

          {/* Preset buttons */}
          <div className="flex flex-wrap gap-1">
            {QUANTITY_PRESETS.map((preset) => (
              <button
                key={preset}
                onClick={() => handlePresetClick(preset)}
                className="px-3 py-1 rounded text-sm transition-all"
                style={{
                  background:
                    quantity === preset
                      ? "var(--gw2-gold)"
                      : "var(--gw2-bg-light)",
                  color:
                    quantity === preset
                      ? "var(--gw2-bg-dark)"
                      : "var(--gw2-text-secondary)",
                  border: "1px solid var(--gw2-border)",
                }}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="p-6 flex items-center justify-center">
          <div
            className="animate-spin rounded-full h-8 w-8"
            style={{
              border: "3px solid var(--gw2-border)",
              borderTop: "3px solid var(--gw2-gold)",
            }}
          />
        </div>
      )}

      {/* Analysis Results */}
      {!isLoading && analysis && (
        <>
          {/* Price Impact Warning */}
          {analysis.buyPriceImpact > 5 && (
            <div
              className="px-6 py-3 flex items-center gap-3"
              style={{
                background:
                  analysis.buyPriceImpact > 15
                    ? "rgba(196, 31, 59, 0.1)"
                    : "rgba(255, 204, 0, 0.1)",
                borderBottom: "1px solid var(--gw2-border)",
              }}
            >
              <TrendingUp className="w-5 h-5" style={{ color: priceImpactColor }} />
              <div>
                <span
                  className="font-semibold"
                  style={{ color: priceImpactColor }}
                >
                  +{analysis.buyPriceImpact.toFixed(1)}% Price Impact
                </span>
                <p
                  className="text-sm"
                  style={{ color: "var(--gw2-text-muted)" }}
                >
                  Buying {quantity} units increases the average price due to
                  order book depth
                </p>
              </div>
            </div>
          )}

          {/* Supply Warning */}
          {!analysis.canFillOrder && (
            <div
              className="px-6 py-3 flex items-center gap-3"
              style={{
                background: "rgba(196, 31, 59, 0.1)",
                borderBottom: "1px solid var(--gw2-border)",
              }}
            >
              <AlertTriangle
                className="w-5 h-5"
                style={{ color: "var(--gw2-red)" }}
              />
              <div>
                <span
                  className="font-semibold"
                  style={{ color: "var(--gw2-red)" }}
                >
                  Limited Supply
                </span>
                <p
                  className="text-sm"
                  style={{ color: "var(--gw2-text-muted)" }}
                >
                  Only {analysis.supplyAvailable.toLocaleString()} available,{" "}
                  {analysis.supplyShortfall.toLocaleString()} short
                </p>
              </div>
            </div>
          )}

          {/* Recommendation Banner */}
          <div
            className="px-6 py-4"
            style={{
              background:
                analysis.recommendation === "buy"
                  ? "linear-gradient(90deg, rgba(26, 147, 6, 0.15) 0%, transparent 100%)"
                  : "linear-gradient(90deg, rgba(196, 31, 59, 0.15) 0%, transparent 100%)",
              borderBottom: "1px solid var(--gw2-border)",
              borderLeft: `4px solid ${analysis.recommendation === "buy" ? "var(--gw2-success)" : "var(--gw2-red)"}`,
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="p-2 rounded-lg"
                  style={{
                    background:
                      analysis.recommendation === "buy"
                        ? "rgba(26, 147, 6, 0.2)"
                        : "rgba(196, 31, 59, 0.2)",
                  }}
                >
                  {analysis.recommendation === "buy" ? (
                    <ShoppingCart
                      className="w-6 h-6"
                      style={{ color: "var(--gw2-success)" }}
                    />
                  ) : (
                    <Hammer
                      className="w-6 h-6"
                      style={{ color: "var(--gw2-red-light)" }}
                    />
                  )}
                </div>
                <div>
                  <span
                    className="text-lg font-semibold"
                    style={{
                      fontFamily: "var(--font-display)",
                      color: "var(--gw2-text-primary)",
                    }}
                  >
                    For {quantity.toLocaleString()} items:{" "}
                    <span
                      className="uppercase font-bold"
                      style={{
                        color:
                          analysis.recommendation === "buy"
                            ? "var(--gw2-success)"
                            : "var(--gw2-red-light)",
                      }}
                    >
                      {!analysis.canCraft
                        ? "Buy (No Recipe)"
                        : analysis.recommendation}
                    </span>
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span
                  className="text-sm"
                  style={{ color: "var(--gw2-text-muted)" }}
                >
                  Total Savings
                </span>
                <div className="flex items-center gap-2">
                  <PriceDisplay copper={analysis.savings} size="lg" />
                  <span
                    className="font-semibold flex items-center gap-1"
                    style={{ color: "var(--gw2-success)" }}
                  >
                    {analysis.savingsPercent > 0 ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
                    {analysis.savingsPercent.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Cost Comparison */}
          <div
            className="grid grid-cols-2 gap-4 p-6"
            style={{ borderBottom: "1px solid var(--gw2-border)" }}
          >
            {/* Buy Side */}
            <div
              className="p-4 rounded-lg"
              style={{
                background:
                  analysis.recommendation === "buy"
                    ? "rgba(26, 147, 6, 0.1)"
                    : "var(--gw2-bg-light)",
                border:
                  analysis.recommendation === "buy"
                    ? "1px solid var(--gw2-success)"
                    : "1px solid var(--gw2-border)",
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <ShoppingCart
                  className="w-4 h-4"
                  style={{ color: "var(--gw2-text-muted)" }}
                />
                <span
                  className="font-semibold"
                  style={{ color: "var(--gw2-text-primary)" }}
                >
                  Buy from TP
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span
                    className="text-sm"
                    style={{ color: "var(--gw2-text-muted)" }}
                  >
                    Total Cost:
                  </span>
                  <PriceDisplay copper={analysis.totalBuyCost} size="lg" />
                </div>
                <div className="flex justify-between items-center">
                  <span
                    className="text-sm"
                    style={{ color: "var(--gw2-text-muted)" }}
                  >
                    Per Unit:
                  </span>
                  <PriceDisplay
                    copper={Math.round(analysis.averageBuyPrice)}
                    size="sm"
                  />
                </div>
                {analysis.buyPriceImpact > 0 && (
                  <div className="flex justify-between items-center">
                    <span
                      className="text-sm flex items-center gap-1"
                      style={{ color: "var(--gw2-text-muted)" }}
                    >
                      <Info className="w-3 h-3" />
                      Price Impact:
                    </span>
                    <span
                      className="text-sm font-semibold"
                      style={{ color: priceImpactColor }}
                    >
                      +{analysis.buyPriceImpact.toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Craft Side */}
            <div
              className="p-4 rounded-lg"
              style={{
                background:
                  analysis.recommendation === "craft" && analysis.canCraft
                    ? "rgba(196, 31, 59, 0.1)"
                    : "var(--gw2-bg-light)",
                border:
                  analysis.recommendation === "craft" && analysis.canCraft
                    ? "1px solid var(--gw2-red)"
                    : "1px solid var(--gw2-border)",
                opacity: analysis.canCraft ? 1 : 0.5,
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Hammer
                  className="w-4 h-4"
                  style={{ color: "var(--gw2-text-muted)" }}
                />
                <span
                  className="font-semibold"
                  style={{ color: "var(--gw2-text-primary)" }}
                >
                  Craft
                </span>
                {!analysis.canCraft && (
                  <span
                    className="text-xs px-2 py-0.5 rounded"
                    style={{
                      background: "var(--gw2-bg-dark)",
                      color: "var(--gw2-text-muted)",
                    }}
                  >
                    No Recipe
                  </span>
                )}
              </div>

              {analysis.canCraft ? (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span
                      className="text-sm"
                      style={{ color: "var(--gw2-text-muted)" }}
                    >
                      Total Cost:
                    </span>
                    <PriceDisplay copper={analysis.totalCraftCost} size="lg" />
                  </div>
                  <div className="flex justify-between items-center">
                    <span
                      className="text-sm"
                      style={{ color: "var(--gw2-text-muted)" }}
                    >
                      Per Unit:
                    </span>
                    <PriceDisplay
                      copper={Math.round(analysis.averageCraftCost)}
                      size="sm"
                    />
                  </div>
                </div>
              ) : (
                <span
                  className="text-sm italic"
                  style={{ color: "var(--gw2-text-muted)" }}
                >
                  This item cannot be crafted
                </span>
              )}
            </div>
          </div>

          {/* Material Breakdown */}
          {analysis.canCraft && analysis.materialBreakdown && (
            <div className="p-6">
              <h3
                className="text-lg font-semibold mb-4"
                style={{
                  fontFamily: "var(--font-display)",
                  color: "var(--gw2-text-primary)",
                }}
              >
                Materials for {quantity.toLocaleString()} units
              </h3>
              <div className="space-y-2">
                {analysis.materialBreakdown.map((material) => (
                  <div
                    key={material.item.id}
                    className="flex items-center gap-3 p-2 rounded-lg"
                    style={{ background: "var(--gw2-bg-light)" }}
                  >
                    {material.item.icon && (
                      <img
                        src={material.item.icon}
                        alt={material.item.name}
                        className="w-8 h-8 rounded"
                        style={{ border: "2px solid var(--gw2-border)" }}
                      />
                    )}
                    <span
                      className="font-mono font-semibold min-w-[4rem]"
                      style={{ color: "var(--gw2-gold)" }}
                    >
                      ×{material.quantity.toLocaleString()}
                    </span>
                    <span
                      className="flex-1"
                      style={{ color: "var(--gw2-text-primary)" }}
                    >
                      {material.item.name}
                    </span>
                    <span
                      className="px-2 py-0.5 text-xs rounded"
                      style={{
                        background:
                          material.decision === "buy"
                            ? "rgba(26, 147, 6, 0.2)"
                            : "rgba(196, 31, 59, 0.2)",
                        color:
                          material.decision === "buy"
                            ? "var(--gw2-success)"
                            : "var(--gw2-red-light)",
                      }}
                    >
                      {material.decision}
                    </span>
                    <div className="text-right min-w-[5rem]">
                      <PriceDisplay copper={material.totalCost} size="sm" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Empty State */}
      {!isLoading && !analysis && !error && (
        <div
          className="p-6 text-center"
          style={{ color: "var(--gw2-text-muted)" }}
        >
          Enter a quantity to see the analysis
        </div>
      )}
    </div>
  );
}

export default QuantityAnalysis;

