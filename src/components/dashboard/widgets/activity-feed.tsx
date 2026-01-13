"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Activity,
  CheckCircle,
  MessageSquare,
  Phone,
  Mail,
  UserPlus,
  FileText,
  Clock,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

type ActivityType = "task_completed" | "task_assigned" | "comment" | "call" | "email" | "client_added" | "document";

interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  description?: string;
  user?: {
    name: string;
    avatar?: string;
  };
  timestamp: Date;
  metadata?: Record<string, string>;
}

const activityIcons: Record<ActivityType, { icon: typeof Activity; color: string; bg: string }> = {
  task_completed: { icon: CheckCircle, color: "text-green-600", bg: "bg-green-100" },
  task_assigned: { icon: UserPlus, color: "text-blue-600", bg: "bg-blue-100" },
  comment: { icon: MessageSquare, color: "text-purple-600", bg: "bg-purple-100" },
  call: { icon: Phone, color: "text-orange-600", bg: "bg-orange-100" },
  email: { icon: Mail, color: "text-sky-600", bg: "bg-sky-100" },
  client_added: { icon: UserPlus, color: "text-indigo-600", bg: "bg-indigo-100" },
  document: { icon: FileText, color: "text-amber-600", bg: "bg-amber-100" },
};

// Demo activity data
const demoActivities: ActivityItem[] = [
  {
    id: "1",
    type: "task_completed",
    title: "Tax return filed",
    description: "Johnson Corp Q4 filing",
    user: { name: "Tyler Daniel" },
    timestamp: new Date(Date.now() - 15 * 60 * 1000),
  },
  {
    id: "2",
    type: "call",
    title: "Incoming call handled",
    description: "Sarah Miller - New client inquiry",
    user: { name: "AI Assistant" },
    timestamp: new Date(Date.now() - 45 * 60 * 1000),
  },
  {
    id: "3",
    type: "task_assigned",
    title: "Task assigned",
    description: "Review quarterly statements",
    user: { name: "Tyler Daniel" },
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    id: "4",
    type: "email",
    title: "Email processed",
    description: "Client document request",
    user: { name: "AI Assistant" },
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
  },
  {
    id: "5",
    type: "client_added",
    title: "New client added",
    description: "Smith & Associates LLC",
    user: { name: "Tyler Daniel" },
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
  },
];

interface ActivityFeedProps {
  activities?: ActivityItem[];
  maxItems?: number;
  loading?: boolean;
}

function ActivityFeedBase({
  activities = demoActivities,
  maxItems = 5,
  loading = false,
}: ActivityFeedProps) {
  const router = useRouter();
  const displayActivities = activities.slice(0, maxItems);

  const getUserInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Recent Activity
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => router.push("/activity")}
          >
            View All
            <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <ScrollArea className="max-h-[240px]">
          <div className="px-4 py-2 space-y-1">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
                      <div className="h-3 w-1/2 bg-muted animate-pulse rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : displayActivities.length > 0 ? (
              displayActivities.map((activity, index) => {
                const { icon: Icon, color, bg } = activityIcons[activity.type];
                const isLast = index === displayActivities.length - 1;

                return (
                  <div key={activity.id} className="relative">
                    <div className="flex items-start gap-3 py-2">
                      {/* Icon */}
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                        bg
                      )}>
                        <Icon className={cn("h-4 w-4", color)} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{activity.title}</p>
                        {activity.description && (
                          <p className="text-xs text-muted-foreground truncate">
                            {activity.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          {activity.user && (
                            <div className="flex items-center gap-1">
                              <Avatar className="h-4 w-4">
                                <AvatarImage src={activity.user.avatar} />
                                <AvatarFallback className="text-[8px]">
                                  {getUserInitials(activity.user.name)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-[10px] text-muted-foreground">
                                {activity.user.name}
                              </span>
                            </div>
                          )}
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />
                            {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Connector line */}
                    {!isLast && (
                      <div className="absolute left-4 top-10 bottom-0 w-px bg-border" />
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                <Activity className="h-6 w-6 mx-auto mb-1 opacity-30" />
                <p className="text-sm">No recent activity</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// Export with error boundary wrapping
export function ActivityFeed(props: ActivityFeedProps) {
  return (
    <ErrorBoundary name="Activity Feed" compact>
      <ActivityFeedBase {...props} />
    </ErrorBoundary>
  );
}
