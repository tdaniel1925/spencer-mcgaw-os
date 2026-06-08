"use client";

import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, ArrowRight } from "lucide-react";

type Status = "PLANNED" | "DRAFTED" | "REVIEWED" | "APPROVED" | "SCHEDULED" | "PUBLISHED";

interface PipelineItem {
  id: string;
  title: string;
  channel: string;
  pillar: string;
  owner: string;
  status: Status;
  date: string;
  notes?: string;
}

const pillarColors: Record<string, string> = {
  BIP: "bg-blue-100 text-blue-700",
  EDU: "bg-cyan-100 text-cyan-700",
  AI: "bg-violet-100 text-violet-700",
  DEF: "bg-amber-100 text-amber-700",
  IR: "bg-red-100 text-red-700",
  FV: "bg-emerald-100 text-emerald-700",
};

const statusConfig: Record<Status, { label: string; color: string; bgColor: string }> = {
  PLANNED: { label: "Planned", color: "text-gray-600", bgColor: "bg-gray-50 border-gray-200" },
  DRAFTED: { label: "Drafted", color: "text-blue-600", bgColor: "bg-blue-50 border-blue-200" },
  REVIEWED: { label: "Reviewed", color: "text-yellow-600", bgColor: "bg-yellow-50 border-yellow-200" },
  APPROVED: { label: "Approved", color: "text-emerald-600", bgColor: "bg-emerald-50 border-emerald-200" },
  SCHEDULED: { label: "Scheduled", color: "text-violet-600", bgColor: "bg-violet-50 border-violet-200" },
  PUBLISHED: { label: "Published", color: "text-primary", bgColor: "bg-primary/5 border-primary/20" },
};

const pipelineData: PipelineItem[] = [
  // PLANNED
  { id: "p1", title: "Friday founder voice: Nelson on first-principles hiring", channel: "LinkedIn Company", pillar: "FV", owner: "BM", status: "PLANNED", date: "Jun 19" },
  { id: "p2", title: "Reflection: What the Texatron build taught us about iteration", channel: "LinkedIn — Nelson", pillar: "FV", owner: "BM/Nelson", status: "PLANNED", date: "Jun 19" },
  { id: "p3", title: "Team spotlight: controls engineering lead", channel: "X", pillar: "BIP", owner: "BM", status: "PLANNED", date: "Jun 19" },
  { id: "p4", title: "Close-up: Texatron electromagnet assembly", channel: "Instagram", pillar: "BIP", owner: "BM", status: "PLANNED", date: "Jun 19" },
  { id: "p5", title: "CEO Update #1: Texatron build progress", channel: "YouTube", pillar: "BIP", owner: "BM/Nelson", status: "PLANNED", date: "Jun 24" },
  // DRAFTED
  { id: "d1", title: "CEO note: Q2 progress and path to OTCQB", channel: "LinkedIn — Hawkins", pillar: "IR", owner: "BM/Hawkins/LEGAL", status: "DRAFTED", date: "Jun 18", notes: "RED — counsel review required" },
  { id: "d2", title: "Nelson quote on engineering philosophy", channel: "X", pillar: "FV", owner: "BM", status: "DRAFTED", date: "Jun 18" },
  { id: "d3", title: "Janus site map + fusion readiness thread", channel: "X", pillar: "DEF", owner: "BM", status: "DRAFTED", date: "Jun 18" },
  // REVIEWED
  { id: "r1", title: "Milestone update: Texatron structural frame complete", channel: "LinkedIn Company", pillar: "IR", owner: "BM", status: "REVIEWED", date: "Jun 18", notes: "LEGAL review pending" },
  { id: "r2", title: "Issue 01: Why aneutronic fusion matters now", channel: "Newsletter", pillar: "EDU", owner: "BM", status: "REVIEWED", date: "Jun 18" },
  // APPROVED
  { id: "a1", title: "Long-form: How direct energy conversion works", channel: "LinkedIn Company", pillar: "EDU", owner: "BM", status: "APPROVED", date: "Jun 17" },
  { id: "a2", title: "Carousel: Why D–He-3 instead of D–T?", channel: "LinkedIn — Nelson", pillar: "EDU", owner: "BM/Nelson", status: "APPROVED", date: "Jun 17" },
  { id: "a3", title: "Infographic: fusion fuel comparison", channel: "Instagram", pillar: "EDU", owner: "BM", status: "APPROVED", date: "Jun 17" },
  // SCHEDULED
  { id: "s1", title: "Build photo: diagnostics array installation", channel: "X", pillar: "BIP", owner: "BM", status: "SCHEDULED", date: "Jun 17" },
  { id: "s2", title: "950 TWh by 2030 — IEA data breakdown", channel: "X", pillar: "AI", owner: "BM", status: "SCHEDULED", date: "Jun 17" },
  // PUBLISHED
  { id: "pub1", title: "Week-in-review: Texatron frame milestone", channel: "LinkedIn Company", pillar: "BIP", owner: "BM", status: "PUBLISHED", date: "Jun 15" },
  { id: "pub2", title: "Engineering note: plasma containment vessel specs", channel: "LinkedIn — Nelson", pillar: "BIP", owner: "BM/Nelson", status: "PUBLISHED", date: "Jun 15" },
  { id: "pub3", title: "EO 14299 analysis: second-cohort positioning", channel: "LinkedIn — Reid", pillar: "DEF", owner: "BM/Reid", status: "PUBLISHED", date: "Jun 16" },
  { id: "pub4", title: "Thread: What is aneutronic fusion? (1/5)", channel: "X", pillar: "EDU", owner: "BM", status: "PUBLISHED", date: "Jun 15" },
];

const columns: Status[] = ["PLANNED", "DRAFTED", "REVIEWED", "APPROVED", "SCHEDULED", "PUBLISHED"];

export default function ContentPipelinePage() {
  const grouped = columns.reduce((acc, status) => {
    acc[status] = pipelineData.filter((item) => item.status === status);
    return acc;
  }, {} as Record<Status, PipelineItem[]>);

  return (
    <>
      <Header
        title="Content Pipeline"
        breadcrumbItems={[{ label: "Marketing", href: "/marketing" }]}
        currentPageLabel="Content Pipeline"
      />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-full mx-auto space-y-4">
          {/* Status flow indicator */}
          <div className="flex items-center justify-center gap-1 flex-wrap">
            {columns.map((status, i) => (
              <div key={status} className="flex items-center gap-1">
                <Badge variant="outline" className={`${statusConfig[status].bgColor} ${statusConfig[status].color}`}>
                  {statusConfig[status].label} ({grouped[status].length})
                </Badge>
                {i < columns.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
              </div>
            ))}
          </div>

          {/* Kanban board */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {columns.map((status) => (
              <div key={status} className="space-y-2">
                <div className={`rounded-lg border p-2 ${statusConfig[status].bgColor}`}>
                  <h3 className={`text-sm font-semibold ${statusConfig[status].color}`}>
                    {statusConfig[status].label}
                  </h3>
                  <p className="text-xs text-muted-foreground">{grouped[status].length} items</p>
                </div>
                <ScrollArea className="h-[calc(100vh-280px)]">
                  <div className="space-y-2 pr-2">
                    {grouped[status].map((item) => (
                      <Card key={item.id} className="border shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-center gap-1 flex-wrap">
                            <Badge variant="outline" className={`text-[10px] ${pillarColors[item.pillar]}`}>
                              {item.pillar}
                            </Badge>
                          </div>
                          <p className="text-xs font-medium leading-tight">{item.title}</p>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground">{item.channel}</span>
                            <span className="text-[10px] text-muted-foreground">{item.date}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground">{item.owner}</span>
                          </div>
                          {item.notes && (
                            <p className="text-[10px] text-amber-600 font-medium bg-amber-50 rounded px-1.5 py-0.5">
                              {item.notes}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
