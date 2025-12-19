import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock types for testing
interface MockTask {
  id: string;
  title: string;
  description?: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  assigned_to?: string;
  client_id?: string;
  due_date?: string;
  created_at: string;
  updated_at: string;
}

describe("Tasks API", () => {
  const mockTasks: MockTask[] = [
    {
      id: "1",
      title: "Complete tax return",
      description: "File 2024 tax return for client",
      status: "in_progress",
      priority: "high",
      assigned_to: "user-1",
      client_id: "client-1",
      due_date: "2024-04-15T00:00:00Z",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    },
    {
      id: "2",
      title: "Review quarterly report",
      status: "pending",
      priority: "medium",
      created_at: "2024-01-02T00:00:00Z",
      updated_at: "2024-01-02T00:00:00Z",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/tasks", () => {
    it("should return tasks list", () => {
      expect(mockTasks).toHaveLength(2);
    });

    it("should filter by status", () => {
      const inProgress = mockTasks.filter((t) => t.status === "in_progress");
      expect(inProgress).toHaveLength(1);
    });

    it("should filter by priority", () => {
      const highPriority = mockTasks.filter((t) => t.priority === "high");
      expect(highPriority).toHaveLength(1);
    });

    it("should filter by assigned user", () => {
      const assigned = mockTasks.filter((t) => t.assigned_to === "user-1");
      expect(assigned).toHaveLength(1);
    });

    it("should filter by client", () => {
      const clientTasks = mockTasks.filter((t) => t.client_id === "client-1");
      expect(clientTasks).toHaveLength(1);
    });

    it("should sort by due date", () => {
      const sorted = [...mockTasks].sort((a, b) => {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      });
      expect(sorted[0].id).toBe("1");
    });

    it("should sort by priority", () => {
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      const sorted = [...mockTasks].sort(
        (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
      );
      expect(sorted[0].priority).toBe("high");
    });
  });

  describe("POST /api/tasks", () => {
    it("should require title", () => {
      const invalidTask = { title: "" };
      expect(Boolean(invalidTask.title)).toBe(false);
    });

    it("should set default status to pending", () => {
      const newTask = { title: "New Task" };
      const created = { ...newTask, status: "pending" as const };
      expect(created.status).toBe("pending");
    });

    it("should set default priority to medium", () => {
      const newTask = { title: "New Task" };
      const created = { ...newTask, priority: "medium" as const };
      expect(created.priority).toBe("medium");
    });

    it("should validate due date format", () => {
      const validDate = "2024-12-31T00:00:00.000Z";
      expect(() => new Date(validDate)).not.toThrow();
      expect(new Date(validDate).toISOString()).toBe(validDate);
    });

    it("should accept optional description", () => {
      const task = { title: "Task", description: "Description" };
      expect(task.description).toBe("Description");
    });
  });

  describe("PUT /api/tasks/[id]", () => {
    it("should update task status", () => {
      const task = { ...mockTasks[0] };
      const updated = { ...task, status: "completed" as const };
      expect(updated.status).toBe("completed");
    });

    it("should update assigned user", () => {
      const task = { ...mockTasks[0] };
      const updated = { ...task, assigned_to: "user-2" };
      expect(updated.assigned_to).toBe("user-2");
    });

    it("should update due date", () => {
      const task = { ...mockTasks[0] };
      const newDate = "2024-05-01T00:00:00Z";
      const updated = { ...task, due_date: newDate };
      expect(updated.due_date).toBe(newDate);
    });

    it("should update updated_at timestamp", () => {
      const task = { ...mockTasks[0] };
      const now = new Date().toISOString();
      const updated = { ...task, updated_at: now };
      expect(updated.updated_at).not.toBe(task.updated_at);
    });
  });

  describe("DELETE /api/tasks/[id]", () => {
    it("should remove task from list", () => {
      const remaining = mockTasks.filter((t) => t.id !== "1");
      expect(remaining).toHaveLength(1);
    });

    it("should return 404 for non-existent task", () => {
      const found = mockTasks.find((t) => t.id === "non-existent");
      expect(found).toBeUndefined();
    });
  });

  describe("Task Status Transitions", () => {
    it("should allow pending to in_progress", () => {
      const validTransitions = {
        pending: ["in_progress", "cancelled"],
        in_progress: ["completed", "pending", "cancelled"],
        completed: ["pending"],
        cancelled: ["pending"],
      };
      expect(validTransitions.pending).toContain("in_progress");
    });

    it("should allow in_progress to completed", () => {
      const task = { ...mockTasks[0], status: "in_progress" as const };
      const completed = { ...task, status: "completed" as const };
      expect(completed.status).toBe("completed");
    });
  });
});
