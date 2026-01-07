/**
 * @fileoverview Demo page showcasing API request functionality.
 *
 * This module demonstrates how to fetch data from an API endpoint
 * within a TanStack Start application. It fetches a list of names
 * from the `/demo/api/names` endpoint and displays them in a styled list.
 *
 * @module routes/demo/start.api-request
 */

import { useEffect, useState } from 'react'

import { createFileRoute } from '@tanstack/react-router'

/**
 * Fetches the list of names from the API endpoint.
 *
 * @returns Promise resolving to an array of name strings
 */
function getNames() {
  return fetch('/demo/api/names').then((res) => res.json() as Promise<string[]>)
}

/**
 * Route configuration for the API request demo page.
 */
export const Route = createFileRoute('/demo/start/api-request')({
  component: Home,
})

/**
 * API request demo component.
 *
 * Fetches and displays a list of names from the API endpoint
 * using client-side data fetching with useEffect.
 *
 * @returns The demo page with a list of fetched names
 */
function Home() {
  const [names, setNames] = useState<Array<string>>([])

  useEffect(() => {
    getNames().then(setNames)
  }, [])

  return (
    <div
      className="flex items-center justify-center min-h-screen p-4 text-white"
      style={{
        backgroundColor: '#000',
        backgroundImage:
          'radial-gradient(ellipse 60% 60% at 0% 100%, #444 0%, #222 60%, #000 100%)',
      }}
    >
      <div className="w-full max-w-2xl p-8 rounded-xl backdrop-blur-md bg-black/50 shadow-xl border-8 border-black/10">
        <h1 className="text-2xl mb-4">Start API Request Demo - Names List</h1>
        <ul className="mb-4 space-y-2">
          {names.map((name) => (
            <li
              key={name}
              className="bg-white/10 border border-white/20 rounded-lg p-3 backdrop-blur-sm shadow-md"
            >
              <span className="text-lg text-white">{name}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
