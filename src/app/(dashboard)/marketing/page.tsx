"use client";

import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  TrendingUp,
  Users,
  FileText,
  Eye,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";

// Mock KPI data from the Foundation Package
const kpiCards = [
  {
    title: "LinkedIn Followers",
    current: 847,
    target: 2500,
    change: "+312 this week",
    trend: "up" as const,
    channel: "Company + Exec",
  },
  {
    title: "X Followers",
    current: 1203,
    target: 5000,
    change: "+189 this week",
    trend: "up" as const,
    channel: "@AmericanFusion",
  },
  {
    title: "YouTube Subscribers",
    current: 156,
    target: 1000,
    change: "+42 this week",
    trend: "up" as const,
    channel: "American Fusion",
  },
  {
    title: "Newsletter Subscribers",
    current: 534,
    target: 2000,
    change: "+67 this week",
    trend: "up" as const,
    channel: "Bi-weekly",
  },
];

// Content output tracking
const contentOutput = [
  { week: "Week 1", planned: 27, published: 25 },
  { week: "Week 2", planned: 27, published: 27 },
  { week: "Week 3", planned: 27, published: 24 },
  { week: "Week 4", planned: 27, published: 28 },
  { week: "Week 5", planned: 27, published: 26 },
  { week: "Week 6", planned: 27, published: 27 },
];

// Content pillar distribution
const pillarMix = [
  { code: "BIP", name: "Build in Public", target: 30, actual: 32, color: "bg-blue-500" },
  { code: "EDU", name: "Education", target: 25, actual: 23, color: "bg-cyan-500" },
  { code: "AI", name: "AI Energy", target: 15, actual: 16, color: "bg-violet-500" },
  { code: "DEF", name: "Defense", target: 15, actual: 14, color: "bg-amber-500" },
  { code: "IR", name: "Investor Relations", target: 5, actual: 5, color: "bg-red-500" },
  { code: "FV", name: "Founder Voice", target: 10, actual: 10, color: "bg-emerald-500" },
];

// Competitive benchmark (LinkedIn followers)
const competitors = [
  { name: "Commonwealth Fusion", followers: 31245, change: "+582", trend: "up" as const },
  { name: "Helion Energy", followers: 27103, change: "+281", trend: "up" as const },
  { name: "TAE Technologies", followers: 18420, change: "+134", trend: "up" as const },
  { name: "General Fusion", followers: 12890, change: "-42", trend: "down" as const },
  { name: "Thea Energy", followers: 4210, change: "+98", trend: "up" as const },
  { name: "American Fusion", followers: 847, change: "+312", trend: "up" as const },
];

// Recent engagement highlights
const topPosts = [
  {
    title: "Why D–He-3 instead of D–T? (Carousel)",
    channel: "LinkedIn — Nelson",
    pillar: "EDU",
    impressions: 12400,
    engagement: "4.2%",
    date: "Jun 4",
  },
  {
    title: "EO 14299 sets a deadline. Here's what fusion must bring.",
    channel: "LinkedIn — Reid",
    pillar: "DEF",
    impressions: 8900,
    engagement: "3.8%",
    date: "Jun 3",
  },
  {
    title: "Texatron structural frame complete. What's next.",
    channel: "LinkedIn Company",
    pillar: "BIP",
    impressions: 15200,
    engagement: "5.1%",
    date: "Jun 2",
  },
  {
    title: "AI rack density is up 11x. The grid is not.",
    channel: "X",
    pillar: "AI",
    impressions: 22100,
    engagement: "2.9%",
    date: "Jun 1",
  },
];

const TrendIcon = ({ trend }: { trend: "up" | "down" | "flat" }) => {
  if (trend === "up") return <ArrowUpRight className="h-4 w-4 text-emerald-500" />;
  if (trend === "down") return <ArrowDownRight className="h-4 w-4 text-red-500" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
};

const pillarColors: Record<string, string> = {
  BIP: "bg-blue-100 text-blue-700 border-blue-200",
  EDU: "bg-cyan-100 text-cyan-700 border-cyan-200",
  AI: "bg-violet-100 text-violet-700 border-violet-200",
  DEF: "bg-amber-100 text-amber-700 border-amber-200",
  IR: "bg-red-100 text-red-700 border-red-200",
  FV: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

export default function MarketingDashboardPage() {
  return (
    <>
      <Header title="Marketing Dashboard" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {kpiCards.map((kpi) => (
              <Card key={kpi.title}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-muted-foreground">{kpi.title}</p>
                    <TrendIcon trend={kpi.trend} />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-bold">{kpi.current.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">/ {kpi.target.toLocaleString()}</p>
                  </div>
                  <Progress value={(kpi.current / kpi.target) * 100} className="mt-3 h-2" />
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-emerald-600 font-medium">{kpi.change}</p>
                    <p className="text-xs text-muted-foreground">{Math.round((kpi.current / kpi.target) * 100)}% to target</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Content Output */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Content Output vs Plan
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {contentOutput.map((week) => (
                    <div key={week.week} className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground w-16">{week.week}</span>
                      <div className="flex-1 flex items-center gap-2">
                        <div className="flex-1 bg-muted rounded-full h-6 relative overflow-hidden">
                          <div
                            className="bg-primary h-full rounded-full flex items-center justify-end pr-2"
                            style={{ width: `${(week.published / 30) * 100}%` }}
                          >
                            <span className="text-xs text-primary-foreground font-medium">{week.published}</span>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground w-20">
                          / {week.planned} planned
                        </span>
                      </div>
                      <Badge
                        variant={week.published >= week.planned ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {week.published >= week.planned ? "On Track" : `${week.planned - week.published} behind`}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Pillar Mix */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Content Pillar Mix
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {pillarMix.map((pillar) => (
                    <div key={pillar.code}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={pillarColors[pillar.code]}>
                            {pillar.code}
                          </Badge>
                          <span className="text-sm">{pillar.name}</span>
                        </div>
                        <span className="text-sm text-muted-foreground">{pillar.actual}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={pillar.actual} className="h-2 flex-1" />
                        <span className="text-xs text-muted-foreground w-12">/ {pillar.target}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Competitive Benchmark */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Competitive Benchmark (LinkedIn)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {competitors.map((comp) => (
                    <div
                      key={comp.name}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        comp.name === "American Fusion" ? "bg-primary/5 border border-primary/20" : "bg-muted/50"
                      }`}
                    >
                      <div>
                        <p className={`text-sm font-medium ${comp.name === "American Fusion" ? "text-primary" : ""}`}>
                          {comp.name}
                        </p>
                        <p className="text-xs text-muted-foreground">{comp.followers.toLocaleString()} followers</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <TrendIcon trend={comp.trend} />
                        <span className={`text-sm ${comp.trend === "up" ? "text-emerald-600" : "text-red-500"}`}>
                          {comp.change}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Top Performing Posts */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Top Performing Posts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {topPosts.map((post, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm flex-shrink-0">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{post.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className={pillarColors[post.pillar]}>
                            {post.pillar}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{post.channel}</span>
                          <span className="text-xs text-muted-foreground">{post.date}</span>
                        </div>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-xs text-muted-foreground">
                            <Eye className="h-3 w-3 inline mr-1" />
                            {post.impressions.toLocaleString()}
                          </span>
                          <span className="text-xs text-emerald-600 font-medium">
                            <TrendingUp className="h-3 w-3 inline mr-1" />
                            {post.engagement}
                          </span>
                        </div>
                      </div>
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
