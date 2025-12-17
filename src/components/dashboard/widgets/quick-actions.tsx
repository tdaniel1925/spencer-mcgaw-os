"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Zap,
  Plus,
  Mail,
  Phone,
  Users,
  FileText,
  Calendar,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickAction {
  id: string;
  label: string;
  icon: typeof Plus;
  href: string;
  color: string;
}

const defaultActions: QuickAction[] = [
  { id: "task", label: "New Task", icon: Plus, href: "/taskpool", color: "text-primary" },
  { id: "email", label: "Email", icon: Mail, href: "/email-intelligence", color: "text-blue-600" },
  { id: "call", label: "Calls", icon: Phone, href: "/calls", color: "text-green-600" },
  { id: "client", label: "Clients", icon: Users, href: "/clients", color: "text-purple-600" },
  { id: "files", label: "Files", icon: FileText, href: "/files", color: "text-amber-600" },
  { id: "calendar", label: "Calendar", icon: Calendar, href: "/calendar", color: "text-red-600" },
];

interface QuickActionsProps {
  actions?: QuickAction[];
  columns?: 2 | 3 | 6;
}

export function QuickActions({ actions = defaultActions, columns = 3 }: QuickActionsProps) {
  const router = useRouter();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cn(
          "grid gap-2",
          columns === 2 && "grid-cols-2",
          columns === 3 && "grid-cols-3",
          columns === 6 && "grid-cols-6"
        )}>
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Button
                key={action.id}
                variant="outline"
                className={cn(
                  "h-auto flex-col gap-1.5 py-3",
                  columns === 6 && "py-2"
                )}
                onClick={() => router.push(action.href)}
              >
                <Icon className={cn("h-5 w-5", action.color)} />
                <span className="text-xs font-medium">{action.label}</span>
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// Compact horizontal version
export function QuickActionsBar({ actions = defaultActions }: { actions?: QuickAction[] }) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Button
            key={action.id}
            variant="outline"
            size="sm"
            className="flex-shrink-0 gap-2"
            onClick={() => router.push(action.href)}
          >
            <Icon className={cn("h-4 w-4", action.color)} />
            <span className="text-xs">{action.label}</span>
          </Button>
        );
      })}
    </div>
  );
}
