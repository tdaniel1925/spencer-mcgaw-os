import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tasks, clients, users } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { eq, isNotNull, and, gte, lte, ne } from "drizzle-orm";

/**
 * GET /api/calendar/task-deadlines
 *
 * Returns tasks with due dates formatted as calendar events.
 * These appear on the calendar as deadline events.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("start");
  const endDate = searchParams.get("end");

  try {
    // Build query conditions
    const conditions = [
      isNotNull(tasks.dueDate),
      ne(tasks.status, "completed"), // Don't show completed tasks
    ];

    // Filter by date range if provided
    if (startDate) {
      conditions.push(gte(tasks.dueDate, new Date(startDate)));
    }
    if (endDate) {
      conditions.push(lte(tasks.dueDate, new Date(endDate)));
    }

    // Fetch tasks with due dates, including related client and assigned user
    const tasksWithDueDates = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        description: tasks.description,
        status: tasks.status,
        priority: tasks.priority,
        dueDate: tasks.dueDate,
        clientId: tasks.clientId,
        clientFirstName: clients.firstName,
        clientLastName: clients.lastName,
        assignedToId: tasks.assignedTo,
        assignedToName: users.fullName,
        createdAt: tasks.createdAt,
      })
      .from(tasks)
      .leftJoin(clients, eq(tasks.clientId, clients.id))
      .leftJoin(users, eq(tasks.assignedTo, users.id))
      .where(and(...conditions))
      .orderBy(tasks.dueDate);

    // Transform tasks to calendar event format
    const events = tasksWithDueDates.map((task) => {
      // Get color based on priority
      let color = "bg-amber-500"; // default for medium
      if (task.priority === "high" || task.priority === "urgent") {
        color = "bg-red-500";
      } else if (task.priority === "low") {
        color = "bg-gray-500";
      }

      // Check if overdue
      const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();
      if (isOverdue) {
        color = "bg-red-600";
      }

      const dueDate = task.dueDate ? new Date(task.dueDate) : new Date();

      // Build client name from first and last name
      const clientName = task.clientFirstName && task.clientLastName
        ? `${task.clientFirstName} ${task.clientLastName}`
        : task.clientFirstName || task.clientLastName || undefined;

      return {
        id: `task-${task.id}`,
        taskId: task.id, // Keep reference to original task
        provider: "local" as const,
        title: `📋 ${task.title}`,
        description: task.description || undefined,
        startTime: dueDate.toISOString(),
        endTime: dueDate.toISOString(), // Deadlines are point-in-time
        allDay: true, // Task deadlines show as all-day events
        category: "deadline" as const,
        color,
        priority: task.priority,
        status: task.status,
        isOverdue,
        clientId: task.clientId || undefined,
        clientName,
        assignedToId: task.assignedToId || undefined,
        assignedToName: task.assignedToName || undefined,
        createdAt: task.createdAt?.toISOString(),
        isTaskDeadline: true, // Flag to identify these as task deadlines
      };
    });

    return NextResponse.json({ events });
  } catch (error) {
    console.error("Error fetching task deadlines:", error);
    return NextResponse.json(
      { error: "Failed to fetch task deadlines" },
      { status: 500 }
    );
  }
}
