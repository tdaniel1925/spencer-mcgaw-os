"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  MessageSquare,
  Send,
  Users,
  Plus,
  MoreVertical,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Trash2,
  Play,
  Pause,
  FileText,
  Search,
  Filter,
  ArrowLeft,
  ChevronRight,
} from "lucide-react";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import Link from "next/link";

interface Campaign {
  id: string;
  name: string;
  description: string;
  template_id: string | null;
  message_body: string;
  status: "draft" | "scheduled" | "sending" | "completed" | "cancelled";
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  total_recipients: number;
  sent_count: number;
  delivered_count: number;
  failed_count: number;
  created_by: string;
  created_at: string;
  template?: {
    id: string;
    name: string;
  };
}

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  phone?: string;
  mobile?: string;
  email?: string;
  client: {
    id: string;
    name: string;
  };
}

interface Template {
  id: string;
  name: string;
  category: string;
  body: string;
  variables: string[];
}

export default function SMSCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateCampaign, setShowCreateCampaign] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Form state
  const [campaignForm, setCampaignForm] = useState({
    name: "",
    description: "",
    template_id: "",
    message_body: "",
    scheduled_at: "",
    recipients: [] as string[],
  });

  // Load campaigns
  const loadCampaigns = useCallback(async () => {
    try {
      const res = await fetch("/api/sms/campaigns");
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.campaigns || []);
      }
    } catch (error) {
      console.error("Error loading campaigns:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load contacts for recipient selection
  const loadContacts = useCallback(async () => {
    try {
      const res = await fetch("/api/contacts?has_phone=true");
      if (res.ok) {
        const data = await res.json();
        setContacts(data.contacts || []);
      }
    } catch (error) {
      console.error("Error loading contacts:", error);
    }
  }, []);

  // Load templates
  const loadTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/sms/templates");
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } catch (error) {
      console.error("Error loading templates:", error);
    }
  }, []);

  useEffect(() => {
    loadCampaigns();
    loadContacts();
    loadTemplates();
  }, [loadCampaigns, loadContacts, loadTemplates]);

  // Handle template selection
  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setCampaignForm({
        ...campaignForm,
        template_id: templateId,
        message_body: template.body,
      });
    }
  };

  // Toggle recipient selection
  const toggleRecipient = (contactId: string) => {
    setCampaignForm(prev => ({
      ...prev,
      recipients: prev.recipients.includes(contactId)
        ? prev.recipients.filter(id => id !== contactId)
        : [...prev.recipients, contactId],
    }));
  };

  // Select all contacts
  const selectAllContacts = () => {
    setCampaignForm(prev => ({
      ...prev,
      recipients: contacts.map(c => c.id),
    }));
  };

  // Deselect all contacts
  const deselectAllContacts = () => {
    setCampaignForm(prev => ({
      ...prev,
      recipients: [],
    }));
  };

  // Create campaign
  const handleCreateCampaign = async () => {
    if (!campaignForm.name) {
      toast.error("Please enter a campaign name");
      return;
    }
    if (!campaignForm.message_body) {
      toast.error("Please enter a message");
      return;
    }
    if (campaignForm.recipients.length === 0) {
      toast.error("Please select at least one recipient");
      return;
    }

    try {
      const res = await fetch("/api/sms/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(campaignForm),
      });

      if (res.ok) {
        toast.success("Campaign created successfully");
        setShowCreateCampaign(false);
        setCampaignForm({
          name: "",
          description: "",
          template_id: "",
          message_body: "",
          scheduled_at: "",
          recipients: [],
        });
        loadCampaigns();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to create campaign");
      }
    } catch (error) {
      toast.error("Failed to create campaign");
    }
  };

  // Start campaign
  const handleStartCampaign = async (campaignId: string) => {
    try {
      const res = await fetch(`/api/sms/campaigns/${campaignId}/start`, {
        method: "POST",
      });

      if (res.ok) {
        toast.success("Campaign started");
        loadCampaigns();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to start campaign");
      }
    } catch (error) {
      toast.error("Failed to start campaign");
    }
  };

  // Cancel campaign
  const handleCancelCampaign = async (campaignId: string) => {
    if (!confirm("Are you sure you want to cancel this campaign?")) return;

    try {
      const res = await fetch(`/api/sms/campaigns/${campaignId}/cancel`, {
        method: "POST",
      });

      if (res.ok) {
        toast.success("Campaign cancelled");
        loadCampaigns();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to cancel campaign");
      }
    } catch (error) {
      toast.error("Failed to cancel campaign");
    }
  };

  // Delete campaign
  const handleDeleteCampaign = async (campaignId: string) => {
    if (!confirm("Are you sure you want to delete this campaign?")) return;

    try {
      const res = await fetch(`/api/sms/campaigns/${campaignId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Campaign deleted");
        loadCampaigns();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to delete campaign");
      }
    } catch (error) {
      toast.error("Failed to delete campaign");
    }
  };

  // Get status badge
  const getStatusBadge = (status: Campaign["status"]) => {
    const styles: Record<string, string> = {
      draft: "bg-slate-100 text-slate-700",
      scheduled: "bg-blue-100 text-blue-700",
      sending: "bg-amber-100 text-amber-700",
      completed: "bg-green-100 text-green-700",
      cancelled: "bg-red-100 text-red-700",
    };
    return (
      <Badge className={cn("font-medium", styles[status])}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  // Filter campaigns
  const filteredCampaigns = campaigns.filter(campaign => {
    if (statusFilter !== "all" && campaign.status !== statusFilter) return false;
    if (searchQuery) {
      const search = searchQuery.toLowerCase();
      return (
        campaign.name.toLowerCase().includes(search) ||
        campaign.description?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  // Calculate stats
  const stats = {
    total: campaigns.length,
    draft: campaigns.filter(c => c.status === "draft").length,
    scheduled: campaigns.filter(c => c.status === "scheduled").length,
    sending: campaigns.filter(c => c.status === "sending").length,
    completed: campaigns.filter(c => c.status === "completed").length,
  };

  return (
    <>
      <Header title="SMS Campaigns" />

      <main className="flex-1 overflow-hidden flex flex-col">
        {/* Stats Bar */}
        <div className="border-b bg-card/50 px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Link href="/sms">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back to SMS
                </Button>
              </Link>
            </div>
            <Button onClick={() => setShowCreateCampaign(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Campaign
            </Button>
          </div>

          <div className="grid grid-cols-5 gap-4">
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">Total Campaigns</div>
              <div className="text-2xl font-bold">{stats.total}</div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">Draft</div>
              <div className="text-2xl font-bold text-slate-600">{stats.draft}</div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">Scheduled</div>
              <div className="text-2xl font-bold text-blue-600">{stats.scheduled}</div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">Sending</div>
              <div className="text-2xl font-bold text-amber-600">{stats.sending}</div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">Completed</div>
              <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            </Card>
          </div>
        </div>

        {/* Filters */}
        <div className="border-b px-6 py-3 flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search campaigns..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="sending">Sending</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={loadCampaigns}>
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Refresh
          </Button>
        </div>

        {/* Campaign List */}
        <ScrollArea className="flex-1">
          <div className="p-6">
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <Skeleton className="h-6 w-48 mb-2" />
                      <Skeleton className="h-4 w-96" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredCampaigns.length === 0 ? (
              <Card className="p-12 text-center">
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No campaigns yet</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first SMS campaign to reach multiple contacts at once.
                </p>
                <Button onClick={() => setShowCreateCampaign(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Campaign
                </Button>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredCampaigns.map(campaign => (
                  <Card key={campaign.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold">{campaign.name}</h3>
                            {getStatusBadge(campaign.status)}
                          </div>
                          {campaign.description && (
                            <p className="text-sm text-muted-foreground mb-2">
                              {campaign.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Users className="h-3.5 w-3.5" />
                              {campaign.total_recipients} recipients
                            </span>
                            {campaign.scheduled_at && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5" />
                                Scheduled: {format(parseISO(campaign.scheduled_at), "MMM d, h:mm a")}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              Created {formatDistanceToNow(parseISO(campaign.created_at), { addSuffix: true })}
                            </span>
                          </div>

                          {/* Progress bar for sending/completed campaigns */}
                          {(campaign.status === "sending" || campaign.status === "completed") && (
                            <div className="mt-3">
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span>Progress</span>
                                <span>
                                  {campaign.sent_count} / {campaign.total_recipients} sent
                                </span>
                              </div>
                              <Progress
                                value={(campaign.sent_count / campaign.total_recipients) * 100}
                                className="h-2"
                              />
                              <div className="flex items-center gap-4 mt-2 text-xs">
                                <span className="flex items-center gap-1 text-green-600">
                                  <CheckCircle className="h-3 w-3" />
                                  {campaign.delivered_count} delivered
                                </span>
                                {campaign.failed_count > 0 && (
                                  <span className="flex items-center gap-1 text-red-600">
                                    <XCircle className="h-3 w-3" />
                                    {campaign.failed_count} failed
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {campaign.status === "draft" && (
                              <>
                                <DropdownMenuItem onClick={() => handleStartCampaign(campaign.id)}>
                                  <Play className="h-4 w-4 mr-2" />
                                  Start Campaign
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </>
                            )}
                            {campaign.status === "sending" && (
                              <>
                                <DropdownMenuItem onClick={() => handleCancelCampaign(campaign.id)}>
                                  <Pause className="h-4 w-4 mr-2" />
                                  Cancel Campaign
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </>
                            )}
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDeleteCampaign(campaign.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </main>

      {/* Create Campaign Dialog */}
      <Dialog open={showCreateCampaign} onOpenChange={setShowCreateCampaign}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Create SMS Campaign</DialogTitle>
            <DialogDescription>
              Send a message to multiple contacts at once.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden">
            <Tabs defaultValue="details" className="h-full flex flex-col">
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="details">Campaign Details</TabsTrigger>
                <TabsTrigger value="message">Message</TabsTrigger>
                <TabsTrigger value="recipients">
                  Recipients ({campaignForm.recipients.length})
                </TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-auto mt-4">
                <TabsContent value="details" className="m-0 space-y-4">
                  <div>
                    <Label htmlFor="name">Campaign Name *</Label>
                    <Input
                      id="name"
                      value={campaignForm.name}
                      onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })}
                      placeholder="e.g., Tax Season Reminder 2025"
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={campaignForm.description}
                      onChange={(e) => setCampaignForm({ ...campaignForm, description: e.target.value })}
                      placeholder="Brief description of this campaign..."
                      rows={2}
                    />
                  </div>
                  <div>
                    <Label htmlFor="scheduled">Schedule (Optional)</Label>
                    <Input
                      id="scheduled"
                      type="datetime-local"
                      value={campaignForm.scheduled_at}
                      onChange={(e) => setCampaignForm({ ...campaignForm, scheduled_at: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Leave empty to send immediately when you start the campaign.
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="message" className="m-0 space-y-4">
                  <div>
                    <Label>Use Template (Optional)</Label>
                    <Select
                      value={campaignForm.template_id}
                      onValueChange={handleTemplateSelect}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a template..." />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map(template => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="message">Message *</Label>
                    <Textarea
                      id="message"
                      value={campaignForm.message_body}
                      onChange={(e) => setCampaignForm({ ...campaignForm, message_body: e.target.value })}
                      placeholder="Enter your message..."
                      rows={6}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {campaignForm.message_body.length} characters
                      {campaignForm.message_body.length > 160 && (
                        <span className="text-amber-600">
                          {" "}(will be sent as {Math.ceil(campaignForm.message_body.length / 160)} messages)
                        </span>
                      )}
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="recipients" className="m-0">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={selectAllContacts}>
                        Select All
                      </Button>
                      <Button variant="outline" size="sm" onClick={deselectAllContacts}>
                        Deselect All
                      </Button>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {campaignForm.recipients.length} of {contacts.length} selected
                    </span>
                  </div>

                  <ScrollArea className="h-[300px] border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12"></TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Client</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {contacts.map(contact => (
                          <TableRow
                            key={contact.id}
                            className="cursor-pointer"
                            onClick={() => toggleRecipient(contact.id)}
                          >
                            <TableCell>
                              <Checkbox
                                checked={campaignForm.recipients.includes(contact.id)}
                                onCheckedChange={() => toggleRecipient(contact.id)}
                              />
                            </TableCell>
                            <TableCell>
                              {contact.first_name} {contact.last_name}
                            </TableCell>
                            <TableCell>{contact.mobile || contact.phone}</TableCell>
                            <TableCell>{contact.client?.name}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </TabsContent>
              </div>
            </Tabs>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowCreateCampaign(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateCampaign}>
              Create Campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
