import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useUnopenedTasksCount } from "@/hooks/use-unopened-tasks-count";

// Mock dependencies
vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/auth-context", () => ({
  useAuth: vi.fn(),
}));

describe("useUnopenedTasksCount", () => {
  let mockSupabase: any;
  let mockUseAuth: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock channel for real-time subscription
    const mockChannel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      unsubscribe: vi.fn(),
    };

    // Setup mock Supabase client
    mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            is: vi.fn(() => ({
              neq: vi.fn(() => ({
                count: 0,
                error: null,
              })),
            })),
          })),
        })),
      })),
      channel: vi.fn(() => mockChannel),
    };

    const { createClient } = require("@/lib/supabase/client");
    createClient.mockReturnValue(mockSupabase);

    mockUseAuth = require("@/lib/supabase/auth-context").useAuth;
  });

  it("should return count of 0 when no user is authenticated", async () => {
    mockUseAuth.mockReturnValue({ user: null });

    const { result } = renderHook(() => useUnopenedTasksCount());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.count).toBe(0);
  });

  it("should fetch unopened tasks count for authenticated user", async () => {
    const userId = "test-user-123";
    mockUseAuth.mockReturnValue({ user: { id: userId } });

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          is: vi.fn().mockReturnValue({
            neq: vi.fn().mockResolvedValue({
              count: 5,
              error: null,
            }),
          }),
        }),
      }),
    });

    const { result } = renderHook(() => useUnopenedTasksCount());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.count).toBe(5);
  });

  it("should handle database errors gracefully", async () => {
    const userId = "test-user-123";
    mockUseAuth.mockReturnValue({ user: { id: userId } });

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          is: vi.fn().mockReturnValue({
            neq: vi.fn().mockResolvedValue({
              count: null,
              error: { message: "Database error" },
            }),
          }),
        }),
      }),
    });

    const { result } = renderHook(() => useUnopenedTasksCount());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.count).toBe(0);
  });

  it("should start with loading state as true", () => {
    const userId = "test-user-123";
    mockUseAuth.mockReturnValue({ user: { id: userId } });

    const { result } = renderHook(() => useUnopenedTasksCount());

    expect(result.current.loading).toBe(true);
  });

  it("should subscribe to real-time updates", () => {
    const userId = "test-user-123";
    mockUseAuth.mockReturnValue({ user: { id: userId } });

    renderHook(() => useUnopenedTasksCount());

    expect(mockSupabase.channel).toHaveBeenCalledWith("unopened-tasks-count");
  });
});
