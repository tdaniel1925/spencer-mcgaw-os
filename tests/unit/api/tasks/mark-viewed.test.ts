import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "@/app/api/tasks/mark-viewed/route";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Mock dependencies
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

const mockCreateClient = vi.mocked(createClient);

describe("POST /api/tasks/mark-viewed", () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock Supabase client
    mockSupabase = {
      auth: {
        getUser: vi.fn(),
      },
      from: vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            is: vi.fn(() => ({
              select: vi.fn(),
            })),
          })),
        })),
      })),
    };

    mockCreateClient.mockResolvedValue(mockSupabase as any);
  });

  it("should mark unopened tasks as viewed for authenticated user", async () => {
    const userId = "test-user-123";
    const mockTasks = [
      { id: "task-1", title: "Task 1", first_viewed_at: null },
      { id: "task-2", title: "Task 2", first_viewed_at: null },
    ];

    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    });

    mockSupabase.from.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          is: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({
              data: mockTasks,
              error: null,
            }),
          }),
        }),
      }),
    });

    const request = new NextRequest("http://localhost:3000/api/tasks/mark-viewed", {
      method: "POST",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.count).toBe(2);
    expect(data.message).toBe("2 task(s) marked as viewed");
  });

  it("should return 401 for unauthenticated user", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const request = new NextRequest("http://localhost:3000/api/tasks/mark-viewed", {
      method: "POST",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should handle database errors gracefully", async () => {
    const userId = "test-user-123";

    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    });

    mockSupabase.from.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          is: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({
              data: null,
              error: { message: "Database error" },
            }),
          }),
        }),
      }),
    });

    const request = new NextRequest("http://localhost:3000/api/tasks/mark-viewed", {
      method: "POST",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to mark tasks as viewed");
  });

  it("should return count of 0 when no unopened tasks exist", async () => {
    const userId = "test-user-123";

    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    });

    mockSupabase.from.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          is: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      }),
    });

    const request = new NextRequest("http://localhost:3000/api/tasks/mark-viewed", {
      method: "POST",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.count).toBe(0);
  });
});
