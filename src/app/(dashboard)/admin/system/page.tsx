"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useEmail } from "@/lib/email";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Mail,
  Phone,
  Bot,
  Key,
  Shield,
  Database,
  Settings,
  CheckCircle,
  XCircle,
  RefreshCw,
  ExternalLink,
  Eye,
  EyeOff,
  Copy,
  Trash2,
  Plus,
  AlertTriangle,
  Clock,
  Activity,
  Download,
  Upload,
  Globe,
  Bell,
  Lock,
  FileText,
  Zap,
  Server,
  HardDrive,
  Calendar,
  Users,
  CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";

// Types
interface ConnectedAccount {
  id: string;
  provider: "microsoft" | "google";
  email: string;
  connectedAt: Date;
  lastSync: Date;
  status: "active" | "expired" | "error";
  syncEnabled: boolean;
}

interface ApiKey {
  id: string;
  name: string;
  service: "twilio" | "vapi" | "openai" | "anthropic" | "custom";
  keyPreview: string;
  createdAt: Date;
  lastUsed: Date | null;
  status: "active" | "inactive";
  usageThisMonth: number;
  usageLimit: number | null;
}

interface AuditLogEntry {
  id: string;
  timestamp: Date;
  user: string;
  action: string;
  resource: string;
  details: string;
  ip: string;
}

interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  events: string[];
  status: "active" | "inactive";
  lastTriggered: Date | null;
  successRate: number;
}

// Empty arrays - real data comes from OAuth connections
const mockConnectedAccounts: ConnectedAccount[] = [];

// Empty arrays - real data comes from API key management
const mockApiKeys: ApiKey[] = [];

// Empty arrays - real data comes from audit system
const mockAuditLogs: AuditLogEntry[] = [];

// Empty arrays - real data comes from webhook configuration
const mockWebhooks: WebhookConfig[] = [];

// Service icons and colors
const serviceConfig = {
  twilio: { icon: Phone, color: "bg-red-500", name: "Twilio" },
  vapi: { icon: Bot, color: "bg-purple-500", name: "VAPI" },
  openai: { icon: Zap, color: "bg-green-500", name: "OpenAI" },
  anthropic: { icon: Bot, color: "bg-orange-500", name: "Anthropic" },
  custom: { icon: Key, color: "bg-gray-500", name: "Custom" },
};

export default function SystemSettingsPage() {
  const { refreshAccounts } = useEmail();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState("integrations");
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccount[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [auditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [showConnectEmail, setShowConnectEmail] = useState(false);
  const [showAddApiKey, setShowAddApiKey] = useState(false);
  const [showAddWebhook, setShowAddWebhook] = useState(false);
  const [showApiKeyValue, setShowApiKeyValue] = useState<string | null>(null);
  const [showClearDataConfirm, setShowClearDataConfirm] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCleaningOrphanedData, setIsCleaningOrphanedData] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<{ success: boolean; message: string } | null>(null);
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [savingSecurity, setSavingSecurity] = useState(false);

  // Handle hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch email connections from database
  useEffect(() => {
    async function fetchEmailConnections() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          const { data: connections, error } = await supabase
            .from("email_connections")
            .select("*")
            .eq("user_id", user.id);

          if (!error && connections) {
            const formattedConnections: ConnectedAccount[] = connections.map(conn => ({
              id: conn.id,
              provider: conn.provider as "microsoft" | "google",
              email: conn.email,
              connectedAt: new Date(conn.created_at || conn.updated_at),
              lastSync: new Date(conn.updated_at),
              // Show active if we have a refresh token (tokens auto-refresh), only expired if no refresh token
              status: conn.refresh_token ? "active" : "expired",
              syncEnabled: true,
            }));
            setConnectedAccounts(formattedConnections);
          }
        }
      } catch (error) {
        console.error("Failed to fetch email connections:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchEmailConnections();
  }, []);

  // Form states
  const [newApiKey, setNewApiKey] = useState({
    name: "",
    service: "twilio" as ApiKey["service"],
    apiKey: "",
    apiSecret: "",
  });

  // Settings states
  const [generalSettings, setGeneralSettings] = useState({
    companyName: "Spencer McGaw CPA",
    timezone: "America/Chicago",
    dateFormat: "MM/dd/yyyy",
    currency: "USD",
    fiscalYearStart: "January",
  });

  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    smsNotifications: false,
    dailyDigest: true,
    urgentAlerts: true,
    clientUpdates: true,
    systemAlerts: true,
  });

  const [securitySettings, setSecuritySettings] = useState({
    twoFactorRequired: false,
    sessionTimeout: "30",
    ipWhitelist: false,
    auditLogging: true,
    dataEncryption: true,
  });

  // Fetch company settings on mount
  useEffect(() => {
    async function fetchCompanySettings() {
      try {
        const response = await fetch("/api/settings/company");
        if (response.ok) {
          const data = await response.json();
          setGeneralSettings(prev => ({
            ...prev,
            companyName: data.companyName || prev.companyName,
            timezone: data.timezone === "cst" ? "America/Chicago" : data.timezone || prev.timezone,
          }));
        }
      } catch (error) {
        console.error("Failed to fetch company settings:", error);
      }
    }
    fetchCompanySettings();
  }, []);

  // Save general settings
  const handleSaveGeneralSettings = async () => {
    setSavingGeneral(true);
    try {
      const response = await fetch("/api/settings/company", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: generalSettings.companyName,
          timezone: generalSettings.timezone,
        }),
      });

      if (response.ok) {
        toast.success("Company settings saved successfully");
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to save settings");
      }
    } catch (error) {
      console.error("Failed to save company settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setSavingGeneral(false);
    }
  };

  // Save notification settings
  const handleSaveNotificationSettings = async () => {
    setSavingNotifications(true);
    try {
      const response = await fetch("/api/settings/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailNewTask: notificationSettings.emailNotifications,
          emailTaskAssigned: notificationSettings.emailNotifications,
          emailTaskDueSoon: notificationSettings.urgentAlerts,
          emailTaskOverdue: notificationSettings.urgentAlerts,
          emailTaskCompleted: notificationSettings.emailNotifications,
          emailClientActivity: notificationSettings.clientUpdates,
          emailWeeklySummary: notificationSettings.dailyDigest,
          smsEnabled: notificationSettings.smsNotifications,
          smsUrgentOnly: true,
          smsTaskOverdue: notificationSettings.urgentAlerts,
          inappNewTask: true,
          inappTaskAssigned: true,
          inappTaskDueSoon: true,
          inappTaskOverdue: true,
          inappTaskCompleted: true,
          inappMentions: true,
          inappClientActivity: notificationSettings.clientUpdates,
          aiEmailProcessed: true,
          aiHighPriorityDetected: notificationSettings.urgentAlerts,
          aiActionItemsExtracted: true,
          quietHoursEnabled: false,
          quietHoursStart: "22:00",
          quietHoursEnd: "07:00",
        }),
      });

      if (response.ok) {
        toast.success("Notification settings saved successfully");
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to save notification settings");
      }
    } catch (error) {
      console.error("Failed to save notification settings:", error);
      toast.error("Failed to save notification settings");
    } finally {
      setSavingNotifications(false);
    }
  };

  // Handle Microsoft OAuth connection - redirects to real OAuth flow
  const handleConnectMicrosoft = async () => {
    setIsConnecting(true);
    // Redirect to the actual OAuth endpoint
    window.location.href = "/api/email/connect";
  };

  // Handle orphaned email data cleanup
  const handleCleanupOrphanedData = async () => {
    setIsCleaningOrphanedData(true);
    setCleanupResult(null);
    try {
      const response = await fetch("/api/email/cleanup", {
        method: "POST",
      });
      const data = await response.json();
      if (response.ok) {
        setCleanupResult({
          success: true,
          message: `Cleaned up ${data.cleaned?.classifications || 0} classifications, ${data.cleaned?.actionItems || 0} action items, and ${data.cleaned?.tasks || 0} tasks.`,
        });
        // Refresh accounts to update UI
        await refreshAccounts();
      } else {
        setCleanupResult({
          success: false,
          message: data.error || "Failed to cleanup orphaned data",
        });
      }
    } catch (error) {
      console.error("Failed to cleanup orphaned data:", error);
      setCleanupResult({
        success: false,
        message: "An error occurred while cleaning up data",
      });
    } finally {
      setIsCleaningOrphanedData(false);
    }
  };

  // Handle API key creation
  const handleAddApiKey = () => {
    const newKey: ApiKey = {
      id: `key-${Date.now()}`,
      name: newApiKey.name,
      service: newApiKey.service,
      keyPreview: `${newApiKey.apiKey.slice(0, 4)}...${newApiKey.apiKey.slice(-6)}`,
      createdAt: new Date(),
      lastUsed: null,
      status: "active",
      usageThisMonth: 0,
      usageLimit: null,
    };
    setApiKeys([...apiKeys, newKey]);
    setNewApiKey({ name: "", service: "twilio", apiKey: "", apiSecret: "" });
    setShowAddApiKey(false);
  };

  // Handle account disconnect - also delete from database and clear emails
  const handleDisconnectAccount = async (accountId: string) => {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("email_connections")
        .delete()
        .eq("id", accountId);

      if (!error) {
        setConnectedAccounts(connectedAccounts.filter(a => a.id !== accountId));
        // Refresh the email context to remove emails for this account
        await refreshAccounts();
      } else {
        console.error("Failed to disconnect account:", error);
      }
    } catch (error) {
      console.error("Failed to disconnect account:", error);
    }
  };

  // Handle API key deletion
  const handleDeleteApiKey = (keyId: string) => {
    setApiKeys(apiKeys.filter(k => k.id !== keyId));
  };

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <>
        <Header title="System Settings" />
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            <div className="mb-6">
              <h2 className="text-2xl font-bold">System Configuration</h2>
              <p className="text-muted-foreground">
                Manage integrations, API keys, security settings, and system preferences
              </p>
            </div>
            <div className="flex items-center justify-center h-64">
              <div className="animate-pulse text-muted-foreground">Loading...</div>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header title="System Settings" />
      <main className="flex-1 overflow-auto">
        <div className="p-6">
          {/* Page Header */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold">System Configuration</h2>
            <p className="text-muted-foreground">
              Manage integrations, API keys, security settings, and system preferences
            </p>
          </div>

          {/* Settings Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="integrations" className="gap-2">
                <Globe className="h-4 w-4" />
                Integrations
              </TabsTrigger>
              <TabsTrigger value="api-keys" className="gap-2">
                <Key className="h-4 w-4" />
                API Keys
              </TabsTrigger>
              <TabsTrigger value="general" className="gap-2">
                <Settings className="h-4 w-4" />
                General
              </TabsTrigger>
              <TabsTrigger value="security" className="gap-2">
                <Shield className="h-4 w-4" />
                Security
              </TabsTrigger>
              <TabsTrigger value="notifications" className="gap-2">
                <Bell className="h-4 w-4" />
                Notifications
              </TabsTrigger>
              <TabsTrigger value="backup" className="gap-2">
                <Database className="h-4 w-4" />
                Backup & Data
              </TabsTrigger>
              <TabsTrigger value="audit" className="gap-2">
                <FileText className="h-4 w-4" />
                Audit Log
              </TabsTrigger>
            </TabsList>

            {/* Integrations Tab */}
            <TabsContent value="integrations" className="space-y-6">
              {/* Email Integration */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Mail className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <CardTitle>Email Integration</CardTitle>
                        <CardDescription>
                          Connect Microsoft 365 or Google Workspace for email sync
                        </CardDescription>
                      </div>
                    </div>
                    <Button onClick={() => setShowConnectEmail(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Connect Account
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {connectedAccounts.length === 0 ? (
                    <div className="space-y-6">
                      <div className="text-center py-8 text-muted-foreground">
                        <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No email accounts connected</p>
                        <p className="text-sm">Connect your Microsoft 365 or Google account to enable email features</p>
                      </div>

                      {/* Orphaned Data Cleanup Section */}
                      <Separator />
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium flex items-center gap-2">
                              <Trash2 className="h-4 w-4 text-muted-foreground" />
                              Clear Orphaned Email Data
                            </h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              Remove any leftover email classifications, action items, and tasks from previously disconnected accounts
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            onClick={handleCleanupOrphanedData}
                            disabled={isCleaningOrphanedData}
                          >
                            {isCleaningOrphanedData ? (
                              <>
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                Cleaning...
                              </>
                            ) : (
                              <>
                                <Trash2 className="h-4 w-4 mr-2" />
                                Clear Orphaned Data
                              </>
                            )}
                          </Button>
                        </div>
                        {cleanupResult && (
                          <Alert variant={cleanupResult.success ? "default" : "destructive"}>
                            {cleanupResult.success ? (
                              <CheckCircle className="h-4 w-4" />
                            ) : (
                              <AlertTriangle className="h-4 w-4" />
                            )}
                            <AlertDescription>{cleanupResult.message}</AlertDescription>
                          </Alert>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {connectedAccounts.map((account) => (
                        <div
                          key={account.id}
                          className="flex items-center justify-between p-4 border rounded-lg"
                        >
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "p-2 rounded-lg",
                              account.provider === "microsoft" ? "bg-blue-100" : "bg-red-100"
                            )}>
                              <Mail className={cn(
                                "h-5 w-5",
                                account.provider === "microsoft" ? "text-blue-600" : "text-red-600"
                              )} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{account.email}</span>
                                <Badge variant={account.status === "active" ? "default" : "destructive"}>
                                  {account.status}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                                <span className="capitalize">{account.provider}</span>
                                <span>Connected {format(account.connectedAt, "MMM d, yyyy")}</span>
                                <span>Last sync: {format(account.lastSync, "MMM d, h:mm a")}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2 mr-4">
                              <Switch
                                checked={account.syncEnabled}
                                onCheckedChange={(checked) => {
                                  setConnectedAccounts(accounts =>
                                    accounts.map(a =>
                                      a.id === account.id ? { ...a, syncEnabled: checked } : a
                                    )
                                  );
                                }}
                              />
                              <span className="text-sm">Auto-sync</span>
                            </div>
                            <Button variant="outline" size="sm">
                              <RefreshCw className="h-4 w-4 mr-1" />
                              Sync Now
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDisconnectAccount(account.id)}
                            >
                              Disconnect
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Email Sync Settings */}
                  {connectedAccounts.length > 0 && (
                    <>
                      <Separator className="my-6" />
                      <div className="space-y-4">
                        <h4 className="font-medium">Sync Settings</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Sync Frequency</Label>
                            <Select defaultValue="5">
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1">Every 1 minute</SelectItem>
                                <SelectItem value="5">Every 5 minutes</SelectItem>
                                <SelectItem value="15">Every 15 minutes</SelectItem>
                                <SelectItem value="30">Every 30 minutes</SelectItem>
                                <SelectItem value="60">Every hour</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Sync History</Label>
                            <Select defaultValue="30">
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="7">Last 7 days</SelectItem>
                                <SelectItem value="30">Last 30 days</SelectItem>
                                <SelectItem value="90">Last 90 days</SelectItem>
                                <SelectItem value="365">Last year</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Include Attachments</Label>
                            <p className="text-sm text-muted-foreground">
                              Automatically download email attachments
                            </p>
                          </div>
                          <Switch defaultChecked />
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <Label>AI Processing</Label>
                            <p className="text-sm text-muted-foreground">
                              Automatically classify and summarize incoming emails
                            </p>
                          </div>
                          <Switch defaultChecked />
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Phone Integration (Twilio) */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <Phone className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <CardTitle>SMS & Phone Integration</CardTitle>
                      <CardDescription>
                        Twilio integration for SMS notifications and call features
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert>
                    <Zap className="h-4 w-4" />
                    <AlertTitle>Usage-Based Billing</AlertTitle>
                    <AlertDescription>
                      SMS and phone features use our shared Twilio account. You only pay for what you use.
                      Current rate: $0.0075/SMS, $0.0085/min for calls.
                    </AlertDescription>
                  </Alert>

                  <div className="grid grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="text-3xl font-bold">0</div>
                          <div className="text-sm text-muted-foreground">SMS This Month</div>
                          <div className="text-xs text-muted-foreground mt-1">$0.00 estimated</div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="text-3xl font-bold">0</div>
                          <div className="text-sm text-muted-foreground">Calls This Month</div>
                          <div className="text-xs text-muted-foreground mt-1">0 minutes</div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-muted-foreground">Not Connected</div>
                          <div className="text-sm text-muted-foreground">Service Status</div>
                          <div className="text-xs text-muted-foreground mt-1">Configure Twilio to enable</div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="space-y-4 pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>SMS Notifications</Label>
                        <p className="text-sm text-muted-foreground">
                          Send SMS alerts for urgent items
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Client SMS Reminders</Label>
                        <p className="text-sm text-muted-foreground">
                          Send appointment and deadline reminders to clients
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* VAPI Webhook */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 rounded-lg">
                      <Phone className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <CardTitle>VAPI Webhook</CardTitle>
                      <CardDescription>
                        Server URL for receiving call data from your VAPI assistant
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Server URL</Label>
                    <p className="text-sm text-muted-foreground">
                      Copy this URL into your VAPI assistant&apos;s Server URL field
                    </p>
                    <div className="flex items-center gap-2">
                      <Input
                        readOnly
                        value="https://spencer-mcgaw-os.vercel.app/api/webhooks/vapi"
                        className="font-mono text-sm"
                      />
                      <Button variant="outline" size="icon" onClick={() => copyToClipboard("https://spencer-mcgaw-os.vercel.app/api/webhooks/vapi")}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* AI Phone Agent (VAPI) */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Bot className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <CardTitle>AI Phone Agent</CardTitle>
                      <CardDescription>
                        VAPI-powered AI assistant for automated phone interactions
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert>
                    <Bot className="h-4 w-4" />
                    <AlertTitle>AI-Powered Phone Assistant</AlertTitle>
                    <AlertDescription>
                      Our AI phone agent can handle incoming calls, schedule appointments, and answer common questions.
                      Usage: $0.05/min for AI agent time.
                    </AlertDescription>
                  </Alert>

                  <div className="grid grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="text-3xl font-bold">0</div>
                          <div className="text-sm text-muted-foreground">AI Minutes This Month</div>
                          <div className="text-xs text-muted-foreground mt-1">$0.00 estimated</div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="text-3xl font-bold">--%</div>
                          <div className="text-sm text-muted-foreground">Resolution Rate</div>
                          <div className="text-xs text-muted-foreground mt-1">No calls yet</div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="text-3xl font-bold">--</div>
                          <div className="text-sm text-muted-foreground">Satisfaction Score</div>
                          <div className="text-xs text-muted-foreground mt-1">No ratings yet</div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h4 className="font-medium">AI Agent Settings</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Agent Voice</Label>
                        <Select defaultValue="professional-female">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="professional-female">Professional Female</SelectItem>
                            <SelectItem value="professional-male">Professional Male</SelectItem>
                            <SelectItem value="friendly-female">Friendly Female</SelectItem>
                            <SelectItem value="friendly-male">Friendly Male</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Operating Hours</Label>
                        <Select defaultValue="business">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="24-7">24/7</SelectItem>
                            <SelectItem value="business">Business Hours (8am-6pm)</SelectItem>
                            <SelectItem value="extended">Extended (7am-9pm)</SelectItem>
                            <SelectItem value="custom">Custom Schedule</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Enable AI Agent</Label>
                        <p className="text-sm text-muted-foreground">
                          Allow AI to handle incoming calls
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Appointment Scheduling</Label>
                        <p className="text-sm text-muted-foreground">
                          AI can schedule appointments directly
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Transfer to Human</Label>
                        <p className="text-sm text-muted-foreground">
                          Always offer option to speak with a person
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                  </div>

                  <div className="pt-4">
                    <Button variant="outline" className="w-full">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open AI Agent Dashboard
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Webhooks */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-100 rounded-lg">
                        <Zap className="h-5 w-5 text-gray-600" />
                      </div>
                      <div>
                        <CardTitle>Webhooks</CardTitle>
                        <CardDescription>
                          Configure webhooks for external integrations
                        </CardDescription>
                      </div>
                    </div>
                    <Button variant="outline" onClick={() => setShowAddWebhook(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Webhook
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {webhooks.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Zap className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No webhooks configured</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>URL</TableHead>
                          <TableHead>Events</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Success Rate</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {webhooks.map((webhook) => (
                          <TableRow key={webhook.id}>
                            <TableCell className="font-medium">{webhook.name}</TableCell>
                            <TableCell className="font-mono text-sm">{webhook.url}</TableCell>
                            <TableCell>
                              <div className="flex gap-1 flex-wrap">
                                {webhook.events.map((event) => (
                                  <Badge key={event} variant="secondary" className="text-xs">
                                    {event}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={webhook.status === "active" ? "default" : "secondary"}>
                                {webhook.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className={cn(
                                webhook.successRate >= 99 ? "text-green-600" :
                                webhook.successRate >= 95 ? "text-yellow-600" : "text-red-600"
                              )}>
                                {webhook.successRate}%
                              </span>
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm">
                                <Trash2 className="h-4 w-4" />
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

            {/* API Keys Tab */}
            <TabsContent value="api-keys" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>API Keys & Credentials</CardTitle>
                      <CardDescription>
                        Manage API keys for external services. Keys are encrypted and stored securely.
                      </CardDescription>
                    </div>
                    <Button onClick={() => setShowAddApiKey(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add API Key
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {apiKeys.map((key) => {
                      const config = serviceConfig[key.service];
                      const Icon = config.icon;

                      return (
                        <div
                          key={key.id}
                          className="flex items-center justify-between p-4 border rounded-lg"
                        >
                          <div className="flex items-center gap-4">
                            <div className={cn("p-2 rounded-lg", config.color.replace("bg-", "bg-opacity-20 "))}>
                              <Icon className={cn("h-5 w-5", config.color.replace("bg-", "text-").replace("-500", "-600"))} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{key.name}</span>
                                <Badge variant={key.status === "active" ? "default" : "secondary"}>
                                  {key.status}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                                <span>{config.name}</span>
                                <span className="font-mono">{key.keyPreview}</span>
                                <span>Created {format(key.createdAt, "MMM d, yyyy")}</span>
                                {key.lastUsed && (
                                  <span>Last used {format(key.lastUsed, "MMM d")}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            {key.usageLimit && (
                              <div className="text-right">
                                <div className="text-sm font-medium">
                                  {key.usageThisMonth.toLocaleString()} / {key.usageLimit.toLocaleString()}
                                </div>
                                <div className="text-xs text-muted-foreground">usage this month</div>
                              </div>
                            )}
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowApiKeyValue(key.id)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard(key.keyPreview)}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteApiKey(key.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <Alert className="mt-6">
                    <Lock className="h-4 w-4" />
                    <AlertTitle>Security Notice</AlertTitle>
                    <AlertDescription>
                      API keys are encrypted at rest and in transit. Never share your API keys or commit them to version control.
                      Rotate keys regularly for enhanced security.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>

              {/* Usage Overview */}
              <Card>
                <CardHeader>
                  <CardTitle>Usage Overview</CardTitle>
                  <CardDescription>Current month API usage across all services</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                          <Phone className="h-8 w-8 text-muted-foreground" />
                          <div>
                            <div className="text-2xl font-bold">$0.00</div>
                            <div className="text-sm text-muted-foreground">Twilio SMS</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                          <Bot className="h-8 w-8 text-muted-foreground" />
                          <div>
                            <div className="text-2xl font-bold">$0.00</div>
                            <div className="text-sm text-muted-foreground">VAPI AI</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                          <Zap className="h-8 w-8 text-muted-foreground" />
                          <div>
                            <div className="text-2xl font-bold">$0.00</div>
                            <div className="text-sm text-muted-foreground">OpenAI</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                          <CreditCard className="h-8 w-8 text-muted-foreground" />
                          <div>
                            <div className="text-2xl font-bold">$0.00</div>
                            <div className="text-sm text-muted-foreground">Total MTD</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* General Settings Tab */}
            <TabsContent value="general" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Company Settings</CardTitle>
                  <CardDescription>Basic company and regional settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Company Name</Label>
                      <Input
                        value={generalSettings.companyName}
                        onChange={(e) => setGeneralSettings({
                          ...generalSettings,
                          companyName: e.target.value
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Timezone</Label>
                      <Select
                        value={generalSettings.timezone}
                        onValueChange={(value) => setGeneralSettings({
                          ...generalSettings,
                          timezone: value
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="America/New_York">Eastern Time</SelectItem>
                          <SelectItem value="America/Chicago">Central Time</SelectItem>
                          <SelectItem value="America/Denver">Mountain Time</SelectItem>
                          <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Date Format</Label>
                      <Select
                        value={generalSettings.dateFormat}
                        onValueChange={(value) => setGeneralSettings({
                          ...generalSettings,
                          dateFormat: value
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MM/dd/yyyy">MM/DD/YYYY</SelectItem>
                          <SelectItem value="dd/MM/yyyy">DD/MM/YYYY</SelectItem>
                          <SelectItem value="yyyy-MM-dd">YYYY-MM-DD</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Currency</Label>
                      <Select
                        value={generalSettings.currency}
                        onValueChange={(value) => setGeneralSettings({
                          ...generalSettings,
                          currency: value
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">USD ($)</SelectItem>
                          <SelectItem value="EUR">EUR (€)</SelectItem>
                          <SelectItem value="GBP">GBP (£)</SelectItem>
                          <SelectItem value="CAD">CAD ($)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Fiscal Year Start</Label>
                      <Select
                        value={generalSettings.fiscalYearStart}
                        onValueChange={(value) => setGeneralSettings({
                          ...generalSettings,
                          fiscalYearStart: value
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="January">January</SelectItem>
                          <SelectItem value="April">April</SelectItem>
                          <SelectItem value="July">July</SelectItem>
                          <SelectItem value="October">October</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={handleSaveGeneralSettings} disabled={savingGeneral}>
                      {savingGeneral ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save Changes"
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Business Hours</CardTitle>
                  <CardDescription>Set your office operating hours</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map((day) => (
                      <div key={day} className="flex items-center gap-4">
                        <div className="w-24 font-medium">{day}</div>
                        <Select defaultValue="9:00">
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 12 }, (_, i) => i + 6).map((hour) => (
                              <SelectItem key={hour} value={`${hour}:00`}>
                                {hour > 12 ? hour - 12 : hour}:00 {hour >= 12 ? "PM" : "AM"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span>to</span>
                        <Select defaultValue="17:00">
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 12 }, (_, i) => i + 12).map((hour) => (
                              <SelectItem key={hour} value={`${hour}:00`}>
                                {hour > 12 ? hour - 12 : hour}:00 PM
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Switch defaultChecked />
                      </div>
                    ))}
                    {["Saturday", "Sunday"].map((day) => (
                      <div key={day} className="flex items-center gap-4">
                        <div className="w-24 font-medium text-muted-foreground">{day}</div>
                        <span className="text-muted-foreground">Closed</span>
                        <Switch />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Security Settings Tab */}
            <TabsContent value="security" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Authentication & Access</CardTitle>
                  <CardDescription>Configure security settings for user access</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Two-Factor Authentication</Label>
                      <p className="text-sm text-muted-foreground">
                        Require 2FA for all users
                      </p>
                    </div>
                    <Switch
                      checked={securitySettings.twoFactorRequired}
                      onCheckedChange={(checked) => setSecuritySettings({
                        ...securitySettings,
                        twoFactorRequired: checked
                      })}
                    />
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <Label>Session Timeout</Label>
                    <Select
                      value={securitySettings.sessionTimeout}
                      onValueChange={(value) => setSecuritySettings({
                        ...securitySettings,
                        sessionTimeout: value
                      })}
                    >
                      <SelectTrigger className="w-64">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">15 minutes</SelectItem>
                        <SelectItem value="30">30 minutes</SelectItem>
                        <SelectItem value="60">1 hour</SelectItem>
                        <SelectItem value="120">2 hours</SelectItem>
                        <SelectItem value="480">8 hours</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                      Automatically log out inactive users
                    </p>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>IP Whitelist</Label>
                      <p className="text-sm text-muted-foreground">
                        Restrict access to specific IP addresses
                      </p>
                    </div>
                    <Switch
                      checked={securitySettings.ipWhitelist}
                      onCheckedChange={(checked) => setSecuritySettings({
                        ...securitySettings,
                        ipWhitelist: checked
                      })}
                    />
                  </div>
                  {securitySettings.ipWhitelist && (
                    <div className="space-y-2 pl-4 border-l-2">
                      <Label>Allowed IP Addresses</Label>
                      <Input placeholder="e.g., 192.168.1.0/24, 10.0.0.1" />
                      <p className="text-sm text-muted-foreground">
                        Comma-separated list of IP addresses or CIDR ranges
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Data Security</CardTitle>
                  <CardDescription>Encryption and data protection settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Audit Logging</Label>
                      <p className="text-sm text-muted-foreground">
                        Log all user actions and system events
                      </p>
                    </div>
                    <Switch
                      checked={securitySettings.auditLogging}
                      onCheckedChange={(checked) => setSecuritySettings({
                        ...securitySettings,
                        auditLogging: checked
                      })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Data Encryption at Rest</Label>
                      <p className="text-sm text-muted-foreground">
                        Encrypt all stored data (AES-256)
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="default" className="bg-green-500">Enabled</Badge>
                      <Lock className="h-4 w-4 text-green-500" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Data Encryption in Transit</Label>
                      <p className="text-sm text-muted-foreground">
                        TLS 1.3 for all connections
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="default" className="bg-green-500">Enabled</Badge>
                      <Lock className="h-4 w-4 text-green-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Password Policy</CardTitle>
                  <CardDescription>Set password requirements for all users</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Minimum Length</Label>
                      <Select defaultValue="12">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="8">8 characters</SelectItem>
                          <SelectItem value="10">10 characters</SelectItem>
                          <SelectItem value="12">12 characters</SelectItem>
                          <SelectItem value="16">16 characters</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Password Expiry</Label>
                      <Select defaultValue="90">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="30">30 days</SelectItem>
                          <SelectItem value="60">60 days</SelectItem>
                          <SelectItem value="90">90 days</SelectItem>
                          <SelectItem value="never">Never</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Requirements</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center gap-2">
                        <Switch defaultChecked />
                        <span className="text-sm">Uppercase letters</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch defaultChecked />
                        <span className="text-sm">Lowercase letters</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch defaultChecked />
                        <span className="text-sm">Numbers</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch defaultChecked />
                        <span className="text-sm">Special characters</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Notifications Tab */}
            <TabsContent value="notifications" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Notification Preferences</CardTitle>
                  <CardDescription>Configure how you receive notifications</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Email Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive notifications via email
                      </p>
                    </div>
                    <Switch
                      checked={notificationSettings.emailNotifications}
                      onCheckedChange={(checked) => setNotificationSettings({
                        ...notificationSettings,
                        emailNotifications: checked
                      })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>SMS Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive urgent alerts via SMS
                      </p>
                    </div>
                    <Switch
                      checked={notificationSettings.smsNotifications}
                      onCheckedChange={(checked) => setNotificationSettings({
                        ...notificationSettings,
                        smsNotifications: checked
                      })}
                    />
                  </div>
                  <Separator />
                  <h4 className="font-medium">Notification Types</h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Daily Digest</Label>
                        <p className="text-sm text-muted-foreground">
                          Summary of daily activity
                        </p>
                      </div>
                      <Switch
                        checked={notificationSettings.dailyDigest}
                        onCheckedChange={(checked) => setNotificationSettings({
                          ...notificationSettings,
                          dailyDigest: checked
                        })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Urgent Alerts</Label>
                        <p className="text-sm text-muted-foreground">
                          IRS notices, deadlines, critical issues
                        </p>
                      </div>
                      <Switch
                        checked={notificationSettings.urgentAlerts}
                        onCheckedChange={(checked) => setNotificationSettings({
                          ...notificationSettings,
                          urgentAlerts: checked
                        })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Client Updates</Label>
                        <p className="text-sm text-muted-foreground">
                          New documents, messages from clients
                        </p>
                      </div>
                      <Switch
                        checked={notificationSettings.clientUpdates}
                        onCheckedChange={(checked) => setNotificationSettings({
                          ...notificationSettings,
                          clientUpdates: checked
                        })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>System Alerts</Label>
                        <p className="text-sm text-muted-foreground">
                          System updates, maintenance notices
                        </p>
                      </div>
                      <Switch
                        checked={notificationSettings.systemAlerts}
                        onCheckedChange={(checked) => setNotificationSettings({
                          ...notificationSettings,
                          systemAlerts: checked
                        })}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end pt-4">
                    <Button onClick={handleSaveNotificationSettings} disabled={savingNotifications}>
                      {savingNotifications ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save Notification Settings"
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Backup & Data Tab */}
            <TabsContent value="backup" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Automated Backups</CardTitle>
                  <CardDescription>Configure automatic backup settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Enable Automated Backups</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically backup data on schedule
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Backup Frequency</Label>
                      <Select defaultValue="daily">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hourly">Hourly</SelectItem>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Retention Period</Label>
                      <Select defaultValue="30">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="7">7 days</SelectItem>
                          <SelectItem value="30">30 days</SelectItem>
                          <SelectItem value="90">90 days</SelectItem>
                          <SelectItem value="365">1 year</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h4 className="font-medium mb-4">Recent Backups</h4>
                    <div className="text-center py-8 text-muted-foreground">
                      <Database className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No backups yet</p>
                      <p className="text-sm">Backups will appear here once configured</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Data Export</CardTitle>
                  <CardDescription>Export your data for backup or migration</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Button variant="outline" className="h-24 flex-col">
                      <Users className="h-6 w-6 mb-2" />
                      <span>Export Clients</span>
                    </Button>
                    <Button variant="outline" className="h-24 flex-col">
                      <FileText className="h-6 w-6 mb-2" />
                      <span>Export Documents</span>
                    </Button>
                    <Button variant="outline" className="h-24 flex-col">
                      <Mail className="h-6 w-6 mb-2" />
                      <span>Export Emails</span>
                    </Button>
                    <Button variant="outline" className="h-24 flex-col">
                      <Download className="h-6 w-6 mb-2" />
                      <span>Export All Data</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-red-600">Danger Zone</CardTitle>
                  <CardDescription>Irreversible actions - proceed with caution</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Warning</AlertTitle>
                    <AlertDescription>
                      These actions cannot be undone. Please make sure you have a backup before proceeding.
                    </AlertDescription>
                  </Alert>
                  <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg">
                    <div>
                      <Label className="text-red-600">Clear All Data</Label>
                      <p className="text-sm text-muted-foreground">
                        Permanently delete all data from the system
                      </p>
                    </div>
                    <Button variant="destructive" onClick={() => setShowClearDataConfirm(true)}>
                      Clear Data
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Audit Log Tab */}
            <TabsContent value="audit" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Audit Log</CardTitle>
                      <CardDescription>Track all system activities and changes</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Select defaultValue="all">
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="Filter by action" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Actions</SelectItem>
                          <SelectItem value="created">Created</SelectItem>
                          <SelectItem value="updated">Updated</SelectItem>
                          <SelectItem value="deleted">Deleted</SelectItem>
                          <SelectItem value="login">Login</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="outline">
                        <Download className="h-4 w-4 mr-2" />
                        Export
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Resource</TableHead>
                        <TableHead>Details</TableHead>
                        <TableHead>IP Address</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="whitespace-nowrap">
                            {format(log.timestamp, "MMM d, yyyy h:mm a")}
                          </TableCell>
                          <TableCell>{log.user}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{log.action}</Badge>
                          </TableCell>
                          <TableCell>{log.resource}</TableCell>
                          <TableCell className="max-w-xs truncate">{log.details}</TableCell>
                          <TableCell className="font-mono text-sm">{log.ip}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Connect Email Dialog */}
      <Dialog open={showConnectEmail} onOpenChange={setShowConnectEmail}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Connect Email Account</DialogTitle>
            <DialogDescription>
              Connect your Microsoft 365 or Google Workspace account to enable email features
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Button
              variant="outline"
              className="w-full h-16 justify-start gap-4"
              onClick={handleConnectMicrosoft}
              disabled={isConnecting}
            >
              <div className="p-2 bg-blue-100 rounded">
                <Mail className="h-6 w-6 text-blue-600" />
              </div>
              <div className="text-left">
                <div className="font-medium">Microsoft 365</div>
                <div className="text-sm text-muted-foreground">Outlook, Exchange Online</div>
              </div>
              {isConnecting && <RefreshCw className="h-4 w-4 animate-spin ml-auto" />}
            </Button>
            <Button
              variant="outline"
              className="w-full h-16 justify-start gap-4"
              disabled
            >
              <div className="p-2 bg-red-100 rounded">
                <Mail className="h-6 w-6 text-red-600" />
              </div>
              <div className="text-left">
                <div className="font-medium">Google Workspace</div>
                <div className="text-sm text-muted-foreground">Coming soon</div>
              </div>
            </Button>
          </div>
          <Alert>
            <Lock className="h-4 w-4" />
            <AlertDescription>
              We use OAuth 2.0 for secure authentication. Your password is never stored.
            </AlertDescription>
          </Alert>
        </DialogContent>
      </Dialog>

      {/* Add API Key Dialog */}
      <Dialog open={showAddApiKey} onOpenChange={setShowAddApiKey}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add API Key</DialogTitle>
            <DialogDescription>
              Add credentials for external services
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Service</Label>
              <Select
                value={newApiKey.service}
                onValueChange={(value: ApiKey["service"]) => setNewApiKey({
                  ...newApiKey,
                  service: value
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="twilio">Twilio (SMS/Voice)</SelectItem>
                  <SelectItem value="vapi">VAPI (AI Phone Agent)</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                placeholder="e.g., Production API Key"
                value={newApiKey.name}
                onChange={(e) => setNewApiKey({ ...newApiKey, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>API Key</Label>
              <Input
                type="password"
                placeholder="Enter API key"
                value={newApiKey.apiKey}
                onChange={(e) => setNewApiKey({ ...newApiKey, apiKey: e.target.value })}
              />
            </div>
            {(newApiKey.service === "twilio") && (
              <div className="space-y-2">
                <Label>API Secret / Auth Token</Label>
                <Input
                  type="password"
                  placeholder="Enter API secret"
                  value={newApiKey.apiSecret}
                  onChange={(e) => setNewApiKey({ ...newApiKey, apiSecret: e.target.value })}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddApiKey(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddApiKey} disabled={!newApiKey.name || !newApiKey.apiKey}>
              Add Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear Data Confirmation Dialog */}
      <Dialog open={showClearDataConfirm} onOpenChange={setShowClearDataConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Confirm Data Deletion
            </DialogTitle>
            <DialogDescription>
              This action is irreversible and will permanently delete all system data.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Warning</AlertTitle>
              <AlertDescription>
                You are about to delete ALL data from the system including:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>All client records</li>
                  <li>All tasks and task history</li>
                  <li>All documents and files</li>
                  <li>All email and SMS history</li>
                  <li>All audit logs</li>
                </ul>
                <p className="mt-2 font-semibold">This cannot be undone!</p>
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClearDataConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                toast.error("Data clearing is disabled for safety. Contact support if needed.");
                setShowClearDataConfirm(false);
              }}
            >
              I Understand, Delete Everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
