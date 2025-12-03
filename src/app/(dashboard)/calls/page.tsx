"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { StatCard } from "@/components/dashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Search,
  Play,
  Eye,
  Clock,
  CheckCircle,
  Bot,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";

// Mock call data
const mockCalls = [
  {
    id: "CALL001",
    vapiCallId: "vapi_abc123",
    direction: "inbound",
    status: "completed",
    callerPhone: "555-0101",
    callerName: "John Smith",
    clientId: "CL001",
    duration: 225,
    summary:
      "Client called requesting a copy of their 2023 tax return. Task created for document retrieval and email.",
    intent: "document_request",
    sentiment: "neutral",
    transcript: [
      {
        role: "assistant",
        message:
          "Thank you for calling Spencer McGaw CPA. This is the AI assistant. How may I help you today?",
        timestamp: 0,
      },
      {
        role: "user",
        message:
          "Hi, this is John Smith. I need a copy of my 2023 tax return sent to me.",
        timestamp: 5,
      },
      {
        role: "assistant",
        message:
          "Hello John! I can help you with that. Let me verify your information. I see you in our system. Would you like the tax return sent to your email on file?",
        timestamp: 12,
      },
      {
        role: "user",
        message: "Yes, please send it to my email.",
        timestamp: 22,
      },
      {
        role: "assistant",
        message:
          "I've created a task for our team to send your 2023 tax return to your email. You should receive it within 2 hours. Is there anything else I can help you with?",
        timestamp: 28,
      },
      {
        role: "user",
        message: "No, that's all. Thank you!",
        timestamp: 38,
      },
      {
        role: "assistant",
        message:
          "You're welcome, John! Have a great day. Goodbye!",
        timestamp: 42,
      },
    ],
    recordingUrl: "/recordings/call001.mp3",
    createdAt: new Date(Date.now() - 1000 * 60 * 30),
  },
  {
    id: "CALL002",
    vapiCallId: "vapi_def456",
    direction: "inbound",
    status: "completed",
    callerPhone: "555-0102",
    callerName: "Sarah Johnson",
    clientId: "CL003",
    duration: 480,
    summary:
      "Client upset about a delay in processing. Escalated to office manager for immediate follow-up. High priority task created.",
    intent: "complaint",
    sentiment: "negative",
    transcript: [],
    recordingUrl: "/recordings/call002.mp3",
    createdAt: new Date(Date.now() - 1000 * 60 * 90),
  },
  {
    id: "CALL003",
    vapiCallId: "vapi_ghi789",
    direction: "inbound",
    status: "missed",
    callerPhone: "555-0199",
    callerName: "Unknown",
    duration: 0,
    createdAt: new Date(Date.now() - 1000 * 60 * 120),
  },
  {
    id: "CALL004",
    vapiCallId: "vapi_jkl012",
    direction: "outbound",
    status: "completed",
    callerPhone: "555-0104",
    callerName: "Tech Solutions LLC",
    clientId: "CL005",
    duration: 750,
    summary:
      "Called client to discuss IRS notice. Explained next steps and scheduled follow-up meeting.",
    intent: "follow_up",
    sentiment: "positive",
    transcript: [],
    recordingUrl: "/recordings/call004.mp3",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3),
  },
  {
    id: "CALL005",
    vapiCallId: "vapi_mno345",
    direction: "inbound",
    status: "completed",
    callerPhone: "555-0150",
    callerName: "Mike Williams",
    duration: 180,
    summary:
      "New client inquiry about tax preparation services. Lead task created for Hunter.",
    intent: "new_client",
    sentiment: "positive",
    transcript: [],
    recordingUrl: "/recordings/call005.mp3",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5),
  },
];

const statusConfig = {
  completed: {
    label: "Completed",
    className: "bg-green-100 text-green-700",
    icon: CheckCircle,
  },
  missed: {
    label: "Missed",
    className: "bg-red-100 text-red-700",
    icon: PhoneMissed,
  },
  voicemail: {
    label: "Voicemail",
    className: "bg-yellow-100 text-yellow-700",
    icon: Phone,
  },
};

const intentConfig: Record<string, { label: string; className: string }> = {
  document_request: { label: "Document Request", className: "bg-blue-100 text-blue-700" },
  complaint: { label: "Complaint", className: "bg-red-100 text-red-700" },
  new_client: { label: "New Client", className: "bg-accent/20 text-accent-foreground" },
  follow_up: { label: "Follow-up", className: "bg-purple-100 text-purple-700" },
  question: { label: "Question", className: "bg-gray-100 text-gray-700" },
};

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export default function CallsPage() {
  const [directionFilter, setDirectionFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCall, setSelectedCall] = useState<typeof mockCalls[0] | null>(
    null
  );

  const filteredCalls = mockCalls.filter((call) => {
    const matchesDirection =
      directionFilter === "all" || call.direction === directionFilter;
    const matchesStatus =
      statusFilter === "all" || call.status === statusFilter;
    const matchesSearch =
      call.callerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      call.callerPhone.includes(searchQuery);
    return matchesDirection && matchesStatus && matchesSearch;
  });

  const callStats = {
    total: mockCalls.length,
    inbound: mockCalls.filter((c) => c.direction === "inbound").length,
    outbound: mockCalls.filter((c) => c.direction === "outbound").length,
    missed: mockCalls.filter((c) => c.status === "missed").length,
  };

  return (
    <>
      <Header title="Call Log" />
      <main className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard
            title="Total Calls Today"
            value={callStats.total}
            change={{ value: 12.5, period: "vs yesterday" }}
            icon={<Phone className="h-6 w-6 text-primary-foreground" />}
            iconBg="bg-primary"
          />
          <StatCard
            title="Inbound"
            value={callStats.inbound}
            change={{ value: 8.2, period: "vs yesterday" }}
            icon={<PhoneIncoming className="h-6 w-6 text-green-700" />}
            iconBg="bg-green-100"
          />
          <StatCard
            title="Outbound"
            value={callStats.outbound}
            change={{ value: 15.0, period: "vs yesterday" }}
            icon={<PhoneOutgoing className="h-6 w-6 text-blue-700" />}
            iconBg="bg-blue-100"
          />
          <StatCard
            title="Missed"
            value={callStats.missed}
            change={{ value: -25.0, period: "vs yesterday" }}
            icon={<PhoneMissed className="h-6 w-6 text-red-700" />}
            iconBg="bg-red-100"
          />
        </div>

        {/* Calls Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Bot className="h-5 w-5" />
              AI Phone Agent Calls
            </CardTitle>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search calls..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>

              <Select value={directionFilter} onValueChange={setDirectionFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Direction" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Calls</SelectItem>
                  <SelectItem value="inbound">Inbound</SelectItem>
                  <SelectItem value="outbound">Outbound</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="missed">Missed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Call ID</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Caller</TableHead>
                  <TableHead>Intent</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCalls.map((call) => {
                  const DirectionIcon =
                    call.direction === "inbound"
                      ? PhoneIncoming
                      : PhoneOutgoing;
                  const StatusIcon =
                    statusConfig[call.status as keyof typeof statusConfig]?.icon ||
                    Phone;

                  return (
                    <TableRow key={call.id}>
                      <TableCell className="font-medium text-primary">
                        #{call.id}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <DirectionIcon
                            className={cn(
                              "h-4 w-4",
                              call.direction === "inbound"
                                ? "text-green-600"
                                : "text-blue-600"
                            )}
                          />
                          <span className="capitalize text-sm">
                            {call.direction}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {call.callerName || "Unknown"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {call.callerPhone}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {call.intent ? (
                          <Badge
                            variant="secondary"
                            className={cn(
                              "font-normal",
                              intentConfig[call.intent]?.className
                            )}
                          >
                            {intentConfig[call.intent]?.label || call.intent}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          {call.duration > 0
                            ? formatDuration(call.duration)
                            : "-"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "font-normal",
                            statusConfig[call.status as keyof typeof statusConfig]
                              ?.className
                          )}
                        >
                          {
                            statusConfig[call.status as keyof typeof statusConfig]
                              ?.label
                          }
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {format(call.createdAt, "h:mm a")}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDistanceToNow(call.createdAt, {
                            addSuffix: true,
                          })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setSelectedCall(call)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>
                                  Call Details - #{call.id}
                                </DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                {/* Call Summary */}
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-sm text-muted-foreground">
                                      Caller
                                    </p>
                                    <p className="font-medium">
                                      {call.callerName || "Unknown"}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      {call.callerPhone}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">
                                      Duration
                                    </p>
                                    <p className="font-medium">
                                      {formatDuration(call.duration || 0)}
                                    </p>
                                  </div>
                                </div>

                                {call.summary && (
                                  <div>
                                    <p className="text-sm text-muted-foreground mb-1">
                                      AI Summary
                                    </p>
                                    <p className="bg-muted p-3 rounded-lg text-sm">
                                      {call.summary}
                                    </p>
                                  </div>
                                )}

                                {/* Transcript */}
                                {call.transcript && call.transcript.length > 0 && (
                                  <div>
                                    <p className="text-sm text-muted-foreground mb-2">
                                      Transcript
                                    </p>
                                    <ScrollArea className="h-[300px] border rounded-lg p-4">
                                      <div className="space-y-4">
                                        {call.transcript.map((msg, idx) => (
                                          <div
                                            key={idx}
                                            className={cn(
                                              "flex gap-3",
                                              msg.role === "assistant"
                                                ? ""
                                                : "flex-row-reverse"
                                            )}
                                          >
                                            <Avatar className="h-8 w-8">
                                              <AvatarFallback
                                                className={cn(
                                                  "text-xs",
                                                  msg.role === "assistant"
                                                    ? "bg-primary text-primary-foreground"
                                                    : "bg-accent text-accent-foreground"
                                                )}
                                              >
                                                {msg.role === "assistant" ? (
                                                  <Bot className="h-4 w-4" />
                                                ) : (
                                                  <User className="h-4 w-4" />
                                                )}
                                              </AvatarFallback>
                                            </Avatar>
                                            <div
                                              className={cn(
                                                "max-w-[80%] rounded-lg p-3 text-sm",
                                                msg.role === "assistant"
                                                  ? "bg-primary text-primary-foreground"
                                                  : "bg-muted"
                                              )}
                                            >
                                              {msg.message}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </ScrollArea>
                                  </div>
                                )}

                                {/* Recording */}
                                {call.recordingUrl && (
                                  <div>
                                    <p className="text-sm text-muted-foreground mb-2">
                                      Recording
                                    </p>
                                    <Button variant="outline" className="gap-2">
                                      <Play className="h-4 w-4" />
                                      Play Recording
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </DialogContent>
                          </Dialog>
                          {call.recordingUrl && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                          )}
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
                Showing 1 to {filteredCalls.length} of {mockCalls.length} calls
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
