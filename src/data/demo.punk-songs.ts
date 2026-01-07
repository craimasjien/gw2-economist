/**
 * @fileoverview Demo data provider for punk/rock song samples.
 *
 * This module provides a server function that returns a list of sample
 * punk and alternative rock songs. It's used across the SSR demo pages
 * to demonstrate different data loading strategies.
 *
 * @module data/demo.punk-songs
 *
 * @example
 * ```ts
 * import { getPunkSongs } from '@/data/demo.punk-songs'
 *
 * const songs = await getPunkSongs()
 * // Returns array of { id, name, artist } objects
 * ```
 */

import { createServerFn } from '@tanstack/react-start'

/**
 * Server function to retrieve a list of punk/rock songs.
 *
 * Returns a static list of popular punk and alternative rock songs
 * for demo purposes. This runs on the server and can be called
 * from both server and client contexts.
 *
 * @returns Promise resolving to an array of song objects with id, name, and artist
 */
export const getPunkSongs = createServerFn({
  method: 'GET',
}).handler(async () => [
  { id: 1, name: 'Teenage Dirtbag', artist: 'Wheatus' },
  { id: 2, name: 'Smells Like Teen Spirit', artist: 'Nirvana' },
  { id: 3, name: 'The Middle', artist: 'Jimmy Eat World' },
  { id: 4, name: 'My Own Worst Enemy', artist: 'Lit' },
  { id: 5, name: 'Fat Lip', artist: 'Sum 41' },
  { id: 6, name: 'All the Small Things', artist: 'blink-182' },
  { id: 7, name: 'Beverly Hills', artist: 'Weezer' },
])
