"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Phone,
  Mail,
  ChevronDown,
  ChevronUp,
  Trash2,
  UserPlus,
  Loader2,
  RefreshCw,
  PhoneIncoming,
  PhoneOutgoing,
  Clock,
  Play,
  Pause,
  Paperclip,
  Star,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { AssignmentDialog } from "@/components/communications/assignment-dialog";
import {
  ConfirmationDialog,
  useDeleteConfirmation,
} from "@/components/ui/confirmation-dialog";

interface Communication {
  id: string;
  type: "phone" | "email";
  timestamp: string;
  from: string;
  fromIdentifier: string;
  subject: string;
  preview: string | null;
  // Phone-specific fields
  duration?: number;
  direction?: string;
  status?: string;
  recordingUrl?: string;
  transcription?: string;
  // Email-specific fields
  importance?: string;
  hasAttachments?: boolean;
  attachmentCount?: number;
  isRead?: boolean;
  isFlagged?: boolean;
  bodyHtml?: string;
  bodyText?: string;
  userId?: string | null; // NULL = unassigned email
  connectionEmail?: string; // Email account this came from
  // Common AI fields
  aiSummary?: string | null;
  sentiment?: string | null;
  intent?: string | null;
  priorityScore?: number;
  clientId?: string | null;
}

export default function InboundPage() {
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState<"all" | "phone" | "email">("all");
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  // Assignment dialog state
  const [assignmentDialog, setAssignmentDialog] = useState<{
    open: boolean;
    communicationId: string | null;
    communicationType: "phone" | "email" | null;
    communicationSubject: string | null;
  }>({
    open: false,
    communicationId: null,
    communicationType: null,
    communicationSubject: null,
  });

  // Delete confirmation
  const { confirmDelete, state: deleteState, setOpen: setDeleteOpen } = useDeleteConfirmation();

  // Mock communications data for demo
  const mockCommunications: Communication[] = [
    {
      id: "call-1",
      type: "phone",
      timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      from: "Col. James Mitchell",
      fromIdentifier: "+1 (703) 555-0142",
      subject: "ANPI Second Cohort — Texatron Timeline",
      preview: "Discussed Texatron timeline for second-cohort evaluation. Wants written capability brief by June 20. Mentioned Fort Carson and Fort Drum as priority Janus sites.",
      duration: 1122,
      direction: "inbound",
      status: "completed",
      aiSummary: "DoD/DIU program manager requesting capability brief for ANPI second cohort evaluation. Timeline: June 20 deadline. Key action: prepare written brief with Texatron specs, timeline, and deployment scenarios.",
      sentiment: "positive",
      intent: "procurement_inquiry",
      priorityScore: 95,
    },
    {
      id: "call-2",
      type: "phone",
      timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
      from: "Sarah Chen — Microsoft Energy",
      fromIdentifier: "+1 (425) 555-0198",
      subject: "Data Center Baseload Requirements — Quincy, WA",
      preview: "Microsoft evaluating 50MW+ fusion for Quincy, WA campus. AI rack density driving unprecedented power demand. Requested Texatron specs document and feasibility study scope.",
      duration: 1930,
      direction: "outbound",
      status: "completed",
      aiSummary: "Microsoft energy procurement exploring fusion baseload for Quincy data center. 50MW+ requirement. Need: Texatron spec sheet, preliminary feasibility study. Follow-up call scheduled for tomorrow 2PM.",
      sentiment: "positive",
      intent: "commercial_inquiry",
      priorityScore: 90,
    },
    {
      id: "email-1",
      type: "email",
      timestamp: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
      from: "procurement@diu.mil",
      fromIdentifier: "procurement@diu.mil",
      subject: "RE: AMFN Capability Brief — ANPI Second Cohort",
      preview: "Thank you for the initial submission. We need the following additional documentation by COB June 20: (1) Updated deployment timeline, (2) Safety analysis summary, (3) Logistics requirements for portable configuration...",
      importance: "high",
      hasAttachments: true,
      attachmentCount: 2,
      isRead: false,
      aiSummary: "DIU requesting additional documentation for ANPI capability brief. Three specific items needed by June 20. Attachments include requirements template and evaluation criteria.",
      sentiment: "neutral",
      intent: "document_request",
      priorityScore: 95,
    },
    {
      id: "call-3",
      type: "phone",
      timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
      from: "Dr. Erik Lindberg — Oak Ridge National Lab",
      fromIdentifier: "+1 (865) 555-0234",
      subject: "D-He-3 Plasma Diagnostics Collaboration",
      preview: "Offered access to ORNL neutron measurement facility for D-He-3 plasma diagnostics validation. Discussed potential joint publication on aneutronic fusion diagnostics methodology.",
      duration: 1455,
      direction: "inbound",
      status: "completed",
      aiSummary: "ORNL researcher proposing collaboration on plasma diagnostics. Offering facility access and co-publication opportunity. High value for technical credibility. Follow-up meeting scheduled.",
      sentiment: "positive",
      intent: "collaboration",
      priorityScore: 80,
    },
    {
      id: "email-2",
      type: "email",
      timestamp: new Date(Date.now() - 1000 * 60 * 150).toISOString(),
      from: "brent.nelson@keplerfusion.com",
      fromIdentifier: "brent.nelson@keplerfusion.com",
      subject: "Texatron Integration Test Schedule — UPDATED",
      preview: "Team — updated the integration test schedule. Plasma containment vessel installation moved to June 12. Diagnostics array calibration now June 14-16. Full system integration test targeted for June 20...",
      importance: "high",
      hasAttachments: true,
      attachmentCount: 1,
      isRead: false,
      aiSummary: "Updated Texatron build schedule from Nelson. Key dates: containment vessel June 12, diagnostics calibration June 14-16, full integration test June 20.",
      sentiment: "neutral",
      intent: "status_update",
      priorityScore: 85,
    },
    {
      id: "call-4",
      type: "phone",
      timestamp: new Date(Date.now() - 1000 * 60 * 200).toISOString(),
      from: "David Park — Goldman Sachs",
      fromIdentifier: "+1 (212) 555-0167",
      subject: "Clean Energy Coverage Initiation",
      preview: null,
      duration: 0,
      direction: "inbound",
      status: "missed",
      aiSummary: "Voicemail: Goldman Sachs clean energy analyst interested in AMFN for coverage initiation. Callback requested.",
      sentiment: "positive",
      intent: "investor_inquiry",
      priorityScore: 75,
    },
    {
      id: "email-3",
      type: "email",
      timestamp: new Date(Date.now() - 1000 * 60 * 210).toISOString(),
      from: "investor.relations@ibnnewswire.com",
      fromIdentifier: "investor.relations@ibnnewswire.com",
      subject: "Draft 8-K: Texatron Structural Frame Completion",
      preview: "Attached is the draft 8-K for your review. Please confirm the milestone language and forward-looking statement disclaimers. We recommend filing by EOD Thursday to allow social amplification on Friday...",
      importance: "high",
      hasAttachments: true,
      attachmentCount: 3,
      isRead: true,
      aiSummary: "IBN newswire draft 8-K for Texatron structural frame milestone. Needs review of milestone language and FLS disclaimers. Recommended filing: Thursday EOD.",
      sentiment: "neutral",
      intent: "compliance_review",
      priorityScore: 88,
    },
    {
      id: "call-5",
      type: "phone",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      from: "Maj. Rodriguez — US Army Corps of Engineers",
      fromIdentifier: "+1 (719) 555-0321",
      subject: "Janus Site Evaluation — Fort Carson",
      preview: "Fort Carson considering fusion microreactor for base energy resilience. Wants Nelson to present at July site visit. Discussed grid-independent operation requirements and timeline for portable unit deployment.",
      duration: 728,
      direction: "inbound",
      status: "completed",
      aiSummary: "Army Corps inquiring about fusion microreactor for Fort Carson Janus site. Requesting Nelson presentation at July site visit. Key requirements: grid-independent operation, portable deployment.",
      sentiment: "positive",
      intent: "procurement_inquiry",
      priorityScore: 88,
    },
    {
      id: "email-4",
      type: "email",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      from: "energy-procurement@microsoft.com",
      fromIdentifier: "energy-procurement@microsoft.com",
      subject: "Follow-up: Baseload Requirements for Quincy Campus",
      preview: "Hi team, following up on our call today. Attached are the detailed power requirements for the Quincy campus expansion. We're looking at 50-100MW baseload with 99.99% uptime SLA...",
      importance: "normal",
      hasAttachments: true,
      attachmentCount: 2,
      isRead: false,
      aiSummary: "Microsoft follow-up with detailed Quincy campus power requirements. 50-100MW baseload, 99.99% uptime SLA. Attachments include requirements doc and campus expansion timeline.",
      sentiment: "positive",
      intent: "commercial_inquiry",
      priorityScore: 85,
    },
    {
      id: "call-6",
      type: "phone",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 25).toISOString(),
      from: "Lisa Morales — Tweed Roosevelt LLP",
      fromIdentifier: "+1 (512) 555-0445",
      subject: "OTCQB Application Status Review",
      preview: "All documentation submitted. Expected qualification timeline: 4-6 weeks. Discussed Frankfurt secondary listing requirements — need to prepare German-language disclosures.",
      duration: 930,
      direction: "outbound",
      status: "completed",
      aiSummary: "Legal counsel update on OTCQB application. All docs submitted, 4-6 week timeline. Also discussed Frankfurt listing prep — German-language disclosures needed.",
      sentiment: "positive",
      intent: "legal_update",
      priorityScore: 70,
    },
    {
      id: "email-5",
      type: "email",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
      from: "samuel.reid@americanfusion.com",
      fromIdentifier: "samuel.reid@americanfusion.com",
      subject: "NATO Allied Command Briefing Prep — June 25",
      preview: "Team — need to prepare briefing materials for NATO Allied Command presentation on June 25. Focus areas: (1) D-He-3 technology overview, (2) Portable deployment capabilities, (3) Allied procurement pathways...",
      importance: "normal",
      hasAttachments: false,
      isRead: true,
      aiSummary: "Reid requesting briefing materials for NATO presentation. Three focus areas: technology overview, portable deployment, allied procurement. Deadline: June 25.",
      sentiment: "neutral",
      intent: "task_assignment",
      priorityScore: 75,
    },
    {
      id: "email-6",
      type: "email",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 28).toISOString(),
      from: "supply@industrialgas.com",
      fromIdentifier: "supply@industrialgas.com",
      subject: "He-3 Delivery Schedule Q3 2026",
      preview: "Confirming Q3 delivery schedule for helium-3 supply. July shipment: 500L, August: 750L, September: 750L. Please confirm receiving facility specifications and safety protocols...",
      importance: "normal",
      hasAttachments: true,
      attachmentCount: 1,
      isRead: true,
      aiSummary: "He-3 supplier confirming Q3 delivery schedule. Total: 2,000L across July-September. Need to confirm receiving facility specs.",
      sentiment: "neutral",
      intent: "supply_chain",
      priorityScore: 65,
    },
  ];

  // Fetch communications (falls back to mock data for demo)
  const fetchCommunications = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType !== "all") params.append("type", filterType);

      const queryString = params.toString();
      const response = await fetch(`/api/inbound${queryString ? `?${queryString}` : ""}`);

      if (!response.ok) throw new Error("Failed to fetch");

      const data = await response.json();
      const live = data.communications || [];
      // Use live data if available, otherwise fall back to mock
      if (live.length > 0) {
        setCommunications(live);
      } else {
        const filtered = filterType === "all"
          ? mockCommunications
          : mockCommunications.filter(c => c.type === filterType);
        setCommunications(filtered);
      }
    } catch {
      // Silently fall back to mock data for demo
      const filtered = filterType === "all"
        ? mockCommunications
        : mockCommunications.filter(c => c.type === filterType);
      setCommunications(filtered);
    } finally {
      setIsLoading(false);
    }
  }, [filterType]);

  useEffect(() => {
    fetchCommunications();
  }, [fetchCommunications]);

  // Toggle card expansion and log view
  const toggleCard = (id: string) => {
    const comm = communications.find((c) => c.id === id);

    setExpandedCards((prev) => {
      const newSet = new Set(prev);
      const isExpanding = !newSet.has(id);

      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);

        // Log view when expanding (only if not already logged)
        if (isExpanding && comm) {
          logCommunicationView(comm);
        }
      }
      return newSet;
    });
  };

  // Log communication view for audit trail
  const logCommunicationView = async (comm: Communication) => {
    try {
      if (comm.type === "email") {
        await fetch("/api/audit/log-email-view", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emailId: comm.id }),
        });
      } else if (comm.type === "phone") {
        await fetch("/api/audit/log-call-view", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callId: comm.id }),
        });
      }
    } catch (error) {
      // Silent fail - don't block UX for audit logging
      console.error("Failed to log communication view:", error);
    }
  };

  // Open assignment dialog
  const openAssignmentDialog = (comm: Communication) => {
    setAssignmentDialog({
      open: true,
      communicationId: comm.id,
      communicationType: comm.type,
      communicationSubject: comm.subject,
    });
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    const comm = communications.find((c) => c.id === id);
    if (!comm) return;

    try {
      const endpoint =
        comm.type === "phone" ? `/api/calls/${id}` : `/api/email/messages/${id}`;

      const response = await fetch(endpoint, { method: "DELETE" });

      if (!response.ok) throw new Error("Failed to delete");

      toast.success(`${comm.type === "phone" ? "Call" : "Email"} deleted successfully`);
      fetchCommunications(); // Refresh list
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete communication");
    }
  };

  // Format duration for calls
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Get initials for avatar
  const getInitials = (name: string | null | undefined): string => {
    if (!name) return "??";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <>
      <Header title="Inbound Communications" />
      <main className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
        {/* Top Bar */}
        <div className="border-b bg-card flex-shrink-0">
          <div className="h-12 flex items-center px-4 gap-4">
            {/* Filter Tabs */}
            <div className="flex items-center gap-2">
              <Button
                variant={filterType === "all" ? "default" : "ghost"}
                size="sm"
                onClick={() => setFilterType("all")}
                className="h-8"
              >
                All (Emails and Phone)
                <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-[10px]">
                  {communications.length}
                </Badge>
              </Button>
              <Button
                variant={filterType === "phone" ? "default" : "ghost"}
                size="sm"
                onClick={() => setFilterType("phone")}
                className="h-8"
              >
                <Phone className="h-4 w-4 mr-2" />
                Phone Only
              </Button>
              <Button
                variant={filterType === "email" ? "default" : "ghost"}
                size="sm"
                onClick={() => setFilterType("email")}
                className="h-8"
              >
                <Mail className="h-4 w-4 mr-2" />
                Emails Only
              </Button>
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Refresh Button */}
            <Button variant="outline" size="sm" onClick={fetchCommunications} disabled={isLoading} className="h-8">
              <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Timeline Content */}
        <div className="flex-1 overflow-auto">
          <div className="container mx-auto p-6 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : communications.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Phone className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-2">No Communications</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {filterType === "all"
                  ? "No phone calls or emails to display."
                  : `No ${filterType === "phone" ? "phone calls" : "emails"} to display.`}
              </p>
            </CardContent>
          </Card>
        ) : (
          communications.map((comm) => {
            const isExpanded = expandedCards.has(comm.id);

            return (
              <Collapsible
                key={comm.id}
                open={isExpanded}
                onOpenChange={() => toggleCard(comm.id)}
              >
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      {/* Header Row */}
                      <div className="flex items-start justify-between gap-3">
                        {/* Left: Avatar + Info */}
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <Avatar className="h-10 w-10 flex-shrink-0">
                            <AvatarFallback className="bg-muted">
                              {getInitials(comm.from)}
                            </AvatarFallback>
                          </Avatar>

                          <div className="flex-1 min-w-0">
                            {/* Type Badge + From */}
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-xs font-bold uppercase",
                                  comm.type === "phone"
                                    ? "bg-blue-50 text-blue-700 border-blue-300"
                                    : "bg-purple-50 text-purple-700 border-purple-300"
                                )}
                              >
                                {comm.type === "phone" ? "PHONE" : "EMAIL"}
                              </Badge>

                              {/* Email Account Badge */}
                              {comm.type === "email" && comm.connectionEmail && (
                                <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-700 border-slate-300">
                                  <Mail className="h-3 w-3 mr-1" />
                                  {comm.connectionEmail}
                                </Badge>
                              )}

                              {/* Direction badge for calls */}
                              {comm.type === "phone" && comm.direction && (
                                <Badge variant="secondary" className="text-[10px]">
                                  {comm.direction === "inbound" ? (
                                    <PhoneIncoming className="h-3 w-3 mr-1" />
                                  ) : (
                                    <PhoneOutgoing className="h-3 w-3 mr-1" />
                                  )}
                                  {comm.direction}
                                </Badge>
                              )}

                              {/* Email indicators */}
                              {comm.type === "email" && comm.userId === null && (
                                <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-300">
                                  Unassigned
                                </Badge>
                              )}
                              {comm.type === "email" && comm.isFlagged && (
                                <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                              )}
                              {comm.type === "email" && comm.hasAttachments && (
                                <Paperclip className="h-3 w-3 text-muted-foreground" />
                              )}
                            </div>

                            {/* From Name */}
                            <p className="font-semibold text-sm truncate">{comm.from}</p>

                            {/* Subject */}
                            <p className="text-sm font-medium text-foreground truncate mt-1">
                              {comm.subject}
                            </p>

                            {/* Preview */}
                            {comm.preview && !isExpanded && (
                              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                {comm.preview}
                              </p>
                            )}

                            {/* AI Summary (if available) */}
                            {comm.aiSummary && !isExpanded && (
                              <div className="bg-primary/5 border border-primary/10 rounded-md p-2 mt-2">
                                <p className="text-xs text-foreground">{comm.aiSummary}</p>
                              </div>
                            )}

                            {/* Meta Info */}
                            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDistanceToNow(new Date(comm.timestamp), {
                                  addSuffix: true,
                                })}
                              </span>
                              {comm.type === "phone" && comm.duration && (
                                <span>{formatDuration(comm.duration)}</span>
                              )}
                              {comm.type === "email" && !comm.isRead && (
                                <Badge variant="default" className="text-[10px] h-4">
                                  Unread
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right: Quick Actions */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              openAssignmentDialog(comm);
                            }}
                          >
                            <UserPlus className="h-4 w-4 mr-1" />
                            Assign
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              confirmDelete({
                                title: `Delete ${comm.type === "phone" ? "Call" : "Email"}`,
                                description: `Are you sure you want to delete this ${comm.type}? This action cannot be undone.`,
                                onConfirm: () => handleDelete(comm.id),
                              });
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>

                          {/* Expand/Collapse Trigger */}
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                        </div>
                      </div>

                      {/* Expanded Content */}
                      <CollapsibleContent className="space-y-3 pt-3 border-t">
                        {/* AI Summary (expanded) */}
                        {comm.aiSummary && (
                          <div className="bg-primary/5 border border-primary/10 rounded-md p-3">
                            <p className="text-sm font-medium mb-1">AI Summary</p>
                            <p className="text-sm text-muted-foreground">{comm.aiSummary}</p>
                          </div>
                        )}

                        {/* Phone Call: Transcription */}
                        {comm.type === "phone" && comm.transcription && (
                          <div className="bg-muted/50 rounded-md p-3">
                            <p className="text-sm font-medium mb-2">Transcription</p>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {comm.transcription}
                            </p>
                          </div>
                        )}

                        {/* Phone Call: Recording */}
                        {comm.type === "phone" && comm.recordingUrl && (
                          <div className="bg-muted/50 rounded-md p-3">
                            <p className="text-sm font-medium mb-2">Recording</p>
                            <audio controls className="w-full">
                              <source src={comm.recordingUrl} type="audio/mpeg" />
                              Your browser does not support the audio element.
                            </audio>
                          </div>
                        )}

                        {/* Email: Body */}
                        {comm.type === "email" && (comm.bodyHtml || comm.bodyText) && (
                          <div className="bg-white dark:bg-gray-900 border rounded-md overflow-hidden">
                            <div className="bg-muted/50 px-3 py-2 border-b">
                              <p className="text-sm font-medium">Message</p>
                            </div>
                            <ScrollArea className="max-h-[600px]">
                              <div className="p-4">
                                {comm.bodyHtml ? (
                                  <div
                                    className="prose prose-sm dark:prose-invert max-w-none
                                             prose-headings:font-semibold prose-headings:text-foreground
                                             prose-p:text-foreground prose-p:leading-relaxed
                                             prose-a:text-primary hover:prose-a:text-primary/80
                                             prose-strong:text-foreground prose-strong:font-semibold
                                             prose-ul:text-foreground prose-ol:text-foreground
                                             prose-li:text-foreground prose-code:text-foreground
                                             prose-blockquote:text-muted-foreground prose-blockquote:border-l-primary"
                                    dangerouslySetInnerHTML={{ __html: comm.bodyHtml }}
                                  />
                                ) : (
                                  <div className="text-sm text-foreground leading-relaxed space-y-3">
                                    {comm.bodyText?.split('\n\n').map((paragraph, idx) => (
                                      <p key={idx} className="whitespace-pre-wrap">
                                        {paragraph}
                                      </p>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </ScrollArea>
                          </div>
                        )}

                        {/* Sentiment & Intent Badges */}
                        {(comm.sentiment || comm.intent) && (
                          <div className="flex flex-wrap gap-2">
                            {comm.sentiment && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-xs",
                                  comm.sentiment === "positive" &&
                                    "bg-green-50 text-green-700 border-green-200",
                                  comm.sentiment === "negative" &&
                                    "bg-red-50 text-red-700 border-red-200",
                                  comm.sentiment === "neutral" &&
                                    "bg-gray-50 text-gray-700 border-gray-200"
                                )}
                              >
                                Sentiment: {comm.sentiment}
                              </Badge>
                            )}
                            {comm.intent && (
                              <Badge variant="outline" className="text-xs">
                                Intent: {comm.intent}
                              </Badge>
                            )}
                          </div>
                        )}
                      </CollapsibleContent>
                    </div>
                  </CardContent>
                </Card>
              </Collapsible>
            );
          })
        )}
          </div>
        </div>
      </main>

      {/* Assignment Dialog */}
      <AssignmentDialog
        open={assignmentDialog.open}
        onOpenChange={(open) => setAssignmentDialog((prev) => ({ ...prev, open }))}
        communicationId={assignmentDialog.communicationId || ""}
        communicationType={assignmentDialog.communicationType || "phone"}
        communicationSubject={assignmentDialog.communicationSubject || ""}
        onAssignmentComplete={fetchCommunications}
      />

      {/* Delete Confirmation */}
      <ConfirmationDialog {...deleteState} onOpenChange={setDeleteOpen} />
    </>
  );
}
