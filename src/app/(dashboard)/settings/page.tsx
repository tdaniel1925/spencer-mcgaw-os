"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  User,
  Building,
  Bell,
  Shield,
  Palette,
  Phone,
  Mail,
  Save,
  Upload,
  RefreshCw,
  CheckCircle,
  XCircle,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/lib/supabase/auth-context";
import { toast } from "sonner";

interface EmailAccount {
  id: string;
  email: string;
  displayName: string;
  provider: string;
  isConnected: boolean;
  lastSyncAt: string | null;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [orphanedDataCount, setOrphanedDataCount] = useState(0);
  const [clearingData, setClearingData] = useState(false);

  const loadEmailAccounts = useCallback(async () => {
    try {
      const response = await fetch("/api/email/accounts");
      if (response.ok) {
        const data = await response.json();
        setEmailAccounts(data.accounts || []);

        // Check for orphaned data if no accounts connected
        if (!data.accounts || data.accounts.length === 0) {
          const emailDataResponse = await fetch("/api/email-intelligence?limit=1");
          if (emailDataResponse.ok) {
            const emailData = await emailDataResponse.json();
            setOrphanedDataCount(emailData.total || 0);
          }
        } else {
          setOrphanedDataCount(0);
        }
      }
    } catch (error) {
      console.error("Error loading email accounts:", error);
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

  useEffect(() => {
    loadEmailAccounts();
  }, [loadEmailAccounts]);

  const handleConnectMicrosoft = () => {
    setConnecting(true);
    // Redirect to Microsoft OAuth
    window.location.href = "/api/email/connect";
  };

  const handleDisconnectAccount = async (accountId: string) => {
    if (!confirm(
      "Are you sure you want to disconnect this email account?\n\n" +
      "This will permanently delete:\n" +
      "• All email classifications and AI analysis\n" +
      "• All extracted action items\n" +
      "• All tasks created from emails\n" +
      "• Email training data\n\n" +
      "This action cannot be undone."
    )) return;

    try {
      const response = await fetch(`/api/email/accounts/${accountId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`Email account disconnected. Cleaned up ${data.cleaned?.classifications || 0} email records.`);
        loadEmailAccounts();
      } else {
        toast.error("Failed to disconnect account");
      }
    } catch (error) {
      console.error("Error disconnecting account:", error);
      toast.error("Failed to disconnect account");
    }
  };

  const handleClearOrphanedData = async () => {
    if (!confirm(
      "Are you sure you want to clear all orphaned email data?\n\n" +
      "This will permanently delete:\n" +
      "• All email classifications and AI analysis\n" +
      "• All extracted action items\n" +
      "• All tasks created from emails\n" +
      "• Email training data\n\n" +
      "This action cannot be undone."
    )) return;

    setClearingData(true);
    try {
      const response = await fetch("/api/email/cleanup", {
        method: "POST",
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`Cleaned up ${data.cleaned?.classifications || 0} orphaned email records.`);
        setOrphanedDataCount(0);
      } else {
        toast.error("Failed to clear orphaned data");
      }
    } catch (error) {
      console.error("Error clearing orphaned data:", error);
      toast.error("Failed to clear orphaned data");
    } finally {
      setClearingData(false);
    }
  };

  return (
    <>
      <Header title="Settings" />
      <main className="p-6">
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList>
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="company" className="flex items-center gap-2">
              <Building className="h-4 w-4" />
              Company
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Security
            </TabsTrigger>
            <TabsTrigger value="integrations" className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Integrations
            </TabsTrigger>
          </TabsList>

          {/* Profile Settings */}
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Profile Settings</CardTitle>
                <CardDescription>
                  Manage your personal information and preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Avatar Section */}
                <div className="flex items-center gap-6">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src="" />
                    <AvatarFallback className="text-xl bg-primary text-primary-foreground">
                      {user?.full_name?.split(" ").map((n) => n[0]).join("") || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <Button variant="outline" size="sm">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Photo
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">
                      JPG, PNG or GIF. Max size 2MB
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Form Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      defaultValue={user?.full_name || ""}
                      placeholder="Enter your full name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      defaultValue={user?.email || ""}
                      placeholder="Enter your email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input id="phone" placeholder="Enter your phone number" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Input
                      id="role"
                      defaultValue={user?.role || "Staff"}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    placeholder="Tell us about yourself"
                    rows={3}
                  />
                </div>

                <div className="flex justify-end">
                  <Button className="bg-primary">
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Company Settings */}
          <TabsContent value="company">
            <Card>
              <CardHeader>
                <CardTitle>Company Settings</CardTitle>
                <CardDescription>
                  Manage your company information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Company Name</Label>
                    <Input
                      id="companyName"
                      defaultValue="Spencer McGaw CPA"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyEmail">Company Email</Label>
                    <Input
                      id="companyEmail"
                      type="email"
                      defaultValue="contact@spencermcgaw.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyPhone">Company Phone</Label>
                    <Input id="companyPhone" defaultValue="(555) 123-4567" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Select defaultValue="cst">
                      <SelectTrigger>
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="est">Eastern Time (EST)</SelectItem>
                        <SelectItem value="cst">Central Time (CST)</SelectItem>
                        <SelectItem value="mst">Mountain Time (MST)</SelectItem>
                        <SelectItem value="pst">Pacific Time (PST)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    placeholder="Enter company address"
                    rows={2}
                  />
                </div>

                <div className="flex justify-end">
                  <Button className="bg-primary">
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Settings */}
          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>
                  Configure how you receive notifications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Notification settings coming soon...
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Settings */}
          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle>Security Settings</CardTitle>
                <CardDescription>
                  Manage your password and security preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <Input id="currentPassword" type="password" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input id="newPassword" type="password" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <Input id="confirmPassword" type="password" />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button className="bg-primary">
                    Update Password
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Integrations Settings */}
          <TabsContent value="integrations">
            <div className="space-y-6">
              {/* Email Connections */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Email Accounts
                  </CardTitle>
                  <CardDescription>
                    Connect your email accounts to sync emails and automatically create tasks
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {loadingAccounts ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : emailAccounts.length > 0 ? (
                    <>
                      {emailAccounts.map((account) => (
                        <div
                          key={account.id}
                          className="flex items-center justify-between p-4 border rounded-lg"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
                              <Mail className="h-6 w-6 text-purple-600" />
                            </div>
                            <div>
                              <p className="font-medium">{account.displayName}</p>
                              <p className="text-sm text-muted-foreground">
                                {account.email}
                              </p>
                              {account.lastSyncAt && (
                                <p className="text-xs text-muted-foreground">
                                  Last synced: {new Date(account.lastSyncAt).toLocaleString()}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {account.isConnected ? (
                              <Badge className="bg-green-100 text-green-700 flex items-center gap-1">
                                <CheckCircle className="h-3 w-3" />
                                Connected
                              </Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-700 flex items-center gap-1">
                                <XCircle className="h-3 w-3" />
                                Expired
                              </Badge>
                            )}
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
                      <Separator />
                    </>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Mail className="h-12 w-12 mx-auto mb-4 opacity-20" />
                      <p>No email accounts connected</p>
                      <p className="text-sm">Connect your Microsoft 365 account to start syncing emails</p>

                      {/* Warning about orphaned data */}
                      {orphanedDataCount > 0 && (
                        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-left">
                          <div className="flex items-start gap-3">
                            <XCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-amber-800">
                                Orphaned Email Data Detected
                              </p>
                              <p className="text-sm text-amber-700 mt-1">
                                There are {orphanedDataCount} email records remaining from a previously disconnected account.
                                This data is no longer syncing and should be cleaned up.
                              </p>
                              <Button
                                variant="outline"
                                size="sm"
                                className="mt-3 border-amber-300 text-amber-800 hover:bg-amber-100"
                                onClick={handleClearOrphanedData}
                                disabled={clearingData}
                              >
                                {clearingData ? (
                                  <>
                                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                    Clearing...
                                  </>
                                ) : (
                                  "Clear Orphaned Data"
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Connect Microsoft 365 Button */}
                  <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                        <svg className="h-6 w-6" viewBox="0 0 23 23">
                          <path fill="#f35325" d="M1 1h10v10H1z"/>
                          <path fill="#81bc06" d="M12 1h10v10H12z"/>
                          <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                          <path fill="#ffba08" d="M12 12h10v10H12z"/>
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium">Microsoft 365 / Outlook</p>
                        <p className="text-sm text-muted-foreground">
                          Connect to sync emails, calendar, and contacts
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={handleConnectMicrosoft}
                      disabled={connecting}
                    >
                      {connecting ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        <>
                          <ExternalLink className="h-4 w-4 mr-2" />
                          {emailAccounts.length > 0 ? "Add Another Account" : "Connect"}
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Other Integrations */}
              <Card>
                <CardHeader>
                  <CardTitle>Other Integrations</CardTitle>
                  <CardDescription>
                    Additional services and connections
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                        <Phone className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium">VAPI Voice Agent</p>
                        <p className="text-sm text-muted-foreground">
                          AI-powered phone agent for calls
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-green-100 text-green-700">Connected</Badge>
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                        <svg className="h-6 w-6 text-green-600" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium">Twilio SMS</p>
                        <p className="text-sm text-muted-foreground">
                          SMS messaging integration
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <a href="/admin/sms-settings">Configure</a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </>
  );
}
