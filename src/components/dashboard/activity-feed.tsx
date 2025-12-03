"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Phone,
  Mail,
  FileText,
  CheckCircle,
  UserPlus,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface ActivityItem {
  id: string;
  type:
    | "call_received"
    | "call_made"
    | "email_received"
    | "email_sent"
    | "document_received"
    | "task_completed"
    | "client_created"
    | "note_added";
  description: string;
  user?: {
    name: string;
    avatar?: string;
  };
  client?: {
    name: string;
  };
  timestamp: Date;
}

const activityIcons = {
  call_received: { icon: Phone, bg: "bg-blue-100", color: "text-blue-600" },
  call_made: { icon: Phone, bg: "bg-blue-100", color: "text-blue-600" },
  email_received: { icon: Mail, bg: "bg-purple-100", color: "text-purple-600" },
  email_sent: { icon: Mail, bg: "bg-purple-100", color: "text-purple-600" },
  document_received: {
    icon: FileText,
    bg: "bg-orange-100",
    color: "text-orange-600",
  },
  task_completed: {
    icon: CheckCircle,
    bg: "bg-green-100",
    color: "text-green-600",
  },
  client_created: { icon: UserPlus, bg: "bg-accent/20", color: "text-accent" },
  note_added: {
    icon: MessageSquare,
    bg: "bg-gray-100",
    color: "text-gray-600",
  },
};

interface ActivityFeedProps {
  activities: ActivityItem[];
  className?: string;
}

export function ActivityFeed({ activities, className }: ActivityFeedProps) {
  return (
    <Card className={cn("h-full", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px] px-6 pb-6">
          <div className="space-y-4">
            {activities.map((activity) => {
              const iconConfig = activityIcons[activity.type];
              const Icon = iconConfig.icon;

              return (
                <div key={activity.id} className="flex items-start gap-3">
                  <div
                    className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center shrink-0",
                      iconConfig.bg
                    )}
                  >
                    <Icon className={cn("h-4 w-4", iconConfig.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground leading-snug">
                      {activity.description}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {activity.user && (
                        <div className="flex items-center gap-1">
                          <Avatar className="h-4 w-4">
                            <AvatarImage src={activity.user.avatar} />
                            <AvatarFallback className="text-[8px]">
                              {activity.user.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-muted-foreground">
                            {activity.user.name}
                          </span>
                        </div>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(activity.timestamp, {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
