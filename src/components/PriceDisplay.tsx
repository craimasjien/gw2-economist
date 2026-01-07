/**
 * @fileoverview Component for displaying GW2 currency values.
 *
 * Converts copper values to gold/silver/copper format with appropriate
 * styling for each currency type. Supports optional display of all units
 * or condensed format showing only non-zero values.
 *
 * @module components/PriceDisplay
 *
 * @example
 * ```tsx
 * import { PriceDisplay } from './PriceDisplay';
 *
 * // Shows "1g 23s 45c"
 * <PriceDisplay copper={12345} />
 *
 * // Shows "0g 0s 45c" (all units)
 * <PriceDisplay copper={45} showAll />
 * ```
 */

/**
 * Parsed price with gold, silver, and copper values.
 */
export interface ParsedPrice {
  gold: number;
  silver: number;
  copper: number;
}

/**
 * Props for the PriceDisplay component.
 */
export interface PriceDisplayProps {
  /**
   * Price value in copper (base unit).
   */
  copper: number;

  /**
   * Show all currency units even if zero.
   * @default false
   */
  showAll?: boolean;

  /**
   * Additional CSS classes to apply.
   */
  className?: string;

  /**
   * Size variant for the display.
   * @default 'md'
   */
  size?: "sm" | "md" | "lg";
}

/**
 * Converts a copper value to gold, silver, and copper.
 *
 * GW2 currency conversion:
 * - 1 gold = 100 silver = 10,000 copper
 * - 1 silver = 100 copper
 *
 * @param copper - Value in copper coins
 * @returns Parsed price with gold, silver, copper
 */
export function formatPrice(copper: number): ParsedPrice {
  const gold = Math.floor(copper / 10000);
  const remaining = copper % 10000;
  const silver = Math.floor(remaining / 100);
  const copperCoins = remaining % 100;

  return { gold, silver, copper: copperCoins };
}

/**
 * Displays a GW2 price in gold/silver/copper format.
 *
 * Uses color-coded icons for each currency type:
 * - Gold: Yellow/gold colored coin
 * - Silver: Gray/silver colored coin
 * - Copper: Orange/copper colored coin
 *
 * @param props - Component props
 * @returns Formatted price display
 */
export function PriceDisplay({
  copper,
  showAll = false,
  className = "",
  size = "md",
}: PriceDisplayProps) {
  const { gold, silver, copper: copperCoins } = formatPrice(copper);

  const sizeClasses = {
    sm: "text-sm gap-1",
    md: "text-base gap-1.5",
    lg: "text-lg gap-2",
  };

  const coinSizes = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  const showGold = showAll || gold > 0;
  const showSilver = showAll || gold > 0 || silver > 0;
  const showCopper = showAll || copper === 0 || copperCoins > 0 || (!showGold && !showSilver);

  return (
    <span
      data-testid="price-display"
      className={`inline-flex items-center font-medium ${sizeClasses[size]} ${className}`}
    >
      {showGold && (
        <span
          data-testid="gold-value"
          className="inline-flex items-center gap-0.5"
        >
          <span className="text-yellow-400">{gold}</span>
          <GoldCoin className={coinSizes[size]} />
        </span>
      )}

      {showSilver && (
        <span
          data-testid="silver-value"
          className="inline-flex items-center gap-0.5"
        >
          <span className="text-gray-300">{silver}</span>
          <SilverCoin className={coinSizes[size]} />
        </span>
      )}

      {showCopper && (
        <span
          data-testid="copper-value"
          className="inline-flex items-center gap-0.5"
        >
          <span className="text-orange-400">{copperCoins}</span>
          <CopperCoin className={coinSizes[size]} />
        </span>
      )}
    </span>
  );
}

/**
 * Gold coin icon component.
 */
function GoldCoin({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`${className} text-yellow-400`}
      viewBox="0 0 16 16"
      fill="currentColor"
    >
      <circle cx="8" cy="8" r="7" fill="currentColor" />
      <circle cx="8" cy="8" r="5" fill="#D4AF37" />
      <text
        x="8"
        y="11"
        textAnchor="middle"
        fontSize="8"
        fill="#996515"
        fontWeight="bold"
      >
        G
      </text>
    </svg>
  );
}

/**
 * Silver coin icon component.
 */
function SilverCoin({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`${className} text-gray-400`}
      viewBox="0 0 16 16"
      fill="currentColor"
    >
      <circle cx="8" cy="8" r="7" fill="currentColor" />
      <circle cx="8" cy="8" r="5" fill="#C0C0C0" />
      <text
        x="8"
        y="11"
        textAnchor="middle"
        fontSize="8"
        fill="#666"
        fontWeight="bold"
      >
        S
      </text>
    </svg>
  );
}

/**
 * Copper coin icon component.
 */
function CopperCoin({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`${className} text-orange-600`}
      viewBox="0 0 16 16"
      fill="currentColor"
    >
      <circle cx="8" cy="8" r="7" fill="currentColor" />
      <circle cx="8" cy="8" r="5" fill="#B87333" />
      <text
        x="8"
        y="11"
        textAnchor="middle"
        fontSize="8"
        fill="#8B4513"
        fontWeight="bold"
      >
        C
      </text>
    </svg>
  );
}

export default PriceDisplay;

