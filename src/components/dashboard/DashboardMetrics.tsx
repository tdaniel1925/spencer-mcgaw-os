/**
 * Dashboard Metrics Cards
 * Shows key task statistics: overdue, due today, and in progress
 */

import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface TaskStats {
  overdue: number;
  dueToday: number;
  inProgress: number;
}

interface DashboardMetricsProps {
  stats: TaskStats;
  loading?: boolean;
}

export function DashboardMetrics({ stats, loading = false }: DashboardMetricsProps) {
  const router = useRouter();

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="border-border/50">
            <CardContent className="p-3">
              <div className="animate-pulse">
                <div className="h-4 bg-muted rounded w-20 mb-2" />
                <div className="h-8 bg-muted rounded w-12" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {/* Overdue Tasks */}
      <Card
        className={cn(
          "cursor-pointer transition-all border-border/50 hover:shadow-md",
          stats.overdue > 0 && "border-red-200 bg-red-50/50"
        )}
        onClick={() => router.push("/taskpool?view=overdue")}
      >
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Overdue</p>
              <p
                className={cn(
                  "text-2xl font-bold",
                  stats.overdue > 0 && "text-red-600"
                )}
              >
                {stats.overdue}
              </p>
            </div>
            <div
              className={cn(
                "h-10 w-10 rounded-lg flex items-center justify-center",
                stats.overdue > 0
                  ? "bg-red-100 text-red-600"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          {stats.overdue > 0 && (
            <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Requires immediate attention
            </p>
          )}
        </CardContent>
      </Card>

      {/* Due Today */}
      <Card
        className={cn(
          "cursor-pointer transition-all border-border/50 hover:shadow-md",
          stats.dueToday > 0 && "border-amber-200 bg-amber-50/50"
        )}
        onClick={() => router.push("/taskpool?view=today")}
      >
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Due Today</p>
              <p
                className={cn(
                  "text-2xl font-bold",
                  stats.dueToday > 0 && "text-amber-600"
                )}
              >
                {stats.dueToday}
              </p>
            </div>
            <div
              className={cn(
                "h-10 w-10 rounded-lg flex items-center justify-center",
                stats.dueToday > 0
                  ? "bg-amber-100 text-amber-600"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <Clock className="h-5 w-5" />
            </div>
          </div>
          {stats.dueToday > 0 && (
            <p className="text-xs text-amber-600 mt-2">
              Complete today to stay on track
            </p>
          )}
        </CardContent>
      </Card>

      {/* In Progress */}
      <Card
        className="cursor-pointer transition-all border-border/50 hover:shadow-md"
        onClick={() => router.push("/tasks?status=in_progress")}
      >
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">In Progress</p>
              <p className="text-2xl font-bold">{stats.inProgress}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Currently being worked on
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
