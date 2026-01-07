/**
 * @fileoverview Demo page showcasing TanStack Start server functions.
 *
 * This module demonstrates server functions (similar to server actions) in
 * TanStack Start. It implements a todo list that persists to a JSON file
 * on the server, showcasing how server functions can handle both GET and
 * POST operations with type-safe input validation.
 *
 * @module routes/demo/start.server-funcs
 */

import fs from 'node:fs'
import { useCallback, useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

/*
const loggingMiddleware = createMiddleware().server(
  async ({ next, request }) => {
    console.log("Request:", request.url);
    return next();
  }
);
const loggedServerFunction = createServerFn({ method: "GET" }).middleware([
  loggingMiddleware,
]);
*/

/** File path for persisting todos on the server */
const TODOS_FILE = 'todos.json'

/**
 * Reads todos from the JSON file, returning default todos if file doesn't exist.
 *
 * @returns Promise resolving to an array of todo objects
 */
async function readTodos() {
  return JSON.parse(
    await fs.promises.readFile(TODOS_FILE, 'utf-8').catch(() =>
      JSON.stringify(
        [
          { id: 1, name: 'Get groceries' },
          { id: 2, name: 'Buy a new phone' },
        ],
        null,
        2,
      ),
    ),
  )
}

/**
 * Server function to retrieve all todos.
 *
 * @returns Promise resolving to the array of todos
 */
const getTodos = createServerFn({
  method: 'GET',
}).handler(async () => await readTodos())

/**
 * Server function to add a new todo item.
 *
 * Validates the input as a string, adds it to the todos list,
 * and persists the updated list to the JSON file.
 *
 * @param data - The todo name/description to add
 * @returns Promise resolving to the updated todos array
 */
const addTodo = createServerFn({ method: 'POST' })
  .inputValidator((d: string) => d)
  .handler(async ({ data }) => {
    const todos = await readTodos()
    todos.push({ id: todos.length + 1, name: data })
    await fs.promises.writeFile(TODOS_FILE, JSON.stringify(todos, null, 2))
    return todos
  })

/**
 * Route configuration for the server functions demo page.
 *
 * Uses a loader to pre-fetch todos before rendering the component.
 */
export const Route = createFileRoute('/demo/start/server-funcs')({
  component: Home,
  loader: async () => await getTodos(),
})

/**
 * Server functions demo component.
 *
 * Displays a todo list with the ability to add new items.
 * Demonstrates server function usage for both data loading and mutations.
 *
 * @returns The todo list demo page
 */
function Home() {
  const router = useRouter()
  let todos = Route.useLoaderData()

  const [todo, setTodo] = useState('')

  const submitTodo = useCallback(async () => {
    todos = await addTodo({ data: todo })
    setTodo('')
    router.invalidate()
  }, [addTodo, todo])

  return (
    <div
      className="flex items-center justify-center min-h-screen bg-gradient-to-br from-zinc-800 to-black p-4 text-white"
      style={{
        backgroundImage:
          'radial-gradient(50% 50% at 20% 60%, #23272a 0%, #18181b 50%, #000000 100%)',
      }}
    >
      <div className="w-full max-w-2xl p-8 rounded-xl backdrop-blur-md bg-black/50 shadow-xl border-8 border-black/10">
        <h1 className="text-2xl mb-4">Start Server Functions - Todo Example</h1>
        <ul className="mb-4 space-y-2">
          {todos?.map((t) => (
            <li
              key={t.id}
              className="bg-white/10 border border-white/20 rounded-lg p-3 backdrop-blur-sm shadow-md"
            >
              <span className="text-lg text-white">{t.name}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={todo}
            onChange={(e) => setTodo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                submitTodo()
              }
            }}
            placeholder="Enter a new todo..."
            className="w-full px-4 py-3 rounded-lg border border-white/20 bg-white/10 backdrop-blur-sm text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
          />
          <button
            disabled={todo.trim().length === 0}
            onClick={submitTodo}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-colors"
          >
            Add todo
          </button>
        </div>
      </div>
    </div>
  )
}
