"use client";

import { useState } from "react";
import {
  FileSpreadsheet,
  Download,
  Users,
  FolderKanban,
  CheckSquare,
  FileText,
  MessageSquare,
  BarChart3,
  Calendar,
  Filter,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type ReportType = "clients" | "projects" | "tasks" | "tax-filings" | "communications" | "workload";

interface ReportConfig {
  type: ReportType;
  title: string;
  description: string;
  icon: React.ReactNode;
  filters: ("dateRange" | "status" | "taxYear" | "assignedTo")[];
}

const reportConfigs: ReportConfig[] = [
  {
    type: "clients",
    title: "Client Report",
    description: "Export client list with contact information, status, and metadata",
    icon: <Users className="h-5 w-5" />,
    filters: ["dateRange", "status"],
  },
  {
    type: "projects",
    title: "Project Report",
    description: "Export project status, deadlines, progress, and assignments",
    icon: <FolderKanban className="h-5 w-5" />,
    filters: ["dateRange", "status", "taxYear", "assignedTo"],
  },
  {
    type: "tasks",
    title: "Task Report",
    description: "Export task list with status, priority, and completion data",
    icon: <CheckSquare className="h-5 w-5" />,
    filters: ["dateRange", "status", "assignedTo"],
  },
  {
    type: "tax-filings",
    title: "Tax Filing Report",
    description: "Export tax filing status by client, year, and form type",
    icon: <FileText className="h-5 w-5" />,
    filters: ["dateRange", "status", "taxYear"],
  },
  {
    type: "communications",
    title: "Communications Report",
    description: "Export call logs and email activity with client associations",
    icon: <MessageSquare className="h-5 w-5" />,
    filters: ["dateRange"],
  },
  {
    type: "workload",
    title: "Workload Report",
    description: "Export staff workload with task counts and completion rates",
    icon: <BarChart3 className="h-5 w-5" />,
    filters: ["dateRange"],
  },
];

const statusOptions: Record<string, { label: string; values: { value: string; label: string }[] }> = {
  clients: {
    label: "Client Status",
    values: [
      { value: "all", label: "All Statuses" },
      { value: "active", label: "Active" },
      { value: "inactive", label: "Inactive" },
      { value: "prospect", label: "Prospect" },
    ],
  },
  projects: {
    label: "Project Status",
    values: [
      { value: "all", label: "All Statuses" },
      { value: "not_started", label: "Not Started" },
      { value: "in_progress", label: "In Progress" },
      { value: "review", label: "Review" },
      { value: "completed", label: "Completed" },
      { value: "on_hold", label: "On Hold" },
    ],
  },
  tasks: {
    label: "Task Status",
    values: [
      { value: "all", label: "All Statuses" },
      { value: "pending", label: "Pending" },
      { value: "in_progress", label: "In Progress" },
      { value: "completed", label: "Completed" },
    ],
  },
  "tax-filings": {
    label: "Filing Status",
    values: [
      { value: "all", label: "All Statuses" },
      { value: "not_started", label: "Not Started" },
      { value: "in_progress", label: "In Progress" },
      { value: "ready_for_review", label: "Ready for Review" },
      { value: "filed", label: "Filed" },
      { value: "extended", label: "Extended" },
    ],
  },
};

export default function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState<ReportType | null>(null);
  const [format, setFormat] = useState<"csv" | "json">("csv");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [status, setStatus] = useState("all");
  const [taxYear, setTaxYear] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  const selectedConfig = reportConfigs.find((c) => c.type === selectedReport);

  const currentYear = new Date().getFullYear();
  const taxYears = Array.from({ length: 10 }, (_, i) => currentYear - i);

  const handleExport = async () => {
    if (!selectedReport) {
      toast.error("Please select a report type to export");
      return;
    }

    setIsExporting(true);

    try {
      const params = new URLSearchParams();
      params.set("type", selectedReport);
      params.set("format", format);

      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (status && status !== "all") params.set("status", status);
      if (taxYear) params.set("taxYear", taxYear);

      const response = await fetch(`/api/reports?${params.toString()}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate report");
      }

      if (format === "json") {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: "application/json" });
        downloadBlob(blob, data.filename);
      } else {
        const blob = await response.blob();
        const contentDisposition = response.headers.get("Content-Disposition");
        const filename = contentDisposition
          ? contentDisposition.split("filename=")[1].replace(/"/g, "")
          : `${selectedReport}-report.csv`;
        downloadBlob(blob, filename);
      }

      toast.success(`Your ${selectedConfig?.title} has been downloaded`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate report");
    } finally {
      setIsExporting(false);
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const resetFilters = () => {
    setDateFrom("");
    setDateTo("");
    setStatus("all");
    setTaxYear("");
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">
            Generate and export reports for clients, projects, tasks, and more
          </p>
        </div>
        <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {reportConfigs.map((config) => (
          <Card
            key={config.type}
            className={`cursor-pointer transition-all hover:border-primary ${
              selectedReport === config.type ? "border-primary ring-2 ring-primary/20" : ""
            }`}
            onClick={() => {
              setSelectedReport(config.type);
              resetFilters();
            }}
          >
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <div
                className={`p-2 rounded-lg ${
                  selectedReport === config.type
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                {config.icon}
              </div>
              <div>
                <CardTitle className="text-lg">{config.title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>{config.description}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedReport && selectedConfig && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Export Options: {selectedConfig.title}
            </CardTitle>
            <CardDescription>
              Configure filters and export format for your report
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* Format Selection */}
              <div className="space-y-2">
                <Label>Export Format</Label>
                <Select value={format} onValueChange={(v) => setFormat(v as "csv" | "json")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">CSV (Excel)</SelectItem>
                    <SelectItem value="json">JSON</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date Range Filter */}
              {selectedConfig.filters.includes("dateRange") && (
                <>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      From Date
                    </Label>
                    <Input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      To Date
                    </Label>
                    <Input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                  </div>
                </>
              )}

              {/* Status Filter */}
              {selectedConfig.filters.includes("status") && statusOptions[selectedReport] && (
                <div className="space-y-2">
                  <Label>{statusOptions[selectedReport].label}</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions[selectedReport].values.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Tax Year Filter */}
              {selectedConfig.filters.includes("taxYear") && (
                <div className="space-y-2">
                  <Label>Tax Year</Label>
                  <Select value={taxYear} onValueChange={setTaxYear}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Years" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Years</SelectItem>
                      {taxYears.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="flex gap-4">
              <Button onClick={handleExport} disabled={isExporting} className="gap-2">
                {isExporting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Export {format.toUpperCase()}
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={resetFilters}>
                Reset Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!selectedReport && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileSpreadsheet className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Select a Report Type</h3>
            <p className="text-muted-foreground max-w-md">
              Choose one of the report types above to configure export options and download your
              data in CSV or JSON format.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
