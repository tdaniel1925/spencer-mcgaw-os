/**
 * Unit Tests for LoadingSkeleton Component
 * Tests different skeleton types and configurations
 */

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import {
  LoadingSkeleton,
  TaskListSkeleton,
  ClientListSkeleton,
  EmailListSkeleton,
} from "@/components/ui/loading-skeleton";

describe("LoadingSkeleton Component", () => {
  describe("Task Card Skeleton", () => {
    it("renders task-card skeleton", () => {
      const { container } = render(
        <LoadingSkeleton type="task-card" count={1} />
      );

      expect(container.firstChild).toBeInTheDocument();
    });

    it("renders multiple task-card skeletons", () => {
      const { container } = render(
        <LoadingSkeleton type="task-card" count={3} />
      );

      const children = container.firstChild?.childNodes;
      expect(children).toHaveLength(3);
    });
  });

  describe("Task Row Skeleton", () => {
    it("renders task-row skeleton", () => {
      const { container } = render(
        <LoadingSkeleton type="task-row" count={1} />
      );

      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe("Client Row Skeleton", () => {
    it("renders client-row skeleton", () => {
      const { container } = render(
        <LoadingSkeleton type="client-row" count={1} />
      );

      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe("Email Item Skeleton", () => {
    it("renders email-item skeleton", () => {
      const { container } = render(
        <LoadingSkeleton type="email-item" count={1} />
      );

      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe("Metric Card Skeleton", () => {
    it("renders metric-card skeleton", () => {
      const { container } = render(
        <LoadingSkeleton type="metric-card" count={1} />
      );

      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe("Activity Item Skeleton", () => {
    it("renders activity-item skeleton", () => {
      const { container } = render(
        <LoadingSkeleton type="activity-item" count={1} />
      );

      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe("Table Row Skeleton", () => {
    it("renders table-row skeleton", () => {
      const { container } = render(
        <LoadingSkeleton type="table-row" count={1} />
      );

      expect(container.firstChild).toBeInTheDocument();
    });

    it("renders multiple table rows", () => {
      const { container } = render(
        <LoadingSkeleton type="table-row" count={5} />
      );

      // Count the skeleton rows (they might be divs, not tr elements)
      const children = container.firstChild?.childNodes;
      expect(children).toHaveLength(5);
    });
  });

  describe("Form Skeleton", () => {
    it("renders form skeleton", () => {
      const { container } = render(
        <LoadingSkeleton type="form" />
      );

      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe("Profile Header Skeleton", () => {
    it("renders profile-header skeleton", () => {
      const { container } = render(
        <LoadingSkeleton type="profile-header" />
      );

      expect(container.firstChild).toBeInTheDocument();
    });
  });
});

describe("Skeleton Helpers", () => {
  describe("TaskListSkeleton", () => {
    it("renders with default count", () => {
      const { container } = render(<TaskListSkeleton />);
      const children = container.firstChild?.childNodes;
      expect(children).toHaveLength(5);
    });

    it("renders with custom count", () => {
      const { container } = render(<TaskListSkeleton count={10} />);
      const children = container.firstChild?.childNodes;
      expect(children).toHaveLength(10);
    });
  });

  describe("ClientListSkeleton", () => {
    it("renders with default count", () => {
      const { container } = render(<ClientListSkeleton />);
      const children = container.firstChild?.childNodes;
      expect(children).toHaveLength(5);
    });

    it("renders with custom count", () => {
      const { container } = render(<ClientListSkeleton count={8} />);
      const children = container.firstChild?.childNodes;
      expect(children).toHaveLength(8);
    });
  });

  describe("EmailListSkeleton", () => {
    it("renders with default count", () => {
      const { container } = render(<EmailListSkeleton />);
      const children = container.firstChild?.childNodes;
      expect(children).toHaveLength(5);
    });

    it("renders with custom count", () => {
      const { container } = render(<EmailListSkeleton count={12} />);
      const children = container.firstChild?.childNodes;
      expect(children).toHaveLength(12);
    });
  });
});

describe("Animation", () => {
  it("has animation classes", () => {
    const { container } = render(
      <LoadingSkeleton type="task-card" count={1} />
    );

    const skeleton = container.querySelector(".animate-pulse");
    expect(skeleton).toBeInTheDocument();
  });
});
