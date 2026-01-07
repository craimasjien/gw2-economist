/**
 * @fileoverview Full SSR demo page.
 *
 * This module demonstrates full server-side rendering in TanStack Start
 * where both data loading and component rendering occur on the server.
 * The page is fully rendered with data before being sent to the client.
 *
 * @module routes/demo/start.ssr.full-ssr
 */

import { createFileRoute } from '@tanstack/react-router'
import { getPunkSongs } from '@/data/demo.punk-songs'

/**
 * Route configuration for full SSR mode demo.
 *
 * Uses a loader to fetch data on the server, with the component
 * fully rendered server-side before being sent to the client.
 */
export const Route = createFileRoute('/demo/start/ssr/full-ssr')({
  component: RouteComponent,
  loader: async () => await getPunkSongs(),
})

/**
 * Full SSR demo component.
 *
 * Displays punk songs that were loaded server-side via the route loader.
 * The entire page including data is rendered on the server.
 *
 * @returns The full SSR demo page with server-rendered song list
 */
function RouteComponent() {
  const punkSongs = Route.useLoaderData()

  return (
    <div
      className="flex items-center justify-center min-h-screen bg-gradient-to-br from-zinc-800 to-black p-4 text-white"
      style={{
        backgroundImage:
          'radial-gradient(50% 50% at 20% 60%, #1a1a1a 0%, #0a0a0a 50%, #000000 100%)',
      }}
    >
      <div className="w-full max-w-2xl p-8 rounded-xl backdrop-blur-md bg-black/50 shadow-xl border-8 border-black/10">
        <h1 className="text-3xl font-bold mb-6 text-purple-400">
          Full SSR - Punk Songs
        </h1>
        <ul className="space-y-3">
          {punkSongs.map((song) => (
            <li
              key={song.id}
              className="bg-white/10 border border-white/20 rounded-lg p-4 backdrop-blur-sm shadow-md"
            >
              <span className="text-lg text-white font-medium">
                {song.name}
              </span>
              <span className="text-white/60"> - {song.artist}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
