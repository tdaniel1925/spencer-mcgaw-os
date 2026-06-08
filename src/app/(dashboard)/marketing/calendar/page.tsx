"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Calendar, Filter } from "lucide-react";

type Channel = "all" | "linkedin-company" | "linkedin-nelson" | "linkedin-reid" | "linkedin-hawkins" | "x" | "instagram" | "youtube" | "newsletter";
type Pillar = "all" | "BIP" | "EDU" | "AI" | "DEF" | "IR" | "FV";
type Status = "PLANNED" | "DRAFTED" | "REVIEWED" | "APPROVED" | "SCHEDULED" | "PUBLISHED";

interface CalendarEntry {
  day: number;
  date: string;
  dayOfWeek: string;
  channel: string;
  owner: string;
  pillar: string;
  title: string;
  status: Status;
  notes?: string;
}

const statusColors: Record<Status, string> = {
  PLANNED: "bg-gray-100 text-gray-700 border-gray-200",
  DRAFTED: "bg-blue-100 text-blue-700 border-blue-200",
  REVIEWED: "bg-yellow-100 text-yellow-700 border-yellow-200",
  APPROVED: "bg-emerald-100 text-emerald-700 border-emerald-200",
  SCHEDULED: "bg-violet-100 text-violet-700 border-violet-200",
  PUBLISHED: "bg-primary/10 text-primary border-primary/20",
};

const pillarColors: Record<string, string> = {
  BIP: "bg-blue-100 text-blue-700",
  EDU: "bg-cyan-100 text-cyan-700",
  AI: "bg-violet-100 text-violet-700",
  DEF: "bg-amber-100 text-amber-700",
  IR: "bg-red-100 text-red-700",
  FV: "bg-emerald-100 text-emerald-700",
};

const channelLabels: Record<string, string> = {
  "linkedin-company": "LinkedIn Company",
  "linkedin-nelson": "LinkedIn — Nelson",
  "linkedin-reid": "LinkedIn — Reid",
  "linkedin-hawkins": "LinkedIn — Hawkins",
  "x": "X (Twitter)",
  "instagram": "Instagram",
  "youtube": "YouTube",
  "newsletter": "Newsletter",
};

// Mock 90-day editorial calendar data (subset)
const calendarData: CalendarEntry[] = [
  // Week 1 - Monday
  { day: 1, date: "2026-06-15", dayOfWeek: "Monday", channel: "linkedin-company", owner: "BM", pillar: "BIP", title: "Week-in-review: Texatron frame milestone", status: "PUBLISHED" },
  { day: 1, date: "2026-06-15", dayOfWeek: "Monday", channel: "linkedin-nelson", owner: "BM/Nelson", pillar: "BIP", title: "Engineering note: plasma containment vessel specs", status: "PUBLISHED" },
  { day: 1, date: "2026-06-15", dayOfWeek: "Monday", channel: "x", owner: "BM", pillar: "EDU", title: "Thread: What is aneutronic fusion? (1/5)", status: "PUBLISHED" },
  { day: 1, date: "2026-06-15", dayOfWeek: "Monday", channel: "x", owner: "BM", pillar: "AI", title: "AI power demand chart + our take", status: "PUBLISHED" },
  { day: 1, date: "2026-06-15", dayOfWeek: "Monday", channel: "instagram", owner: "BM", pillar: "BIP", title: "Kepler facility wide shot + caption", status: "PUBLISHED" },
  // Tuesday
  { day: 2, date: "2026-06-16", dayOfWeek: "Tuesday", channel: "linkedin-reid", owner: "BM/Reid", pillar: "DEF", title: "EO 14299 analysis: second-cohort positioning", status: "PUBLISHED" },
  { day: 2, date: "2026-06-16", dayOfWeek: "Tuesday", channel: "x", owner: "BM", pillar: "DEF", title: "ANPI timeline vs fusion readiness", status: "PUBLISHED" },
  { day: 2, date: "2026-06-16", dayOfWeek: "Tuesday", channel: "x", owner: "BM", pillar: "EDU", title: "D-He-3 vs D-T: the neutron problem", status: "PUBLISHED" },
  // Wednesday
  { day: 3, date: "2026-06-17", dayOfWeek: "Wednesday", channel: "linkedin-company", owner: "BM", pillar: "EDU", title: "Long-form: How direct energy conversion works", status: "APPROVED" },
  { day: 3, date: "2026-06-17", dayOfWeek: "Wednesday", channel: "linkedin-nelson", owner: "BM/Nelson", pillar: "EDU", title: "Carousel: Why D–He-3 instead of D–T?", status: "APPROVED" },
  { day: 3, date: "2026-06-17", dayOfWeek: "Wednesday", channel: "x", owner: "BM", pillar: "BIP", title: "Build photo: diagnostics array installation", status: "SCHEDULED" },
  { day: 3, date: "2026-06-17", dayOfWeek: "Wednesday", channel: "x", owner: "BM", pillar: "AI", title: "950 TWh by 2030 — IEA data breakdown", status: "SCHEDULED" },
  { day: 3, date: "2026-06-17", dayOfWeek: "Wednesday", channel: "instagram", owner: "BM", pillar: "EDU", title: "Infographic: fusion fuel comparison", status: "APPROVED" },
  // Thursday
  { day: 4, date: "2026-06-18", dayOfWeek: "Thursday", channel: "linkedin-company", owner: "BM", pillar: "IR", title: "Milestone update: Texatron structural frame complete", status: "REVIEWED", notes: "LEGAL review pending" },
  { day: 4, date: "2026-06-18", dayOfWeek: "Thursday", channel: "linkedin-hawkins", owner: "BM/Hawkins/LEGAL", pillar: "IR", title: "CEO note: Q2 progress and path to OTCQB", status: "DRAFTED", notes: "RED — counsel review required" },
  { day: 4, date: "2026-06-18", dayOfWeek: "Thursday", channel: "x", owner: "BM", pillar: "FV", title: "Nelson quote on engineering philosophy", status: "DRAFTED" },
  { day: 4, date: "2026-06-18", dayOfWeek: "Thursday", channel: "x", owner: "BM", pillar: "DEF", title: "Janus site map + fusion readiness thread", status: "DRAFTED" },
  // Friday
  { day: 5, date: "2026-06-19", dayOfWeek: "Friday", channel: "linkedin-company", owner: "BM", pillar: "FV", title: "Friday founder voice: Nelson on first-principles hiring", status: "PLANNED" },
  { day: 5, date: "2026-06-19", dayOfWeek: "Friday", channel: "linkedin-nelson", owner: "BM/Nelson", pillar: "FV", title: "Reflection: What the Texatron build taught us about iteration", status: "PLANNED" },
  { day: 5, date: "2026-06-19", dayOfWeek: "Friday", channel: "x", owner: "BM", pillar: "BIP", title: "Team spotlight: controls engineering lead", status: "PLANNED" },
  { day: 5, date: "2026-06-19", dayOfWeek: "Friday", channel: "x", owner: "BM", pillar: "EDU", title: "Quick explainer: what is plasma confinement time?", status: "PLANNED" },
  { day: 5, date: "2026-06-19", dayOfWeek: "Friday", channel: "instagram", owner: "BM", pillar: "BIP", title: "Close-up: Texatron electromagnet assembly", status: "PLANNED" },
  // Newsletter
  { day: 4, date: "2026-06-18", dayOfWeek: "Thursday", channel: "newsletter", owner: "BM", pillar: "EDU", title: "Issue 01: Why aneutronic fusion matters now", status: "REVIEWED" },
  // YouTube
  { day: 10, date: "2026-06-24", dayOfWeek: "Wednesday", channel: "youtube", owner: "BM/Nelson", pillar: "BIP", title: "CEO Update #1: Texatron build progress", status: "PLANNED" },
];

export default function EditorialCalendarPage() {
  const [channelFilter, setChannelFilter] = useState<Channel>("all");
  const [pillarFilter, setPillarFilter] = useState<Pillar>("all");
  const [weekOffset, setWeekOffset] = useState(0);

  const filtered = calendarData.filter((entry) => {
    if (channelFilter !== "all" && entry.channel !== channelFilter) return false;
    if (pillarFilter !== "all" && entry.pillar !== pillarFilter) return false;
    return true;
  });

  // Group by day of week
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const grouped = days.reduce((acc, day) => {
    acc[day] = filtered.filter((e) => e.dayOfWeek === day);
    return acc;
  }, {} as Record<string, CalendarEntry[]>);

  return (
    <>
      <Header
        title="Editorial Calendar"
        breadcrumbItems={[{ label: "Marketing", href: "/marketing" }]}
        currentPageLabel="Editorial Calendar"
      />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Filters:</span>
                </div>
                <Select value={channelFilter} onValueChange={(v) => setChannelFilter(v as Channel)}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="All Channels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Channels</SelectItem>
                    {Object.entries(channelLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={pillarFilter} onValueChange={(v) => setPillarFilter(v as Pillar)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Pillars" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Pillars</SelectItem>
                    <SelectItem value="BIP">BIP — Build in Public</SelectItem>
                    <SelectItem value="EDU">EDU — Education</SelectItem>
                    <SelectItem value="AI">AI — AI Energy</SelectItem>
                    <SelectItem value="DEF">DEF — Defense</SelectItem>
                    <SelectItem value="IR">IR — Investor Relations</SelectItem>
                    <SelectItem value="FV">FV — Founder Voice</SelectItem>
                  </SelectContent>
                </Select>
                <div className="ml-auto flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={() => setWeekOffset((w) => w - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium px-2">
                    Week {1 + weekOffset} of 13
                  </span>
                  <Button variant="outline" size="icon" onClick={() => setWeekOffset((w) => w + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Calendar grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {days.slice(0, 5).map((day) => (
              <div key={day} className="space-y-2">
                <div className="flex items-center gap-2 px-2 py-1">
                  <h3 className="text-sm font-semibold">{day}</h3>
                  <Badge variant="secondary" className="text-xs">
                    {grouped[day]?.length || 0}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {(grouped[day] || []).map((entry, i) => (
                    <Card key={i} className="border shadow-sm">
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-center gap-1 flex-wrap">
                          <Badge variant="outline" className={`text-[10px] ${pillarColors[entry.pillar]}`}>
                            {entry.pillar}
                          </Badge>
                          <Badge variant="outline" className={`text-[10px] ${statusColors[entry.status]}`}>
                            {entry.status}
                          </Badge>
                        </div>
                        <p className="text-xs font-medium leading-tight">{entry.title}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">
                            {channelLabels[entry.channel] || entry.channel}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{entry.owner}</span>
                        </div>
                        {entry.notes && (
                          <p className="text-[10px] text-amber-600 font-medium">{entry.notes}</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                  {(!grouped[day] || grouped[day].length === 0) && (
                    <div className="text-center py-8 text-xs text-muted-foreground">
                      No posts
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Weekend + special */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Saturday</CardTitle>
              </CardHeader>
              <CardContent>
                {(grouped["Saturday"] || []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">1 X post (long-form quote-tweet)</p>
                ) : (
                  grouped["Saturday"].map((e, i) => (
                    <p key={i} className="text-xs">{e.title}</p>
                  ))
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Sunday</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Engagement window only. No posts.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Long-Form
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {filtered.filter((e) => e.channel === "newsletter" || e.channel === "youtube").map((e, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-[10px] ${statusColors[e.status]}`}>{e.status}</Badge>
                      <span className="text-xs">{e.title}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}
