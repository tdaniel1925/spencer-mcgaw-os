/**
 * Unit Tests for EmptyState Component
 * Tests rendering, actions, and different configurations
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EmptyState } from "@/components/ui/empty-state";
import { Users } from "lucide-react";

describe("EmptyState Component", () => {
  describe("Rendering", () => {
    it("renders with title and description", () => {
      render(
        <EmptyState
          icon={Users}
          title="No clients yet"
          description="Add your first client to get started"
        />
      );

      expect(screen.getByText("No clients yet")).toBeInTheDocument();
      expect(screen.getByText("Add your first client to get started")).toBeInTheDocument();
    });

    it("renders icon", () => {
      const { container } = render(
        <EmptyState
          icon={Users}
          title="No clients"
          description="Get started"
        />
      );

      // Icon should be rendered (check for svg)
      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("renders without card when showCard is false", () => {
      const { container } = render(
        <EmptyState
          icon={Users}
          title="No clients"
          description="Get started"
          showCard={false}
        />
      );

      // Should not have card classes
      expect(container.firstChild).not.toHaveClass("border");
    });
  });

  describe("Actions", () => {
    it("renders primary action button", () => {
      const handleClick = vi.fn();
      render(
        <EmptyState
          icon={Users}
          title="No clients"
          description="Get started"
          action={
            <button onClick={handleClick}>Add Client</button>
          }
        />
      );

      const button = screen.getByText("Add Client");
      expect(button).toBeInTheDocument();

      fireEvent.click(button);
      expect(handleClick).toHaveBeenCalled();
    });

    it("renders secondary action button", () => {
      render(
        <EmptyState
          icon={Users}
          title="No clients"
          description="Get started"
          action={<button>Add Client</button>}
          secondaryAction={<button>Import</button>}
        />
      );

      expect(screen.getByText("Add Client")).toBeInTheDocument();
      expect(screen.getByText("Import")).toBeInTheDocument();
    });
  });

  describe("Tips", () => {
    it("renders tip when provided", () => {
      render(
        <EmptyState
          icon={Users}
          title="No clients"
          description="Get started"
          tip="💡 Clients help organize your work"
        />
      );

      expect(screen.getByText("💡 Clients help organize your work")).toBeInTheDocument();
    });

    it("does not render tip section when not provided", () => {
      const { container } = render(
        <EmptyState
          icon={Users}
          title="No clients"
          description="Get started"
        />
      );

      // Tip paragraph should not exist
      const tipElements = container.querySelectorAll("p.text-blue-600");
      expect(tipElements.length).toBe(0);
    });
  });

  describe("Sizes", () => {
    it("renders small size", () => {
      const { container } = render(
        <EmptyState
          icon={Users}
          title="No clients"
          description="Get started"
          size="sm"
        />
      );

      // Check for small icon size (actual size is h-10 w-10)
      const svg = container.querySelector("svg");
      expect(svg).toHaveClass("h-10", "w-10");
    });

    it("renders medium size (default)", () => {
      const { container } = render(
        <EmptyState
          icon={Users}
          title="No clients"
          description="Get started"
        />
      );

      const svg = container.querySelector("svg");
      expect(svg).toHaveClass("h-12", "w-12");
    });

    it("renders large size", () => {
      const { container } = render(
        <EmptyState
          icon={Users}
          title="No clients"
          description="Get started"
          size="lg"
        />
      );

      const svg = container.querySelector("svg");
      expect(svg).toHaveClass("h-16", "w-16");
    });
  });

  describe("Accessibility", () => {
    it("has proper heading hierarchy", () => {
      render(
        <EmptyState
          icon={Users}
          title="No clients"
          description="Get started"
        />
      );

      const heading = screen.getByRole("heading", { level: 3 });
      expect(heading).toHaveTextContent("No clients");
    });

    it("description is readable by screen readers", () => {
      render(
        <EmptyState
          icon={Users}
          title="No clients"
          description="Add your first client to get started"
        />
      );

      const description = screen.getByText("Add your first client to get started");
      expect(description).toBeInTheDocument();
    });
  });
});
