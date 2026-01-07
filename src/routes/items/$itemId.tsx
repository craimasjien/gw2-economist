/**
 * @fileoverview Item detail page with craft analysis.
 *
 * This module defines the item detail route ('/items/:itemId') which displays
 * the full craft analysis for a specific item, including buy vs craft recommendation,
 * material breakdown, and nested recipe analysis.
 *
 * @module routes/items/$itemId
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, AlertCircle, Loader2 } from "lucide-react";
import { CraftAnalysis } from "../../components/CraftAnalysis";
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
 * Rarity color mapping.
 */
const rarityColors: Record<string, string> = {
  Junk: "text-gray-400 border-gray-500",
  Basic: "text-gray-300 border-gray-400",
  Fine: "text-blue-400 border-blue-400",
  Masterwork: "text-green-400 border-green-400",
  Rare: "text-yellow-400 border-yellow-400",
  Exotic: "text-orange-400 border-orange-400",
  Ascended: "text-pink-400 border-pink-400",
  Legendary: "text-purple-400 border-purple-400",
};

/**
 * Item detail page component.
 */
function ItemDetailPage() {
  const { error, item, price, analysis } = Route.useLoaderData();

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="max-w-4xl mx-auto">
          <BackLink />
          <ErrorMessage message={error} />
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="max-w-4xl mx-auto">
          <BackLink />
          <ErrorMessage message="Item not found" />
        </div>
      </div>
    );
  }

  const rarityClass = rarityColors[item.rarity] || "text-gray-300 border-gray-500";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Header with Search */}
      <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-700">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
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
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6 mb-8">
            <div className="flex items-start gap-4">
              {item.icon && (
                <img
                  src={item.icon}
                  alt={item.name}
                  className={`w-20 h-20 rounded-lg border-2 ${rarityClass.split(" ")[1]}`}
                />
              )}
              <div className="flex-1">
                <h1 className={`text-3xl font-bold ${rarityClass.split(" ")[0]}`}>
                  {item.name}
                </h1>
                <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-400">
                  <span>{item.type}</span>
                  <span>•</span>
                  <span className={rarityClass.split(" ")[0]}>{item.rarity}</span>
                  {item.level > 0 && (
                    <>
                      <span>•</span>
                      <span>Level {item.level}</span>
                    </>
                  )}
                </div>
                {item.description && (
                  <p className="mt-3 text-gray-400">{item.description}</p>
                )}
              </div>
              {price && (
                <div className="text-right">
                  <div className="text-sm text-gray-400 mb-1">Trading Post</div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-xs text-gray-500">Buy:</span>
                      <PriceDisplay copper={price.sellPrice} />
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-xs text-gray-500">Sell:</span>
                      <PriceDisplay copper={price.buyPrice} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Not Craftable Notice */}
            <div className="mt-6 p-4 bg-slate-700/50 rounded-lg border border-slate-600">
              <div className="flex items-center gap-3 text-gray-400">
                <AlertCircle className="w-5 h-5 text-yellow-500" />
                <span>
                  This item cannot be crafted. It can only be obtained from the
                  Trading Post, drops, or other sources.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Craft Analysis */}
        {analysis && <CraftAnalysis analysis={analysis} />}
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
      className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6"
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
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mx-auto mb-4" />
        <p className="text-gray-400">Loading item data...</p>
      </div>
    </div>
  );
}

/**
 * Error state component.
 */
function ErrorState({ error }: { error: Error }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-6">
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
    <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-6">
      <div className="flex items-center gap-3">
        <AlertCircle className="w-6 h-6 text-red-400" />
        <div>
          <h2 className="text-xl font-semibold text-red-400">Error</h2>
          <p className="text-gray-400 mt-1">{message}</p>
        </div>
      </div>
      <Link
        to="/"
        className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Return to search
      </Link>
    </div>
  );
}
