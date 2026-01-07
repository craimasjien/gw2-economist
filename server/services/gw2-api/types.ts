/**
 * @fileoverview TypeScript type definitions for the Guild Wars 2 API v2.
 *
 * This module defines interfaces that mirror the response structures from
 * the GW2 API endpoints used by this application. These types ensure type
 * safety when fetching and processing data from the API.
 *
 * @module server/services/gw2-api/types
 *
 * @see https://wiki.guildwars2.com/wiki/API:Main
 * @see https://api.guildwars2.com/v2
 *
 * @example
 * ```typescript
 * import type { GW2Item, GW2Recipe, GW2Price } from './types';
 *
 * const item: GW2Item = await fetchItem(12345);
 * console.log(item.name, item.rarity);
 * ```
 */

/**
 * Represents an item from the GW2 API `/v2/items` endpoint.
 *
 * @interface GW2Item
 * @see https://wiki.guildwars2.com/wiki/API:2/items
 */
export interface GW2Item {
  /**
   * Unique item identifier.
   */
  id: number;

  /**
   * Chat code for linking the item in-game (e.g., "[&AgEqAQAA]").
   */
  chat_link: string;

  /**
   * Localized item name.
   */
  name: string;

  /**
   * URL to the item's icon image.
   */
  icon?: string;

  /**
   * Item description, may contain HTML formatting.
   */
  description?: string;

  /**
   * Item type classification.
   */
  type: GW2ItemType;

  /**
   * Item rarity tier.
   */
  rarity: GW2Rarity;

  /**
   * Required character level to use the item.
   */
  level: number;

  /**
   * Vendor sell value in copper coins.
   */
  vendor_value: number;

  /**
   * Default skin ID applied when the item is equipped.
   */
  default_skin?: number;

  /**
   * Array of item flags indicating special properties.
   */
  flags: GW2ItemFlag[];

  /**
   * Array of game types where this item can be used.
   */
  game_types: GW2GameType[];

  /**
   * Array of item restrictions (e.g., race, profession).
   */
  restrictions: string[];

  /**
   * Upgrade information for upgrade components.
   */
  upgrades_into?: GW2UpgradeInfo[];

  /**
   * Items that this upgrade can be applied to.
   */
  upgrades_from?: GW2UpgradeInfo[];

  /**
   * Type-specific details (varies by item type).
   */
  details?: GW2ItemDetails;
}

/**
 * Classification of item types in GW2.
 */
export type GW2ItemType =
  | "Armor"
  | "Back"
  | "Bag"
  | "Consumable"
  | "Container"
  | "CraftingMaterial"
  | "Gathering"
  | "Gizmo"
  | "JadeTechModule"
  | "Key"
  | "MiniPet"
  | "PowerCore"
  | "Relic"
  | "Tool"
  | "Trait"
  | "Trinket"
  | "Trophy"
  | "UpgradeComponent"
  | "Weapon";

/**
 * Item rarity tiers in GW2.
 */
export type GW2Rarity =
  | "Junk"
  | "Basic"
  | "Fine"
  | "Masterwork"
  | "Rare"
  | "Exotic"
  | "Ascended"
  | "Legendary";

/**
 * Item flags indicating special properties or restrictions.
 */
export type GW2ItemFlag =
  | "AccountBindOnUse"
  | "AccountBound"
  | "Attuned"
  | "BulkConsume"
  | "DeleteWarning"
  | "HideSuffix"
  | "Infused"
  | "MonsterOnly"
  | "NoMysticForge"
  | "NoSalvage"
  | "NoSell"
  | "NotUpgradeable"
  | "NoUnderwater"
  | "SoulbindOnAcquire"
  | "SoulBindOnUse"
  | "Tonic"
  | "Unique";

/**
 * Game modes where items can be used.
 */
export type GW2GameType =
  | "Activity"
  | "Dungeon"
  | "Pve"
  | "Pvp"
  | "PvpLobby"
  | "Wvw";

/**
 * Upgrade relationship information.
 */
export interface GW2UpgradeInfo {
  /**
   * Item ID that can be upgraded to/from.
   */
  item_id: number;

  /**
   * Upgrade type (e.g., "Attunement", "Infusion").
   */
  upgrade: string;
}

/**
 * Type-specific item details (partial, varies by type).
 */
export interface GW2ItemDetails {
  /**
   * Item type (for armor/weapons).
   */
  type?: string;

  /**
   * Weight class (for armor).
   */
  weight_class?: string;

  /**
   * Defense value (for armor).
   */
  defense?: number;

  /**
   * Damage type (for weapons).
   */
  damage_type?: string;

  /**
   * Minimum weapon power.
   */
  min_power?: number;

  /**
   * Maximum weapon power.
   */
  max_power?: number;

  /**
   * Number of infusion slots.
   */
  infusion_slots?: unknown[];

  /**
   * Attribute modifiers.
   */
  infix_upgrade?: GW2InfixUpgrade;

  /**
   * Suffix item ID.
   */
  suffix_item_id?: number;

  /**
   * Secondary suffix item ID.
   */
  secondary_suffix_item_id?: string;

  /**
   * Bag size (for bags).
   */
  size?: number;

  /**
   * Recipe unlock ID (for recipe sheets).
   */
  recipe_id?: number;
}

/**
 * Attribute modifiers for equipment.
 */
export interface GW2InfixUpgrade {
  /**
   * Infix upgrade ID.
   */
  id: number;

  /**
   * Attribute bonuses.
   */
  attributes: GW2Attribute[];

  /**
   * Buff information.
   */
  buff?: {
    skill_id: number;
    description?: string;
  };
}

/**
 * Single attribute bonus.
 */
export interface GW2Attribute {
  /**
   * Attribute name.
   */
  attribute: string;

  /**
   * Bonus value.
   */
  modifier: number;
}

/**
 * Represents a crafting recipe from the GW2 API `/v2/recipes` endpoint.
 *
 * @interface GW2Recipe
 * @see https://wiki.guildwars2.com/wiki/API:2/recipes
 */
export interface GW2Recipe {
  /**
   * Unique recipe identifier.
   */
  id: number;

  /**
   * Recipe type classification.
   */
  type: GW2RecipeType;

  /**
   * Item ID produced by this recipe.
   */
  output_item_id: number;

  /**
   * Number of items produced per craft.
   */
  output_item_count: number;

  /**
   * Time to craft in milliseconds.
   */
  time_to_craft_ms: number;

  /**
   * Crafting disciplines that can use this recipe.
   */
  disciplines: GW2Discipline[];

  /**
   * Minimum crafting level required.
   */
  min_rating: number;

  /**
   * Recipe flags.
   */
  flags: GW2RecipeFlag[];

  /**
   * Item ingredients required.
   */
  ingredients: GW2Ingredient[];

  /**
   * Guild upgrade ingredients (for guild recipes).
   */
  guild_ingredients?: GW2GuildIngredient[];

  /**
   * Chat code for linking.
   */
  chat_link: string;
}

/**
 * Recipe type classifications.
 */
export type GW2RecipeType =
  | "Amulet"
  | "Axe"
  | "Backpack"
  | "Bag"
  | "Boots"
  | "Bulk"
  | "Coat"
  | "Component"
  | "Consumable"
  | "Dagger"
  | "Dessert"
  | "Dye"
  | "Earring"
  | "Feast"
  | "Focus"
  | "Gloves"
  | "GuildConsumable"
  | "GuildDecoration"
  | "GuildConsumableWvw"
  | "Greatsword"
  | "Hammer"
  | "Harpoon"
  | "Helm"
  | "IngredientCooking"
  | "Inscription"
  | "Insignia"
  | "JadeTechModule"
  | "LegendaryComponent"
  | "Leggings"
  | "LongBow"
  | "Mace"
  | "Meal"
  | "Pistol"
  | "Potion"
  | "Refinement"
  | "RefinementEctoplasm"
  | "RefinementObsidian"
  | "Rifle"
  | "Ring"
  | "Scepter"
  | "Seasoning"
  | "Shield"
  | "ShortBow"
  | "Shoulders"
  | "Snack"
  | "Soup"
  | "Speargun"
  | "Staff"
  | "Sword"
  | "Torch"
  | "Trident"
  | "UpgradeComponent"
  | "Warhorn";

/**
 * Crafting disciplines (professions).
 */
export type GW2Discipline =
  | "Armorsmith"
  | "Artificer"
  | "Chef"
  | "Huntsman"
  | "Jeweler"
  | "Leatherworker"
  | "Scribe"
  | "Tailor"
  | "Weaponsmith";

/**
 * Recipe flags.
 */
export type GW2RecipeFlag =
  | "AutoLearned"
  | "LearnedFromItem";

/**
 * Recipe ingredient.
 */
export interface GW2Ingredient {
  /**
   * Item ID required.
   */
  item_id: number;

  /**
   * Quantity required.
   */
  count: number;
}

/**
 * Guild upgrade ingredient.
 */
export interface GW2GuildIngredient {
  /**
   * Guild upgrade ID required.
   */
  upgrade_id: number;

  /**
   * Quantity required.
   */
  count: number;
}

/**
 * Represents trading post prices from the GW2 API `/v2/commerce/prices` endpoint.
 *
 * @interface GW2Price
 * @see https://wiki.guildwars2.com/wiki/API:2/commerce/prices
 */
export interface GW2Price {
  /**
   * Item ID.
   */
  id: number;

  /**
   * Whether the trading post is available.
   */
  whitelisted: boolean;

  /**
   * Current buy order information.
   */
  buys: GW2PriceData;

  /**
   * Current sell listing information.
   */
  sells: GW2PriceData;
}

/**
 * Price data for buy orders or sell listings.
 */
export interface GW2PriceData {
  /**
   * Number of orders/listings at this price.
   */
  quantity: number;

  /**
   * Price in copper coins.
   */
  unit_price: number;
}

/**
 * Trading post listing from `/v2/commerce/listings`.
 */
export interface GW2Listing {
  /**
   * Item ID.
   */
  id: number;

  /**
   * All buy orders for this item.
   */
  buys: GW2ListingEntry[];

  /**
   * All sell listings for this item.
   */
  sells: GW2ListingEntry[];
}

/**
 * Individual listing entry.
 */
export interface GW2ListingEntry {
  /**
   * Number of listings at this price.
   */
  listings: number;

  /**
   * Total quantity available.
   */
  quantity: number;

  /**
   * Price in copper coins.
   */
  unit_price: number;
}

/**
 * Error response from the GW2 API.
 */
export interface GW2ApiError {
  /**
   * Error message text.
   */
  text: string;
}

/**
 * Batch request result with potential errors.
 */
export interface GW2BatchResult<T> {
  /**
   * Successfully fetched items.
   */
  items: T[];

  /**
   * IDs that failed to fetch.
   */
  failedIds: number[];

  /**
   * Error messages if any.
   */
  errors: string[];
}

