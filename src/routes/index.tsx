/**
 * @fileoverview Home page with item search for the GW2 Economist application.
 *
 * This module defines the index route ('/') which provides a search interface
 * for finding GW2 items and analyzing their craft costs. Users can search for
 * items and navigate to the detail page for full craft analysis.
 * Styled with the GW2 theme featuring dark fantasy aesthetics with red/gold accents.
 *
 * @module routes/index
 */

import { createFileRoute } from "@tanstack/react-router";
import { Hammer, TrendingUp, Search, Sparkles, Shield, Swords } from "lucide-react";
import { ItemSearch } from "../components/ItemSearch";

/**
 * Index route configuration for the home page.
 */
export const Route = createFileRoute("/")({ component: HomePage });

/**
 * Home page component with item search.
 *
 * Renders a hero section with the application title and search bar,
 * followed by feature highlights explaining what the app does.
 * Uses GW2-themed styling throughout.
 *
 * @returns The home page layout
 */
function HomePage() {
  const features = [
    {
      icon: <Search className="w-10 h-10" style={{ color: 'var(--gw2-gold)' }} />,
      title: "Search Any Item",
      description:
        "Find any craftable item in Guild Wars 2 by name. We have data on over 30,000 items and 12,000 recipes.",
    },
    {
      icon: <Hammer className="w-10 h-10" style={{ color: 'var(--gw2-red-light)' }} />,
      title: "Analyze Craft Costs",
      description:
        "See the complete material breakdown with recursive recipe analysis. We calculate the cheapest way to get each material.",
    },
    {
      icon: <TrendingUp className="w-10 h-10" style={{ color: 'var(--gw2-success)' }} />,
      title: "Buy vs Craft Decision",
      description:
        "Get instant recommendations on whether to buy directly from the Trading Post or craft the item yourself.",
    },
  ];

  return (
    <div className="min-h-screen gw2-bg-pattern relative overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative py-20 px-6 text-center">
        {/* Background decorative elements */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at 50% 0%, var(--gw2-red-glow) 0%, transparent 50%)',
          }}
        />
        <div
          className="absolute top-1/4 left-0 w-64 h-64 opacity-20 blur-3xl"
          style={{ background: 'var(--gw2-gold)' }}
        />
        <div
          className="absolute bottom-1/4 right-0 w-64 h-64 opacity-20 blur-3xl"
          style={{ background: 'var(--gw2-red)' }}
        />

        <div className="relative max-w-4xl mx-auto">
          {/* Decorative top element */}
          <div className="flex justify-center mb-6">
            <div className="flex items-center gap-4">
              <div className="h-px w-16 bg-gradient-to-r from-transparent to-[var(--gw2-gold)]" />
              <Sparkles className="w-6 h-6" style={{ color: 'var(--gw2-gold)' }} />
              <div className="h-px w-16 bg-gradient-to-l from-transparent to-[var(--gw2-gold)]" />
            </div>
          </div>

          {/* Logo/Title */}
          <div className="flex flex-col items-center gap-4 mb-10">
            <div className="flex items-center gap-4">
              <div
                className="p-4 rounded-xl animate-gw2-glow"
                style={{
                  background: 'linear-gradient(135deg, var(--gw2-red) 0%, var(--gw2-red-dark) 100%)',
                  boxShadow: 'var(--gw2-shadow-red-glow)',
                }}
              >
                <Hammer className="w-12 h-12 text-white" />
              </div>
              <h1
                className="text-5xl md:text-7xl font-bold tracking-wide"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                <span style={{ color: 'var(--gw2-gold)' }} className="gw2-text-glow">GW2</span>{" "}
                <span style={{ color: 'var(--gw2-text-primary)' }}>Economist</span>
              </h1>
            </div>
            <p
              className="text-xl max-w-2xl leading-relaxed"
              style={{ color: 'var(--gw2-text-secondary)' }}
            >
              Should you <span style={{ color: 'var(--gw2-success)' }}>buy</span> or{" "}
              <span style={{ color: 'var(--gw2-red-light)' }}>craft</span>? Find the cheapest way to
              get any item in Guild Wars 2 with real-time Trading Post prices.
            </p>
          </div>

          {/* Search Bar */}
          <div className="max-w-2xl mx-auto mb-6">
            <ItemSearch
              placeholder="Search for an item... (e.g., Bolt of Silk, Deldrimor Steel)"
              autoFocus
              className="w-full"
            />
          </div>

          <p className="text-sm" style={{ color: 'var(--gw2-text-muted)' }}>
            Try searching for crafting materials, weapons, armor, or any craftable item
          </p>
        </div>
      </section>

      {/* Decorative Divider */}
      <div className="gw2-divider max-w-4xl mx-auto" />

      {/* Features Section */}
      <section className="py-16 px-6 max-w-6xl mx-auto">
        <h2
          className="text-3xl font-bold text-center mb-12"
          style={{
            fontFamily: 'var(--font-display)',
            color: 'var(--gw2-text-primary)',
          }}
        >
          Master the Trading Post
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className="gw2-card p-6 transition-all duration-300 hover:scale-[1.02]"
            >
              <div
                className="mb-4 p-3 rounded-lg inline-block"
                style={{ background: 'var(--gw2-bg-light)' }}
              >
                {feature.icon}
              </div>
              <h3
                className="text-xl font-semibold mb-3"
                style={{
                  fontFamily: 'var(--font-display)',
                  color: 'var(--gw2-text-primary)',
                }}
              >
                {feature.title}
              </h3>
              <p style={{ color: 'var(--gw2-text-secondary)' }} className="leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 px-6 max-w-4xl mx-auto">
        <h2
          className="text-3xl font-bold text-center mb-12"
          style={{
            fontFamily: 'var(--font-display)',
            color: 'var(--gw2-text-primary)',
          }}
        >
          How It Works
        </h2>

        <div className="space-y-6">
          <Step
            number={1}
            title="Search for an Item"
            description="Type the name of any item you want to craft. We'll show you matching items with their current Trading Post prices."
            icon={<Search className="w-5 h-5" />}
          />
          <Step
            number={2}
            title="View the Analysis"
            description="See a complete breakdown of materials needed, including nested recipes. We recursively analyze sub-components to find the optimal strategy."
            icon={<Shield className="w-5 h-5" />}
          />
          <Step
            number={3}
            title="Make Your Decision"
            description="Get a clear recommendation: Buy the item directly, or craft it from materials. We show you exactly how much you'll save either way."
            icon={<Swords className="w-5 h-5" />}
          />
        </div>
      </section>

      {/* Decorative Divider */}
      <div className="gw2-divider max-w-4xl mx-auto" />

      {/* Footer */}
      <footer
        className="py-8 px-6"
        style={{ borderTop: '1px solid var(--gw2-border)' }}
      >
        <div
          className="max-w-6xl mx-auto text-center text-sm"
          style={{ color: 'var(--gw2-text-muted)' }}
        >
          <p className="mb-2">
            Prices updated hourly from the GW2 Trading Post API.
          </p>
          <p style={{ color: 'var(--gw2-text-muted)', opacity: 0.7 }}>
            © 2024 GW2 Economist. Not affiliated with ArenaNet or NCSOFT.
            Guild Wars 2 and all associated logos are trademarks of NCSOFT Corporation.
          </p>
        </div>
      </footer>
    </div>
  );
}

/**
 * Step component for the "How It Works" section.
 * Features GW2-themed styling with gold numbering and decorative elements.
 *
 * @param props - Component props
 * @param props.number - Step number
 * @param props.title - Step title
 * @param props.description - Step description
 * @param props.icon - Optional icon element
 * @returns Styled step component
 */
function Step({
  number,
  title,
  description,
  icon,
}: {
  number: number;
  title: string;
  description: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex gap-6 items-start gw2-card p-6">
      {/* Step Number */}
      <div
        className="flex-shrink-0 w-14 h-14 rounded-lg flex items-center justify-center text-2xl font-bold"
        style={{
          background: 'linear-gradient(135deg, var(--gw2-gold) 0%, var(--gw2-gold-dark) 100%)',
          color: 'var(--gw2-bg-darkest)',
          fontFamily: 'var(--font-display)',
          boxShadow: 'var(--gw2-shadow-glow)',
        }}
      >
        {number}
      </div>

      {/* Step Content */}
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-2">
          {icon && (
            <span style={{ color: 'var(--gw2-gold)' }}>{icon}</span>
          )}
          <h3
            className="text-xl font-semibold"
            style={{
              fontFamily: 'var(--font-display)',
              color: 'var(--gw2-text-primary)',
            }}
          >
            {title}
          </h3>
        </div>
        <p style={{ color: 'var(--gw2-text-secondary)' }} className="leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}
