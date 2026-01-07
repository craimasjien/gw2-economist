/**
 * @fileoverview Autocomplete search component for GW2 items.
 *
 * Provides a search input with dropdown results that queries items
 * from the database using server functions. Supports keyboard navigation
 * and displays item icons, names, and prices.
 *
 * @module components/ItemSearch
 *
 * @example
 * ```tsx
 * import { ItemSearch } from './ItemSearch';
 *
 * <ItemSearch onSelect={(item) => navigate(`/items/${item.id}`)} />
 * ```
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, Loader2, Hammer } from "lucide-react";
import { PriceDisplay } from "./PriceDisplay";
import { searchItems, type ItemSearchResult } from "../../server/functions/craft-analysis";

/**
 * Props for the ItemSearch component.
 */
export interface ItemSearchProps {
  /**
   * Callback when an item is selected.
   */
  onSelect?: (item: ItemSearchResult) => void;

  /**
   * Placeholder text for the search input.
   * @default "Search items..."
   */
  placeholder?: string;

  /**
   * Whether to auto-focus the input on mount.
   * @default false
   */
  autoFocus?: boolean;

  /**
   * Additional CSS classes.
   */
  className?: string;
}

/**
 * Rarity color mapping.
 */
const rarityColors: Record<string, string> = {
  Junk: "border-gray-500",
  Basic: "border-gray-400",
  Fine: "border-blue-400",
  Masterwork: "border-green-400",
  Rare: "border-yellow-400",
  Exotic: "border-orange-400",
  Ascended: "border-pink-400",
  Legendary: "border-purple-400",
};

/**
 * Debounce delay for search queries in milliseconds.
 */
const DEBOUNCE_MS = 300;

/**
 * Autocomplete search component for GW2 items.
 *
 * @param props - Component props
 * @returns Item search input with dropdown results
 */
export function ItemSearch({
  onSelect,
  placeholder = "Search items...",
  autoFocus = false,
  className = "",
}: ItemSearchProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ItemSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  /**
   * Performs the search with debouncing.
   */
  const performSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      const data = await searchItems({ data: { query: searchQuery, limit: 15 } });
      setResults(data);
      setIsOpen(data.length > 0);
      setSelectedIndex(-1);
    } catch (error) {
      console.error("Search failed:", error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Handles input change with debouncing.
   */
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setQuery(value);

      // Clear existing timeout
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Debounce the search
      debounceRef.current = setTimeout(() => {
        performSearch(value);
      }, DEBOUNCE_MS);
    },
    [performSearch]
  );

  /**
   * Handles item selection.
   */
  const handleSelect = useCallback(
    (item: ItemSearchResult) => {
      setQuery(item.item.name);
      setIsOpen(false);

      if (onSelect) {
        onSelect(item);
      } else {
        // Default behavior: navigate to item detail
        navigate({ to: "/items/$itemId", params: { itemId: String(item.item.id) } });
      }
    },
    [onSelect, navigate]
  );

  /**
   * Handles keyboard navigation.
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < results.length - 1 ? prev + 1 : prev
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
          break;
        case "Enter":
          e.preventDefault();
          if (selectedIndex >= 0 && results[selectedIndex]) {
            handleSelect(results[selectedIndex]);
          }
          break;
        case "Escape":
          setIsOpen(false);
          setSelectedIndex(-1);
          break;
      }
    },
    [isOpen, results, selectedIndex, handleSelect]
  );

  /**
   * Close dropdown when clicking outside.
   * Uses containerRef to include both input and dropdown in the "inside" area.
   */
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={`relative ${className}`} data-testid="item-search">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full pl-12 pr-12 py-4 bg-slate-800/80 backdrop-blur-sm border border-slate-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-lg"
          data-testid="search-input"
        />
        {isLoading && (
          <Loader2
            className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-cyan-400 animate-spin"
            data-testid="loading-indicator"
          />
        )}
      </div>

      {/* Results Dropdown */}
      {isOpen && results.length > 0 && (
        <div
          className="absolute z-50 w-full mt-2 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl overflow-hidden"
          data-testid="search-results"
        >
          {results.map((result, index) => (
            <button
              key={result.item.id}
              onClick={() => handleSelect(result)}
              className={`w-full flex items-center gap-3 p-3 text-left hover:bg-slate-700 transition-colors ${
                index === selectedIndex ? "bg-slate-700" : ""
              }`}
              data-testid={`search-result-${result.item.id}`}
            >
              {/* Item Icon */}
              {result.item.icon ? (
                <img
                  src={result.item.icon}
                  alt={result.item.name}
                  className={`w-10 h-10 rounded border ${
                    rarityColors[result.item.rarity] || "border-gray-500"
                  }`}
                />
              ) : (
                <div className="w-10 h-10 rounded bg-slate-600 flex items-center justify-center">
                  <span className="text-xs text-gray-400">?</span>
                </div>
              )}

              {/* Item Info */}
              <div className="flex-1 min-w-0">
                <div className="text-white font-medium truncate">
                  {result.item.name}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-400">{result.item.type}</span>
                  {result.hasCraftingRecipe && (
                    <span className="flex items-center gap-1 text-indigo-400">
                      <Hammer className="w-3 h-3" />
                      Craftable
                    </span>
                  )}
                </div>
              </div>

              {/* Price */}
              {result.price && (
                <div className="text-right">
                  <div className="text-xs text-gray-400 mb-0.5">Sell Price</div>
                  <PriceDisplay copper={result.price.sellPrice} size="sm" />
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* No Results */}
      {isOpen && query.length >= 2 && results.length === 0 && !isLoading && (
        <div className="absolute z-50 w-full mt-2 bg-slate-800 border border-slate-600 rounded-xl p-6 text-center">
          <p className="text-gray-400">No items found for "{query}"</p>
        </div>
      )}
    </div>
  );
}

export default ItemSearch;

