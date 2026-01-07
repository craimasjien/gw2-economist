/**
 * @fileoverview Header component with slide-out navigation drawer.
 *
 * This module provides the main header and navigation component for the application.
 * It includes a hamburger menu that opens a slide-out sidebar with navigation links
 * to all application routes, including collapsible sub-menus for grouped routes.
 * Styled with the GW2 theme featuring gold accents and dark fantasy aesthetics.
 *
 * @module components/Header
 *
 * @example
 * ```tsx
 * import Header from '@/components/Header'
 *
 * function App() {
 *   return (
 *     <>
 *       <Header />
 *       <main>...</main>
 *     </>
 *   )
 * }
 * ```
 */

import { Link } from '@tanstack/react-router'

import { useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Home,
  Menu,
  Network,
  SquareFunction,
  StickyNote,
  X,
  Hammer,
  TrendingUp,
} from 'lucide-react'

/**
 * Header component with slide-out navigation drawer.
 *
 * Renders a fixed header bar with a hamburger menu button and logo.
 * When the menu is opened, a slide-out drawer appears from the left
 * containing navigation links to all application routes.
 * Features GW2-themed styling with gold borders and dark backgrounds.
 *
 * @returns The header element with navigation drawer.
 */
export default function Header() {
  const [isOpen, setIsOpen] = useState(false)
  const [groupedExpanded, setGroupedExpanded] = useState<
    Record<string, boolean>
  >({})

  return (
    <>
      {/* Main Header Bar */}
      <header
        className="sticky top-0 z-40 px-6 py-3 flex items-center justify-between"
        style={{
          background: 'linear-gradient(180deg, var(--gw2-bg-medium) 0%, var(--gw2-bg-dark) 100%)',
          borderBottom: '1px solid var(--gw2-border)',
          boxShadow: 'var(--gw2-shadow-md)',
        }}
      >
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsOpen(true)}
            className="p-2 rounded-lg transition-all duration-200"
            style={{
              color: 'var(--gw2-text-secondary)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--gw2-gold)'
              e.currentTarget.style.background = 'var(--gw2-bg-light)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--gw2-text-secondary)'
              e.currentTarget.style.background = 'transparent'
            }}
            aria-label="Open menu"
          >
            <Menu size={24} />
          </button>

          {/* Logo / Brand */}
          <Link to="/" className="flex items-center gap-3 group">
            <div
              className="p-2 rounded-lg transition-all duration-300 group-hover:scale-105"
              style={{
                background: 'linear-gradient(135deg, var(--gw2-red) 0%, var(--gw2-red-dark) 100%)',
                boxShadow: '0 0 15px var(--gw2-red-glow)',
              }}
            >
              <Hammer size={24} className="text-white" />
            </div>
            <div>
              <h1
                className="text-xl font-bold tracking-wide"
                style={{
                  fontFamily: 'var(--font-display)',
                  color: 'var(--gw2-text-primary)',
                }}
              >
                <span style={{ color: 'var(--gw2-gold)' }}>GW2</span>{' '}
                <span>Economist</span>
              </h1>
            </div>
          </Link>
        </div>

        {/* Right side - could add user menu, settings, etc. */}
        <div className="flex items-center gap-2">
          <span
            className="text-xs px-3 py-1 rounded-full"
            style={{
              background: 'var(--gw2-bg-light)',
              color: 'var(--gw2-text-muted)',
              border: '1px solid var(--gw2-border)',
            }}
          >
            Trading Post Data
          </span>
        </div>
      </header>

      {/* Backdrop Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 transition-opacity duration-300"
          style={{ background: 'rgba(0, 0, 0, 0.7)' }}
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Slide-out Navigation Drawer */}
      <aside
        className={`fixed top-0 left-0 h-full w-80 z-50 flex flex-col transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          background: 'linear-gradient(180deg, var(--gw2-bg-medium) 0%, var(--gw2-bg-darkest) 100%)',
          borderRight: '1px solid var(--gw2-border)',
          boxShadow: 'var(--gw2-shadow-lg)',
        }}
      >
        {/* Drawer Header */}
        <div
          className="flex items-center justify-between p-4"
          style={{ borderBottom: '1px solid var(--gw2-border)' }}
        >
          <h2
            className="text-xl font-bold"
            style={{
              fontFamily: 'var(--font-display)',
              color: 'var(--gw2-gold)',
            }}
          >
            Navigation
          </h2>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 rounded-lg transition-all duration-200"
            style={{ color: 'var(--gw2-text-secondary)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--gw2-red)'
              e.currentTarget.style.background = 'var(--gw2-bg-light)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--gw2-text-secondary)'
              e.currentTarget.style.background = 'transparent'
            }}
            aria-label="Close menu"
          >
            <X size={24} />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-4 overflow-y-auto">
          {/* Home Link */}
          <NavLink to="/" icon={<Home size={20} />} onClick={() => setIsOpen(false)}>
            Home
          </NavLink>

          {/* Opportunities Link */}
          <NavLink to="/opportunities" icon={<TrendingUp size={20} />} onClick={() => setIsOpen(false)}>
            Profit Opportunities
          </NavLink>

          {/* Demo Links Section */}
          <div
            className="mt-6 mb-2 px-3"
            style={{
              fontFamily: 'var(--font-display)',
              color: 'var(--gw2-text-muted)',
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}
          >
            Demo Pages
          </div>

          <NavLink
            to="/demo/start/server-funcs"
            icon={<SquareFunction size={20} />}
            onClick={() => setIsOpen(false)}
          >
            Server Functions
          </NavLink>

          <NavLink
            to="/demo/start/api-request"
            icon={<Network size={20} />}
            onClick={() => setIsOpen(false)}
          >
            API Request
          </NavLink>

          {/* Expandable SSR Demos */}
          <div className="flex flex-row justify-between items-center">
            <NavLink
              to="/demo/start/ssr"
              icon={<StickyNote size={20} />}
              onClick={() => setIsOpen(false)}
              className="flex-1"
            >
              SSR Demos
            </NavLink>
            <button
              className="p-2 rounded-lg transition-all duration-200"
              style={{ color: 'var(--gw2-text-secondary)' }}
              onClick={() =>
                setGroupedExpanded((prev) => ({
                  ...prev,
                  StartSSRDemo: !prev.StartSSRDemo,
                }))
              }
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--gw2-gold)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--gw2-text-secondary)'
              }}
            >
              {groupedExpanded.StartSSRDemo ? (
                <ChevronDown size={20} />
              ) : (
                <ChevronRight size={20} />
              )}
            </button>
          </div>

          {/* Nested SSR Demo Links */}
          {groupedExpanded.StartSSRDemo && (
            <div className="ml-4 pl-4" style={{ borderLeft: '1px solid var(--gw2-border)' }}>
              <NavLink
                to="/demo/start/ssr/spa-mode"
                icon={<StickyNote size={18} />}
                onClick={() => setIsOpen(false)}
                size="sm"
              >
                SPA Mode
              </NavLink>

              <NavLink
                to="/demo/start/ssr/full-ssr"
                icon={<StickyNote size={18} />}
                onClick={() => setIsOpen(false)}
                size="sm"
              >
                Full SSR
              </NavLink>

              <NavLink
                to="/demo/start/ssr/data-only"
                icon={<StickyNote size={18} />}
                onClick={() => setIsOpen(false)}
                size="sm"
              >
                Data Only
              </NavLink>
            </div>
          )}
        </nav>

        {/* Drawer Footer */}
        <div
          className="p-4 text-center"
          style={{
            borderTop: '1px solid var(--gw2-border)',
            color: 'var(--gw2-text-muted)',
            fontSize: '0.75rem',
          }}
        >
          <p>Not affiliated with ArenaNet</p>
        </div>
      </aside>
    </>
  )
}

/**
 * Props for the NavLink component.
 */
interface NavLinkProps {
  to: string
  icon: React.ReactNode
  children: React.ReactNode
  onClick?: () => void
  className?: string
  size?: 'sm' | 'md'
}

/**
 * Navigation link component with GW2 styling.
 *
 * @param props - Component props
 * @returns Styled navigation link
 */
function NavLink({ to, icon, children, onClick, className = '', size = 'md' }: NavLinkProps) {
  const padding = size === 'sm' ? 'p-2' : 'p-3'
  const fontSize = size === 'sm' ? 'text-sm' : 'text-base'

  return (
    <Link
      to={to}
      onClick={onClick}
      className={`flex items-center gap-3 ${padding} rounded-lg mb-1 transition-all duration-200 ${className}`}
      style={{
        color: 'var(--gw2-text-secondary)',
      }}
      activeProps={{
        style: {
          background: 'linear-gradient(90deg, var(--gw2-red-dark) 0%, transparent 100%)',
          color: 'var(--gw2-text-primary)',
          borderLeft: '3px solid var(--gw2-red)',
        },
      }}
      // Using data attributes for hover since inline styles can't do :hover
      onMouseEnter={(e) => {
        if (!e.currentTarget.getAttribute('data-active')) {
          e.currentTarget.style.background = 'var(--gw2-bg-light)'
          e.currentTarget.style.color = 'var(--gw2-gold)'
        }
      }}
      onMouseLeave={(e) => {
        if (!e.currentTarget.getAttribute('data-active')) {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = 'var(--gw2-text-secondary)'
        }
      }}
    >
      {icon}
      <span className={`font-medium ${fontSize}`}>{children}</span>
    </Link>
  )
}
