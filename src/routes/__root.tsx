/**
 * @fileoverview Root route configuration and document shell for the application.
 *
 * This module defines the root route which serves as the base layout for all pages.
 * It configures the HTML document structure, meta tags, stylesheets, and includes
 * the Header component and TanStack DevTools for development.
 *
 * @module routes/__root
 *
 * @example
 * The root route is automatically used by TanStack Router as the parent
 * for all other routes. Child routes are rendered where `{children}` appears.
 */

import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import Header from '../components/Header'

import appCss from '../styles.css?url'

/**
 * Root route configuration with document shell.
 *
 * Configures meta tags (charset, viewport, title) and stylesheets
 * for the entire application.
 */
export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'GW2 Economist - Buy or Craft Calculator',
      },
      {
        name: 'description',
        content: 'Find the cheapest way to get any item in Guild Wars 2. Compare buy vs craft prices with real-time Trading Post data.',
      },
      {
        name: 'theme-color',
        content: '#0a0908',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
      {
        rel: 'preconnect',
        href: 'https://fonts.googleapis.com',
      },
      {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossOrigin: 'anonymous',
      },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap',
      },
    ],
  }),

  shellComponent: RootDocument,
})

/**
 * Root document shell component.
 *
 * Renders the complete HTML document structure including html, head, and body tags.
 * Includes the Header component, child routes, and development tools.
 *
 * @param props - Component props
 * @param props.children - Child route components to render in the body
 * @returns The complete HTML document structure
 */
function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <Header />
        {children}
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
