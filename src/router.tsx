/**
 * @fileoverview Router configuration for the GW2 Economist application.
 *
 * This module configures and exports the TanStack Router instance used throughout
 * the application. It imports the auto-generated route tree and creates a router
 * with appropriate settings for scroll restoration and preloading.
 *
 * @module router
 *
 * @example
 * ```tsx
 * import { getRouter } from './router'
 *
 * const router = getRouter()
 * // Use router with RouterProvider
 * ```
 */

import { createRouter } from '@tanstack/react-router'

import { routeTree } from './routeTree.gen'

/**
 * Creates and configures a new TanStack Router instance.
 *
 * @returns A configured router instance with scroll restoration enabled
 *          and zero preload stale time for fresh data on navigation.
 */
export const getRouter = () => {
  const router = createRouter({
    routeTree,
    context: {},

    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  })

  return router
}
