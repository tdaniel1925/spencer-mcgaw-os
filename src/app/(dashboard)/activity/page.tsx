"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  Download,
  Filter,
  Phone,
  Mail,
  FileText,
  CheckCircle,
  UserPlus,
  MessageSquare,
  Clock,
  Activity,
  PhoneIncoming,
  PhoneOutgoing,
  MailOpen,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";

// Mock activity data
const mockActivities = [
  {
    id: "1",
    type: "call_received",
    description: "Inbound call from John Smith regarding tax return status",
    user: { name: "AI Phone Agent", avatar: "" },
    client: { name: "John Smith" },
    metadata: { duration: "3:45", callId: "CALL001" },
    timestamp: new Date(Date.now() - 1000 * 60 * 15),
  },
  {
    id: "2",
    type: "document_received",
    description: "Bank statements received via email from ABC Corp",
    user: { name: "AI Email Agent", avatar: "" },
    client: { name: "ABC Corp" },
    metadata: { documentCount: 3, source: "email" },
    timestamp: new Date(Date.now() - 1000 * 60 * 45),
  },
  {
    id: "3",
    type: "task_completed",
    description: "Completed task: Send W-2 copy to Sarah Johnson",
    user: { name: "Elizabeth", avatar: "" },
    client: { name: "Sarah Johnson" },
    metadata: { taskId: "TSK001" },
    timestamp: new Date(Date.now() - 1000 * 60 * 90),
  },
  {
    id: "4",
    type: "email_received",
    description: "New client inquiry received from Mike Williams",
    user: { name: "AI Email Agent", avatar: "" },
    client: { name: "Mike Williams" },
    metadata: { subject: "Tax Preparation Services" },
    timestamp: new Date(Date.now() - 1000 * 60 * 120),
  },
  {
    id: "5",
    type: "client_created",
    description: "New client added to system: Williams Consulting LLC",
    user: { name: "Hunter McGaw", avatar: "" },
    client: { name: "Williams Consulting LLC" },
    timestamp: new Date(Date.now() - 1000 * 60 * 180),
  },
  {
    id: "6",
    type: "call_made",
    description: "Outbound call to Tech Solutions regarding IRS notice",
    user: { name: "Hunter McGaw", avatar: "" },
    client: { name: "Tech Solutions LLC" },
    metadata: { duration: "12:30" },
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3),
  },
  {
    id: "7",
    type: "email_sent",
    description: "Sent 2023 tax return copy to client",
    user: { name: "Elizabeth", avatar: "" },
    client: { name: "John Smith" },
    metadata: { attachments: 1 },
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4),
  },
  {
    id: "8",
    type: "document_received",
    description: "Payroll documents received via scan",
    user: { name: "AI Email Agent", avatar: "" },
    client: { name: "XYZ Inc" },
    metadata: { documentCount: 5, source: "scan" },
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5),
  },
  {
    id: "9",
    type: "task_created",
    description: "New task created from phone call: Send tax return copy",
    user: { name: "AI Phone Agent", avatar: "" },
    client: { name: "John Smith" },
    metadata: { priority: "high" },
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6),
  },
  {
    id: "10",
    type: "note_added",
    description: "Added note to client profile regarding payment preferences",
    user: { name: "Britney", avatar: "" },
    client: { name: "ABC Corp" },
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 8),
  },
];

const activityIcons: Record<string, { icon: any; bg: string; color: string }> = {
  call_received: { icon: PhoneIncoming, bg: "bg-green-100", color: "text-green-600" },
  call_made: { icon: PhoneOutgoing, bg: "bg-blue-100", color: "text-blue-600" },
  email_received: { icon: MailOpen, bg: "bg-purple-100", color: "text-purple-600" },
  email_sent: { icon: Send, bg: "bg-indigo-100", color: "text-indigo-600" },
  document_received: { icon: FileText, bg: "bg-orange-100", color: "text-orange-600" },
  task_completed: { icon: CheckCircle, bg: "bg-green-100", color: "text-green-600" },
  task_created: { icon: Clock, bg: "bg-yellow-100", color: "text-yellow-600" },
  client_created: { icon: UserPlus, bg: "bg-accent/20", color: "text-accent-foreground" },
  note_added: { icon: MessageSquare, bg: "bg-gray-100", color: "text-gray-600" },
};

const activityLabels: Record<string, string> = {
  call_received: "Call Received",
  call_made: "Call Made",
  email_received: "Email Received",
  email_sent: "Email Sent",
  document_received: "Document Received",
  task_completed: "Task Completed",
  task_created: "Task Created",
  client_created: "Client Created",
  note_added: "Note Added",
};

export default function ActivityPage() {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredActivities = mockActivities.filter((activity) => {
    const matchesType = typeFilter === "all" || activity.type === typeFilter;
    const matchesUser =
      userFilter === "all" || activity.user.name === userFilter;
    const matchesSearch =
      activity.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      activity.client?.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesUser && matchesSearch;
  });

  const uniqueUsers = [...new Set(mockActivities.map((a) => a.user.name))];

  return (
    <>
      <Header title="Activity Log" />
      <main className="p-6 space-y-6">
        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                <Phone className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Calls Today</p>
                <p className="text-2xl font-bold">24</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <Mail className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Emails Processed</p>
                <p className="text-2xl font-bold">56</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
                <FileText className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Documents</p>
                <p className="text-2xl font-bold">18</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-accent-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tasks Completed</p>
                <p className="text-2xl font-bold">12</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Activity Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Activity Log
            </CardTitle>
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search activities..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>

              {/* Type Filter */}
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Activity Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="call_received">Calls Received</SelectItem>
                  <SelectItem value="call_made">Calls Made</SelectItem>
                  <SelectItem value="email_received">Emails Received</SelectItem>
                  <SelectItem value="email_sent">Emails Sent</SelectItem>
                  <SelectItem value="document_received">Documents</SelectItem>
                  <SelectItem value="task_completed">Tasks Completed</SelectItem>
                  <SelectItem value="task_created">Tasks Created</SelectItem>
                  <SelectItem value="client_created">Clients Created</SelectItem>
                </SelectContent>
              </Select>

              {/* User Filter */}
              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Actor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {uniqueUsers.map((user) => (
                    <SelectItem key={user} value={user}>
                      {user}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Export */}
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">Type</TableHead>
                  <TableHead>Activity</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredActivities.map((activity) => {
                  const iconConfig = activityIcons[activity.type] || {
                    icon: Activity,
                    bg: "bg-gray-100",
                    color: "text-gray-600",
                  };
                  const Icon = iconConfig.icon;

                  return (
                    <TableRow key={activity.id}>
                      <TableCell>
                        <div
                          className={cn(
                            "w-9 h-9 rounded-full flex items-center justify-center",
                            iconConfig.bg
                          )}
                        >
                          <Icon className={cn("h-4 w-4", iconConfig.color)} />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <Badge variant="outline" className="mb-1 text-xs">
                            {activityLabels[activity.type] || activity.type}
                          </Badge>
                          <p className="text-sm">{activity.description}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback
                              className={cn(
                                "text-xs",
                                activity.user.name.includes("AI")
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted"
                              )}
                            >
                              {activity.user.name.includes("AI")
                                ? "AI"
                                : activity.user.name
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{activity.user.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {activity.client ? (
                          <span className="text-sm font-medium text-primary">
                            {activity.client.name}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          {activity.metadata?.duration && (
                            <div>Duration: {activity.metadata.duration}</div>
                          )}
                          {activity.metadata?.documentCount && (
                            <div>
                              {activity.metadata.documentCount} documents (
                              {activity.metadata.source})
                            </div>
                          )}
                          {activity.metadata?.priority && (
                            <Badge variant="outline" className="text-xs">
                              {activity.metadata.priority} priority
                            </Badge>
                          )}
                          {activity.metadata?.attachments && (
                            <div>{activity.metadata.attachments} attachment(s)</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {format(activity.timestamp, "MMM d, h:mm a")}
                        </div>
                        <div className="text-xs text-muted-foreground" suppressHydrationWarning>
                          {formatDistanceToNow(activity.timestamp, {
                            addSuffix: true,
                          })}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {/* Pagination */}
            <div className="flex items-center justify-between px-6 py-4 border-t">
              <p className="text-sm text-muted-foreground">
                Showing 1 to {filteredActivities.length} of{" "}
                {mockActivities.length} entries
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled>
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-primary text-primary-foreground"
                >
                  1
                </Button>
                <Button variant="outline" size="sm">
                  2
                </Button>
                <Button variant="outline" size="sm">
                  3
                </Button>
                <Button variant="outline" size="sm">
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
