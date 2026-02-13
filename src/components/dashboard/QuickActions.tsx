/**
 * Quick Actions Component
 * Provides quick access to common actions
 */

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Users,
  MessageSquare,
  Mail,
  FileText,
  ListTodo,
} from "lucide-react";
import Link from "next/link";

interface QuickActionsProps {
  onCreateTask?: () => void;
}

export function QuickActions({ onCreateTask }: QuickActionsProps) {
  const actions = [
    {
      label: "Create Task",
      icon: Plus,
      onClick: onCreateTask,
      variant: "default" as const,
    },
    {
      label: "Add Client",
      icon: Users,
      href: "/clients/new",
      variant: "outline" as const,
    },
    {
      label: "Send SMS",
      icon: MessageSquare,
      href: "/sms",
      variant: "outline" as const,
    },
    {
      label: "Send Email",
      icon: Mail,
      href: "/email-client",
      variant: "outline" as const,
    },
  ];

  return (
    <Card className="border-border/50">
      <CardContent className="p-4">
        <h2 className="font-medium text-sm mb-3 flex items-center gap-2">
          <ListTodo className="h-4 w-4" />
          Quick Actions
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {actions.map((action) => {
            const Icon = action.icon;

            if (action.onClick) {
              return (
                <Button
                  key={action.label}
                  variant={action.variant}
                  className="h-auto py-3 flex-col gap-2"
                  onClick={action.onClick}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs">{action.label}</span>
                </Button>
              );
            }

            return (
              <Button
                key={action.label}
                variant={action.variant}
                className="h-auto py-3 flex-col gap-2"
                asChild
              >
                <Link href={action.href!}>
                  <Icon className="h-5 w-5" />
                  <span className="text-xs">{action.label}</span>
                </Link>
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
