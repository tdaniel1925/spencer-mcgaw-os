"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { useKeyboardNavigation } from "@/hooks/use-keyboard-navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/supabase/auth-context";
import { TaskDetailPanel } from "@/components/tasks/task-detail-panel";
import { Task, useTaskContext } from "@/lib/tasks/task-context";
import {
  LayoutDashboard,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Loader2,
  Plus,
  Bot,
  Zap,
  Shield,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Mail,
  MailOpen,
  Users,
  Building2,
  Activity,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  Calendar,
  Flame,
  Target,
  Atom,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isPast, isToday } from "date-fns";
import { toast } from "sonner";

// ============================================================================
// MOCK DATA — American Fusion Energy
// ============================================================================

// Facility status
const facilities = [
  { name: "Kepler Lab — Southlake, TX", status: "operational", uptime: 98.7, lastInspection: "Jun 2", nextMilestone: "Texatron 5MW integration test" },
  { name: "He-3 Processing — Houston, TX", status: "maintenance", uptime: 94.2, lastInspection: "May 28", nextMilestone: "Supply chain qualification" },
  { name: "Diagnostics Center — Dallas, TX", status: "operational", uptime: 99.1, lastInspection: "Jun 5", nextMilestone: "Plasma analytics upgrade" },
];

// Recent phone calls
const recentCalls = [
  { id: "c1", type: "inbound" as const, caller: "Col. James Mitchell — DoD/DIU", duration: "18:42", time: "2:15 PM", summary: "ANPI program update. Discussed Texatron timeline for second-cohort evaluation. Wants written capability brief by June 20.", priority: "high" as const },
  { id: "c2", type: "outbound" as const, caller: "Sarah Chen — Microsoft Energy", duration: "32:10", time: "11:30 AM", summary: "Data center baseload requirements discussion. Microsoft evaluating 50MW+ fusion for Quincy, WA campus. Requested Texatron specs doc.", priority: "high" as const },
  { id: "c3", type: "inbound" as const, caller: "Dr. Erik Lindberg — Oak Ridge National Lab", duration: "24:15", time: "10:00 AM", summary: "Collaboration on D-He-3 plasma diagnostics. Offered access to ORNL neutron measurement facility. Follow-up meeting scheduled.", priority: "medium" as const },
  { id: "c4", type: "missed" as const, caller: "David Park — Goldman Sachs", duration: "0:00", time: "9:45 AM", summary: "Voicemail: Interested in AMFN for clean energy coverage initiation. Callback requested.", priority: "medium" as const },
  { id: "c5", type: "outbound" as const, caller: "Lisa Morales — Tweed Roosevelt (Legal)", duration: "15:30", time: "Yesterday", summary: "OTCQB application status review. All documentation submitted. Expected qualification timeline: 4-6 weeks.", priority: "medium" as const },
  { id: "c6", type: "inbound" as const, caller: "Maj. Rodriguez — US Army Corps of Engineers", duration: "12:08", time: "Yesterday", summary: "Janus site evaluation inquiry. Fort Carson considering fusion microreactor. Wants Nelson to present at July site visit.", priority: "high" as const },
];

// Recent emails
const recentEmails = [
  { id: "e1", from: "procurement@diu.mil", subject: "RE: AMFN Capability Brief — ANPI Second Cohort", time: "1:30 PM", read: false, priority: "high" as const, category: "Defense" },
  { id: "e2", from: "brent.nelson@keplerfusion.com", subject: "Texatron integration test schedule — UPDATED", time: "12:15 PM", read: false, priority: "high" as const, category: "Engineering" },
  { id: "e3", from: "investor.relations@ibnnewswire.com", subject: "Draft 8-K: Texatron structural frame completion", time: "11:00 AM", read: true, priority: "high" as const, category: "IR" },
  { id: "e4", from: "energy-procurement@microsoft.com", subject: "Follow-up: Baseload Requirements for Quincy Campus", time: "10:30 AM", read: false, priority: "medium" as const, category: "Commercial" },
  { id: "e5", from: "samuel.reid@americanfusion.com", subject: "NATO Allied Command briefing prep — June 25", time: "9:00 AM", read: true, priority: "medium" as const, category: "Defense" },
  { id: "e6", from: "careers@americanfusion.com", subject: "3 new applications: Senior Plasma Physicist", time: "8:30 AM", read: true, priority: "low" as const, category: "HR" },
  { id: "e7", from: "compliance@tweedlaw.com", subject: "OTCQB application — final review checklist", time: "Yesterday", read: true, priority: "medium" as const, category: "Legal" },
  { id: "e8", from: "supply@industrialgas.com", subject: "He-3 delivery schedule Q3 2026", time: "Yesterday", read: true, priority: "medium" as const, category: "Supply Chain" },
];

// Active projects / milestones
const activeProjects = [
  { name: "Texatron 5MW Unit Build", progress: 72, status: "on-track" as const, lead: "Brent Nelson", deadline: "Sep 2026", tasks: 34, completed: 24 },
  { name: "OTCQB Uplisting", progress: 85, status: "on-track" as const, lead: "Richard Hawkins", deadline: "Jul 2026", tasks: 12, completed: 10 },
  { name: "DoD ANPI Second Cohort Application", progress: 45, status: "at-risk" as const, lead: "Samuel Reid", deadline: "Aug 2026", tasks: 18, completed: 8 },
  { name: "He-3 Supply Chain Qualification", progress: 60, status: "on-track" as const, lead: "Operations", deadline: "Aug 2026", tasks: 8, completed: 5 },
  { name: "Microsoft Baseload Feasibility Study", progress: 15, status: "new" as const, lead: "Brent Nelson", deadline: "Oct 2026", tasks: 6, completed: 1 },
];

// Key contacts / clients
const keyContacts = [
  { name: "Col. James Mitchell", org: "DoD/DIU — ANPI Program", type: "Defense", lastContact: "Today", status: "active" },
  { name: "Sarah Chen", org: "Microsoft — Energy Procurement", type: "Commercial", lastContact: "Today", status: "active" },
  { name: "Dr. Erik Lindberg", org: "Oak Ridge National Lab", type: "Research", lastContact: "Today", status: "active" },
  { name: "David Park", org: "Goldman Sachs — Clean Energy", type: "Investor", lastContact: "Today", status: "callback" },
  { name: "Maj. Rodriguez", org: "US Army Corps of Engineers", type: "Defense", lastContact: "Yesterday", status: "active" },
  { name: "Lisa Morales", org: "Tweed Roosevelt LLP", type: "Legal", lastContact: "Yesterday", status: "active" },
  { name: "Dr. Yuki Tanaka", org: "JAXA — Japan Aerospace", type: "International", lastContact: "Jun 4", status: "follow-up" },
  { name: "Mark Stevens", org: "AWS — Infrastructure", type: "Commercial", lastContact: "Jun 3", status: "nurture" },
];

// Upcoming calendar
const upcomingEvents = [
  { title: "Texatron Integration Test Review", time: "3:00 PM Today", type: "engineering", attendees: "Nelson, Engineering team" },
  { title: "ANPI Capability Brief — Draft Review", time: "9:00 AM Tomorrow", type: "defense", attendees: "Reid, Hawkins, Legal" },
  { title: "Microsoft Baseload Follow-up Call", time: "2:00 PM Tomorrow", type: "commercial", attendees: "Nelson, Chen (MSFT)" },
  { title: "Weekly Executive Sync", time: "10:00 AM Wed", type: "internal", attendees: "Nelson, Reid, Hawkins" },
  { title: "NATO Allied Command Briefing Prep", time: "1:00 PM Thu", type: "defense", attendees: "Reid, Legal" },
  { title: "Goldman Sachs — Intro Call", time: "11:00 AM Fri", type: "investor", attendees: "Hawkins, Park (GS)" },
];

// Dashboard metrics
const mockStats = {
  overdue: 3,
  dueToday: 7,
  inProgress: 14,
  completedToday: 5,
  totalActive: 78,
};

// ============================================================================
// COMPONENT
// ============================================================================

interface DashboardTask {
  id: string;
  title: string;
  description?: string | null;
  priority: "urgent" | "high" | "medium" | "low";
  due_date: string | null;
  status: "open" | "in_progress" | "waiting" | "completed" | "cancelled";
  client_id: string | null;
  source_type: string | null;
  assigned_to?: string | null;
  client?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
}

const callTypeIcon = {
  inbound: PhoneIncoming,
  outbound: PhoneOutgoing,
  missed: PhoneMissed,
};

const callTypeColor = {
  inbound: "text-blue-600",
  outbound: "text-emerald-600",
  missed: "text-red-500",
};

const priorityColor = {
  urgent: "bg-red-100 text-red-700 border-red-200",
  high: "bg-amber-100 text-amber-700 border-amber-200",
  medium: "bg-blue-100 text-blue-700 border-blue-200",
  low: "bg-gray-100 text-gray-600 border-gray-200",
};

const statusColor = {
  "on-track": "bg-emerald-100 text-emerald-700",
  "at-risk": "bg-amber-100 text-amber-700",
  "new": "bg-blue-100 text-blue-700",
  "blocked": "bg-red-100 text-red-700",
};

const facilityStatusColor = {
  operational: "bg-emerald-500",
  maintenance: "bg-amber-500",
  offline: "bg-red-500",
};

const eventTypeColor: Record<string, string> = {
  engineering: "border-l-blue-500",
  defense: "border-l-amber-500",
  commercial: "border-l-emerald-500",
  internal: "border-l-gray-400",
  investor: "border-l-violet-500",
};

const contactTypeColor: Record<string, string> = {
  Defense: "bg-amber-100 text-amber-700",
  Commercial: "bg-emerald-100 text-emerald-700",
  Research: "bg-blue-100 text-blue-700",
  Investor: "bg-violet-100 text-violet-700",
  Legal: "bg-gray-100 text-gray-700",
  International: "bg-cyan-100 text-cyan-700",
  HR: "bg-pink-100 text-pink-700",
};

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { tasks: contextTasks, loading: tasksLoading, refreshTasks } = useTaskContext();
  const [mounted, setMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Task detail panel state
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);

  // Quick create dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "medium" as "urgent" | "high" | "medium" | "low",
    due_date: "",
  });

  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  useKeyboardNavigation({
    onEscape: () => { if (createDialogOpen) setCreateDialogOpen(false); },
    onEnter: () => { if (createDialogOpen && newTask.title.trim()) handleCreateTask(); },
    enabled: createDialogOpen,
    preventDefault: false,
  });

  const getGreeting = () => {
    const hour = currentTime.getHours();
    const firstName = user?.full_name?.split(" ")[0] || "";
    let greeting: string;
    if (hour < 12) greeting = "Good morning";
    else if (hour < 17) greeting = "Good afternoon";
    else greeting = "Good evening";
    return firstName ? `${greeting}, ${firstName}` : greeting;
  };

  const handleCreateTask = async () => {
    if (!newTask.title.trim()) { toast.error("Title is required"); return; }
    setCreating(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTask.title, description: newTask.description || null, priority: newTask.priority, due_date: newTask.due_date || null, status: "open" }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
      toast.success(`Task created: ${newTask.title.substring(0, 50)}`);
      setCreateDialogOpen(false);
      setNewTask({ title: "", description: "", priority: "medium", due_date: "" });
      refreshTasks?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create task");
    } finally { setCreating(false); }
  };

  if (!mounted) {
    return (
      <>
        <Header title="Dashboard" />
        <main className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header title="Dashboard" />
      <main className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
        {/* Top Bar */}
        <div className="h-14 border-b bg-card flex items-center px-4 gap-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Atom className="h-5 w-5 text-primary" />
            <span className="font-medium">American Fusion Energy</span>
          </div>
          <div className="flex-1" />
          <Button size="sm" onClick={() => setCreateDialogOpen(true)} className="h-8 gap-1.5">
            <Plus className="h-4 w-4" /> Quick Task
          </Button>
          <div className="h-4 border-l mx-2" />
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="font-medium text-red-600">{mockStats.overdue} overdue</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-amber-600" />
              <span className="font-medium text-amber-600">{mockStats.dueToday} due today</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-muted-foreground">{mockStats.completedToday} done</span>
            </div>
          </div>
          <div className="h-4 border-l mx-2" />
          <p className="text-sm text-muted-foreground" suppressHydrationWarning>
            {format(currentTime, "EEEE, MMMM d")}
          </p>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4 max-w-7xl mx-auto">
              {/* Greeting */}
              <Card className="border-border/50">
                <CardContent className="p-4">
                  <div className="bg-primary/5 rounded-lg p-4 border border-primary/10">
                    <div className="flex items-start gap-3">
                      <Atom className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <div>
                        <h1 className="text-xl font-semibold">{getGreeting()}</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                          {mockStats.totalActive} active tasks across {activeProjects.length} projects. {recentCalls.filter(c => c.type === "missed").length} missed call{recentCalls.filter(c => c.type === "missed").length !== 1 ? "s" : ""} and {recentEmails.filter(e => !e.read).length} unread emails need your attention.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Facility Status + Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Active Facilities</p>
                    </div>
                    <p className="text-2xl font-bold">{facilities.filter(f => f.status === "operational").length} / {facilities.length}</p>
                    <div className="mt-3 space-y-2">
                      {facilities.map((f) => (
                        <div key={f.name} className="flex items-center gap-2">
                          <div className={`h-2 w-2 rounded-full ${facilityStatusColor[f.status as keyof typeof facilityStatusColor]}`} />
                          <span className="text-xs truncate">{f.name.split("—")[0].trim()}</span>
                          <span className="text-xs text-muted-foreground ml-auto">{f.uptime}%</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Calls Today</p>
                    </div>
                    <p className="text-2xl font-bold">{recentCalls.filter(c => c.time.includes("PM") || c.time.includes("AM")).length}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-blue-600">{recentCalls.filter(c => c.type === "inbound").length} inbound</span>
                      <span className="text-xs text-emerald-600">{recentCalls.filter(c => c.type === "outbound").length} outbound</span>
                      <span className="text-xs text-red-500">{recentCalls.filter(c => c.type === "missed").length} missed</span>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Emails</p>
                    </div>
                    <p className="text-2xl font-bold">{recentEmails.filter(e => !e.read).length} unread</p>
                    <p className="text-xs text-muted-foreground mt-1">{recentEmails.length} total today</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700">{recentEmails.filter(e => e.priority === "high").length} high priority</Badge>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Projects</p>
                    </div>
                    <p className="text-2xl font-bold">{activeProjects.length} active</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700">{activeProjects.filter(p => p.status === "on-track").length} on track</Badge>
                      <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700">{activeProjects.filter(p => p.status === "at-risk").length} at risk</Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Main 3-column layout */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Left column — Phone Calls */}
                <Card className="lg:col-span-1">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Recent Calls
                      <Badge variant="secondary" className="ml-auto text-xs">{recentCalls.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {recentCalls.map((call) => {
                        const Icon = callTypeIcon[call.type];
                        return (
                          <div key={call.id} className="p-3 rounded-lg bg-muted/50 space-y-1.5 hover:bg-muted transition-colors cursor-pointer">
                            <div className="flex items-center gap-2">
                              <Icon className={`h-4 w-4 ${callTypeColor[call.type]}`} />
                              <span className="text-sm font-medium truncate flex-1">{call.caller}</span>
                              <Badge variant="outline" className={`text-[10px] ${priorityColor[call.priority]}`}>
                                {call.priority}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">{call.summary}</p>
                            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                              <span>{call.time}</span>
                              {call.duration !== "0:00" && <span>{call.duration}</span>}
                              {call.type === "missed" && <span className="text-red-500 font-medium">Callback needed</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <Button variant="ghost" size="sm" className="w-full mt-3 text-xs" onClick={() => router.push("/calls")}>
                      View All Calls
                    </Button>
                  </CardContent>
                </Card>

                {/* Center column — Emails */}
                <Card className="lg:col-span-1">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Recent Emails
                      <Badge variant="secondary" className="ml-auto text-xs">{recentEmails.filter(e => !e.read).length} new</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {recentEmails.map((email) => (
                        <div
                          key={email.id}
                          className={cn(
                            "p-3 rounded-lg space-y-1 hover:bg-muted transition-colors cursor-pointer",
                            email.read ? "bg-muted/30" : "bg-muted/50 border border-primary/10"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            {email.read ? (
                              <MailOpen className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            ) : (
                              <Mail className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                            )}
                            <span className={cn("text-xs truncate flex-1", !email.read && "font-semibold")}>
                              {email.from}
                            </span>
                            <Badge variant="outline" className={`text-[10px] ${contactTypeColor[email.category] || "bg-gray-100 text-gray-600"}`}>
                              {email.category}
                            </Badge>
                          </div>
                          <p className={cn("text-xs truncate", !email.read && "font-medium")}>{email.subject}</p>
                          <span className="text-[10px] text-muted-foreground">{email.time}</span>
                        </div>
                      ))}
                    </div>
                    <Button variant="ghost" size="sm" className="w-full mt-3 text-xs" onClick={() => router.push("/email-client")}>
                      Open Email Client
                    </Button>
                  </CardContent>
                </Card>

                {/* Right column — Calendar */}
                <Card className="lg:col-span-1">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Upcoming
                      <Badge variant="secondary" className="ml-auto text-xs">{upcomingEvents.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {upcomingEvents.map((event, i) => (
                        <div key={i} className={`p-3 rounded-lg bg-muted/50 border-l-2 ${eventTypeColor[event.type] || "border-l-gray-300"}`}>
                          <p className="text-xs font-medium">{event.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-muted-foreground">{event.time}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground">{event.attendees}</span>
                        </div>
                      ))}
                    </div>
                    <Button variant="ghost" size="sm" className="w-full mt-3 text-xs" onClick={() => router.push("/calendar")}>
                      View Calendar
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Projects */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Active Projects & Milestones
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {activeProjects.map((project) => (
                      <div key={project.name} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{project.name}</span>
                            <Badge variant="outline" className={`text-[10px] ${statusColor[project.status]}`}>
                              {project.status.replace("-", " ")}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground">{project.lead}</span>
                            <span className="text-xs text-muted-foreground">Due: {project.deadline}</span>
                            <span className="text-xs font-medium">{project.progress}%</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Progress value={project.progress} className="h-2 flex-1" />
                          <span className="text-xs text-muted-foreground w-24">
                            {project.completed}/{project.tasks} tasks
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Key Contacts */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Key Contacts & Stakeholders
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    {keyContacts.map((contact) => (
                      <div key={contact.name} className="p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium truncate">{contact.name}</p>
                          {contact.status === "callback" && (
                            <Badge variant="outline" className="text-[10px] bg-red-50 text-red-600">Callback</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{contact.org}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className={`text-[10px] ${contactTypeColor[contact.type] || "bg-gray-100 text-gray-600"}`}>
                            {contact.type}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground ml-auto">{contact.lastContact}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button variant="ghost" size="sm" className="w-full mt-3 text-xs" onClick={() => router.push("/clients")}>
                    View All Contacts
                  </Button>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </div>
      </main>

      {/* Task Detail Panel */}
      <TaskDetailPanel
        task={selectedTask}
        open={detailPanelOpen}
        onOpenChange={setDetailPanelOpen}
        onTaskUpdate={async () => { refreshTasks?.(); }}
      />

      {/* Quick Create Task Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Quick Create Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input placeholder="What needs to be done?" value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} autoFocus />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description (optional)</label>
              <Textarea placeholder="Add more details..." value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Priority</label>
                <Select value={newTask.priority} onValueChange={(v) => setNewTask({ ...newTask, priority: v as typeof newTask.priority })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Due Date</label>
                <Input type="date" value={newTask.due_date} onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateTask} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
