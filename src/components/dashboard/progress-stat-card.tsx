"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp } from "lucide-react";

interface ProgressStatCardProps {
  title: string;
  value: string | number;
  progress: number;
  change?: {
    value: number;
    period: string;
  };
  progressColor?: string;
  className?: string;
}

export function ProgressStatCard({
  title,
  value,
  progress,
  change,
  progressColor = "#DBC16F",
  className,
}: ProgressStatCardProps) {
  const isPositive = change && change.value >= 0;
  const circumference = 2 * Math.PI * 36;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
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

          {/* Circular Progress */}
          <div className="relative w-20 h-20">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="40"
                cy="40"
                r="36"
                stroke="currentColor"
                strokeWidth="6"
                fill="none"
                className="text-muted"
              />
              <circle
                cx="40"
                cy="40"
                r="36"
                stroke={progressColor}
                strokeWidth="6"
                fill="none"
                strokeLinecap="round"
                style={{
                  strokeDasharray: circumference,
                  strokeDashoffset: strokeDashoffset,
                }}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold">
              {progress}%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
