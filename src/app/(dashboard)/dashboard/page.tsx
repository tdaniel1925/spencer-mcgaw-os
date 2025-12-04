"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Clock,
  CheckCircle,
  Phone,
  FileText,
  Mail,
  Bot,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Play,
  Eye,
  ArrowRight,
  Zap,
  Users,
  Timer,
  Target,
  DollarSign,
  Calendar,
  BarChart3,
  Activity,
  Headphones,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";

// Types
interface UrgentItem {
  id: string;
  title: string;
  client: string;
  dueIn: string;
  type: "irs_notice" | "callback" | "approval" | "deadline";
  action: string;
}

interface PriorityItem {
  id: string;
  title: string;
  count?: number;
}

interface AIPhoneCall {
  id: string;
  callerName: string;
  callerPhone: string;
  time: Date;
  intent: string;
  actionTaken: string;
  status: "handled" | "needs_action" | "transferred";
  duration: string;
}

interface AICompletedAction {
  id: string;
  action: string;
  count: number;
  icon: React.ElementType;
}

// Empty arrays - real data comes from database/webhooks
const urgentItems: UrgentItem[] = [];
const priorities: PriorityItem[] = [];
const phoneCalls: AIPhoneCall[] = [];
const aiActions: AICompletedAction[] = [];

const urgentTypeConfig = {
  irs_notice: { color: "bg-red-500", icon: AlertCircle },
  callback: { color: "bg-amber-500", icon: Phone },
  approval: { color: "bg-blue-500", icon: CheckCircle },
  deadline: { color: "bg-violet-500", icon: Clock },
};

const callStatusConfig = {
  handled: { label: "AI Handled", className: "bg-green-100 text-green-700" },
  needs_action: { label: "Needs Action", className: "bg-amber-100 text-amber-700" },
  transferred: { label: "Transferred", className: "bg-blue-100 text-blue-700" },
};

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  // Stats calculations - zeros until real data is available
  const timeSavedToday = 0;
  const timeSavedYesterday = 0;
  const automationRate = 0;
  const totalTasks = 0;
  const urgentTasks = 0;
  const taskProgress = 0;
  const weeklyHoursWithoutAI = 0;
  const weeklyHoursWithAI = 0;
  const hoursSaved = 0;
  const efficiencyGain = 0;
  const dollarValue = 0;

  return (
    <>
      <Header title="Dashboard" />
      <main className="p-6 space-y-6 overflow-auto">
        {/* Greeting & Date */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{getGreeting()}, Elizabeth!</h1>
            <p className="text-muted-foreground" suppressHydrationWarning>
              {format(currentTime, "EEEE, MMMM d, yyyy")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium">AI Assistant Active</span>
          </div>
        </div>

        {/* Top Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Time Saved Today */}
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Time Saved Today</p>
                  <p className="text-3xl font-bold mt-1">{timeSavedToday} hours</p>
                  <p className="text-sm text-primary flex items-center gap-1 mt-1">
                    <TrendingUp className="h-4 w-4" />
                    +{((timeSavedToday - timeSavedYesterday) * 60).toFixed(0)} min vs yesterday
                  </p>
                </div>
                <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center">
                  <Timer className="h-7 w-7 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Efficiency */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">AI Automation Rate</p>
                  <p className="text-3xl font-bold mt-1">{automationRate}%</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    <span className="font-medium text-foreground">0</span> actions auto-completed this week
                  </p>
                </div>
                <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                  <Zap className="h-7 w-7 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Workload */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm text-muted-foreground">Today&apos;s Workload</p>
                  <p className="text-3xl font-bold mt-1">{totalTasks} Tasks</p>
                </div>
                <Badge variant="destructive" className="text-xs">
                  {urgentTasks} Urgent
                </Badge>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{taskProgress}%</span>
                </div>
                <Progress value={taskProgress} className="h-2" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - What Needs Attention */}
          <div className="lg:col-span-2 space-y-6">
            {/* Urgent Items */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  What Needs Your Attention
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Urgent Section */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="text-sm font-medium">URGENT ({urgentItems.length})</span>
                  </div>
                  <div className="space-y-2">
                    {urgentItems.map((item) => {
                      const config = urgentTypeConfig[item.type];
                      const Icon = config.icon;
                      return (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                        >
                          <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", config.color)}>
                            <Icon className="h-4 w-4 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{item.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.client} • Due in {item.dueIn}
                            </p>
                          </div>
                          <Button size="sm" variant="outline">
                            {item.action}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Today's Priorities */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="text-sm font-medium">TODAY&apos;S PRIORITIES ({priorities.length})</span>
                  </div>
                  <div className="space-y-2">
                    {priorities.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                      >
                        <ArrowRight className="h-4 w-4 text-amber-500" />
                        <span className="text-sm">{item.title}</span>
                        {item.count && (
                          <Badge variant="secondary" className="ml-auto">
                            {item.count} pending
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Workflow Comparison */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Weekly Efficiency Report
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Without AI</span>
                      <span className="font-medium">{weeklyHoursWithoutAI} hrs</span>
                    </div>
                    <div className="h-4 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-red-400 rounded-full" style={{ width: "100%" }} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">With AI</span>
                      <span className="font-medium">{weeklyHoursWithAI} hrs</span>
                    </div>
                    <div className="h-4 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${(weeklyHoursWithAI / weeklyHoursWithoutAI) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-6 pt-4 border-t">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-primary">{hoursSaved} hrs</p>
                      <p className="text-xs text-muted-foreground">Hours Saved</p>
                    </div>
                    <div className="w-px h-10 bg-border" />
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">{efficiencyGain}%</p>
                      <p className="text-xs text-muted-foreground">Efficiency Gain</p>
                    </div>
                    <div className="w-px h-10 bg-border" />
                    <div className="text-center">
                      <p className="text-2xl font-bold text-amber-600">${dollarValue.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Value Saved</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Recent AI Phone Calls */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Headphones className="h-5 w-5" />
                    AI Phone Calls
                  </CardTitle>
                  <Badge variant="secondary" className="text-xs">
                    {phoneCalls.length} today
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[320px]">
                  <div className="p-4 space-y-3">
                    {phoneCalls.map((call) => (
                      <div key={call.id} className="p-3 border rounded-lg space-y-2">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-primary" />
                            <div>
                              <p className="font-medium text-sm">{call.callerName}</p>
                              <p className="text-xs text-muted-foreground" suppressHydrationWarning>
                                {format(call.time, "h:mm a")} • {call.duration}
                              </p>
                            </div>
                          </div>
                          <Badge
                            variant="secondary"
                            className={cn("text-xs", callStatusConfig[call.status].className)}
                          >
                            {callStatusConfig[call.status].label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">&quot;{call.intent}&quot;</p>
                        <div className="flex items-center gap-2 text-xs">
                          <Bot className="h-3 w-3 text-primary" />
                          <span className="text-muted-foreground">→ {call.actionTaken}</span>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" className="h-7 text-xs">
                            <Play className="h-3 w-3 mr-1" />
                            Listen
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 text-xs">
                            <MessageSquare className="h-3 w-3 mr-1" />
                            Transcript
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* AI Completed Today */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Bot className="h-5 w-5 text-primary" />
                    AI Completed Today
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {aiActions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <div key={action.id} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <span className="flex-1 text-sm">{action.action}</span>
                        <Badge variant="secondary">{action.count}</Badge>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 pt-4 border-t flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-muted-foreground">Est. value:</span>
                  </div>
                  <span className="font-semibold text-green-600">$0</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}
