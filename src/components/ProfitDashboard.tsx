/**
 * @fileoverview Component for displaying profitable crafting opportunities.
 *
 * Shows a sortable table of items with positive profit margins,
 * including craft cost, sell price, profit, margin, and daily volume.
 * Supports sorting by different columns and links to item detail pages.
 *
 * @module components/ProfitDashboard
 *
 * @example
 * ```tsx
 * import { ProfitDashboard } from './ProfitDashboard';
 *
 * <ProfitDashboard items={profitableItems} isLoading={false} />
 * ```
 */

import { useState, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { PriceDisplay } from "./PriceDisplay";
import type { SerializedProfitableItem } from "../../server/functions/craft-analysis";
import { Loader2, TrendingUp, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

/**
 * Props for the ProfitDashboard component.
 */
export interface ProfitDashboardProps {
  /**
   * Array of profitable items to display.
   */
  items: SerializedProfitableItem[];

  /**
   * Whether data is currently loading.
   */
  isLoading: boolean;

  /**
   * Additional CSS classes.
   */
  className?: string;
}

/**
 * Sort configuration.
 */
type SortColumn = "profitScore" | "profit" | "profitMargin" | "dailyVolume" | "craftCost" | "sellPrice";
type SortDirection = "asc" | "desc";

/**
 * Rarity color mapping using GW2 official colors.
 */
const rarityColors: Record<string, string> = {
  Junk: "var(--rarity-junk)",
  Basic: "var(--rarity-basic)",
  Fine: "var(--rarity-fine)",
  Masterwork: "var(--rarity-masterwork)",
  Rare: "var(--rarity-rare)",
  Exotic: "var(--rarity-exotic)",
  Ascended: "var(--rarity-ascended)",
  Legendary: "var(--rarity-legendary)",
};

/**
 * Displays profitable crafting opportunities in a sortable table.
 *
 * @param props - Component props
 * @returns Profit dashboard display
 */
export function ProfitDashboard({ items, isLoading, className = "" }: ProfitDashboardProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>("profitScore");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Sort items based on current sort configuration
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const aValue = a[sortColumn];
      const bValue = b[sortColumn];
      const multiplier = sortDirection === "desc" ? -1 : 1;
      return (aValue - bValue) * multiplier;
    });
  }, [items, sortColumn, sortDirection]);

  // Handle column header click for sorting
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "desc" ? "asc" : "desc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  // Render sort indicator
  const SortIndicator = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="w-4 h-4 opacity-30" />;
    }
    return sortDirection === "desc" ? (
      <ArrowDown className="w-4 h-4" />
    ) : (
      <ArrowUp className="w-4 h-4" />
    );
  };

  // Column header component
  const ColumnHeader = ({
    column,
    children,
  }: {
    column: SortColumn;
    children: React.ReactNode;
  }) => (
    <th
      role="columnheader"
      className="px-4 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-[var(--gw2-bg-lighter)] transition-colors"
      onClick={() => handleSort(column)}
      style={{ color: "var(--gw2-text-secondary)" }}
    >
      <div className="flex items-center gap-2">
        {children}
        <SortIndicator column={column} />
      </div>
    </th>
  );

  if (isLoading) {
    return (
      <div
        data-testid="loading-indicator"
        className={`gw2-card p-8 flex items-center justify-center ${className}`}
      >
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--gw2-gold)" }} />
        <span className="ml-3" style={{ color: "var(--gw2-text-secondary)" }}>
          Finding profitable opportunities...
        </span>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className={`gw2-card p-8 text-center ${className}`}>
        <TrendingUp className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--gw2-text-muted)" }} />
        <p style={{ color: "var(--gw2-text-secondary)" }}>
          No profitable items found matching your criteria.
        </p>
      </div>
    );
  }

  return (
    <div className={`gw2-card overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead style={{ backgroundColor: "var(--gw2-bg-lighter)" }}>
            <tr>
              <th
                className="px-4 py-3 text-left text-sm font-semibold"
                style={{ color: "var(--gw2-text-secondary)" }}
              >
                Item
              </th>
              <ColumnHeader column="craftCost">Craft Cost</ColumnHeader>
              <ColumnHeader column="sellPrice">Sell Price</ColumnHeader>
              <ColumnHeader column="profit">Profit</ColumnHeader>
              <ColumnHeader column="profitMargin">Margin</ColumnHeader>
              <ColumnHeader column="dailyVolume">Volume</ColumnHeader>
              <ColumnHeader column="profitScore">Score</ColumnHeader>
            </tr>
          </thead>
          <tbody>
            {sortedItems.map((item, index) => {
              const rarityColor = rarityColors[item.item.rarity] || "var(--gw2-text-secondary)";
              
              return (
                <tr
                  key={item.item.id}
                  className="border-t hover:bg-[var(--gw2-bg-lighter)] transition-colors"
                  style={{ borderColor: "var(--gw2-border)" }}
                >
                  {/* Item Name & Info */}
                  <td className="px-4 py-3">
                    <Link
                      to="/items/$itemId"
                      params={{ itemId: String(item.item.id) }}
                      className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                      data-testid="router-link"
                    >
                      {item.item.icon && (
                        <img
                          src={item.item.icon}
                          alt=""
                          className="w-8 h-8 rounded"
                          style={{ border: `1px solid ${rarityColor}` }}
                        />
                      )}
                      <div>
                        <div
                          className="font-medium"
                          style={{ color: rarityColor }}
                        >
                          {item.item.name}
                        </div>
                        <div
                          className="text-xs"
                          style={{ color: "var(--gw2-text-muted)" }}
                        >
                          {item.recipe.disciplines.slice(0, 2).join(", ")}
                          {item.recipe.disciplines.length > 2 && "..."}
                        </div>
                      </div>
                    </Link>
                  </td>

                  {/* Craft Cost */}
                  <td className="px-4 py-3" data-testid={`craft-cost-${index}`}>
                    <PriceDisplay copper={item.craftCost} size="sm" />
                  </td>

                  {/* Sell Price */}
                  <td className="px-4 py-3" data-testid={`sell-price-${index}`}>
                    <PriceDisplay copper={item.sellPrice} size="sm" />
                  </td>

                  {/* Profit */}
                  <td className="px-4 py-3">
                    <span style={{ color: item.profit > 0 ? "var(--gw2-green)" : "var(--gw2-red)" }}>
                      <PriceDisplay copper={item.profit} size="sm" showSign />
                    </span>
                  </td>

                  {/* Margin */}
                  <td className="px-4 py-3">
                    <span
                      className="font-medium"
                      style={{
                        color: item.profitMargin > 0.2 ? "var(--gw2-green)" : "var(--gw2-text-secondary)",
                      }}
                    >
                      {(item.profitMargin * 100).toFixed(1)}%
                    </span>
                  </td>

                  {/* Volume */}
                  <td className="px-4 py-3" style={{ color: "var(--gw2-text-secondary)" }}>
                    {item.dailyVolume.toLocaleString()}/day
                  </td>

                  {/* Score */}
                  <td className="px-4 py-3">
                    <span
                      className="px-2 py-1 rounded text-sm font-medium"
                      style={{
                        backgroundColor: "var(--gw2-bg-lighter)",
                        color: "var(--gw2-gold)",
                      }}
                    >
                      {Math.round(item.profitScore).toLocaleString()}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

