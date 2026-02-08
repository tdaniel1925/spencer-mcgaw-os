/**
 * Empty State Component
 * Provides helpful guidance when lists or pages have no content
 */

import React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export interface EmptyStateProps {
  /** Icon to display */
  icon: LucideIcon;
  /** Title text */
  title: string;
  /** Description text */
  description: string;
  /** Primary action button (optional) */
  action?: React.ReactNode;
  /** Secondary action button (optional) */
  secondaryAction?: React.ReactNode;
  /** Helpful tip to show (optional) */
  tip?: string;
  /** Additional CSS classes */
  className?: string;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Whether to show in a card */
  showCard?: boolean;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  tip,
  className,
  size = "md",
  showCard = true,
}: EmptyStateProps) {
  const sizeClasses = {
    sm: "py-8",
    md: "py-12",
    lg: "py-16",
  };

  const iconSizes = {
    sm: "h-10 w-10",
    md: "h-12 w-12",
    lg: "h-16 w-16",
  };

  const content = (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        sizeClasses[size],
        className
      )}
    >
      {/* Icon */}
      <div className={cn(
        "rounded-full bg-muted flex items-center justify-center mb-4",
        size === "sm" && "p-3",
        size === "md" && "p-4",
        size === "lg" && "p-5"
      )}>
        <Icon className={cn(iconSizes[size], "text-muted-foreground")} />
      </div>

      {/* Title */}
      <h3
        className={cn(
          "font-semibold text-foreground mb-2",
          size === "sm" && "text-base",
          size === "md" && "text-lg",
          size === "lg" && "text-xl"
        )}
      >
        {title}
      </h3>

      {/* Description */}
      <p
        className={cn(
          "text-muted-foreground mb-6 max-w-md",
          size === "sm" && "text-sm",
          size === "md" && "text-base",
          size === "lg" && "text-lg"
        )}
      >
        {description}
      </p>

      {/* Actions */}
      {(action || secondaryAction) && (
        <div className="flex items-center gap-3">
          {action}
          {secondaryAction}
        </div>
      )}

      {/* Helpful Tip */}
      {tip && (
        <div className="mt-6 px-4 py-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg max-w-md">
          <p className="text-sm text-blue-900 dark:text-blue-100">{tip}</p>
        </div>
      )}
    </div>
  );

  if (showCard) {
    return <Card className="border-dashed">{content}</Card>;
  }

  return content;
}

/**
 * Common empty state configurations
 */
export const EmptyStates = {
  clients: {
    icon: "Users" as const,
    title: "No clients yet",
    description: "Add your first client to start organizing work and tracking interactions",
    tip: "💡 Clients help you organize all related tasks, emails, and communications in one place",
  },
  tasks: {
    icon: "ClipboardList" as const,
    title: "No tasks found",
    description: "Create your first task to start tracking work",
    tip: "💡 Tasks can be created from emails, manually, or through the quick create menu",
  },
  emails: {
    icon: "Mail" as const,
    title: "No emails yet",
    description: "Forward emails to your shared inbox to get AI-powered task suggestions",
    tip: "💡 AI automatically analyzes incoming emails and suggests actionable tasks",
  },
  projects: {
    icon: "Folder" as const,
    title: "No projects yet",
    description: "Create projects to organize related tasks and track progress",
    tip: "💡 Projects help you manage complex client work with multiple deliverables",
  },
  team: {
    icon: "Users" as const,
    title: "No team members yet",
    description: "Invite team members to collaborate and share work",
    tip: "💡 Team members can be assigned tasks and access shared resources",
  },
  search: {
    icon: "Search" as const,
    title: "No results found",
    description: "Try adjusting your search terms or filters",
    tip: "💡 Use specific keywords or clear some filters to see more results",
  },
  activity: {
    icon: "Activity" as const,
    title: "No recent activity",
    description: "Activity will appear here as you and your team work",
    tip: "💡 Activity feed shows all updates across tasks, clients, and projects",
  },
};
