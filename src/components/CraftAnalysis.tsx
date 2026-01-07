/**
 * @fileoverview Component for displaying craft analysis results.
 *
 * Shows buy vs craft recommendation with visual highlighting, price comparison,
 * savings calculation, and material breakdown tree. Supports nested materials
 * for recursive recipe analysis.
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
 * Rarity color mapping for item borders and text.
 */
const rarityColors: Record<string, string> = {
  Junk: "border-gray-500 text-gray-400",
  Basic: "border-gray-400 text-gray-300",
  Fine: "border-blue-400 text-blue-400",
  Masterwork: "border-green-400 text-green-400",
  Rare: "border-yellow-400 text-yellow-400",
  Exotic: "border-orange-400 text-orange-400",
  Ascended: "border-pink-400 text-pink-400",
  Legendary: "border-purple-400 text-purple-400",
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

  return (
    <div
      className={`bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden ${className}`}
    >
      {/* Item Header */}
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-start gap-4">
          {analysis.item.icon && (
            <img
              src={analysis.item.icon}
              alt={analysis.item.name}
              className={`w-16 h-16 rounded-lg border-2 ${
                rarityColors[analysis.item.rarity] || "border-gray-500"
              }`}
            />
          )}
          <div className="flex-1">
            <h2
              className={`text-2xl font-bold ${
                rarityColors[analysis.item.rarity]?.split(" ")[1] || "text-white"
              }`}
            >
              {analysis.item.name}
            </h2>
            <div className="flex flex-wrap gap-2 mt-2">
              {analysis.recipe.disciplines.map((disc) => (
                <span
                  key={disc}
                  className="px-2 py-0.5 bg-slate-700 rounded text-xs text-gray-300"
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
        className={`px-6 py-4 ${
          isBuy
            ? "bg-emerald-600/20 border-b border-emerald-500/30"
            : "bg-indigo-600/20 border-b border-indigo-500/30"
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <span className="text-lg font-semibold text-white">
              Recommendation:{" "}
              <span
                className={`uppercase font-bold ${
                  isBuy ? "text-emerald-400" : "text-indigo-400"
                }`}
              >
                {hasNoBuyOption ? "Craft (Not Tradeable)" : analysis.recommendation}
              </span>
            </span>
            {hasNoBuyOption && (
              <p className="text-sm text-gray-400 mt-1">
                This item is not tradeable or account bound - craft only
              </p>
            )}
          </div>
          <div data-testid="savings" className="text-right">
            <span className="text-sm text-gray-400">You save</span>
            <div className="flex items-center gap-2">
              <PriceDisplay copper={analysis.savings} size="lg" />
              <span className="text-emerald-400 font-semibold">
                ({analysis.savingsPercent.toFixed(1)}%)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Price Comparison */}
      <div className="grid grid-cols-2 gap-4 p-6 border-b border-slate-700">
        <div
          data-testid="buy-price"
          className={`p-4 rounded-lg ${
            isBuy
              ? "bg-emerald-600/10 border border-emerald-500/30"
              : "bg-slate-700/50"
          }`}
        >
          <div className="text-sm text-gray-400 mb-1">Buy Price</div>
          {analysis.buyPrice > 0 ? (
            <PriceDisplay copper={analysis.buyPrice} size="lg" />
          ) : (
            <span className="text-gray-500 italic">Not available</span>
          )}
        </div>

        <div
          data-testid="craft-cost"
          className={`p-4 rounded-lg ${
            !isBuy
              ? "bg-indigo-600/10 border border-indigo-500/30"
              : "bg-slate-700/50"
          }`}
        >
          <div className="text-sm text-gray-400 mb-1">Craft Cost</div>
          <PriceDisplay copper={Math.round(analysis.craftCost)} size="lg" />
        </div>
      </div>

      {/* Materials Section */}
      <div className="p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          Materials Required
        </h3>
        <div className="space-y-2">
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

  return (
    <>
      <div
        className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-700/50 transition-colors"
        style={{ marginLeft: indent }}
      >
        {/* Item Icon */}
        {material.item.icon ? (
          <img
            src={material.item.icon}
            alt={material.item.name}
            className={`w-8 h-8 rounded border ${
              rarityColors[material.item.rarity]?.split(" ")[0] || "border-gray-500"
            }`}
          />
        ) : (
          <div className="w-8 h-8 rounded bg-slate-600 flex items-center justify-center">
            <span className="text-xs text-gray-400">?</span>
          </div>
        )}

        {/* Quantity */}
        <span className="text-cyan-400 font-mono font-semibold min-w-[3rem]">
          ×{material.quantity}
        </span>

        {/* Name */}
        <span
          className={`flex-1 ${
            rarityColors[material.item.rarity]?.split(" ")[1] || "text-gray-300"
          }`}
        >
          {material.item.name}
        </span>

        {/* Crafted/Bought Indicator */}
        {isCrafted ? (
          <span
            data-testid="material-crafted-indicator"
            className="px-2 py-0.5 bg-indigo-600/20 text-indigo-400 text-xs rounded"
          >
            Crafted
          </span>
        ) : material.canCraft ? (
          <span className="px-2 py-0.5 bg-emerald-600/20 text-emerald-400 text-xs rounded">
            Bought (cheaper)
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

