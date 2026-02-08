/**
 * Loading Skeleton Component
 * Provides content-aware loading states that match actual UI
 */

import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface LoadingSkeletonProps {
  /** Type of skeleton to render */
  type:
    | "task-card"
    | "task-row"
    | "client-row"
    | "email-item"
    | "metric-card"
    | "activity-item"
    | "table-row"
    | "form"
    | "profile-header";
  /** Number of skeleton items to show */
  count?: number;
  /** Additional CSS classes */
  className?: string;
}

export function LoadingSkeleton({
  type,
  count = 1,
  className,
}: LoadingSkeletonProps) {
  const renderSkeleton = () => {
    switch (type) {
      case "task-card":
        return <TaskCardSkeleton />;
      case "task-row":
        return <TaskRowSkeleton />;
      case "client-row":
        return <ClientRowSkeleton />;
      case "email-item":
        return <EmailItemSkeleton />;
      case "metric-card":
        return <MetricCardSkeleton />;
      case "activity-item":
        return <ActivityItemSkeleton />;
      case "table-row":
        return <TableRowSkeleton />;
      case "form":
        return <FormSkeleton />;
      case "profile-header":
        return <ProfileHeaderSkeleton />;
      default:
        return <Skeleton className="h-20 w-full" />;
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>{renderSkeleton()}</div>
      ))}
    </div>
  );
}

// Task Card (Kanban)
function TaskCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-5 w-5 rounded" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <div className="flex items-center gap-2 pt-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <div className="flex items-center gap-2 pt-2">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-3 w-24" />
        </div>
      </CardContent>
    </Card>
  );
}

// Task Row (Table/List)
function TaskRowSkeleton() {
  return (
    <div className="flex items-center gap-4 p-3 border rounded-lg">
      <Skeleton className="h-4 w-4 rounded" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <Skeleton className="h-6 w-20 rounded-full" />
      <Skeleton className="h-6 w-16 rounded-full" />
      <Skeleton className="h-8 w-8 rounded-full" />
    </div>
  );
}

// Client Row (Table)
function ClientRowSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 border-b">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-1/4" />
      </div>
      <Skeleton className="h-6 w-24 rounded-full" />
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-8 w-8" />
    </div>
  );
}

// Email Item
function EmailItemSkeleton() {
  return (
    <div className="flex items-start gap-3 p-4 border rounded-lg">
      <Skeleton className="h-4 w-4 rounded mt-1" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <div className="flex items-center gap-2 pt-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

// Metric Card
function MetricCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-16" />
          </div>
          <Skeleton className="h-10 w-10 rounded-lg" />
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-3 w-32" />
        </div>
      </CardContent>
    </Card>
  );
}

// Activity Item
function ActivityItemSkeleton() {
  return (
    <div className="flex items-start gap-3 p-3">
      <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

// Table Row
function TableRowSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 border-b">
      <Skeleton className="h-4 w-1/6" />
      <Skeleton className="h-4 w-1/4" />
      <Skeleton className="h-4 w-1/6" />
      <Skeleton className="h-4 w-1/6" />
      <Skeleton className="h-8 w-8 rounded" />
    </div>
  );
}

// Form Skeleton
function FormSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      <div className="flex justify-end gap-3 pt-4">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
    </div>
  );
}

// Profile Header
function ProfileHeaderSkeleton() {
  return (
    <div className="flex items-start gap-4 p-6">
      <Skeleton className="h-20 w-20 rounded-full" />
      <div className="flex-1 space-y-3">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-4 w-1/4" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
    </div>
  );
}

/**
 * Shorthand component for common loading scenarios
 */
export function TaskListSkeleton({ count = 5 }: { count?: number }) {
  return <LoadingSkeleton type="task-row" count={count} />;
}

export function ClientListSkeleton({ count = 5 }: { count?: number }) {
  return <LoadingSkeleton type="client-row" count={count} />;
}

export function EmailListSkeleton({ count = 5 }: { count?: number }) {
  return <LoadingSkeleton type="email-item" count={count} />;
}

export function MetricsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <MetricCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ActivitySkeleton({ count = 10 }: { count?: number }) {
  return <LoadingSkeleton type="activity-item" count={count} />;
}
