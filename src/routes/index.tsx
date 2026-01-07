/**
 * @fileoverview Home page with item search for the GW2 Economist application.
 *
 * This module defines the index route ('/') which provides a search interface
 * for finding GW2 items and analyzing their craft costs. Users can search for
 * items and navigate to the detail page for full craft analysis.
 *
 * @module routes/index
 */

import { createFileRoute } from "@tanstack/react-router";
import { Hammer, TrendingUp, Search } from "lucide-react";
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
 *
 * @returns The home page layout
 */
function HomePage() {
  const features = [
    {
      icon: <Search className="w-10 h-10 text-cyan-400" />,
      title: "Search Any Item",
      description:
        "Find any craftable item in Guild Wars 2 by name. We have data on over 30,000 items and 12,000 recipes.",
    },
    {
      icon: <Hammer className="w-10 h-10 text-indigo-400" />,
      title: "Analyze Craft Costs",
      description:
        "See the complete material breakdown with recursive recipe analysis. We calculate the cheapest way to get each material.",
    },
    {
      icon: <TrendingUp className="w-10 h-10 text-emerald-400" />,
      title: "Buy vs Craft Decision",
      description:
        "Get instant recommendations on whether to buy directly from the Trading Post or craft the item yourself.",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Hero Section */}
      <section className="relative py-20 px-6 text-center">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-cyan-500/10 to-emerald-500/10" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl" />

        <div className="relative max-w-4xl mx-auto">
          {/* Logo/Title */}
          <div className="flex flex-col items-center gap-4 mb-8">
            <div className="flex items-center gap-3">
              <Hammer className="w-12 h-12 text-cyan-400" />
              <h1 className="text-5xl md:text-6xl font-black text-white tracking-tight">
                <span className="text-gray-300">GW2</span>{" "}
                <span className="bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
                  Economist
                </span>
              </h1>
            </div>
            <p className="text-xl text-gray-400 max-w-2xl">
              Should you buy or craft? Find the cheapest way to get any item in
              Guild Wars 2 with real-time Trading Post prices.
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

          <p className="text-sm text-gray-500">
            Try searching for crafting materials, weapons, armor, or any
            craftable item
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-6 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6 hover:border-cyan-500/50 transition-all duration-300"
            >
              <div className="mb-4">{feature.icon}</div>
              <h3 className="text-xl font-semibold text-white mb-3">
                {feature.title}
              </h3>
              <p className="text-gray-400 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 px-6 max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-white text-center mb-12">
          How It Works
        </h2>

        <div className="space-y-8">
          <Step
            number={1}
            title="Search for an Item"
            description="Type the name of any item you want to craft. We'll show you matching items with their current Trading Post prices."
          />
          <Step
            number={2}
            title="View the Analysis"
            description="See a complete breakdown of materials needed, including nested recipes. We recursively analyze sub-components to find the optimal strategy."
          />
          <Step
            number={3}
            title="Make Your Decision"
            description="Get a clear recommendation: Buy the item directly, or craft it from materials. We show you exactly how much you'll save either way."
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-slate-800">
        <div className="max-w-6xl mx-auto text-center text-gray-500 text-sm">
          <p>
            Prices updated hourly from the GW2 Trading Post API. Not affiliated
            with ArenaNet.
          </p>
        </div>
      </footer>
    </div>
  );
}

/**
 * Step component for the "How It Works" section.
 */
function Step({
  number,
  title,
  description,
}: {
  number: number;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-6 items-start">
      <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center text-white font-bold text-xl">
        {number}
      </div>
      <div>
        <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
        <p className="text-gray-400">{description}</p>
      </div>
    </div>
  );
}
