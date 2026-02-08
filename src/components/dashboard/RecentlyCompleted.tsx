/**
 * Recently Completed Component
 * Shows recently completed tasks as quick-access badges
 */

import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";

interface Task {
  id: string;
  title: string;
  [key: string]: any; // Allow additional properties
}

interface RecentlyCompletedProps {
  tasks: Task[];
  onTaskClick: (task: any) => void;
}

export function RecentlyCompleted({
  tasks,
  onTaskClick,
}: RecentlyCompletedProps) {
  if (tasks.length === 0) {
    return null;
  }

  return (
    <Card className="border-border/50">
      <CardContent className="p-0">
        <div className="flex items-center justify-between p-3 border-b">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <h2 className="font-medium text-sm">Recently Completed</h2>
          </div>
        </div>
        <div className="p-3 flex flex-wrap gap-2">
          {tasks.map((task) => (
            <button
              key={task.id}
              onClick={() => onTaskClick(task)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-green-50 text-green-700 rounded-md text-xs hover:bg-green-100 transition-colors"
            >
              <CheckCircle2 className="h-3 w-3" />
              <span className="truncate max-w-[200px]">{task.title}</span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
