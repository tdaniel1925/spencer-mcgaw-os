"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Layers,
  ChevronRight,
  Circle,
  Clock,
  CheckCircle,
  PlayCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface KanbanColumn {
  id: string;
  label: string;
  count: number;
  color: string;
  icon: typeof Circle;
}

interface MiniKanbanProps {
  columns?: KanbanColumn[];
  loading?: boolean;
}

const defaultColumns: KanbanColumn[] = [
  { id: "open", label: "Open", count: 12, color: "bg-slate-500", icon: Circle },
  { id: "in_progress", label: "In Progress", count: 5, color: "bg-blue-500", icon: PlayCircle },
  { id: "review", label: "Review", count: 3, color: "bg-amber-500", icon: Clock },
  { id: "completed", label: "Done", count: 28, color: "bg-green-500", icon: CheckCircle },
];

export function MiniKanban({ columns = defaultColumns, loading = false }: MiniKanbanProps) {
  const router = useRouter();

  const totalTasks = columns.reduce((sum, col) => sum + col.count, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            Workflow Status
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => router.push("/kanban")}
          >
            Open Board
            <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            <div className="h-4 w-full bg-muted animate-pulse rounded" />
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Progress bar */}
            <div className="flex h-2 rounded-full overflow-hidden mb-4">
              {columns.map((column) => (
                <div
                  key={column.id}
                  className={cn("transition-all", column.color)}
                  style={{ width: `${(column.count / totalTasks) * 100}%` }}
                />
              ))}
            </div>

            {/* Column cards */}
            <div className="grid grid-cols-4 gap-2">
              {columns.map((column) => {
                const Icon = column.icon;
                return (
                  <div
                    key={column.id}
                    onClick={() => router.push("/kanban")}
                    className={cn(
                      "p-3 rounded-lg border cursor-pointer transition-all",
                      "hover:shadow-sm hover:border-primary/30 text-center"
                    )}
                  >
                    <div className={cn(
                      "w-6 h-6 rounded-full mx-auto mb-1.5 flex items-center justify-center",
                      column.color.replace("bg-", "bg-opacity-20 bg-")
                    )}>
                      <Icon className={cn("h-3.5 w-3.5", column.color.replace("bg-", "text-"))} />
                    </div>
                    <p className="text-xl font-bold">{column.count}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{column.label}</p>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
