/**
 * Tasks Needing Attention Component
 * Shows high-priority tasks that require immediate attention
 */

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ListTodo,
  ChevronRight,
  Clock,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { cn, safeFormatDistanceToNow, safeFormatDate } from "@/lib/utils";
import { isToday, isPast } from "date-fns";

interface Task {
  id: string;
  title: string;
  priority: "urgent" | "high" | "medium" | "low";
  due_date: string | null;
  status: string;
  [key: string]: any; // Allow additional properties
}

interface TasksNeedingAttentionProps {
  tasks: Task[];
  loading?: boolean;
  onTaskClick: (task: any) => void;
  onViewAll: () => void;
}

const priorityColors = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-blue-500",
  low: "bg-slate-400",
};

export function TasksNeedingAttention({
  tasks,
  loading = false,
  onTaskClick,
  onViewAll,
}: TasksNeedingAttentionProps) {
  if (loading) {
    return (
      <Card className="border-border/50 lg:col-span-2">
        <CardContent className="p-0">
          <div className="flex items-center justify-between p-3 border-b">
            <div className="flex items-center gap-2">
              <ListTodo className="h-4 w-4 text-primary" />
              <h2 className="font-medium text-sm">Needs Attention</h2>
            </div>
          </div>
          <div className="p-3 space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 lg:col-span-2">
      <CardContent className="p-0">
        <div className="flex items-center justify-between p-3 border-b">
          <div className="flex items-center gap-2">
            <ListTodo className="h-4 w-4 text-primary" />
            <h2 className="font-medium text-sm">Needs Attention</h2>
            <Badge variant="secondary" className="text-[10px]">
              {tasks.length}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onViewAll}
            className="h-7 text-xs text-muted-foreground hover:text-foreground"
          >
            View all
            <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </div>

        {tasks.length === 0 ? (
          <div className="py-12 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-3" />
            <p className="font-medium text-foreground">You're all caught up</p>
            <p className="text-sm text-muted-foreground mt-1">
              No urgent tasks at the moment
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {tasks.map((task) => {
              const isOverdue =
                task.due_date &&
                isPast(new Date(task.due_date)) &&
                !isToday(new Date(task.due_date));
              const isDueToday = task.due_date && isToday(new Date(task.due_date));

              return (
                <button
                  key={task.id}
                  onClick={() => onTaskClick(task)}
                  className={cn(
                    "w-full p-3 text-left transition-colors group hover:bg-muted/50",
                    isOverdue && "bg-red-50/30",
                    isDueToday && !isOverdue && "bg-amber-50/30"
                  )}
                >
                  <div className="flex items-start gap-3">
                    {/* Priority indicator */}
                    <div
                      className={cn(
                        "w-1 self-stretch rounded-full flex-shrink-0",
                        priorityColors[task.priority]
                      )}
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm text-foreground truncate">
                          {task.title}
                        </p>
                        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                      </div>

                      <div className="flex items-center gap-2 mt-1 text-xs">
                        {task.due_date && (
                          <span
                            className={cn(
                              "flex items-center gap-1",
                              isOverdue && "text-red-600 font-medium",
                              isDueToday && !isOverdue && "text-amber-600"
                            )}
                          >
                            <Clock className="h-3 w-3" />
                            {isOverdue
                              ? `${safeFormatDistanceToNow(task.due_date)} overdue`
                              : isDueToday
                                ? "Due today"
                                : safeFormatDate(task.due_date, "MMM d") || "Unknown"}
                          </span>
                        )}

                        {task.priority === "urgent" && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700 border-red-200"
                          >
                            Urgent
                          </Badge>
                        )}
                        {task.priority === "high" && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 bg-orange-100 text-orange-700 border-orange-200"
                          >
                            High
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
