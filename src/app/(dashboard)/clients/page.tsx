"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  Plus,
  ChevronRight,
  Printer,
  Phone,
  Mail,
  MapPin,
  Loader2,
  RefreshCw,
  Users,
  Upload,
  UserPlus,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { BulkUploadDialog } from "@/components/bulk-upload-dialog";

// Client type from database
interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  status: string;
  notes: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

const ITEMS_PER_PAGE = 10;

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const router = useRouter();

  // Pagination
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    status: "active",
    notes: "",
  });

  // Fetch clients
  const fetchClients = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (statusFilter !== "all") params.set("status", statusFilter);
      params.set("limit", ITEMS_PER_PAGE.toString());
      params.set("offset", ((page - 1) * ITEMS_PER_PAGE).toString());

      const response = await fetch(`/api/clients?${params}`);
      if (response.ok) {
        const data = await response.json();
        setClients(data.clients || []);
        setTotalCount(data.count || 0);
      }
    } catch (error) {
      console.error("Error fetching clients:", error);
      toast.error("Failed to load clients");
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter, page]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter]);

  // Calculate stats from current data
  const clientCounts = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return {
      total: totalCount,
      active: clients.filter(c => c.status === "active").length,
      new: clients.filter(c => new Date(c.created_at) > thirtyDaysAgo).length,
    };
  }, [clients, totalCount]);

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      state: "",
      zip: "",
      status: "active",
      notes: "",
    });
  };

  const handleCreateClient = async () => {
    if (!formData.name.trim()) {
      toast.error("Client name is required");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email || null,
          phone: formData.phone || null,
          address: formData.address || null,
          city: formData.city || null,
          state: formData.state || null,
          zip: formData.zip || null,
          status: formData.status,
          notes: formData.notes || null,
        }),
      });

      if (response.ok) {
        toast.success("Client created successfully");
        setCreateDialogOpen(false);
        resetForm();
        fetchClients();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to create client");
      }
    } catch (error) {
      console.error("Error creating client:", error);
      toast.error("Failed to create client");
    } finally {
      setSaving(false);
    }
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  return (
    <>
      <Header title="Clients" />
      <main className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
        {/* Top Bar */}
        <div className="h-14 border-b bg-card flex items-center px-4 gap-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <span className="font-medium">Clients</span>
          </div>

          {/* Search */}
          <div className="relative ml-4">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search clients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-[200px] h-8 pl-9 text-sm"
            />
          </div>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-28 h-8 text-sm">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex-1" />

          {/* Stats */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{clientCounts.total} total</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-muted-foreground">{clientCounts.active} active</span>
            </div>
            <div className="flex items-center gap-1.5">
              <UserPlus className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">{clientCounts.new} new</span>
            </div>
          </div>

          <div className="h-4 border-l mx-2" />

          {/* Actions */}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={fetchClients}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={() => setBulkUploadOpen(true)}>
            <Upload className="h-4 w-4 mr-1.5" />
            Import
          </Button>
          <Button
            size="sm"
            className="h-8"
            onClick={() => {
              resetForm();
              setCreateDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add Client
          </Button>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4">
              <Card className="border-border/50">
                <CardContent className="p-0">
                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : clients.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Users className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium">No clients found</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {searchQuery || statusFilter !== "all"
                          ? "Try adjusting your filters"
                          : "Add your first client to get started"}
                      </p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[100px]">Client ID</TableHead>
                          <TableHead>Join Date</TableHead>
                          <TableHead>Client Name</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {clients.map((client) => (
                          <TableRow
                            key={client.id}
                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => router.push(`/clients/${client.id}`)}
                          >
                            <TableCell className="font-medium text-primary">
                              #{client.id.slice(0, 8)}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {format(new Date(client.created_at), "dd MMM yyyy")}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9">
                                  <AvatarFallback className="bg-primary/10 text-primary">
                                    {client.name
                                      .split(" ")
                                      .map((n) => n[0])
                                      .join("")
                                      .slice(0, 2)
                                      .toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="font-medium">{client.name}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              {client.phone ? (
                                <div className="flex items-center gap-1.5 text-sm">
                                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                                  {client.phone}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {client.email ? (
                                <div className="flex items-center gap-1.5 text-sm text-primary">
                                  <Mail className="h-3.5 w-3.5" />
                                  {client.email}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {client.city || client.state ? (
                                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                  <MapPin className="h-3.5 w-3.5" />
                                  {[client.city, client.state].filter(Boolean).join(", ")}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] font-normal",
                                  client.status === "active"
                                    ? "bg-green-100 text-green-700 border-green-200"
                                    : "bg-gray-100 text-gray-600 border-gray-200"
                                )}
                              >
                                {client.status === "active" ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}

                  {/* Pagination */}
                  {clients.length > 0 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t">
                      <p className="text-xs text-muted-foreground">
                        Showing {((page - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(page * ITEMS_PER_PAGE, totalCount)} of {totalCount}
                      </p>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={page === 1}
                          onClick={() => setPage(p => p - 1)}
                        >
                          Previous
                        </Button>
                        {(() => {
                          const pages: (number | "ellipsis")[] = [];
                          if (totalPages <= 7) {
                            for (let i = 1; i <= totalPages; i++) pages.push(i);
                          } else {
                            pages.push(1);
                            if (page > 3) pages.push("ellipsis");
                            const start = Math.max(2, page - 1);
                            const end = Math.min(totalPages - 1, page + 1);
                            for (let i = start; i <= end; i++) {
                              if (!pages.includes(i)) pages.push(i);
                            }
                            if (page < totalPages - 2) pages.push("ellipsis");
                            if (!pages.includes(totalPages)) pages.push(totalPages);
                          }

                          return pages.map((p, idx) =>
                            p === "ellipsis" ? (
                              <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground text-xs">...</span>
                            ) : (
                              <Button
                                key={p}
                                variant="outline"
                                size="sm"
                                className={cn("h-7 w-7 text-xs p-0", page === p && "bg-primary text-primary-foreground")}
                                onClick={() => setPage(p)}
                              >
                                {p}
                              </Button>
                            )
                          );
                        })()}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={page >= totalPages}
                          onClick={() => setPage(p => p + 1)}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </div>
      </main>

      {/* Create Client Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add New Client</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Client Name *</Label>
              <Input
                id="name"
                placeholder="Enter client name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="client@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  placeholder="(555) 123-4567"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                placeholder="Street address"
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  placeholder="City"
                  value={formData.city}
                  onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  placeholder="State"
                  value={formData.state}
                  onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zip">ZIP</Label>
                <Input
                  id="zip"
                  placeholder="ZIP"
                  value={formData.zip}
                  onChange={(e) => setFormData(prev => ({ ...prev, zip: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Additional notes about the client"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-primary"
              onClick={handleCreateClient}
              disabled={saving}
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Upload Dialog */}
      <BulkUploadDialog
        open={bulkUploadOpen}
        onClose={() => setBulkUploadOpen(false)}
        title="Bulk Upload Clients"
        targetFields={[
          { name: "name", label: "Company/Client Name", required: true, type: "text" },
          { name: "email", label: "Email", required: false, type: "email" },
          { name: "phone", label: "Phone", required: false, type: "phone" },
          { name: "address", label: "Street Address", required: false, type: "text" },
          { name: "city", label: "City", required: false, type: "text" },
          { name: "state", label: "State", required: false, type: "text" },
          { name: "zip", label: "ZIP Code", required: false, type: "text" },
          { name: "status", label: "Status", required: false, type: "select", options: ["active", "inactive", "prospect"] },
          { name: "notes", label: "Notes", required: false, type: "text" },
        ]}
        onUpload={async (data) => {
          let success = 0;
          const errors: string[] = [];

          for (const row of data) {
            try {
              const response = await fetch("/api/clients", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  name: row.name,
                  email: row.email || null,
                  phone: row.phone || null,
                  address: row.address || null,
                  city: row.city || null,
                  state: row.state || null,
                  zip: row.zip || null,
                  status: row.status || "active",
                  notes: row.notes || null,
                }),
              });

              if (response.ok) {
                success++;
              } else {
                const data = await response.json();
                errors.push(`${row.name}: ${data.error || "Failed to create"}`);
              }
            } catch (error) {
              errors.push(`${row.name}: Unexpected error`);
            }
          }

          if (success > 0) {
            fetchClients();
          }

          return { success, errors };
        }}
      />
    </>
  );
}
