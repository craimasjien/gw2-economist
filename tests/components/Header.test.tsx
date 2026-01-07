/**
 * @fileoverview Unit tests for the Header component.
 *
 * Tests the header navigation, slide-out drawer functionality,
 * menu interactions, and collapsible sub-menu behavior.
 * Updated for GW2-themed styling.
 *
 * @module tests/components/Header.test
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Mock TanStack Router's Link component
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    onClick,
    className,
    activeProps,
    style,
    onMouseEnter,
    onMouseLeave,
    ...props
  }: {
    children: React.ReactNode;
    to: string;
    onClick?: () => void;
    className?: string;
    activeProps?: { className?: string; style?: React.CSSProperties };
    style?: React.CSSProperties;
    onMouseEnter?: React.MouseEventHandler;
    onMouseLeave?: React.MouseEventHandler;
  }) => (
    <a
      href={to}
      onClick={onClick}
      className={className}
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      {...props}
    >
      {children}
    </a>
  ),
}));

import Header from "../../src/components/Header";

describe("Header", () => {
  describe("rendering", () => {
    it("should render the header with menu button", () => {
      render(<Header />);

      expect(
        screen.getByRole("button", { name: /open menu/i })
      ).toBeInTheDocument();
    });

    it("should render the brand/logo text", () => {
      render(<Header />);

      // Check for GW2 Economist branding (updated from TanStack logo)
      expect(screen.getByText("GW2")).toBeInTheDocument();
      expect(screen.getByText("Economist")).toBeInTheDocument();
    });

    it("should have the navigation drawer closed by default", () => {
      render(<Header />);

      const aside = document.querySelector("aside");
      expect(aside).toHaveClass("-translate-x-full");
    });
  });

  describe("menu interactions", () => {
    it("should open the drawer when menu button is clicked", () => {
      render(<Header />);

      const menuButton = screen.getByRole("button", { name: /open menu/i });
      fireEvent.click(menuButton);

      const aside = document.querySelector("aside");
      expect(aside).toHaveClass("translate-x-0");
    });

    it("should close the drawer when close button is clicked", () => {
      render(<Header />);

      // Open the menu first
      const menuButton = screen.getByRole("button", { name: /open menu/i });
      fireEvent.click(menuButton);

      // Close the menu
      const closeButton = screen.getByRole("button", { name: /close menu/i });
      fireEvent.click(closeButton);

      const aside = document.querySelector("aside");
      expect(aside).toHaveClass("-translate-x-full");
    });

    it("should display navigation title when drawer is open", () => {
      render(<Header />);

      const menuButton = screen.getByRole("button", { name: /open menu/i });
      fireEvent.click(menuButton);

      expect(screen.getByText("Navigation")).toBeInTheDocument();
    });
  });

  describe("navigation links", () => {
    it("should display Home link", () => {
      render(<Header />);

      const menuButton = screen.getByRole("button", { name: /open menu/i });
      fireEvent.click(menuButton);

      expect(screen.getByText("Home")).toBeInTheDocument();
    });

    it("should display Server Functions link", () => {
      render(<Header />);

      const menuButton = screen.getByRole("button", { name: /open menu/i });
      fireEvent.click(menuButton);

      // Updated to match new navigation link text
      expect(screen.getByText("Server Functions")).toBeInTheDocument();
    });

    it("should display API Request link", () => {
      render(<Header />);

      const menuButton = screen.getByRole("button", { name: /open menu/i });
      fireEvent.click(menuButton);

      expect(screen.getByText("API Request")).toBeInTheDocument();
    });

    it("should display SSR Demos link", () => {
      render(<Header />);

      const menuButton = screen.getByRole("button", { name: /open menu/i });
      fireEvent.click(menuButton);

      expect(screen.getByText("SSR Demos")).toBeInTheDocument();
    });

    it("should close drawer when a link is clicked", () => {
      render(<Header />);

      // Open the menu
      const menuButton = screen.getByRole("button", { name: /open menu/i });
      fireEvent.click(menuButton);

      // Click a link
      fireEvent.click(screen.getByText("Home"));

      const aside = document.querySelector("aside");
      expect(aside).toHaveClass("-translate-x-full");
    });
  });

  describe("collapsible sub-menus", () => {
    it("should not show SSR sub-menu items by default", () => {
      render(<Header />);

      const menuButton = screen.getByRole("button", { name: /open menu/i });
      fireEvent.click(menuButton);

      expect(screen.queryByText("SPA Mode")).not.toBeInTheDocument();
      expect(screen.queryByText("Full SSR")).not.toBeInTheDocument();
      expect(screen.queryByText("Data Only")).not.toBeInTheDocument();
    });

    it("should expand SSR sub-menu when chevron is clicked", () => {
      render(<Header />);

      const menuButton = screen.getByRole("button", { name: /open menu/i });
      fireEvent.click(menuButton);

      // Find the expand button (it's the button without aria-label after the SSR Demos link)
      const buttons = screen.getAllByRole("button");
      const expandButton = buttons.find(
        (btn) =>
          !btn.getAttribute("aria-label") &&
          btn !== menuButton &&
          btn.querySelector("svg")
      );

      expect(expandButton).toBeDefined();
      if (expandButton) {
        fireEvent.click(expandButton);

        expect(screen.getByText("SPA Mode")).toBeInTheDocument();
        expect(screen.getByText("Full SSR")).toBeInTheDocument();
        expect(screen.getByText("Data Only")).toBeInTheDocument();
      }
    });

    it("should collapse SSR sub-menu when chevron is clicked twice", () => {
      render(<Header />);

      const menuButton = screen.getByRole("button", { name: /open menu/i });
      fireEvent.click(menuButton);

      const buttons = screen.getAllByRole("button");
      const expandButton = buttons.find(
        (btn) =>
          !btn.getAttribute("aria-label") &&
          btn !== menuButton &&
          btn.querySelector("svg")
      );

      if (expandButton) {
        // Expand
        fireEvent.click(expandButton);
        expect(screen.getByText("SPA Mode")).toBeInTheDocument();

        // Collapse
        fireEvent.click(expandButton);
        expect(screen.queryByText("SPA Mode")).not.toBeInTheDocument();
      }
    });
  });
});
