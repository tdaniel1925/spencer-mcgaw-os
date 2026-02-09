/**
 * Unit Tests for Dashboard Components
 * Tests DashboardMetrics, TasksNeedingAttention, ActivityFeed, etc.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DashboardMetrics } from "@/components/dashboard/DashboardMetrics";
import { TasksNeedingAttention } from "@/components/dashboard/TasksNeedingAttention";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { RecentlyCompleted } from "@/components/dashboard/RecentlyCompleted";
import { QuickActions } from "@/components/dashboard/QuickActions";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe("DashboardMetrics Component", () => {
  const defaultStats = {
    overdue: 5,
    dueToday: 3,
    inProgress: 10,
  };

  it("renders all three metrics", () => {
    render(<DashboardMetrics stats={defaultStats} />);

    expect(screen.getByText("Overdue")).toBeInTheDocument();
    expect(screen.getByText("Due Today")).toBeInTheDocument();
    expect(screen.getByText("In Progress")).toBeInTheDocument();
  });

  it("displays correct numbers", () => {
    render(<DashboardMetrics stats={defaultStats} />);

    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("highlights overdue tasks in red when count > 0", () => {
    const { container } = render(<DashboardMetrics stats={defaultStats} />);

    const overdueCard = container.querySelector(".border-red-200");
    expect(overdueCard).toBeInTheDocument();
  });

  it("highlights due today tasks in amber when count > 0", () => {
    const { container } = render(<DashboardMetrics stats={defaultStats} />);

    const dueTodayCard = container.querySelector(".border-amber-200");
    expect(dueTodayCard).toBeInTheDocument();
  });

  it("shows loading skeletons when loading", () => {
    const { container } = render(<DashboardMetrics stats={defaultStats} loading />);

    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("is clickable and navigates", () => {
    const { container } = render(<DashboardMetrics stats={defaultStats} />);

    const cards = container.querySelectorAll(".cursor-pointer");
    expect(cards.length).toBe(3);
  });
});

describe("TasksNeedingAttention Component", () => {
  const mockTasks = [
    {
      id: "1",
      title: "Review tax documents",
      priority: "urgent" as const,
      due_date: "2024-01-20",
      status: "open",
    },
    {
      id: "2",
      title: "Prepare financial statements",
      priority: "high" as const,
      due_date: "2024-01-25",
      status: "in_progress",
    },
  ];

  it("renders task list", () => {
    render(
      <TasksNeedingAttention
        tasks={mockTasks}
        onTaskClick={() => {}}
        onViewAll={() => {}}
      />
    );

    expect(screen.getByText("Review tax documents")).toBeInTheDocument();
    expect(screen.getByText("Prepare financial statements")).toBeInTheDocument();
  });

  it("shows task count badge", () => {
    render(
      <TasksNeedingAttention
        tasks={mockTasks}
        onTaskClick={() => {}}
        onViewAll={() => {}}
      />
    );

    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("calls onTaskClick when task is clicked", () => {
    const handleClick = vi.fn();
    render(
      <TasksNeedingAttention
        tasks={mockTasks}
        onTaskClick={handleClick}
        onViewAll={() => {}}
      />
    );

    const taskButton = screen.getByText("Review tax documents");
    fireEvent.click(taskButton);

    expect(handleClick).toHaveBeenCalledWith(mockTasks[0]);
  });

  it("calls onViewAll when View all is clicked", () => {
    const handleViewAll = vi.fn();
    render(
      <TasksNeedingAttention
        tasks={mockTasks}
        onTaskClick={() => {}}
        onViewAll={handleViewAll}
      />
    );

    const viewAllButton = screen.getByText("View all");
    fireEvent.click(viewAllButton);

    expect(handleViewAll).toHaveBeenCalled();
  });

  it("shows empty state when no tasks", () => {
    render(
      <TasksNeedingAttention
        tasks={[]}
        onTaskClick={() => {}}
        onViewAll={() => {}}
      />
    );

    expect(screen.getByText("You're all caught up")).toBeInTheDocument();
  });

  it("shows loading skeletons when loading", () => {
    const { container } = render(
      <TasksNeedingAttention
        tasks={[]}
        loading
        onTaskClick={() => {}}
        onViewAll={() => {}}
      />
    );

    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("displays priority badges", () => {
    render(
      <TasksNeedingAttention
        tasks={mockTasks}
        onTaskClick={() => {}}
        onViewAll={() => {}}
      />
    );

    expect(screen.getByText("Urgent")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
  });
});

describe("ActivityFeed Component", () => {
  const mockActivities = [
    {
      id: "1",
      type: "task_created" as const,
      description: "created a new task",
      user_name: "John Doe",
      created_at: new Date().toISOString(),
    },
    {
      id: "2",
      type: "task_completed" as const,
      description: "completed a task",
      user_name: "Jane Smith",
      created_at: new Date().toISOString(),
    },
  ];

  it("renders activity list", () => {
    render(<ActivityFeed activities={mockActivities} />);

    expect(screen.getByText(/John Doe/)).toBeInTheDocument();
    expect(screen.getByText(/Jane Smith/)).toBeInTheDocument();
  });

  it("shows empty state when no activities", () => {
    render(<ActivityFeed activities={[]} />);

    expect(screen.getByText("No recent activity to display")).toBeInTheDocument();
  });

  it("shows loading skeletons when loading", () => {
    const { container } = render(<ActivityFeed activities={[]} loading />);

    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("displays activity icons", () => {
    const { container } = render(<ActivityFeed activities={mockActivities} />);

    const icons = container.querySelectorAll("svg");
    expect(icons.length).toBeGreaterThan(0);
  });
});

describe("RecentlyCompleted Component", () => {
  const mockTasks = [
    { id: "1", title: "Tax return filed" },
    { id: "2", title: "Quarterly report completed" },
  ];

  it("renders completed tasks", () => {
    render(
      <RecentlyCompleted
        tasks={mockTasks}
        onTaskClick={() => {}}
      />
    );

    expect(screen.getByText("Tax return filed")).toBeInTheDocument();
    expect(screen.getByText("Quarterly report completed")).toBeInTheDocument();
  });

  it("calls onTaskClick when task is clicked", () => {
    const handleClick = vi.fn();
    render(
      <RecentlyCompleted
        tasks={mockTasks}
        onTaskClick={handleClick}
      />
    );

    const taskButton = screen.getByText("Tax return filed");
    fireEvent.click(taskButton);

    expect(handleClick).toHaveBeenCalledWith(mockTasks[0]);
  });

  it("does not render when no tasks", () => {
    const { container } = render(
      <RecentlyCompleted
        tasks={[]}
        onTaskClick={() => {}}
      />
    );

    expect(container.firstChild).toBeNull();
  });
});

describe("QuickActions Component", () => {
  it("renders all action buttons", () => {
    render(<QuickActions onCreateTask={() => {}} />);

    expect(screen.getByText("Create Task")).toBeInTheDocument();
    expect(screen.getByText("Add Client")).toBeInTheDocument();
    expect(screen.getByText("Log Call")).toBeInTheDocument();
    expect(screen.getByText("Send Email")).toBeInTheDocument();
  });

  it("calls onCreateTask when Create Task is clicked", () => {
    const handleCreate = vi.fn();
    render(<QuickActions onCreateTask={handleCreate} />);

    const createButton = screen.getByText("Create Task");
    fireEvent.click(createButton);

    expect(handleCreate).toHaveBeenCalled();
  });

  it("has navigation links for other actions", () => {
    const { container } = render(<QuickActions onCreateTask={() => {}} />);

    const links = container.querySelectorAll("a");
    expect(links.length).toBe(3); // Add Client, Log Call, Send Email
  });
});
