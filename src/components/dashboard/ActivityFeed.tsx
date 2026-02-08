/**
 * Activity Feed Component
 * Shows recent activities across the organization
 */

import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Activity,
  User,
  FileText,
  MessageSquare,
  Phone,
  Mail,
  ListTodo,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { safeFormatDistanceToNow } from "@/lib/utils";
import Link from "next/link";

interface ActivityItem {
  id: string;
  type: "task_created" | "task_completed" | "call_logged" | "email_sent" | "note_added" | "task_updated";
  description: string;
  user_name?: string;
  created_at: string;
  metadata?: {
    task_title?: string;
    client_name?: string;
    [key: string]: any;
  };
}

interface ActivityFeedProps {
  activities: ActivityItem[];
  loading?: boolean;
}

const getActivityIcon = (type: string) => {
  switch (type) {
    case "task_created":
    case "task_updated":
      return <ListTodo className="h-4 w-4" />;
    case "task_completed":
      return <ListTodo className="h-4 w-4 text-green-600" />;
    case "call_logged":
      return <Phone className="h-4 w-4" />;
    case "email_sent":
      return <Mail className="h-4 w-4" />;
    case "note_added":
      return <MessageSquare className="h-4 w-4" />;
    default:
      return <Activity className="h-4 w-4" />;
  }
};

const getActivityColor = (type: string) => {
  switch (type) {
    case "task_created":
      return "bg-blue-100 text-blue-600";
    case "task_completed":
      return "bg-green-100 text-green-600";
    case "task_updated":
      return "bg-amber-100 text-amber-600";
    case "call_logged":
      return "bg-purple-100 text-purple-600";
    case "email_sent":
      return "bg-indigo-100 text-indigo-600";
    case "note_added":
      return "bg-gray-100 text-gray-600";
    default:
      return "bg-muted text-muted-foreground";
  }
};

export function ActivityFeed({ activities, loading = false }: ActivityFeedProps) {
  if (loading) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-0">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-medium text-sm">Recent Activity</h2>
          </div>
          <ScrollArea className="h-[300px]">
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-start gap-3 animate-pulse">
                  <div className="h-8 w-8 rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    );
  }

  if (activities.length === 0) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-0">
          <div className="p-4 border-b">
            <h2 className="font-medium text-sm">Recent Activity</h2>
          </div>
          <div className="flex flex-col items-center justify-center h-[300px] text-center p-4">
            <Activity className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              No recent activity to display
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Activity will appear here as you and your team work
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardContent className="p-0">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-medium text-sm">Recent Activity</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/activity">
              View All
              <ArrowRight className="h-3 w-3 ml-1" />
            </Link>
          </Button>
        </div>

        <ScrollArea className="h-[300px]">
          <div className="p-3">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-3 py-2 px-2 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${getActivityColor(
                    activity.type
                  )}`}
                >
                  {getActivityIcon(activity.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">
                    {activity.user_name && (
                      <span className="font-medium">{activity.user_name}</span>
                    )}{" "}
                    {activity.description}
                  </p>

                  {activity.metadata?.client_name && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Client: {activity.metadata.client_name}
                    </p>
                  )}

                  <p className="text-xs text-muted-foreground mt-1">
                    {safeFormatDistanceToNow(activity.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
