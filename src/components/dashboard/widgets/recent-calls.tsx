"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  ChevronRight,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";

interface Call {
  id: string;
  callerName?: string;
  callerPhone?: string;
  callStartedAt: string | Date;
  duration?: number;
  status?: string;
  direction?: "inbound" | "outbound";
  aiAnalysis?: {
    summary?: string;
  };
}

interface RecentCallsProps {
  calls: Call[];
  loading?: boolean;
  maxItems?: number;
}

const statusConfig = {
  new: { label: "New", color: "bg-blue-100 text-blue-700" },
  action_required: { label: "Action Needed", color: "bg-amber-100 text-amber-700" },
  in_progress: { label: "In Progress", color: "bg-purple-100 text-purple-700" },
  archived: { label: "Handled", color: "bg-green-100 text-green-700" },
};

export function RecentCalls({ calls, loading = false, maxItems = 4 }: RecentCallsProps) {
  const router = useRouter();
  const displayCalls = calls.slice(0, maxItems);
  const todayCount = calls.filter((call) => {
    const callDate = new Date(call.callStartedAt);
    const today = new Date();
    return callDate.toDateString() === today.toDateString();
  }).length;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Phone className="h-4 w-4 text-primary" />
            Recent Calls
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {todayCount} today
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0 overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
                  <div className="h-3 w-1/2 bg-muted animate-pulse rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : displayCalls.length > 0 ? (
          <div className="divide-y">
            {displayCalls.map((call) => {
              const statusKey = (call.status || "new") as keyof typeof statusConfig;
              const status = statusConfig[statusKey] || statusConfig.new;

              return (
                <div
                  key={call.id}
                  onClick={() => router.push("/calls")}
                  className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      {call.direction === "outbound" ? (
                        <PhoneOutgoing className="h-4 w-4 text-primary" />
                      ) : (
                        <PhoneIncoming className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-sm truncate">
                          {call.callerName || call.callerPhone || "Unknown"}
                        </p>
                        <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0 flex-shrink-0", status.color)}>
                          {status.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span suppressHydrationWarning>
                          {formatDistanceToNow(new Date(call.callStartedAt), { addSuffix: true })}
                        </span>
                        {call.duration && (
                          <span>• {Math.floor(call.duration / 60)}:{String(call.duration % 60).padStart(2, "0")}</span>
                        )}
                      </div>
                      {call.aiAnalysis?.summary && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                          {call.aiAnalysis.summary}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Phone className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No recent calls</p>
          </div>
        )}

        {calls.length > 0 && (
          <div className="p-2 border-t">
            <Button
              variant="ghost"
              className="w-full h-8 text-xs"
              onClick={() => router.push("/calls")}
            >
              View All Calls
              <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
