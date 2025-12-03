"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatCard } from "@/components/dashboard";
import {
  FileText,
  Search,
  Upload,
  Eye,
  Download,
  Trash2,
  MoreHorizontal,
  File,
  FileImage,
  FileSpreadsheet,
  FolderOpen,
  Clock,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const mockDocuments = [
  {
    id: "DOC001",
    name: "2023 Tax Return - John Smith.pdf",
    type: "pdf",
    client: "John Smith",
    category: "Tax Returns",
    size: "2.4 MB",
    uploadedBy: "Elizabeth",
    status: "processed",
    uploadedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
  },
  {
    id: "DOC002",
    name: "Bank Statements Q4 - ABC Corp.xlsx",
    type: "spreadsheet",
    client: "ABC Corp",
    category: "Bank Statements",
    size: "1.8 MB",
    uploadedBy: "Britney",
    status: "pending",
    uploadedAt: new Date(Date.now() - 1000 * 60 * 60 * 5),
  },
  {
    id: "DOC003",
    name: "W-2 Form 2023 - Sarah Johnson.pdf",
    type: "pdf",
    client: "Sarah Johnson",
    category: "Tax Forms",
    size: "450 KB",
    uploadedBy: "System",
    status: "processed",
    uploadedAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
  },
  {
    id: "DOC004",
    name: "Receipt Scan - Tech Solutions.jpg",
    type: "image",
    client: "Tech Solutions LLC",
    category: "Receipts",
    size: "890 KB",
    uploadedBy: "Hunter McGaw",
    status: "processing",
    uploadedAt: new Date(Date.now() - 1000 * 60 * 30),
  },
  {
    id: "DOC005",
    name: "Payroll Report March 2024 - XYZ Inc.pdf",
    type: "pdf",
    client: "XYZ Inc",
    category: "Payroll",
    size: "1.2 MB",
    uploadedBy: "Britney",
    status: "processed",
    uploadedAt: new Date(Date.now() - 1000 * 60 * 60 * 48),
  },
];

const typeIcons = {
  pdf: FileText,
  spreadsheet: FileSpreadsheet,
  image: FileImage,
  other: File,
};

const statusConfig = {
  pending: { label: "Pending", className: "bg-yellow-100 text-yellow-700" },
  processing: { label: "Processing", className: "bg-blue-100 text-blue-700" },
  processed: { label: "Processed", className: "bg-green-100 text-green-700" },
};

export default function DocumentsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const filteredDocuments = mockDocuments.filter((doc) => {
    const matchesSearch =
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.client.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      categoryFilter === "all" || doc.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const docCounts = {
    total: mockDocuments.length,
    pending: mockDocuments.filter((d) => d.status === "pending").length,
    processed: mockDocuments.filter((d) => d.status === "processed").length,
  };

  return (
    <>
      <Header title="Documents" />
      <main className="p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard
            title="Total Documents"
            value={docCounts.total}
            change={{ value: 15.2, period: "30 days" }}
            icon={<FolderOpen className="h-6 w-6 text-primary-foreground" />}
            iconBg="bg-primary"
          />
          <StatCard
            title="Pending Review"
            value={docCounts.pending}
            change={{ value: -8.5, period: "30 days" }}
            icon={<Clock className="h-6 w-6 text-yellow-700" />}
            iconBg="bg-yellow-100"
          />
          <StatCard
            title="Processed"
            value={docCounts.processed}
            change={{ value: 22.3, period: "30 days" }}
            icon={<CheckCircle className="h-6 w-6 text-green-700" />}
            iconBg="bg-green-100"
          />
        </div>

        {/* Documents Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold">Document Library</CardTitle>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="Tax Returns">Tax Returns</SelectItem>
                  <SelectItem value="Bank Statements">Bank Statements</SelectItem>
                  <SelectItem value="Tax Forms">Tax Forms</SelectItem>
                  <SelectItem value="Receipts">Receipts</SelectItem>
                  <SelectItem value="Payroll">Payroll</SelectItem>
                </SelectContent>
              </Select>

              <Button className="bg-primary hover:bg-primary/90">
                <Upload className="h-4 w-4 mr-2" />
                Upload Document
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Uploaded By</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocuments.map((doc) => {
                  const TypeIcon = typeIcons[doc.type as keyof typeof typeIcons] || File;
                  return (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                            <TypeIcon className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <div className="font-medium truncate max-w-[250px]">
                              {doc.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              #{doc.id}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{doc.client}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-normal">
                          {doc.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {doc.size}
                      </TableCell>
                      <TableCell>{doc.uploadedBy}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(doc.uploadedAt, "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={cn(
                            "font-normal",
                            statusConfig[doc.status as keyof typeof statusConfig].className
                          )}
                        >
                          {statusConfig[doc.status as keyof typeof statusConfig].label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Download className="h-4 w-4 mr-2" />
                              Download
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
