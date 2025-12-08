"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertCircle,
  Clock,
  ChevronRight,
  User,
  Calendar,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";

interface Task {
  id: string;
  title: string;
  description?: string;
  priority: "urgent" | "high" | "medium" | "low";
  due_date?: string;
  client_name?: string;
  status: string;
  action_type?: {
    label: string;
    color: string;
  };
}

interface PriorityTasksProps {
  tasks: Task[];
  loading?: boolean;
  onCompleteTask?: (taskId: string) => void;
  maxItems?: number;
}

const priorityConfig = {
  urgent: { label: "Urgent", color: "bg-red-100 text-red-700 border-red-200" },
  high: { label: "High", color: "bg-orange-100 text-orange-700 border-orange-200" },
  medium: { label: "Medium", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  low: { label: "Low", color: "bg-green-100 text-green-700 border-green-200" },
};

const priorityDotColors = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-green-500",
};

export function PriorityTasks({
  tasks,
  loading = false,
  onCompleteTask,
  maxItems = 5,
}: PriorityTasksProps) {
  const router = useRouter();
  const [completingTasks, setCompletingTasks] = useState<Set<string>>(new Set());

  const handleComplete = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onCompleteTask) {
      setCompletingTasks(prev => new Set([...prev, taskId]));
      await onCompleteTask(taskId);
      setCompletingTasks(prev => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  };

  const displayTasks = tasks.slice(0, maxItems);

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-500" />
            Priority Tasks
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => router.push("/taskpool")}
          >
            View All
            <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : displayTasks.length > 0 ? (
          <>
            {displayTasks.map((task) => {
              const isCompleting = completingTasks.has(task.id);
              const isOverdue = task.due_date && new Date(task.due_date) < new Date();

              return (
                <div
                  key={task.id}
                  onClick={() => router.push("/taskpool")}
                  className={cn(
                    "group flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                    "hover:shadow-sm hover:border-primary/30",
                    isOverdue && "border-red-200 bg-red-50/50"
                  )}
                >
                  {/* Priority indicator */}
                  <div className={cn(
                    "w-1 self-stretch rounded-full flex-shrink-0 mt-1",
                    priorityDotColors[task.priority]
                  )} />

                  {/* Checkbox */}
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="flex-shrink-0 mt-0.5"
                  >
                    {isCompleting ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      <Checkbox
                        checked={false}
                        onCheckedChange={() => handleComplete(task.id, { stopPropagation: () => {} } as React.MouseEvent)}
                        className="data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                      />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-sm line-clamp-1">{task.title}</p>
                      <Badge
                        variant="secondary"
                        className={cn("text-[10px] px-1.5 py-0 flex-shrink-0", priorityConfig[task.priority].color)}
                      >
                        {priorityConfig[task.priority].label}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                      {task.client_name && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span className="truncate max-w-[100px]">{task.client_name}</span>
                        </span>
                      )}
                      {task.due_date && (
                        <span className={cn(
                          "flex items-center gap-1",
                          isOverdue && "text-red-600 font-medium"
                        )}>
                          <Calendar className="h-3 w-3" />
                          {isOverdue
                            ? `Overdue ${formatDistanceToNow(new Date(task.due_date))}`
                            : format(new Date(task.due_date), "MMM d")
                          }
                        </span>
                      )}
                      {task.action_type && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0"
                          style={{ borderColor: task.action_type.color, color: task.action_type.color }}
                        >
                          {task.action_type.label}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {tasks.length > maxItems && (
              <Button
                variant="ghost"
                className="w-full h-8 text-xs text-muted-foreground"
                onClick={() => router.push("/taskpool")}
              >
                +{tasks.length - maxItems} more tasks
              </Button>
            )}
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No priority tasks</p>
            <p className="text-xs mt-1">You&apos;re all caught up!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
