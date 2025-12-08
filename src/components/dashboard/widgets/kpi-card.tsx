"use client";

import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

interface KPICardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  trend?: { value: number; isPositive: boolean };
  icon: LucideIcon;
  color?: "primary" | "success" | "warning" | "danger" | "info";
  onClick?: () => void;
  size?: "sm" | "md";
  loading?: boolean;
}

const colorStyles = {
  primary: {
    bg: "bg-primary/10",
    text: "text-primary",
    icon: "text-primary",
  },
  success: {
    bg: "bg-green-100",
    text: "text-green-700",
    icon: "text-green-600",
  },
  warning: {
    bg: "bg-amber-100",
    text: "text-amber-700",
    icon: "text-amber-600",
  },
  danger: {
    bg: "bg-red-100",
    text: "text-red-700",
    icon: "text-red-600",
  },
  info: {
    bg: "bg-blue-100",
    text: "text-blue-700",
    icon: "text-blue-600",
  },
};

export function KPICard({
  title,
  value,
  subtitle,
  trend,
  icon: Icon,
  color = "primary",
  onClick,
  size = "md",
  loading = false,
}: KPICardProps) {
  const styles = colorStyles[color];

  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-card rounded-xl border p-4 transition-all",
        onClick && "cursor-pointer hover:shadow-md hover:border-primary/30",
        size === "sm" && "p-3"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className={cn(
            "text-muted-foreground font-medium",
            size === "sm" ? "text-xs" : "text-sm"
          )}>
            {title}
          </p>
          {loading ? (
            <div className="h-9 w-16 bg-muted animate-pulse rounded mt-1" />
          ) : (
            <p className={cn(
              "font-bold mt-1",
              size === "sm" ? "text-2xl" : "text-3xl"
            )}>
              {value}
            </p>
          )}
          {subtitle && (
            <p className={cn(
              "text-muted-foreground mt-0.5",
              size === "sm" ? "text-[10px]" : "text-xs"
            )}>
              {subtitle}
            </p>
          )}
          {trend && (
            <div className={cn(
              "flex items-center gap-1 mt-1",
              size === "sm" ? "text-[10px]" : "text-xs",
              trend.isPositive ? "text-green-600" : "text-red-600"
            )}>
              {trend.isPositive ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              <span>{trend.isPositive ? "+" : ""}{trend.value}%</span>
            </div>
          )}
        </div>
        <div className={cn(
          "rounded-full flex items-center justify-center flex-shrink-0",
          styles.bg,
          size === "sm" ? "w-10 h-10" : "w-12 h-12"
        )}>
          <Icon className={cn(
            styles.icon,
            size === "sm" ? "h-5 w-5" : "h-6 w-6"
          )} />
        </div>
      </div>
    </div>
  );
}
