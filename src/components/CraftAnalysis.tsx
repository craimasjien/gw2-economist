/**
 * @fileoverview Component for displaying craft analysis results.
 *
 * Shows buy vs craft recommendation with visual highlighting, price comparison,
 * savings calculation, and material breakdown tree. Supports nested materials
 * for recursive recipe analysis. Styled with GW2 theme.
 *
 * @module components/CraftAnalysis
 *
 * @example
 * ```tsx
 * import { CraftAnalysis } from './CraftAnalysis';
 *
 * <CraftAnalysis analysis={craftAnalysisResult} />
 * ```
 */

import { PriceDisplay } from "./PriceDisplay";
import type {
  SerializedCraftAnalysis,
  SerializedMaterialBreakdown,
} from "../../server/functions/craft-analysis";
import { ShoppingCart, Hammer, TrendingUp, ChevronRight } from "lucide-react";

/**
 * Props for the CraftAnalysis component.
 */
export interface CraftAnalysisProps {
  /**
   * The craft analysis result to display.
   */
  analysis: SerializedCraftAnalysis;

  /**
   * Additional CSS classes.
   */
  className?: string;
}

/**
 * Rarity color mapping using GW2 official colors.
 */
const rarityColors: Record<string, { border: string; text: string }> = {
  Junk: { border: "var(--rarity-junk)", text: "var(--rarity-junk)" },
  Basic: { border: "var(--rarity-basic)", text: "var(--rarity-basic)" },
  Fine: { border: "var(--rarity-fine)", text: "var(--rarity-fine)" },
  Masterwork: { border: "var(--rarity-masterwork)", text: "var(--rarity-masterwork)" },
  Rare: { border: "var(--rarity-rare)", text: "var(--rarity-rare)" },
  Exotic: { border: "var(--rarity-exotic)", text: "var(--rarity-exotic)" },
  Ascended: { border: "var(--rarity-ascended)", text: "var(--rarity-ascended)" },
  Legendary: { border: "var(--rarity-legendary)", text: "var(--rarity-legendary)" },
};

/**
 * Displays a complete craft analysis with recommendation.
 *
 * @param props - Component props
 * @returns Craft analysis display
 */
export function CraftAnalysis({ analysis, className = "" }: CraftAnalysisProps) {
  const isBuy = analysis.recommendation === "buy";
  const hasNoBuyOption = analysis.buyPrice === 0;
  const rarity = rarityColors[analysis.item.rarity] || { border: "var(--gw2-border)", text: "var(--gw2-text-secondary)" };

  return (
    <div
      className={`gw2-card overflow-hidden ${className}`}
    >
      {/* Item Header */}
      <div
        className="p-6"
        style={{ borderBottom: '1px solid var(--gw2-border)' }}
      >
        <div className="flex items-start gap-4">
          {analysis.item.icon && (
            <img
              src={analysis.item.icon}
              alt={analysis.item.name}
              className="w-16 h-16 rounded-lg"
              style={{
                border: `2px solid ${rarity.border}`,
                boxShadow: `0 0 12px ${rarity.border}40`,
              }}
            />
          )}
          <div className="flex-1">
            <h2
              className="text-2xl font-bold"
              style={{
                fontFamily: 'var(--font-display)',
                color: rarity.text,
              }}
            >
              {analysis.item.name}
            </h2>
            <div className="flex flex-wrap gap-2 mt-2">
              {analysis.recipe.disciplines.map((disc) => (
                <span
                  key={disc}
                  className="px-2 py-0.5 rounded text-xs"
                  style={{
                    background: 'var(--gw2-bg-light)',
                    color: 'var(--gw2-text-secondary)',
                    border: '1px solid var(--gw2-border)',
                  }}
                >
                  {disc}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recommendation Banner */}
      <div
        data-testid="recommendation"
        className="px-6 py-4"
        style={{
          background: isBuy
            ? 'linear-gradient(90deg, rgba(26, 147, 6, 0.15) 0%, transparent 100%)'
            : 'linear-gradient(90deg, rgba(196, 31, 59, 0.15) 0%, transparent 100%)',
          borderBottom: '1px solid var(--gw2-border)',
          borderLeft: `4px solid ${isBuy ? 'var(--gw2-success)' : 'var(--gw2-red)'}`,
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="p-2 rounded-lg"
              style={{
                background: isBuy ? 'rgba(26, 147, 6, 0.2)' : 'rgba(196, 31, 59, 0.2)',
              }}
            >
              {isBuy ? (
                <ShoppingCart className="w-6 h-6" style={{ color: 'var(--gw2-success)' }} />
              ) : (
                <Hammer className="w-6 h-6" style={{ color: 'var(--gw2-red-light)' }} />
              )}
            </div>
            <div>
              <span
                className="text-lg font-semibold"
                style={{
                  fontFamily: 'var(--font-display)',
                  color: 'var(--gw2-text-primary)',
                }}
              >
                Recommendation:{" "}
                <span
                  className="uppercase font-bold"
                  style={{ color: isBuy ? 'var(--gw2-success)' : 'var(--gw2-red-light)' }}
                >
                  {hasNoBuyOption ? "Craft (Not Tradeable)" : analysis.recommendation}
                </span>
              </span>
              {hasNoBuyOption && (
                <p className="text-sm mt-1" style={{ color: 'var(--gw2-text-muted)' }}>
                  This item is not tradeable or account bound - craft only
                </p>
              )}
            </div>
          </div>
          <div data-testid="savings" className="text-right">
            <span className="text-sm" style={{ color: 'var(--gw2-text-muted)' }}>You save</span>
            <div className="flex items-center gap-2">
              <PriceDisplay copper={analysis.savings} size="lg" />
              <span
                className="font-semibold flex items-center gap-1"
                style={{ color: 'var(--gw2-success)' }}
              >
                <TrendingUp className="w-4 h-4" />
                {analysis.savingsPercent.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Price Comparison */}
      <div
        className="grid grid-cols-2 gap-4 p-6"
        style={{ borderBottom: '1px solid var(--gw2-border)' }}
      >
        <div
          data-testid="buy-price"
          className="p-4 rounded-lg transition-all duration-200"
          style={{
            background: isBuy ? 'rgba(26, 147, 6, 0.1)' : 'var(--gw2-bg-light)',
            border: isBuy ? '1px solid var(--gw2-success)' : '1px solid var(--gw2-border)',
            boxShadow: isBuy ? '0 0 15px rgba(26, 147, 6, 0.2)' : 'none',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <ShoppingCart className="w-4 h-4" style={{ color: 'var(--gw2-text-muted)' }} />
            <span className="text-sm" style={{ color: 'var(--gw2-text-muted)' }}>Buy Price</span>
          </div>
          {analysis.buyPrice > 0 ? (
            <PriceDisplay copper={analysis.buyPrice} size="lg" />
          ) : (
            <span className="italic" style={{ color: 'var(--gw2-text-muted)' }}>Not available</span>
          )}
        </div>

        <div
          data-testid="craft-cost"
          className="p-4 rounded-lg transition-all duration-200"
          style={{
            background: !isBuy ? 'rgba(196, 31, 59, 0.1)' : 'var(--gw2-bg-light)',
            border: !isBuy ? '1px solid var(--gw2-red)' : '1px solid var(--gw2-border)',
            boxShadow: !isBuy ? '0 0 15px var(--gw2-red-glow)' : 'none',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Hammer className="w-4 h-4" style={{ color: 'var(--gw2-text-muted)' }} />
            <span className="text-sm" style={{ color: 'var(--gw2-text-muted)' }}>Craft Cost</span>
          </div>
          <PriceDisplay copper={Math.round(analysis.craftCost)} size="lg" />
        </div>
      </div>

      {/* Materials Section */}
      <div className="p-6">
        <h3
          className="text-lg font-semibold mb-4"
          style={{
            fontFamily: 'var(--font-display)',
            color: 'var(--gw2-text-primary)',
          }}
        >
          Materials Required
        </h3>
        <div className="space-y-1">
          {analysis.materials.map((material) => (
            <MaterialRow key={material.item.id} material={material} depth={0} />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Props for MaterialRow component.
 */
interface MaterialRowProps {
  material: SerializedMaterialBreakdown;
  depth: number;
}

/**
 * Displays a single material row with optional nested materials.
 */
function MaterialRow({ material, depth }: MaterialRowProps) {
  const indent = depth * 24;
  const isCrafted = !material.usedBuyPrice && material.craftAnalysis;
  const rarity = rarityColors[material.item.rarity] || { border: "var(--gw2-border)", text: "var(--gw2-text-secondary)" };

  return (
    <>
      <div
        className="flex items-center gap-3 p-2 rounded-lg transition-all duration-150"
        style={{
          marginLeft: indent,
          background: depth > 0 ? 'var(--gw2-bg-light)' : 'transparent',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--gw2-bg-card-hover)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = depth > 0 ? 'var(--gw2-bg-light)' : 'transparent';
        }}
      >
        {/* Depth indicator */}
        {depth > 0 && (
          <ChevronRight className="w-4 h-4" style={{ color: 'var(--gw2-text-muted)' }} />
        )}

        {/* Item Icon */}
        {material.item.icon ? (
          <img
            src={material.item.icon}
            alt={material.item.name}
            className="w-8 h-8 rounded"
            style={{
              border: `2px solid ${rarity.border}`,
            }}
          />
        ) : (
          <div
            className="w-8 h-8 rounded flex items-center justify-center"
            style={{
              background: 'var(--gw2-bg-dark)',
              border: '2px solid var(--gw2-border)',
            }}
          >
            <span className="text-xs" style={{ color: 'var(--gw2-text-muted)' }}>?</span>
          </div>
        )}

        {/* Quantity */}
        <span
          className="font-mono font-semibold min-w-[3rem]"
          style={{ color: 'var(--gw2-gold)' }}
        >
          ×{material.quantity}
        </span>

        {/* Name */}
        <span
          className="flex-1"
          style={{ color: rarity.text }}
        >
          {material.item.name}
        </span>

        {/* Crafted/Bought Indicator */}
        {isCrafted ? (
          <span
            data-testid="material-crafted-indicator"
            className="px-2 py-0.5 text-xs rounded flex items-center gap-1"
            style={{
              background: 'rgba(196, 31, 59, 0.2)',
              color: 'var(--gw2-red-light)',
              border: '1px solid var(--gw2-red)',
            }}
          >
            <Hammer className="w-3 h-3" />
            Crafted
          </span>
        ) : material.canCraft ? (
          <span
            className="px-2 py-0.5 text-xs rounded flex items-center gap-1"
            style={{
              background: 'rgba(26, 147, 6, 0.2)',
              color: 'var(--gw2-success)',
              border: '1px solid var(--gw2-success)',
            }}
          >
            <ShoppingCart className="w-3 h-3" />
            Bought
          </span>
        ) : null}

        {/* Unit Price */}
        <div className="text-right min-w-[4rem]">
          <PriceDisplay copper={material.unitPrice} size="sm" />
        </div>

        {/* Total Price */}
        <div className="text-right min-w-[5rem]">
          <PriceDisplay copper={material.totalPrice} size="sm" />
        </div>
      </div>

      {/* Nested Materials (if crafted) */}
      {isCrafted &&
        material.craftAnalysis?.materials.map((nested) => (
          <MaterialRow
            key={`${material.item.id}-${nested.item.id}`}
            material={nested}
            depth={depth + 1}
          />
        ))}
    </>
  );
}

export default CraftAnalysis;
