/**
 * @fileoverview API route that returns a list of sample names.
 *
 * This module defines an API endpoint at `/demo/api/names` that serves
 * a JSON array of sample names. It demonstrates how to create server-side
 * API handlers using TanStack Start's file-based routing.
 *
 * @module routes/demo/api.names
 *
 * @example
 * ```ts
 * // Fetch the names from the API
 * const response = await fetch('/demo/api/names')
 * const names = await response.json() // ['Alice', 'Bob', 'Charlie']
 * ```
 */

import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

/**
 * API route configuration for the names endpoint.
 *
 * Handles GET requests and returns a JSON array of sample names.
 */
export const Route = createFileRoute('/demo/api/names')({
  server: {
    handlers: {
      GET: () => json(['Alice', 'Bob', 'Charlie']),
    },
  },
})
