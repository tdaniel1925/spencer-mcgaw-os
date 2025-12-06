"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Settings,
  MessageSquare,
  Clock,
  Bot,
  FileText,
  Shield,
  Save,
  Plus,
  Trash2,
  Edit,
  RefreshCw,
  Phone,
  CheckCircle,
  XCircle,
} from "lucide-react";

interface SmsSettings {
  id: string;
  company_name: string;
  default_sender_name: string;
  business_hours_start: string;
  business_hours_end: string;
  business_days: string[];
  timezone: string;
  auto_reply_enabled: boolean;
  after_hours_message: string;
  opt_out_message: string;
  opt_in_confirmation: string;
  max_messages_per_day: number;
  require_opt_in: boolean;
  twilio_account_sid: string;
  twilio_auth_token: string;
  twilio_phone_number: string;
}

interface AutoResponder {
  id: string;
  name: string;
  trigger_type: "keyword" | "after_hours" | "first_message";
  trigger_keywords: string[];
  response_message: string;
  is_active: boolean;
  created_at: string;
}

interface Template {
  id: string;
  name: string;
  category: string;
  body: string;
  variables: string[];
  is_active: boolean;
  use_count: number;
}

interface CannedResponse {
  id: string;
  shortcut: string;
  title: string;
  body: string;
  category: string;
  is_active: boolean;
}

export default function SmsSettingsPage() {
  const [settings, setSettings] = useState<SmsSettings | null>(null);
  const [autoResponders, setAutoResponders] = useState<AutoResponder[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [cannedResponses, setCannedResponses] = useState<CannedResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showAddAutoResponder, setShowAddAutoResponder] = useState(false);
  const [showAddTemplate, setShowAddTemplate] = useState(false);
  const [showAddCannedResponse, setShowAddCannedResponse] = useState(false);

  const [autoResponderForm, setAutoResponderForm] = useState<{
    name: string;
    trigger_type: "keyword" | "after_hours" | "first_message";
    trigger_keywords: string;
    response_message: string;
    is_active: boolean;
  }>({
    name: "",
    trigger_type: "keyword",
    trigger_keywords: "",
    response_message: "",
    is_active: true,
  });

  const [templateForm, setTemplateForm] = useState({
    name: "",
    category: "general",
    body: "",
  });

  const [cannedResponseForm, setCannedResponseForm] = useState({
    shortcut: "",
    title: "",
    body: "",
    category: "general",
  });

  // Load all data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, autoRespondersRes, templatesRes, cannedRes] = await Promise.all([
        fetch("/api/sms/settings"),
        fetch("/api/sms/auto-responders"),
        fetch("/api/sms/templates"),
        fetch("/api/sms/canned-responses"),
      ]);

      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setSettings(data);
      }
      if (autoRespondersRes.ok) {
        const data = await autoRespondersRes.json();
        setAutoResponders(data.autoResponders || []);
      }
      if (templatesRes.ok) {
        const data = await templatesRes.json();
        setTemplates(data.templates || []);
      }
      if (cannedRes.ok) {
        const data = await cannedRes.json();
        setCannedResponses(data.responses || []);
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Save settings
  const saveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch("/api/sms/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        toast.success("Settings saved successfully");
      } else {
        toast.error("Failed to save settings");
      }
    } catch (error) {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  // Add auto responder
  const handleAddAutoResponder = async () => {
    try {
      const res = await fetch("/api/sms/auto-responders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...autoResponderForm,
          trigger_keywords: autoResponderForm.trigger_keywords.split(",").map(k => k.trim()),
        }),
      });

      if (res.ok) {
        toast.success("Auto-responder created");
        setShowAddAutoResponder(false);
        setAutoResponderForm({
          name: "",
          trigger_type: "keyword",
          trigger_keywords: "",
          response_message: "",
          is_active: true,
        });
        loadData();
      } else {
        toast.error("Failed to create auto-responder");
      }
    } catch (error) {
      toast.error("Failed to create auto-responder");
    }
  };

  // Delete auto responder
  const handleDeleteAutoResponder = async (id: string) => {
    if (!confirm("Are you sure you want to delete this auto-responder?")) return;

    try {
      const res = await fetch(`/api/sms/auto-responders/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Auto-responder deleted");
        loadData();
      } else {
        toast.error("Failed to delete auto-responder");
      }
    } catch (error) {
      toast.error("Failed to delete auto-responder");
    }
  };

  // Add template
  const handleAddTemplate = async () => {
    try {
      const res = await fetch("/api/sms/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(templateForm),
      });

      if (res.ok) {
        toast.success("Template created");
        setShowAddTemplate(false);
        setTemplateForm({ name: "", category: "general", body: "" });
        loadData();
      } else {
        toast.error("Failed to create template");
      }
    } catch (error) {
      toast.error("Failed to create template");
    }
  };

  // Delete template
  const handleDeleteTemplate = async (id: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return;

    try {
      const res = await fetch(`/api/sms/templates/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Template deleted");
        loadData();
      } else {
        toast.error("Failed to delete template");
      }
    } catch (error) {
      toast.error("Failed to delete template");
    }
  };

  // Add canned response
  const handleAddCannedResponse = async () => {
    try {
      const res = await fetch("/api/sms/canned-responses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cannedResponseForm),
      });

      if (res.ok) {
        toast.success("Canned response created");
        setShowAddCannedResponse(false);
        setCannedResponseForm({ shortcut: "", title: "", body: "", category: "general" });
        loadData();
      } else {
        toast.error("Failed to create canned response");
      }
    } catch (error) {
      toast.error("Failed to create canned response");
    }
  };

  // Delete canned response
  const handleDeleteCannedResponse = async (id: string) => {
    if (!confirm("Are you sure you want to delete this canned response?")) return;

    try {
      const res = await fetch(`/api/sms/canned-responses/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Canned response deleted");
        loadData();
      } else {
        toast.error("Failed to delete canned response");
      }
    } catch (error) {
      toast.error("Failed to delete canned response");
    }
  };

  if (loading) {
    return (
      <>
        <Header title="SMS Settings" />
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {[1, 2, 3].map(i => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-48" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-32" />
                </CardContent>
              </Card>
            ))}
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header title="SMS Settings" />

      <main className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto p-6">
          <Tabs defaultValue="general" className="space-y-6">
            <TabsList className="grid grid-cols-5 w-full">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="twilio">Twilio</TabsTrigger>
              <TabsTrigger value="auto-responders">Auto-Responders</TabsTrigger>
              <TabsTrigger value="templates">Templates</TabsTrigger>
              <TabsTrigger value="canned">Canned Responses</TabsTrigger>
            </TabsList>

            {/* General Settings */}
            <TabsContent value="general" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    General Settings
                  </CardTitle>
                  <CardDescription>
                    Configure your SMS messaging preferences
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Company Name</Label>
                      <Input
                        value={settings?.company_name || ""}
                        onChange={(e) => setSettings(s => s ? { ...s, company_name: e.target.value } : s)}
                        placeholder="Your Company Name"
                      />
                    </div>
                    <div>
                      <Label>Default Sender Name</Label>
                      <Input
                        value={settings?.default_sender_name || ""}
                        onChange={(e) => setSettings(s => s ? { ...s, default_sender_name: e.target.value } : s)}
                        placeholder="Sender Name"
                      />
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <Label className="text-base font-medium">Business Hours</Label>
                    <p className="text-sm text-muted-foreground mb-3">
                      Set your business hours for auto-responder timing
                    </p>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label>Start Time</Label>
                        <Input
                          type="time"
                          value={settings?.business_hours_start || "09:00"}
                          onChange={(e) => setSettings(s => s ? { ...s, business_hours_start: e.target.value } : s)}
                        />
                      </div>
                      <div>
                        <Label>End Time</Label>
                        <Input
                          type="time"
                          value={settings?.business_hours_end || "17:00"}
                          onChange={(e) => setSettings(s => s ? { ...s, business_hours_end: e.target.value } : s)}
                        />
                      </div>
                      <div>
                        <Label>Timezone</Label>
                        <Select
                          value={settings?.timezone || "America/New_York"}
                          onValueChange={(v) => setSettings(s => s ? { ...s, timezone: v } : s)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="America/New_York">Eastern</SelectItem>
                            <SelectItem value="America/Chicago">Central</SelectItem>
                            <SelectItem value="America/Denver">Mountain</SelectItem>
                            <SelectItem value="America/Los_Angeles">Pacific</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Auto-Reply Enabled</Label>
                        <p className="text-sm text-muted-foreground">
                          Automatically respond to messages outside business hours
                        </p>
                      </div>
                      <Switch
                        checked={settings?.auto_reply_enabled || false}
                        onCheckedChange={(v) => setSettings(s => s ? { ...s, auto_reply_enabled: v } : s)}
                      />
                    </div>

                    {settings?.auto_reply_enabled && (
                      <div>
                        <Label>After Hours Message</Label>
                        <Textarea
                          value={settings?.after_hours_message || ""}
                          onChange={(e) => setSettings(s => s ? { ...s, after_hours_message: e.target.value } : s)}
                          placeholder="Thanks for your message! We're currently outside business hours..."
                          rows={3}
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Require Opt-In</Label>
                        <p className="text-sm text-muted-foreground">
                          Require contacts to opt-in before receiving messages
                        </p>
                      </div>
                      <Switch
                        checked={settings?.require_opt_in || false}
                        onCheckedChange={(v) => setSettings(s => s ? { ...s, require_opt_in: v } : s)}
                      />
                    </div>

                    <div>
                      <Label>Max Messages Per Day (per contact)</Label>
                      <Input
                        type="number"
                        value={settings?.max_messages_per_day || 10}
                        onChange={(e) => setSettings(s => s ? { ...s, max_messages_per_day: parseInt(e.target.value) } : s)}
                        min={1}
                        max={100}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Compliance Messages
                  </CardTitle>
                  <CardDescription>
                    Configure TCPA compliance messages
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Opt-Out Message</Label>
                    <Textarea
                      value={settings?.opt_out_message || ""}
                      onChange={(e) => setSettings(s => s ? { ...s, opt_out_message: e.target.value } : s)}
                      placeholder="You have been unsubscribed. Reply START to resubscribe."
                      rows={2}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Sent when someone texts STOP
                    </p>
                  </div>
                  <div>
                    <Label>Opt-In Confirmation</Label>
                    <Textarea
                      value={settings?.opt_in_confirmation || ""}
                      onChange={(e) => setSettings(s => s ? { ...s, opt_in_confirmation: e.target.value } : s)}
                      placeholder="You are now subscribed. Reply STOP to unsubscribe."
                      rows={2}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Sent when someone texts START
                    </p>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button onClick={saveSettings} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Saving..." : "Save Settings"}
                </Button>
              </div>
            </TabsContent>

            {/* Twilio Settings */}
            <TabsContent value="twilio" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="h-5 w-5" />
                    Twilio Configuration
                  </CardTitle>
                  <CardDescription>
                    Configure your Twilio account for SMS messaging
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Account SID</Label>
                    <Input
                      type="password"
                      value={settings?.twilio_account_sid || ""}
                      onChange={(e) => setSettings(s => s ? { ...s, twilio_account_sid: e.target.value } : s)}
                      placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    />
                  </div>
                  <div>
                    <Label>Auth Token</Label>
                    <Input
                      type="password"
                      value={settings?.twilio_auth_token || ""}
                      onChange={(e) => setSettings(s => s ? { ...s, twilio_auth_token: e.target.value } : s)}
                      placeholder="Your Twilio Auth Token"
                    />
                  </div>
                  <div>
                    <Label>Phone Number</Label>
                    <Input
                      value={settings?.twilio_phone_number || ""}
                      onChange={(e) => setSettings(s => s ? { ...s, twilio_phone_number: e.target.value } : s)}
                      placeholder="+1234567890"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Your Twilio phone number in E.164 format
                    </p>
                  </div>

                  <div className="flex justify-end">
                    <Button onClick={saveSettings} disabled={saving}>
                      <Save className="h-4 w-4 mr-2" />
                      {saving ? "Saving..." : "Save Twilio Settings"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Auto-Responders */}
            <TabsContent value="auto-responders" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Bot className="h-5 w-5" />
                        Auto-Responders
                      </CardTitle>
                      <CardDescription>
                        Configure automatic responses to incoming messages
                      </CardDescription>
                    </div>
                    <Button onClick={() => setShowAddAutoResponder(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Auto-Responder
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {autoResponders.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No auto-responders configured
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Trigger</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-20"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {autoResponders.map(ar => (
                          <TableRow key={ar.id}>
                            <TableCell className="font-medium">{ar.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {ar.trigger_type === "keyword" && `Keywords: ${ar.trigger_keywords.join(", ")}`}
                                {ar.trigger_type === "after_hours" && "After Hours"}
                                {ar.trigger_type === "first_message" && "First Message"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {ar.is_active ? (
                                <Badge className="bg-green-100 text-green-700">Active</Badge>
                              ) : (
                                <Badge variant="secondary">Inactive</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteAutoResponder(ar.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Templates */}
            <TabsContent value="templates" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Message Templates
                      </CardTitle>
                      <CardDescription>
                        Create reusable message templates
                      </CardDescription>
                    </div>
                    <Button onClick={() => setShowAddTemplate(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Template
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {templates.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No templates configured
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Used</TableHead>
                          <TableHead className="w-20"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {templates.map(template => (
                          <TableRow key={template.id}>
                            <TableCell className="font-medium">{template.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{template.category}</Badge>
                            </TableCell>
                            <TableCell>{template.use_count || 0} times</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteTemplate(template.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Canned Responses */}
            <TabsContent value="canned" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <MessageSquare className="h-5 w-5" />
                        Canned Responses
                      </CardTitle>
                      <CardDescription>
                        Quick replies with /shortcut triggers
                      </CardDescription>
                    </div>
                    <Button onClick={() => setShowAddCannedResponse(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Response
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {cannedResponses.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No canned responses configured
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Shortcut</TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead className="w-20"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cannedResponses.map(response => (
                          <TableRow key={response.id}>
                            <TableCell>
                              <code className="bg-muted px-2 py-0.5 rounded text-sm">
                                {response.shortcut}
                              </code>
                            </TableCell>
                            <TableCell className="font-medium">{response.title}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{response.category}</Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteCannedResponse(response.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Add Auto-Responder Dialog */}
      <Dialog open={showAddAutoResponder} onOpenChange={setShowAddAutoResponder}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Auto-Responder</DialogTitle>
            <DialogDescription>
              Create an automatic response rule
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                value={autoResponderForm.name}
                onChange={(e) => setAutoResponderForm({ ...autoResponderForm, name: e.target.value })}
                placeholder="e.g., After Hours Reply"
              />
            </div>
            <div>
              <Label>Trigger Type</Label>
              <Select
                value={autoResponderForm.trigger_type}
                onValueChange={(v: "keyword" | "after_hours" | "first_message") =>
                  setAutoResponderForm({ ...autoResponderForm, trigger_type: v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="keyword">Keyword</SelectItem>
                  <SelectItem value="after_hours">After Hours</SelectItem>
                  <SelectItem value="first_message">First Message</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {autoResponderForm.trigger_type === "keyword" && (
              <div>
                <Label>Keywords (comma-separated)</Label>
                <Input
                  value={autoResponderForm.trigger_keywords}
                  onChange={(e) => setAutoResponderForm({ ...autoResponderForm, trigger_keywords: e.target.value })}
                  placeholder="help, info, hours"
                />
              </div>
            )}
            <div>
              <Label>Response Message</Label>
              <Textarea
                value={autoResponderForm.response_message}
                onChange={(e) => setAutoResponderForm({ ...autoResponderForm, response_message: e.target.value })}
                placeholder="Your auto-reply message..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddAutoResponder(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddAutoResponder}>Add Auto-Responder</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Template Dialog */}
      <Dialog open={showAddTemplate} onOpenChange={setShowAddTemplate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Template</DialogTitle>
            <DialogDescription>
              Create a reusable message template
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                value={templateForm.name}
                onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                placeholder="e.g., Appointment Reminder"
              />
            </div>
            <div>
              <Label>Category</Label>
              <Select
                value={templateForm.category}
                onValueChange={(v) => setTemplateForm({ ...templateForm, category: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="billing">Billing</SelectItem>
                  <SelectItem value="appointment">Appointment</SelectItem>
                  <SelectItem value="follow_up">Follow Up</SelectItem>
                  <SelectItem value="tax_season">Tax Season</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Message</Label>
              <Textarea
                value={templateForm.body}
                onChange={(e) => setTemplateForm({ ...templateForm, body: e.target.value })}
                placeholder="Hi {{first_name}}, this is a reminder..."
                rows={4}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use {`{{first_name}}`}, {`{{last_name}}`}, {`{{company}}`} for personalization
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddTemplate(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddTemplate}>Add Template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Canned Response Dialog */}
      <Dialog open={showAddCannedResponse} onOpenChange={setShowAddCannedResponse}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Canned Response</DialogTitle>
            <DialogDescription>
              Create a quick reply with a shortcut
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Shortcut</Label>
              <Input
                value={cannedResponseForm.shortcut}
                onChange={(e) => setCannedResponseForm({ ...cannedResponseForm, shortcut: e.target.value })}
                placeholder="/thanks"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Start with / for easy typing
              </p>
            </div>
            <div>
              <Label>Title</Label>
              <Input
                value={cannedResponseForm.title}
                onChange={(e) => setCannedResponseForm({ ...cannedResponseForm, title: e.target.value })}
                placeholder="Thank You"
              />
            </div>
            <div>
              <Label>Category</Label>
              <Select
                value={cannedResponseForm.category}
                onValueChange={(v) => setCannedResponseForm({ ...cannedResponseForm, category: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="greeting">Greeting</SelectItem>
                  <SelectItem value="closing">Closing</SelectItem>
                  <SelectItem value="confirmation">Confirmation</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Message</Label>
              <Textarea
                value={cannedResponseForm.body}
                onChange={(e) => setCannedResponseForm({ ...cannedResponseForm, body: e.target.value })}
                placeholder="Thank you for reaching out! How can I help you today?"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddCannedResponse(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddCannedResponse}>Add Response</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
