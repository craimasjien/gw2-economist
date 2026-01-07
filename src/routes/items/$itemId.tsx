/**
 * @fileoverview Item detail page with craft analysis.
 *
 * This module defines the item detail route ('/items/:itemId') which displays
 * the full craft analysis for a specific item, including buy vs craft recommendation,
 * material breakdown, and nested recipe analysis. Styled with GW2 theme.
 *
 * @module routes/items/$itemId
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, AlertCircle, Loader2, Hammer, Package } from "lucide-react";
import { CraftAnalysis } from "../../components/CraftAnalysis";
import { QuantityAnalysis } from "../../components/QuantityAnalysis";
import { ItemSearch } from "../../components/ItemSearch";
import {
  analyzeCraftCost,
  getItemWithPrice,
} from "../../../server/functions/craft-analysis";
import { PriceDisplay } from "../../components/PriceDisplay";

/**
 * Route configuration with loader for item data.
 */
export const Route = createFileRoute("/items/$itemId")({
  component: ItemDetailPage,
  loader: async ({ params }) => {
    const itemId = parseInt(params.itemId, 10);

    if (isNaN(itemId)) {
      return { error: "Invalid item ID", item: null, analysis: null };
    }

    try {
      // Fetch item and analysis in parallel
      const [itemData, analysis] = await Promise.all([
        getItemWithPrice({ data: { itemId } }),
        analyzeCraftCost({ data: { itemId } }),
      ]);

      if (!itemData) {
        return { error: "Item not found", item: null, analysis: null };
      }

      return {
        error: null,
        item: itemData.item,
        price: itemData.price,
        analysis,
      };
    } catch (error) {
      console.error("Failed to load item:", error);
      return {
        error: "Failed to load item data",
        item: null,
        analysis: null,
      };
    }
  },
  pendingComponent: LoadingState,
  errorComponent: ErrorState,
});

/**
 * Rarity color mapping using GW2 official colors.
 */
const rarityColors: Record<string, { text: string; border: string }> = {
  Junk: { text: "var(--rarity-junk)", border: "var(--rarity-junk)" },
  Basic: { text: "var(--rarity-basic)", border: "var(--rarity-basic)" },
  Fine: { text: "var(--rarity-fine)", border: "var(--rarity-fine)" },
  Masterwork: { text: "var(--rarity-masterwork)", border: "var(--rarity-masterwork)" },
  Rare: { text: "var(--rarity-rare)", border: "var(--rarity-rare)" },
  Exotic: { text: "var(--rarity-exotic)", border: "var(--rarity-exotic)" },
  Ascended: { text: "var(--rarity-ascended)", border: "var(--rarity-ascended)" },
  Legendary: { text: "var(--rarity-legendary)", border: "var(--rarity-legendary)" },
};

/**
 * Item detail page component.
 */
function ItemDetailPage() {
  const { error, item, price, analysis } = Route.useLoaderData();

  if (error) {
    return (
      <div className="min-h-screen gw2-bg-pattern p-6">
        <div className="max-w-4xl mx-auto">
          <BackLink />
          <ErrorMessage message={error} />
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen gw2-bg-pattern p-6">
        <div className="max-w-4xl mx-auto">
          <BackLink />
          <ErrorMessage message="Item not found" />
        </div>
      </div>
    );
  }

  const rarity = rarityColors[item.rarity] || { text: "var(--gw2-text-secondary)", border: "var(--gw2-border)" };

  return (
    <div className="min-h-screen gw2-bg-pattern">
      {/* Header with Search */}
      <header
        className="sticky top-0 z-50 backdrop-blur-md"
        style={{
          background: 'rgba(10, 9, 8, 0.9)',
          borderBottom: '1px solid var(--gw2-border)',
        }}
      >
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200"
              style={{ color: 'var(--gw2-text-secondary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--gw2-gold)';
                e.currentTarget.style.background = 'var(--gw2-bg-light)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--gw2-text-secondary)';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Back</span>
            </Link>
            <ItemSearch placeholder="Search another item..." className="flex-1 max-w-xl" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Item Header (for non-craftable items or additional info) */}
        {!analysis && (
          <div
            className="gw2-card p-6 mb-8"
          >
            <div className="flex items-start gap-4">
              {item.icon && (
                <img
                  src={item.icon}
                  alt={item.name}
                  className="w-20 h-20 rounded-lg"
                  style={{
                    border: `2px solid ${rarity.border}`,
                    boxShadow: `0 0 12px ${rarity.border}40`,
                  }}
                />
              )}
              <div className="flex-1">
                <h1
                  className="text-3xl font-bold"
                  style={{
                    fontFamily: 'var(--font-display)',
                    color: rarity.text,
                  }}
                >
                  {item.name}
                </h1>
                <div className="flex flex-wrap gap-3 mt-2 text-sm" style={{ color: 'var(--gw2-text-muted)' }}>
                  <span>{item.type}</span>
                  <span>•</span>
                  <span style={{ color: rarity.text }}>{item.rarity}</span>
                  {item.level > 0 && (
                    <>
                      <span>•</span>
                      <span>Level {item.level}</span>
                    </>
                  )}
                </div>
                {item.description && (
                  <p className="mt-3" style={{ color: 'var(--gw2-text-secondary)' }}>{item.description}</p>
                )}
              </div>
              {price && (
                <div className="text-right">
                  <div className="text-sm mb-1" style={{ color: 'var(--gw2-text-muted)' }}>Trading Post</div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-xs" style={{ color: 'var(--gw2-text-muted)' }}>Buy:</span>
                      <PriceDisplay copper={price.sellPrice} />
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-xs" style={{ color: 'var(--gw2-text-muted)' }}>Sell:</span>
                      <PriceDisplay copper={price.buyPrice} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Not Craftable Notice */}
            <div
              className="mt-6 p-4 rounded-lg"
              style={{
                background: 'var(--gw2-bg-light)',
                border: '1px solid var(--gw2-border)',
              }}
            >
              <div className="flex items-center gap-3" style={{ color: 'var(--gw2-text-secondary)' }}>
                <AlertCircle className="w-5 h-5" style={{ color: 'var(--gw2-warning)' }} />
                <span>
                  This item cannot be crafted. It can only be obtained from the
                  Trading Post, drops, or other sources.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Craft Analysis (Single Item) */}
        {analysis && <CraftAnalysis analysis={analysis} className="mb-8" />}

        {/* Quantity Analysis (Bulk Purchase) */}
        <div className="mt-8">
          <div className="flex items-center gap-3 mb-4">
            <Package className="w-6 h-6" style={{ color: 'var(--gw2-gold)' }} />
            <h2
              className="text-2xl font-bold"
              style={{
                fontFamily: 'var(--font-display)',
                color: 'var(--gw2-text-primary)',
              }}
            >
              Bulk Analysis
            </h2>
          </div>
          <p className="mb-4" style={{ color: 'var(--gw2-text-muted)' }}>
            Buying in bulk? The trading post has limited supply at each price point.
            Use this calculator to see the real cost when buying multiple items.
          </p>
          <QuantityAnalysis itemId={item.id} initialQuantity={1} />
        </div>
      </main>
    </div>
  );
}

/**
 * Back link component.
 */
function BackLink() {
  return (
    <Link
      to="/"
      className="inline-flex items-center gap-2 mb-6 transition-all duration-200"
      style={{ color: 'var(--gw2-text-secondary)' }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = 'var(--gw2-gold)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = 'var(--gw2-text-secondary)';
      }}
    >
      <ArrowLeft className="w-5 h-5" />
      Back to search
    </Link>
  );
}

/**
 * Loading state component.
 */
function LoadingState() {
  return (
    <div className="min-h-screen gw2-bg-pattern flex items-center justify-center">
      <div className="text-center">
        <div
          className="inline-block p-4 rounded-xl mb-4 animate-gw2-glow"
          style={{
            background: 'var(--gw2-bg-card)',
            border: '1px solid var(--gw2-border)',
          }}
        >
          <Hammer className="w-12 h-12 animate-pulse" style={{ color: 'var(--gw2-gold)' }} />
        </div>
        <p style={{ color: 'var(--gw2-text-secondary)' }}>Analyzing craft costs...</p>
      </div>
    </div>
  );
}

/**
 * Error state component.
 */
function ErrorState({ error }: { error: Error }) {
  return (
    <div className="min-h-screen gw2-bg-pattern p-6">
      <div className="max-w-4xl mx-auto">
        <BackLink />
        <ErrorMessage message={error.message} />
      </div>
    </div>
  );
}

/**
 * Error message component.
 */
function ErrorMessage({ message }: { message: string }) {
  return (
    <div
      className="rounded-xl p-6"
      style={{
        background: 'rgba(196, 31, 59, 0.1)',
        border: '1px solid var(--gw2-red)',
      }}
    >
      <div className="flex items-center gap-3">
        <AlertCircle className="w-6 h-6" style={{ color: 'var(--gw2-red)' }} />
        <div>
          <h2
            className="text-xl font-semibold"
            style={{
              fontFamily: 'var(--font-display)',
              color: 'var(--gw2-red)',
            }}
          >
            Error
          </h2>
          <p className="mt-1" style={{ color: 'var(--gw2-text-secondary)' }}>{message}</p>
        </div>
      </div>
      <Link
        to="/"
        className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-lg transition-all duration-200"
        style={{
          background: 'var(--gw2-bg-light)',
          color: 'var(--gw2-text-primary)',
          border: '1px solid var(--gw2-border)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--gw2-gold)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--gw2-border)';
        }}
      >
        <ArrowLeft className="w-4 h-4" />
        Return to search
      </Link>
    </div>
  );
}
