"use client";

/**
 * Unified Communications Timeline
 * Shows emails, calls, and SMS in chronological order
 */

import React, { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Mail,
  Phone,
  MessageSquare,
  Search,
  Filter,
  Loader2,
  Calendar,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface Communication {
  id: string;
  type: "email" | "call" | "sms";
  date: Date;
  from: {
    name: string;
    contact: string; // email or phone
  };
  to: {
    name: string;
    contact: string;
  };
  subject?: string;
  preview: string;
  duration?: number; // For calls (seconds)
  direction: "inbound" | "outbound";
  status?: "completed" | "missed" | "voicemail"; // For calls
  isRead?: boolean;
}

export default function CommunicationsPage() {
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "email" | "call" | "sms">("all");
  const [filterDirection, setFilterDirection] = useState<"all" | "inbound" | "outbound">("all");

  // Fetch unified timeline
  const fetchCommunications = useCallback(async () => {
    try {
      setIsLoading(true);

      // Fetch emails, calls, and SMS in parallel
      const [emailsRes, callsRes, smsRes] = await Promise.all([
        fetch("/api/emails?folder=inbox&top=20"),
        fetch("/api/calls?limit=20"),
        fetch("/api/sms?limit=20"),
      ]);

      const [emailsData, callsData, smsData] = await Promise.all([
        emailsRes.json(),
        callsRes.json(),
        smsRes.json(),
      ]);

      // Transform emails
      const emails: Communication[] = (emailsData.emails || []).map((email: any) => ({
        id: `email-${email.id}`,
        type: "email" as const,
        date: new Date(email.receivedDateTime),
        from: {
          name: email.from.emailAddress.name,
          contact: email.from.emailAddress.address,
        },
        to: {
          name: email.toRecipients[0]?.emailAddress.name || "",
          contact: email.toRecipients[0]?.emailAddress.address || "",
        },
        subject: email.subject,
        preview: email.bodyPreview,
        direction: "inbound" as const,
        isRead: email.isRead,
      }));

      // Transform calls
      const calls: Communication[] = (callsData.calls || []).map((call: any) => ({
        id: `call-${call.id}`,
        type: "call" as const,
        date: new Date(call.call_answered || call.call_created),
        from: {
          name: call.caller_name || "Unknown",
          contact: call.caller_phone || "",
        },
        to: {
          name: call.line_name || "",
          contact: call.line_phone || "",
        },
        preview: `${call.call_direction === "inbound" ? "Incoming" : "Outgoing"} call - ${call.call_status}`,
        duration: call.duration || 0,
        direction: call.call_direction,
        status: call.call_status,
      }));

      // Transform SMS
      const sms: Communication[] = (smsData.messages || []).map((msg: any) => ({
        id: `sms-${msg.id}`,
        type: "sms" as const,
        date: new Date(msg.created_at),
        from: {
          name: msg.from_name || msg.from_phone,
          contact: msg.from_phone,
        },
        to: {
          name: msg.to_name || msg.to_phone,
          contact: msg.to_phone,
        },
        preview: msg.body,
        direction: msg.direction,
      }));

      // Combine and sort by date (newest first)
      const combined = [...emails, ...calls, ...sms].sort(
        (a, b) => b.date.getTime() - a.date.getTime()
      );

      setCommunications(combined);
    } catch (error) {
      console.error("Error fetching communications:", error);
      toast.error("Failed to load communications");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCommunications();
  }, [fetchCommunications]);

  // Filter communications
  const filteredCommunications = communications.filter((comm) => {
    // Type filter
    if (filterType !== "all" && comm.type !== filterType) {
      return false;
    }

    // Direction filter
    if (filterDirection !== "all" && comm.direction !== filterDirection) {
      return false;
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        comm.from.name.toLowerCase().includes(query) ||
        comm.from.contact.toLowerCase().includes(query) ||
        comm.preview.toLowerCase().includes(query) ||
        comm.subject?.toLowerCase().includes(query)
      );
    }

    return true;
  });

  // Type icons
  const typeIcons = {
    email: Mail,
    call: Phone,
    sms: MessageSquare,
  };

  const typeColors = {
    email: "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300",
    call: "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300",
    sms: "bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300",
  };

  return (
    <div className="h-screen flex flex-col">
      <Header title="Communications Timeline" />

      <div className="p-6">
        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search communications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="email">Emails</SelectItem>
              <SelectItem value="call">Calls</SelectItem>
              <SelectItem value="sms">SMS</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterDirection} onValueChange={(v: any) => setFilterDirection(v)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Directions</SelectItem>
              <SelectItem value="inbound">Inbound</SelectItem>
              <SelectItem value="outbound">Outbound</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={fetchCommunications}>
            Refresh
          </Button>
        </div>

        {/* Timeline */}
        <ScrollArea className="h-[calc(100vh-250px)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredCommunications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No communications found</p>
              <p className="text-sm text-muted-foreground">
                {searchQuery || filterType !== "all" || filterDirection !== "all"
                  ? "Try adjusting your filters"
                  : "Your communications will appear here"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredCommunications.map((comm) => {
                const Icon = typeIcons[comm.type];
                return (
                  <Card key={comm.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div
                          className={`p-2 rounded-lg ${typeColors[comm.type]}`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs">
                              {comm.type}
                            </Badge>
                            <Badge variant={comm.direction === "inbound" ? "default" : "secondary"} className="text-xs">
                              {comm.direction}
                            </Badge>
                            {comm.type === "email" && !comm.isRead && (
                              <Badge variant="destructive" className="text-xs">
                                Unread
                              </Badge>
                            )}
                            {comm.type === "call" && comm.status && (
                              <Badge
                                variant={
                                  comm.status === "completed"
                                    ? "default"
                                    : comm.status === "missed"
                                    ? "destructive"
                                    : "secondary"
                                }
                                className="text-xs"
                              >
                                {comm.status}
                              </Badge>
                            )}
                          </div>

                          {comm.subject && (
                            <h4 className="font-semibold mb-1">{comm.subject}</h4>
                          )}

                          <p className="text-sm mb-2">
                            <span className="font-medium">{comm.from.name}</span>
                            <span className="text-muted-foreground"> ({comm.from.contact})</span>
                            {comm.to.name && (
                              <>
                                <span className="text-muted-foreground"> → </span>
                                <span className="font-medium">{comm.to.name}</span>
                              </>
                            )}
                          </p>

                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {comm.preview}
                          </p>

                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span>{format(comm.date, "MMM d, yyyy 'at' h:mm a")}</span>
                            {comm.type === "call" && comm.duration !== undefined && (
                              <span>Duration: {Math.floor(comm.duration / 60)}:{(comm.duration % 60).toString().padStart(2, "0")}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
