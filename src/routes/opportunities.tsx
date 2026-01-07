/**
 * @fileoverview Opportunities page for discovering profitable crafting items.
 *
 * This module defines the /opportunities route which displays a dashboard
 * of profitable crafting opportunities. Users can filter by discipline,
 * minimum volume, and profit margin to find items worth crafting.
 *
 * @module routes/opportunities
 */

import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { TrendingUp, Filter, RefreshCw, Sparkles, Coins } from "lucide-react";
import { ProfitDashboard } from "../components/ProfitDashboard";
import { getProfitableItems, type SerializedProfitableItem } from "../../server/functions/craft-analysis";

/**
 * Opportunities route configuration.
 */
export const Route = createFileRoute("/opportunities")({
  component: OpportunitiesPage,
});

/**
 * Available crafting disciplines for filtering.
 */
const DISCIPLINES = [
  "Armorsmith",
  "Artificer",
  "Chef",
  "Huntsman",
  "Jeweler",
  "Leatherworker",
  "Scribe",
  "Tailor",
  "Weaponsmith",
];

/**
 * Opportunities page component showing profitable crafting items.
 *
 * Features:
 * - Sortable table of profitable items
 * - Filters for discipline, minimum volume, and margin
 * - Auto-refresh every 5 minutes
 * - Links to item detail pages
 *
 * @returns The opportunities page layout
 */
function OpportunitiesPage() {
  const [items, setItems] = useState<SerializedProfitableItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Filter state
  const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>([]);
  const [minVolume, setMinVolume] = useState(10);
  const [minMargin, setMinMargin] = useState(0.05);
  const [showFilters, setShowFilters] = useState(false);

  // Fetch profitable items
  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await getProfitableItems({
        data: {
          limit: 50,
          minDailyVolume: minVolume,
          minProfitMargin: minMargin,
          disciplines: selectedDisciplines.length > 0 ? selectedDisciplines : undefined,
        },
      });

      setItems(result);
      setLastUpdated(new Date());
    } catch (err) {
      setError("Failed to fetch profitable items. Please try again.");
      console.error("Error fetching profitable items:", err);
    } finally {
      setIsLoading(false);
    }
  }, [minVolume, minMargin, selectedDisciplines]);

  // Initial fetch and auto-refresh
  useEffect(() => {
    fetchItems();

    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchItems, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchItems]);

  // Toggle discipline selection
  const toggleDiscipline = (discipline: string) => {
    setSelectedDisciplines((prev) =>
      prev.includes(discipline)
        ? prev.filter((d) => d !== discipline)
        : [...prev, discipline]
    );
  };

  return (
    <div className="min-h-screen gw2-bg-pattern">
      {/* Header Section */}
      <section className="relative py-12 px-6">
        {/* Background glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse at 50% 0%, var(--gw2-red-glow) 0%, transparent 50%)",
          }}
        />

        <div className="relative max-w-6xl mx-auto">
          {/* Page Title */}
          <div className="flex items-center gap-4 mb-6">
            <div
              className="p-3 rounded-xl"
              style={{
                background: "linear-gradient(135deg, var(--gw2-gold) 0%, var(--gw2-gold-dark) 100%)",
                boxShadow: "var(--gw2-shadow-glow)",
              }}
            >
              <TrendingUp className="w-8 h-8" style={{ color: "var(--gw2-bg-darkest)" }} />
            </div>
            <div>
              <h1
                className="text-4xl font-bold"
                style={{ fontFamily: "var(--font-display)", color: "var(--gw2-text-primary)" }}
              >
                Profit Opportunities
              </h1>
              <p style={{ color: "var(--gw2-text-secondary)" }}>
                Find items that are profitable to craft and sell
              </p>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
                style={{
                  backgroundColor: showFilters ? "var(--gw2-gold)" : "var(--gw2-bg-lighter)",
                  color: showFilters ? "var(--gw2-bg-darkest)" : "var(--gw2-text-secondary)",
                }}
              >
                <Filter className="w-4 h-4" />
                Filters
                {selectedDisciplines.length > 0 && (
                  <span
                    className="px-2 py-0.5 text-xs rounded-full"
                    style={{
                      backgroundColor: "var(--gw2-red)",
                      color: "white",
                    }}
                  >
                    {selectedDisciplines.length}
                  </span>
                )}
              </button>

              <button
                onClick={fetchItems}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
                style={{
                  backgroundColor: "var(--gw2-bg-lighter)",
                  color: "var(--gw2-text-secondary)",
                }}
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>

            {lastUpdated && (
              <p className="text-sm" style={{ color: "var(--gw2-text-muted)" }}>
                Last updated: {lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div
              className="gw2-card p-6 mb-6"
              style={{ borderColor: "var(--gw2-gold)", borderWidth: "1px" }}
            >
              <div className="grid gap-6 md:grid-cols-3">
                {/* Discipline Filter */}
                <div>
                  <label
                    className="block text-sm font-semibold mb-2"
                    style={{ color: "var(--gw2-text-secondary)" }}
                  >
                    Crafting Disciplines
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {DISCIPLINES.map((discipline) => (
                      <button
                        key={discipline}
                        onClick={() => toggleDiscipline(discipline)}
                        className="px-3 py-1 text-sm rounded transition-colors"
                        style={{
                          backgroundColor: selectedDisciplines.includes(discipline)
                            ? "var(--gw2-gold)"
                            : "var(--gw2-bg-lighter)",
                          color: selectedDisciplines.includes(discipline)
                            ? "var(--gw2-bg-darkest)"
                            : "var(--gw2-text-secondary)",
                        }}
                      >
                        {discipline}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Min Volume Filter */}
                <div>
                  <label
                    className="block text-sm font-semibold mb-2"
                    style={{ color: "var(--gw2-text-secondary)" }}
                  >
                    Min Daily Volume: {minVolume}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="500"
                    step="10"
                    value={minVolume}
                    onChange={(e) => setMinVolume(Number(e.target.value))}
                    className="w-full accent-[var(--gw2-gold)]"
                  />
                  <div
                    className="flex justify-between text-xs mt-1"
                    style={{ color: "var(--gw2-text-muted)" }}
                  >
                    <span>0</span>
                    <span>500+</span>
                  </div>
                </div>

                {/* Min Margin Filter */}
                <div>
                  <label
                    className="block text-sm font-semibold mb-2"
                    style={{ color: "var(--gw2-text-secondary)" }}
                  >
                    Min Profit Margin: {(minMargin * 100).toFixed(0)}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="0.5"
                    step="0.01"
                    value={minMargin}
                    onChange={(e) => setMinMargin(Number(e.target.value))}
                    className="w-full accent-[var(--gw2-gold)]"
                  />
                  <div
                    className="flex justify-between text-xs mt-1"
                    style={{ color: "var(--gw2-text-muted)" }}
                  >
                    <span>0%</span>
                    <span>50%</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Info Banner */}
          <div
            className="flex items-start gap-3 p-4 rounded-lg mb-6"
            style={{
              backgroundColor: "var(--gw2-bg-lighter)",
              borderLeft: "4px solid var(--gw2-gold)",
            }}
          >
            <Coins className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "var(--gw2-gold)" }} />
            <div>
              <p className="font-semibold" style={{ color: "var(--gw2-text-primary)" }}>
                Profit Score Explained
              </p>
              <p className="text-sm" style={{ color: "var(--gw2-text-secondary)" }}>
                Items are ranked by{" "}
                <span style={{ color: "var(--gw2-gold)" }}>profit × √(daily volume)</span>.
                This balances profit margin with how quickly items sell.
                Higher scores indicate better opportunities overall.
              </p>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div
              className="p-4 rounded-lg mb-6"
              style={{
                backgroundColor: "var(--gw2-bg-lighter)",
                borderLeft: "4px solid var(--gw2-red)",
              }}
            >
              <p style={{ color: "var(--gw2-red)" }}>{error}</p>
            </div>
          )}

          {/* Results */}
          <ProfitDashboard items={items} isLoading={isLoading} />

          {/* Empty state hint */}
          {!isLoading && items.length === 0 && !error && (
            <div className="text-center py-8">
              <Sparkles className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--gw2-gold)" }} />
              <p style={{ color: "var(--gw2-text-secondary)" }}>
                No profitable opportunities found with current filters.
              </p>
              <p className="text-sm mt-2" style={{ color: "var(--gw2-text-muted)" }}>
                Try lowering the minimum volume or margin, or selecting different disciplines.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
