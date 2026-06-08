"use client";

import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Linkedin,
  Youtube,
  Twitter,
} from "lucide-react";

interface CompetitorData {
  name: string;
  ticker?: string;
  linkedin: number;
  linkedinChange: number;
  x: number;
  xChange: number;
  youtube: number;
  youtubeChange: number;
  highlight?: boolean;
}

const competitors: CompetitorData[] = [
  { name: "Commonwealth Fusion Systems", linkedin: 31245, linkedinChange: 582, x: 18200, xChange: 340, youtube: 8400, youtubeChange: 210 },
  { name: "Helion Energy", linkedin: 27103, linkedinChange: 281, x: 42300, xChange: 890, youtube: 15200, youtubeChange: 620 },
  { name: "TAE Technologies", linkedin: 18420, linkedinChange: 134, x: 8900, xChange: 67, youtube: 3200, youtubeChange: 45 },
  { name: "General Fusion", linkedin: 12890, linkedinChange: -42, x: 5600, xChange: -28, youtube: 2100, youtubeChange: 12 },
  { name: "Thea Energy", linkedin: 4210, linkedinChange: 98, x: 2100, xChange: 45, youtube: 890, youtubeChange: 23 },
  { name: "American Fusion", ticker: "AMFN", linkedin: 847, linkedinChange: 312, x: 1203, xChange: 189, youtube: 156, youtubeChange: 42, highlight: true },
];

// Monthly tracking data
const monthlyTracking = [
  { month: "May 2026", amfn: 0, commonwealth: 30663, helion: 26822, tae: 18100, generalFusion: 13050, thea: 3980 },
  { month: "Jun Wk1", amfn: 215, commonwealth: 30820, helion: 26900, tae: 18200, generalFusion: 12990, thea: 4050 },
  { month: "Jun Wk2", amfn: 535, commonwealth: 30950, helion: 26980, tae: 18310, generalFusion: 12940, thea: 4120 },
  { month: "Jun Wk3", amfn: 847, commonwealth: 31245, helion: 27103, tae: 18420, generalFusion: 12890, thea: 4210 },
];

const TrendIcon = ({ value }: { value: number }) => {
  if (value > 0) return <ArrowUpRight className="h-3 w-3 text-emerald-500" />;
  if (value < 0) return <ArrowDownRight className="h-3 w-3 text-red-500" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
};

const formatChange = (value: number) => {
  if (value > 0) return `+${value.toLocaleString()}`;
  return value.toLocaleString();
};

export default function CompetitiveTrackerPage() {
  const maxLinkedin = Math.max(...competitors.map((c) => c.linkedin));

  return (
    <>
      <Header
        title="Competitive Tracker"
        breadcrumbItems={[{ label: "Marketing", href: "/marketing" }]}
        currentPageLabel="Competitive Tracker"
      />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <Linkedin className="h-5 w-5 text-blue-600" />
                  <p className="text-sm font-medium">LinkedIn Gap</p>
                </div>
                <p className="text-2xl font-bold">30,398</p>
                <p className="text-xs text-muted-foreground">followers behind Commonwealth (leader)</p>
                <p className="text-xs text-emerald-600 mt-1">Closing at +312/week</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <Twitter className="h-5 w-5" />
                  <p className="text-sm font-medium">X Gap</p>
                </div>
                <p className="text-2xl font-bold">41,097</p>
                <p className="text-xs text-muted-foreground">followers behind Helion (leader)</p>
                <p className="text-xs text-emerald-600 mt-1">Closing at +189/week</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <Youtube className="h-5 w-5 text-red-600" />
                  <p className="text-sm font-medium">YouTube Gap</p>
                </div>
                <p className="text-2xl font-bold">15,044</p>
                <p className="text-xs text-muted-foreground">subscribers behind Helion (leader)</p>
                <p className="text-xs text-emerald-600 mt-1">Closing at +42/week</p>
              </CardContent>
            </Card>
          </div>

          {/* Full Comparison Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Full Competitive Comparison
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {competitors.map((comp) => (
                  <div
                    key={comp.name}
                    className={`rounded-lg border p-4 ${
                      comp.highlight ? "border-primary bg-primary/5" : "bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <h3 className={`font-semibold ${comp.highlight ? "text-primary" : ""}`}>
                          {comp.name}
                        </h3>
                        {comp.ticker && (
                          <Badge variant="outline" className="text-xs">OTC: {comp.ticker}</Badge>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-6">
                      {/* LinkedIn */}
                      <div>
                        <div className="flex items-center gap-1 mb-1">
                          <Linkedin className="h-3 w-3 text-blue-600" />
                          <span className="text-xs text-muted-foreground">LinkedIn</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{comp.linkedin.toLocaleString()}</span>
                          <div className="flex items-center gap-0.5">
                            <TrendIcon value={comp.linkedinChange} />
                            <span className={`text-xs ${comp.linkedinChange >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                              {formatChange(comp.linkedinChange)}
                            </span>
                          </div>
                        </div>
                        <Progress value={(comp.linkedin / maxLinkedin) * 100} className="h-1.5 mt-1" />
                      </div>

                      {/* X */}
                      <div>
                        <div className="flex items-center gap-1 mb-1">
                          <Twitter className="h-3 w-3" />
                          <span className="text-xs text-muted-foreground">X</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{comp.x.toLocaleString()}</span>
                          <div className="flex items-center gap-0.5">
                            <TrendIcon value={comp.xChange} />
                            <span className={`text-xs ${comp.xChange >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                              {formatChange(comp.xChange)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* YouTube */}
                      <div>
                        <div className="flex items-center gap-1 mb-1">
                          <Youtube className="h-3 w-3 text-red-600" />
                          <span className="text-xs text-muted-foreground">YouTube</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{comp.youtube.toLocaleString()}</span>
                          <div className="flex items-center gap-0.5">
                            <TrendIcon value={comp.youtubeChange} />
                            <span className={`text-xs ${comp.youtubeChange >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                              {formatChange(comp.youtubeChange)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Growth Trajectory */}
          <Card>
            <CardHeader>
              <CardTitle>AMFN LinkedIn Growth Trajectory</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {monthlyTracking.map((row) => (
                  <div key={row.month} className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground w-20">{row.month}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-muted rounded-full h-4 relative overflow-hidden">
                          <div
                            className="bg-primary h-full rounded-full transition-all duration-500"
                            style={{ width: `${(row.amfn / 2500) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold w-16 text-right">{row.amfn.toLocaleString()}</span>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground w-24">
                      / 2,500 target
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                90-day target: 2,500 LinkedIn followers. Current growth rate: ~312/week. On pace to reach target by Week 8.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
