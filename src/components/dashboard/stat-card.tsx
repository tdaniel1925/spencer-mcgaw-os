"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    period: string;
  };
  icon?: React.ReactNode;
  iconBg?: string;
  className?: string;
}

export function StatCard({
  title,
  value,
  change,
  icon,
  iconBg = "bg-accent",
  className,
}: StatCardProps) {
  const isPositive = change && change.value >= 0;

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <h3 className="text-3xl font-bold mt-1 text-foreground">{value}</h3>
            {change && (
              <div className="flex items-center gap-1 mt-2">
                <span
                  className={cn(
                    "text-sm font-medium flex items-center",
                    isPositive ? "text-green-600" : "text-red-500"
                  )}
                >
                  {isPositive ? (
                    <ArrowUp className="h-3 w-3 mr-0.5" />
                  ) : (
                    <ArrowDown className="h-3 w-3 mr-0.5" />
                  )}
                  {Math.abs(change.value)}%
                </span>
                <span className="text-sm text-muted-foreground">
                  ({change.period})
                </span>
              </div>
            )}
          </div>
          {icon && (
            <div
              className={cn(
                "w-14 h-14 rounded-xl flex items-center justify-center",
                iconBg
              )}
            >
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
