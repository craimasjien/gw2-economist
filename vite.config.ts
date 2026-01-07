/**
 * @fileoverview Vite configuration for the GW2 Economist application.
 *
 * This module configures Vite with all necessary plugins for a TanStack Start
 * application including React, Tailwind CSS, TypeScript path aliases,
 * TanStack DevTools, and Nitro for server-side functionality.
 *
 * @module vite.config
 *
 * @example
 * ```bash
 * # Start development server
 * pnpm dev
 *
 * # Build for production
 * pnpm build
 * ```
 */

import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

/**
 * Vite configuration with TanStack Start and supporting plugins.
 *
 * Plugins included:
 * - devtools: TanStack DevTools integration
 * - nitro: Server-side rendering and API routes
 * - viteTsConfigPaths: TypeScript path alias resolution
 * - tailwindcss: Tailwind CSS compilation
 * - tanstackStart: TanStack Start framework integration
 * - viteReact: React Fast Refresh and JSX transformation
 */
const config = defineConfig({
  plugins: [
    devtools(),
    nitro(),
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
