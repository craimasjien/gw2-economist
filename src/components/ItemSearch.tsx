/**
 * @fileoverview Autocomplete search component for GW2 items.
 *
 * Provides a search input with dropdown results that queries items
 * from the database using server functions. Supports keyboard navigation
 * and displays item icons, names, and prices. Styled with GW2 theme.
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
        <Search
          className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5"
          style={{ color: 'var(--gw2-text-muted)' }}
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full pl-12 pr-12 py-4 rounded-xl text-lg transition-all duration-200"
          style={{
            background: 'var(--gw2-bg-dark)',
            border: '1px solid var(--gw2-border)',
            color: 'var(--gw2-text-primary)',
            boxShadow: 'var(--gw2-shadow-md)',
          }}
          onFocusCapture={(e) => {
            e.currentTarget.style.borderColor = 'var(--gw2-gold)';
            e.currentTarget.style.boxShadow = '0 0 0 2px var(--gw2-gold-glow), var(--gw2-shadow-md)';
          }}
          onBlurCapture={(e) => {
            e.currentTarget.style.borderColor = 'var(--gw2-border)';
            e.currentTarget.style.boxShadow = 'var(--gw2-shadow-md)';
          }}
          data-testid="search-input"
        />
        {isLoading && (
          <Loader2
            className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin"
            style={{ color: 'var(--gw2-gold)' }}
            data-testid="loading-indicator"
          />
        )}
      </div>

      {/* Results Dropdown */}
      {isOpen && results.length > 0 && (
        <div
          className="absolute z-50 w-full mt-2 rounded-xl overflow-hidden"
          style={{
            background: 'var(--gw2-bg-medium)',
            border: '1px solid var(--gw2-border)',
            boxShadow: 'var(--gw2-shadow-lg)',
          }}
          data-testid="search-results"
        >
          {results.map((result, index) => {
            const rarity = rarityColors[result.item.rarity] || { border: 'var(--rarity-junk)', text: 'var(--gw2-text-secondary)' };
            return (
              <button
                key={result.item.id}
                onClick={() => handleSelect(result)}
                className="w-full flex items-center gap-3 p-3 text-left transition-all duration-150"
                style={{
                  background: index === selectedIndex ? 'var(--gw2-bg-light)' : 'transparent',
                  borderLeft: index === selectedIndex ? '3px solid var(--gw2-gold)' : '3px solid transparent',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--gw2-bg-light)';
                }}
                onMouseLeave={(e) => {
                  if (index !== selectedIndex) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
                data-testid={`search-result-${result.item.id}`}
              >
                {/* Item Icon */}
                {result.item.icon ? (
                  <img
                    src={result.item.icon}
                    alt={result.item.name}
                    className="w-10 h-10 rounded"
                    style={{
                      border: `2px solid ${rarity.border}`,
                      boxShadow: `0 0 6px ${rarity.border}40`,
                    }}
                  />
                ) : (
                  <div
                    className="w-10 h-10 rounded flex items-center justify-center"
                    style={{
                      background: 'var(--gw2-bg-dark)',
                      border: '2px solid var(--gw2-border)',
                    }}
                  >
                    <span style={{ color: 'var(--gw2-text-muted)' }} className="text-xs">?</span>
                  </div>
                )}

                {/* Item Info */}
                <div className="flex-1 min-w-0">
                  <div
                    className="font-medium truncate"
                    style={{ color: rarity.text }}
                  >
                    {result.item.name}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span style={{ color: 'var(--gw2-text-muted)' }}>{result.item.type}</span>
                    {result.hasCraftingRecipe && (
                      <span className="flex items-center gap-1" style={{ color: 'var(--gw2-red-light)' }}>
                        <Hammer className="w-3 h-3" />
                        Craftable
                      </span>
                    )}
                  </div>
                </div>

                {/* Price */}
                {result.price && (
                  <div className="text-right">
                    <div className="text-xs mb-0.5" style={{ color: 'var(--gw2-text-muted)' }}>Sell Price</div>
                    <PriceDisplay copper={result.price.sellPrice} size="sm" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* No Results */}
      {isOpen && query.length >= 2 && results.length === 0 && !isLoading && (
        <div
          className="absolute z-50 w-full mt-2 rounded-xl p-6 text-center"
          style={{
            background: 'var(--gw2-bg-medium)',
            border: '1px solid var(--gw2-border)',
          }}
        >
          <p style={{ color: 'var(--gw2-text-muted)' }}>No items found for "{query}"</p>
        </div>
      )}
    </div>
  );
}

export default ItemSearch;
