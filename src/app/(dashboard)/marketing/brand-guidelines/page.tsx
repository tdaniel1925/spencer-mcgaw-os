"use client";

import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Palette, Type, MessageSquare, Ban, CheckCircle } from "lucide-react";

const primaryPalette = [
  { name: "Fusion Navy", hex: "#0A1F44", desc: "Anchor. Headers, dark backgrounds, primary text on light.", className: "bg-[#0A1F44]" },
  { name: "Electric Blue", hex: "#00B4D8", desc: "Plasma accent. Charts, links, highlights, brand moments.", className: "bg-[#00B4D8]" },
  { name: "Signal Lime", hex: "#7FFF00", desc: "Reserved accent. Use sparingly for emphasis.", className: "bg-[#7FFF00]" },
];

const supportingPalette = [
  { name: "Off-White", hex: "#F7F8FA", desc: "Backgrounds, slide canvas, card fills.", className: "bg-[#F7F8FA] border" },
  { name: "Gray 60", hex: "#6B7280", desc: "Secondary text, captions, dividers.", className: "bg-[#6B7280]" },
  { name: "Border", hex: "#D9DDE3", desc: "Hairlines, table borders, separators.", className: "bg-[#D9DDE3]" },
];

const voiceQualities = [
  { quality: "Technical-credibility over hype", desc: "Specifics beat adjectives. Numbers beat 'revolutionary.' Welds beat 'cutting-edge.'" },
  { quality: "First-person, restrained", desc: "'We are building.' 'We chose D–He-3 because.' Direct, not boastful. Confidence without volume." },
  { quality: "Fact-anchored", desc: "Every claim cites an instrument reading, an IEA statistic, an executive order, or a dated company milestone." },
  { quality: "Plainspoken about hard things", desc: "Helium-3 supply is hard. D–He-3 ignition is hard. We say so. The credibility comes from owning the challenge." },
  { quality: "Patriotic without nationalism", desc: "American Fusion. Texas-built. Defense-aligned. We can say all three plainly. No flag-waving or partisan framing." },
];

const dosDonts = [
  { dont: '"Revolutionary fusion technology"', do: '"Aneutronic D–He-3 fusion, modular form factor"', why: "Specific over puffery." },
  { dont: '"Game-changing for AI infrastructure"', do: '"Maps to the 950 TWh data-center demand projected by 2030"', why: "Cite the number." },
  { dont: '"We are disrupting energy"', do: '"We are competing in the post-microreactor procurement window"', why: "Name the actual category." },
  { dont: '"Cutting-edge"', do: "[Just describe what it is]", why: "If you have to say it, you don't have it." },
  { dont: '"Limitless clean energy"', do: '"Aneutronic fusion: no long-lived radioactive waste, lower neutron flux"', why: "Specific physical claims, not vibes." },
  { dont: '"World-class team"', do: "[Name them and what they built]", why: "Show, don't claim." },
  { dont: 'Emoji in executive posts', do: "Plain text. Specific. Confident.", why: "Engineering company. Not a consumer brand." },
];

const toneByAudience = [
  { audience: "DoD / Procurement", tone: "Operational, sober, precise", example: '"Executive Order 14299 set a deadline. Here is what fusion has to bring to the second cohort."' },
  { audience: "Hyperscaler buyers", tone: "Engineering-to-engineering", example: '"AI rack density is up 11x since 2020. The grid is not. Here is the math on baseload."' },
  { audience: "Institutional investors", tone: "Transparent, milestone-anchored", example: '"This quarter we completed the structural frame on the 5 MW Texatron unit."' },
  { audience: "Retail investors", tone: "Accessible, founder-direct", example: '"A short note from Brent on what happens next."' },
  { audience: "Engineering talent", tone: "Mission-first, technically respectful", example: '"We are hiring a controls engineer to own the plasma diagnostics integration."' },
];

const execLanes = [
  {
    name: "Brent Nelson",
    role: "CEO, Kepler Fusion Technologies",
    lane: "Technical & Operational Voice",
    topics: "Build-in-public progress, technology milestones, diagnostics, aneutronic physics, He-3 supply chain, engineering hires",
    cadence: "5–7 LinkedIn/wk, 2–3 X/wk, Monthly YouTube, Quarterly podcasts",
    color: "border-blue-500 bg-blue-50",
  },
  {
    name: "Samuel Reid",
    role: "Government Strategy Advisor",
    lane: "Defense & Government Voice",
    topics: "Procurement landscape, EO 14299, ANPI, Janus, allied defense opportunities",
    cadence: "2–3 LinkedIn/wk, Monthly newsletter byline, Defense conferences",
    color: "border-amber-500 bg-amber-50",
  },
  {
    name: "Richard Hawkins",
    role: "CEO, American Fusion Inc.",
    lane: "Capital Markets & Corporate Voice",
    topics: "Milestone announcements, OTCQB uplisting, capital structure, partnerships, offtake",
    cadence: "2 LinkedIn/wk, Quarterly investor video, Financial podcasts",
    color: "border-red-500 bg-red-50",
  },
];

export default function BrandGuidelinesPage() {
  return (
    <>
      <Header
        title="Brand Guidelines"
        breadcrumbItems={[{ label: "Marketing", href: "/marketing" }]}
        currentPageLabel="Brand Guidelines"
      />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Color Palette */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Color Palette
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold mb-3">Primary Palette</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {primaryPalette.map((c) => (
                    <div key={c.name} className="space-y-2">
                      <div className={`h-20 rounded-lg ${c.className}`} />
                      <div>
                        <p className="text-sm font-semibold">{c.name}</p>
                        <p className="text-xs font-mono text-muted-foreground">{c.hex}</p>
                        <p className="text-xs text-muted-foreground mt-1">{c.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold mb-3">Supporting Palette</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {supportingPalette.map((c) => (
                    <div key={c.name} className="space-y-2">
                      <div className={`h-20 rounded-lg ${c.className}`} />
                      <div>
                        <p className="text-sm font-semibold">{c.name}</p>
                        <p className="text-xs font-mono text-muted-foreground">{c.hex}</p>
                        <p className="text-xs text-muted-foreground mt-1">{c.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-1">
                <p><strong>Navy</strong> is the brand — 60–70% of visual weight.</p>
                <p><strong>Electric Blue</strong> does the work — charts, links, callouts — ~20–25%.</p>
                <p><strong>Lime</strong> is rare — one element per visual, ~5% max.</p>
                <p><strong>White space</strong> is a palette color — Off-white + white carry 50%+ of every layout.</p>
              </div>
            </CardContent>
          </Card>

          {/* Voice & Tone */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Voice & Tone
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                {voiceQualities.map((v) => (
                  <div key={v.quality} className="flex gap-3 p-3 rounded-lg bg-muted/50">
                    <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold">{v.quality}</p>
                      <p className="text-sm text-muted-foreground">{v.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold mb-3">Tone by Audience</h3>
                <div className="space-y-2">
                  {toneByAudience.map((t) => (
                    <div key={t.audience} className="grid grid-cols-3 gap-4 p-3 rounded-lg bg-muted/50">
                      <div>
                        <p className="text-sm font-semibold">{t.audience}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{t.tone}</p>
                      </div>
                      <div>
                        <p className="text-sm italic text-muted-foreground">{t.example}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Do / Don't */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ban className="h-5 w-5" />
                Do / Don&apos;t Language
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-4 px-3 py-2 text-xs font-semibold text-muted-foreground">
                  <div className="col-span-4">Don&apos;t write</div>
                  <div className="col-span-5">Do write</div>
                  <div className="col-span-3">Why</div>
                </div>
                {dosDonts.map((row, i) => (
                  <div key={i} className="grid grid-cols-12 gap-4 px-3 py-3 rounded-lg bg-muted/50 items-start">
                    <div className="col-span-4 flex items-start gap-2">
                      <Ban className="h-3 w-3 text-red-500 mt-1 flex-shrink-0" />
                      <span className="text-sm text-red-600 line-through">{row.dont}</span>
                    </div>
                    <div className="col-span-5 flex items-start gap-2">
                      <CheckCircle className="h-3 w-3 text-emerald-500 mt-1 flex-shrink-0" />
                      <span className="text-sm text-emerald-700">{row.do}</span>
                    </div>
                    <div className="col-span-3">
                      <span className="text-xs text-muted-foreground">{row.why}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Three-Lane Architecture */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Type className="h-5 w-5" />
                Three-Lane Founder Architecture
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {execLanes.map((exec) => (
                  <div key={exec.name} className={`rounded-lg border-l-4 p-4 ${exec.color}`}>
                    <h3 className="font-semibold">{exec.name}</h3>
                    <p className="text-xs text-muted-foreground">{exec.role}</p>
                    <Badge variant="outline" className="mt-2 text-xs">{exec.lane}</Badge>
                    <div className="mt-3 space-y-2">
                      <div>
                        <p className="text-xs font-semibold">Topics</p>
                        <p className="text-xs text-muted-foreground">{exec.topics}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold">Cadence</p>
                        <p className="text-xs text-muted-foreground">{exec.cadence}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
