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
import { Switch } from "@/components/ui/switch";
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
  Sparkles,
  Clock,
  MessageSquare,
  Eye,
  EyeOff,
  AlertCircle,
  Check,
} from "lucide-react";
import { useAuth } from "@/lib/supabase/auth-context";
import { useEmail } from "@/lib/email/email-context";
import { toast } from "sonner";

interface EmailAccount {
  id: string;
  email: string;
  displayName: string;
  provider: string;
  isConnected: boolean;
  lastSyncAt: string | null;
  isGlobal: boolean; // true = Org Feed, false = Personal Inbox
}

interface ProfileSettings {
  fullName: string;
  email: string;
  phone: string;
  bio: string;
}

interface CompanySettings {
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  timezone: string;
  address: string;
}

interface NotificationPreferences {
  // Email Notifications
  emailNewTask: boolean;
  emailTaskAssigned: boolean;
  emailTaskDueSoon: boolean;
  emailTaskOverdue: boolean;
  emailTaskCompleted: boolean;
  emailClientActivity: boolean;
  emailWeeklySummary: boolean;
  // In-App Notifications
  inappNewTask: boolean;
  inappTaskAssigned: boolean;
  inappTaskDueSoon: boolean;
  inappTaskOverdue: boolean;
  inappTaskCompleted: boolean;
  inappMentions: boolean;
  inappClientActivity: boolean;
  // SMS Notifications
  smsEnabled: boolean;
  smsUrgentOnly: boolean;
  smsTaskOverdue: boolean;
  // AI/Email Intelligence
  aiEmailProcessed: boolean;
  aiHighPriorityDetected: boolean;
  aiActionItemsExtracted: boolean;
  // Quiet Hours
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}

const DEFAULT_NOTIFICATIONS: NotificationPreferences = {
  emailNewTask: true,
  emailTaskAssigned: true,
  emailTaskDueSoon: true,
  emailTaskOverdue: true,
  emailTaskCompleted: false,
  emailClientActivity: true,
  emailWeeklySummary: true,
  inappNewTask: true,
  inappTaskAssigned: true,
  inappTaskDueSoon: true,
  inappTaskOverdue: true,
  inappTaskCompleted: true,
  inappMentions: true,
  inappClientActivity: true,
  smsEnabled: false,
  smsUrgentOnly: true,
  smsTaskOverdue: false,
  aiEmailProcessed: true,
  aiHighPriorityDetected: true,
  aiActionItemsExtracted: true,
  quietHoursEnabled: false,
  quietHoursStart: "22:00",
  quietHoursEnd: "07:00",
};

export default function SettingsPage() {
  const { user, isAdmin } = useAuth();
  const { accounts: contextAccounts, refreshAccounts } = useEmail();
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [orphanedDataCount, setOrphanedDataCount] = useState(0);
  const [clearingData, setClearingData] = useState(false);

  // Profile form state
  const [profile, setProfile] = useState<ProfileSettings>({
    fullName: user?.full_name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    bio: "",
  });
  const [savingProfile, setSavingProfile] = useState(false);

  // Company form state
  const [company, setCompany] = useState<CompanySettings>({
    companyName: "Spencer McGaw CPA",
    companyEmail: "",
    companyPhone: "",
    timezone: "cst",
    address: "",
  });
  const [savingCompany, setSavingCompany] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);

  // Notification preferences state
  const [notifications, setNotifications] = useState<NotificationPreferences>(DEFAULT_NOTIFICATIONS);
  const [savingNotifications, setSavingNotifications] = useState(false);

  // Password form state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [savingPassword, setSavingPassword] = useState(false);

  // Call data auto-delete settings
  const [callAutoDelete, setCallAutoDelete] = useState({
    enabled: false,
    deleteAfterDays: 30,
    deleteOnDay: "", // e.g., "monday", "sunday", or empty for daily
  });
  const [savingCallSettings, setSavingCallSettings] = useState(false);
  const [callCount, setCallCount] = useState(0);
  const [clearingCalls, setClearingCalls] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);

  // Load profile, company, and notification settings
  useEffect(() => {
    async function loadSettings() {
      try {
        const [profileRes, companyRes, notificationsRes] = await Promise.all([
          fetch("/api/settings/profile"),
          fetch("/api/settings/company"),
          fetch("/api/settings/notifications"),
        ]);

        if (profileRes.ok) {
          const data = await profileRes.json();
          setProfile({
            fullName: data.fullName || user?.full_name || "",
            email: data.email || user?.email || "",
            phone: data.phone || "",
            bio: data.bio || "",
          });
        }

        if (companyRes.ok) {
          const data = await companyRes.json();
          setCompany({
            companyName: data.companyName || "Spencer McGaw CPA",
            companyEmail: data.companyEmail || "",
            companyPhone: data.companyPhone || "",
            timezone: data.timezone || "cst",
            address: data.address || "",
          });
        }

        if (notificationsRes.ok) {
          const data = await notificationsRes.json();
          setNotifications(data);
        }

        // Load call data settings
        const callSettingsRes = await fetch("/api/settings/call-data");
        if (callSettingsRes.ok) {
          const data = await callSettingsRes.json();
          setCallAutoDelete({
            enabled: data.autoDeleteEnabled || false,
            deleteAfterDays: data.deleteAfterDays || 30,
            deleteOnDay: data.deleteOnDay || "",
          });
          setCallCount(data.callCount || 0);
        }
      } catch (error) {
        console.error("Error loading settings:", error);
      } finally {
        setLoadingSettings(false);
      }
    }

    loadSettings();
  }, [user]);

  // Save profile
  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const response = await fetch("/api/settings/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });

      if (response.ok) {
        toast.success("Profile saved successfully");
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to save profile");
      }
    } catch (error) {
      console.error("Error saving profile:", error);
      toast.error("Failed to save profile");
    } finally {
      setSavingProfile(false);
    }
  };

  // Save company settings
  const handleSaveCompany = async () => {
    setSavingCompany(true);
    try {
      const response = await fetch("/api/settings/company", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(company),
      });

      if (response.ok) {
        toast.success("Company settings saved successfully");
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to save company settings");
      }
    } catch (error) {
      console.error("Error saving company settings:", error);
      toast.error("Failed to save company settings");
    } finally {
      setSavingCompany(false);
    }
  };

  // Save notification preferences
  const handleSaveNotifications = async () => {
    setSavingNotifications(true);
    try {
      const response = await fetch("/api/settings/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notifications),
      });

      if (response.ok) {
        toast.success("Notification preferences saved successfully");
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to save notification preferences");
      }
    } catch (error) {
      console.error("Error saving notification preferences:", error);
      toast.error("Failed to save notification preferences");
    } finally {
      setSavingNotifications(false);
    }
  };

  // Toggle notification preference
  const toggleNotification = (key: keyof NotificationPreferences) => {
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Save call auto-delete settings
  const handleSaveCallSettings = async () => {
    setSavingCallSettings(true);
    try {
      const response = await fetch("/api/settings/call-data", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          autoDeleteEnabled: callAutoDelete.enabled,
          deleteAfterDays: callAutoDelete.deleteAfterDays,
          deleteOnDay: callAutoDelete.deleteOnDay,
        }),
      });

      if (response.ok) {
        toast.success("Call data settings saved successfully");
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to save call data settings");
      }
    } catch (error) {
      console.error("Error saving call data settings:", error);
      toast.error("Failed to save call data settings");
    } finally {
      setSavingCallSettings(false);
    }
  };

  // Clear all call data
  const handleClearAllCalls = async () => {
    setClearingCalls(true);
    try {
      const response = await fetch("/api/org-feed?type=calls", {
        method: "DELETE",
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message || "All calls cleared successfully");
        setCallCount(0);
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to clear calls");
      }
    } catch (error) {
      console.error("Error clearing calls:", error);
      toast.error("Failed to clear calls");
    } finally {
      setClearingCalls(false);
    }
  };

  // Password validation checks
  const passwordChecks = {
    minLength: passwordForm.newPassword.length >= 8,
    hasUppercase: /[A-Z]/.test(passwordForm.newPassword),
    hasLowercase: /[a-z]/.test(passwordForm.newPassword),
    hasNumber: /[0-9]/.test(passwordForm.newPassword),
    passwordsMatch: passwordForm.newPassword === passwordForm.confirmPassword && passwordForm.confirmPassword !== "",
  };

  const allPasswordChecksPassed = Object.values(passwordChecks).every(Boolean);

  // Handle password change
  const handleChangePassword = async () => {
    setPasswordErrors([]);

    // Client-side validation
    if (!passwordForm.currentPassword) {
      setPasswordErrors(["Current password is required"]);
      return;
    }

    if (!passwordForm.newPassword) {
      setPasswordErrors(["New password is required"]);
      return;
    }

    if (!allPasswordChecksPassed) {
      setPasswordErrors(["Please meet all password requirements"]);
      return;
    }

    setSavingPassword(true);
    try {
      const response = await fetch("/api/settings/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(passwordForm),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success("Password updated successfully");
        setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      } else {
        if (data.details && Array.isArray(data.details)) {
          setPasswordErrors(data.details);
        } else {
          setPasswordErrors([data.error || "Failed to update password"]);
        }
        toast.error(data.error || "Failed to update password");
      }
    } catch (error) {
      console.error("Error changing password:", error);
      setPasswordErrors(["An unexpected error occurred"]);
      toast.error("Failed to update password");
    } finally {
      setSavingPassword(false);
    }
  };

  // Derive email accounts from context
  const emailAccounts: EmailAccount[] = contextAccounts.map((a) => ({
    id: a.id,
    email: a.email,
    displayName: a.displayName || a.email,
    provider: a.provider,
    isConnected: a.syncStatus !== "error",
    lastSyncAt: a.lastSyncAt ? new Date(a.lastSyncAt).toISOString() : null,
    isGlobal: a.isGlobal || false,
  }));

  // Load email accounts from context on mount
  useEffect(() => {
    const loadAccounts = async () => {
      setLoadingAccounts(true);
      await refreshAccounts();
      setLoadingAccounts(false);
    };
    loadAccounts();
  }, [refreshAccounts]);

  // Check for orphaned data when accounts change
  useEffect(() => {
    const checkOrphanedData = async () => {
      if (emailAccounts.length === 0) {
        try {
          const emailDataResponse = await fetch("/api/email-intelligence?limit=1");
          if (emailDataResponse.ok) {
            const emailData = await emailDataResponse.json();
            setOrphanedDataCount(emailData.total || 0);
          }
        } catch (error) {
          console.error("Error checking orphaned data:", error);
        }
      } else {
        setOrphanedDataCount(0);
      }
    };
    checkOrphanedData();
  }, [emailAccounts.length]);

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
        // Refresh accounts using shared context
        await refreshAccounts();
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

  // Handle email routing change (Personal Inbox vs Org Feed)
  const handleRoutingChange = async (accountId: string, isGlobal: boolean) => {
    try {
      const response = await fetch(`/api/email/accounts/${accountId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isGlobal }),
      });

      if (response.ok) {
        toast.success(
          isGlobal
            ? "Emails will now appear in Org Feed"
            : "Emails will now appear in your Personal Inbox"
        );
        // Refresh accounts to get updated routing
        await refreshAccounts();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to update routing");
      }
    } catch (error) {
      console.error("Error updating routing:", error);
      toast.error("Failed to update routing");
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
            {isAdmin && (
              <TabsTrigger value="company" className="flex items-center gap-2">
                <Building className="h-4 w-4" />
                Company
              </TabsTrigger>
            )}
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Security
            </TabsTrigger>
            <TabsTrigger value="my-emails" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              My Email Accounts
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="data-management" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Call Data
              </TabsTrigger>
            )}
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toast.info("Avatar upload coming soon", { description: "This feature is under development" })}
                    >
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
                      value={profile.fullName}
                      onChange={(e) => setProfile(p => ({ ...p, fullName: e.target.value }))}
                      placeholder="Enter your full name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profile.email}
                      disabled
                      className="bg-muted"
                      placeholder="Enter your email"
                    />
                    <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      value={profile.phone}
                      onChange={(e) => setProfile(p => ({ ...p, phone: e.target.value }))}
                      placeholder="Enter your phone number"
                    />
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
                    value={profile.bio}
                    onChange={(e) => setProfile(p => ({ ...p, bio: e.target.value }))}
                    placeholder="Tell us about yourself"
                    rows={3}
                  />
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSaveProfile} disabled={savingProfile}>
                    {savingProfile ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    {savingProfile ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Company Settings - Admin Only */}
          {isAdmin && (
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
                      value={company.companyName}
                      onChange={(e) => setCompany(c => ({ ...c, companyName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyEmail">Company Email</Label>
                    <Input
                      id="companyEmail"
                      type="email"
                      value={company.companyEmail}
                      onChange={(e) => setCompany(c => ({ ...c, companyEmail: e.target.value }))}
                      placeholder="contact@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyPhone">Company Phone</Label>
                    <Input
                      id="companyPhone"
                      value={company.companyPhone}
                      onChange={(e) => setCompany(c => ({ ...c, companyPhone: e.target.value }))}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Select
                      value={company.timezone}
                      onValueChange={(value) => setCompany(c => ({ ...c, timezone: value }))}
                    >
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
                    value={company.address}
                    onChange={(e) => setCompany(c => ({ ...c, address: e.target.value }))}
                    placeholder="Enter company address"
                    rows={2}
                  />
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSaveCompany} disabled={savingCompany}>
                    {savingCompany ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    {savingCompany ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          )}

          {/* Notifications Settings */}
          <TabsContent value="notifications">
            <div className="space-y-6">
              {/* Email Notifications */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Email Notifications
                  </CardTitle>
                  <CardDescription>
                    Choose what emails you receive
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">New Task Created</p>
                      <p className="text-xs text-muted-foreground">Get notified when a new task is created</p>
                    </div>
                    <Switch
                      checked={notifications.emailNewTask}
                      onCheckedChange={() => toggleNotification("emailNewTask")}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Task Assigned to You</p>
                      <p className="text-xs text-muted-foreground">Get notified when a task is assigned to you</p>
                    </div>
                    <Switch
                      checked={notifications.emailTaskAssigned}
                      onCheckedChange={() => toggleNotification("emailTaskAssigned")}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Task Due Soon</p>
                      <p className="text-xs text-muted-foreground">Get reminded about upcoming due dates</p>
                    </div>
                    <Switch
                      checked={notifications.emailTaskDueSoon}
                      onCheckedChange={() => toggleNotification("emailTaskDueSoon")}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Task Overdue</p>
                      <p className="text-xs text-muted-foreground">Get notified when a task is overdue</p>
                    </div>
                    <Switch
                      checked={notifications.emailTaskOverdue}
                      onCheckedChange={() => toggleNotification("emailTaskOverdue")}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Client Activity</p>
                      <p className="text-xs text-muted-foreground">Get notified about client-related activity</p>
                    </div>
                    <Switch
                      checked={notifications.emailClientActivity}
                      onCheckedChange={() => toggleNotification("emailClientActivity")}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Weekly Summary</p>
                      <p className="text-xs text-muted-foreground">Receive a weekly summary of your tasks</p>
                    </div>
                    <Switch
                      checked={notifications.emailWeeklySummary}
                      onCheckedChange={() => toggleNotification("emailWeeklySummary")}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* In-App Notifications */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    In-App Notifications
                  </CardTitle>
                  <CardDescription>
                    Configure notifications within the app
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">New Tasks</p>
                      <p className="text-xs text-muted-foreground">Show notifications for new tasks</p>
                    </div>
                    <Switch
                      checked={notifications.inappNewTask}
                      onCheckedChange={() => toggleNotification("inappNewTask")}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Task Assignments</p>
                      <p className="text-xs text-muted-foreground">Notify when tasks are assigned to you</p>
                    </div>
                    <Switch
                      checked={notifications.inappTaskAssigned}
                      onCheckedChange={() => toggleNotification("inappTaskAssigned")}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Due Soon Reminders</p>
                      <p className="text-xs text-muted-foreground">Show reminders for upcoming deadlines</p>
                    </div>
                    <Switch
                      checked={notifications.inappTaskDueSoon}
                      onCheckedChange={() => toggleNotification("inappTaskDueSoon")}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Mentions</p>
                      <p className="text-xs text-muted-foreground">Get notified when someone mentions you</p>
                    </div>
                    <Switch
                      checked={notifications.inappMentions}
                      onCheckedChange={() => toggleNotification("inappMentions")}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Client Activity</p>
                      <p className="text-xs text-muted-foreground">Show client-related notifications</p>
                    </div>
                    <Switch
                      checked={notifications.inappClientActivity}
                      onCheckedChange={() => toggleNotification("inappClientActivity")}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* SMS Notifications */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    SMS Notifications
                  </CardTitle>
                  <CardDescription>
                    Receive text message alerts for important events
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Enable SMS Notifications</p>
                      <p className="text-xs text-muted-foreground">Receive text messages for alerts</p>
                    </div>
                    <Switch
                      checked={notifications.smsEnabled}
                      onCheckedChange={() => toggleNotification("smsEnabled")}
                    />
                  </div>
                  {notifications.smsEnabled && (
                    <>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">Urgent Items Only</p>
                          <p className="text-xs text-muted-foreground">Only send SMS for urgent priorities</p>
                        </div>
                        <Switch
                          checked={notifications.smsUrgentOnly}
                          onCheckedChange={() => toggleNotification("smsUrgentOnly")}
                        />
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">Overdue Task Alerts</p>
                          <p className="text-xs text-muted-foreground">Send SMS when tasks become overdue</p>
                        </div>
                        <Switch
                          checked={notifications.smsTaskOverdue}
                          onCheckedChange={() => toggleNotification("smsTaskOverdue")}
                        />
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* AI Email Intelligence */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    AI Email Intelligence
                  </CardTitle>
                  <CardDescription>
                    Notifications for AI-processed emails
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Email Processed</p>
                      <p className="text-xs text-muted-foreground">Notify when new emails are analyzed</p>
                    </div>
                    <Switch
                      checked={notifications.aiEmailProcessed}
                      onCheckedChange={() => toggleNotification("aiEmailProcessed")}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">High Priority Detected</p>
                      <p className="text-xs text-muted-foreground">Alert when AI detects urgent emails</p>
                    </div>
                    <Switch
                      checked={notifications.aiHighPriorityDetected}
                      onCheckedChange={() => toggleNotification("aiHighPriorityDetected")}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Action Items Extracted</p>
                      <p className="text-xs text-muted-foreground">Notify when action items are found</p>
                    </div>
                    <Switch
                      checked={notifications.aiActionItemsExtracted}
                      onCheckedChange={() => toggleNotification("aiActionItemsExtracted")}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Quiet Hours */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Quiet Hours
                  </CardTitle>
                  <CardDescription>
                    Pause notifications during specific hours
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Enable Quiet Hours</p>
                      <p className="text-xs text-muted-foreground">Pause non-urgent notifications during set hours</p>
                    </div>
                    <Switch
                      checked={notifications.quietHoursEnabled}
                      onCheckedChange={() => toggleNotification("quietHoursEnabled")}
                    />
                  </div>
                  {notifications.quietHoursEnabled && (
                    <>
                      <Separator />
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="quietStart">Start Time</Label>
                          <Input
                            id="quietStart"
                            type="time"
                            value={notifications.quietHoursStart}
                            onChange={(e) => setNotifications(prev => ({ ...prev, quietHoursStart: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="quietEnd">End Time</Label>
                          <Input
                            id="quietEnd"
                            type="time"
                            value={notifications.quietHoursEnd}
                            onChange={(e) => setNotifications(prev => ({ ...prev, quietHoursEnd: e.target.value }))}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Save Button */}
              <div className="flex justify-end">
                <Button onClick={handleSaveNotifications} disabled={savingNotifications}>
                  {savingNotifications ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {savingNotifications ? "Saving..." : "Save Notification Preferences"}
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Security Settings */}
          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>
                  Update your password to keep your account secure
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Error Messages */}
                {passwordErrors.length > 0 && (
                  <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                      <div>
                        {passwordErrors.map((error, index) => (
                          <p key={index} className="text-sm text-destructive">{error}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  {/* Current Password */}
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <div className="relative">
                      <Input
                        id="currentPassword"
                        type={showCurrentPassword ? "text" : "password"}
                        value={passwordForm.currentPassword}
                        onChange={(e) => setPasswordForm(p => ({ ...p, currentPassword: e.target.value }))}
                        placeholder="Enter your current password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      >
                        {showCurrentPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* New Password */}
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showNewPassword ? "text" : "password"}
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm(p => ({ ...p, newPassword: e.target.value }))}
                        placeholder="Enter your new password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                      >
                        {showNewPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Password Requirements */}
                  {passwordForm.newPassword && (
                    <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                      <p className="text-sm font-medium">Password Requirements:</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className={`flex items-center gap-2 text-sm ${passwordChecks.minLength ? "text-green-600" : "text-muted-foreground"}`}>
                          {passwordChecks.minLength ? <Check className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                          At least 8 characters
                        </div>
                        <div className={`flex items-center gap-2 text-sm ${passwordChecks.hasUppercase ? "text-green-600" : "text-muted-foreground"}`}>
                          {passwordChecks.hasUppercase ? <Check className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                          One uppercase letter
                        </div>
                        <div className={`flex items-center gap-2 text-sm ${passwordChecks.hasLowercase ? "text-green-600" : "text-muted-foreground"}`}>
                          {passwordChecks.hasLowercase ? <Check className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                          One lowercase letter
                        </div>
                        <div className={`flex items-center gap-2 text-sm ${passwordChecks.hasNumber ? "text-green-600" : "text-muted-foreground"}`}>
                          {passwordChecks.hasNumber ? <Check className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                          One number
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Confirm Password */}
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm(p => ({ ...p, confirmPassword: e.target.value }))}
                        placeholder="Confirm your new password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                    {passwordForm.confirmPassword && (
                      <p className={`text-sm flex items-center gap-1 ${passwordChecks.passwordsMatch ? "text-green-600" : "text-destructive"}`}>
                        {passwordChecks.passwordsMatch ? (
                          <><Check className="h-4 w-4" /> Passwords match</>
                        ) : (
                          <><XCircle className="h-4 w-4" /> Passwords do not match</>
                        )}
                      </p>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="flex justify-end">
                  <Button
                    onClick={handleChangePassword}
                    disabled={savingPassword || !allPasswordChecksPassed || !passwordForm.currentPassword}
                  >
                    {savingPassword ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Shield className="h-4 w-4 mr-2" />
                    )}
                    {savingPassword ? "Updating..." : "Update Password"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Call Data Management - Admin Only */}
          {isAdmin && (
            <TabsContent value="data-management">
              <div className="space-y-6">
                {/* Current Call Data */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Phone className="h-5 w-5" />
                      Call Data Management
                    </CardTitle>
                    <CardDescription>
                      Manage phone call records and configure automatic cleanup
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Current Stats */}
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Total Call Records</p>
                          <p className="text-2xl font-bold">{callCount.toLocaleString()}</p>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleClearAllCalls}
                          disabled={clearingCalls || callCount === 0}
                        >
                          {clearingCalls ? (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              Clearing...
                            </>
                          ) : (
                            <>
                              <XCircle className="h-4 w-4 mr-2" />
                              Clear All Calls
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    <Separator />

                    {/* Auto-Delete Settings */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">Auto-Delete Call Records</p>
                          <p className="text-xs text-muted-foreground">
                            Automatically delete old call records to manage storage
                          </p>
                        </div>
                        <Switch
                          checked={callAutoDelete.enabled}
                          onCheckedChange={(checked) =>
                            setCallAutoDelete(prev => ({ ...prev, enabled: checked }))
                          }
                        />
                      </div>

                      {callAutoDelete.enabled && (
                        <>
                          <Separator />
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="deleteAfterDays">Delete calls older than</Label>
                              <div className="flex items-center gap-2">
                                <Input
                                  id="deleteAfterDays"
                                  type="number"
                                  min="1"
                                  max="365"
                                  value={callAutoDelete.deleteAfterDays}
                                  onChange={(e) =>
                                    setCallAutoDelete(prev => ({
                                      ...prev,
                                      deleteAfterDays: parseInt(e.target.value) || 30,
                                    }))
                                  }
                                  className="w-24"
                                />
                                <span className="text-sm text-muted-foreground">days</span>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="deleteOnDay">Run cleanup on</Label>
                              <Select
                                value={callAutoDelete.deleteOnDay}
                                onValueChange={(value) =>
                                  setCallAutoDelete(prev => ({ ...prev, deleteOnDay: value }))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Every day" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="">Every day</SelectItem>
                                  <SelectItem value="sunday">Sunday</SelectItem>
                                  <SelectItem value="monday">Monday</SelectItem>
                                  <SelectItem value="tuesday">Tuesday</SelectItem>
                                  <SelectItem value="wednesday">Wednesday</SelectItem>
                                  <SelectItem value="thursday">Thursday</SelectItem>
                                  <SelectItem value="friday">Friday</SelectItem>
                                  <SelectItem value="saturday">Saturday</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Cleanup runs at midnight in your company timezone
                          </p>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Save Button */}
                <div className="flex justify-end">
                  <Button onClick={handleSaveCallSettings} disabled={savingCallSettings}>
                    {savingCallSettings ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    {savingCallSettings ? "Saving..." : "Save Call Settings"}
                  </Button>
                </div>
              </div>
            </TabsContent>
          )}

          {/* My Email Accounts */}
          <TabsContent value="my-emails">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    My Email Accounts
                  </CardTitle>
                  <CardDescription>
                    Connect your email accounts to sync emails and get AI-powered insights.
                    Choose where each account&apos;s emails appear: Personal Inbox (only you) or Org Feed (visible to team).
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
                          className="p-4 border rounded-lg space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
                                <Mail className="h-6 w-6 text-purple-600" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-medium">{account.displayName}</p>
                                </div>
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
                          {/* Email Routing Selector */}
                          <div className="flex items-center justify-between pl-16 pt-2 border-t">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">Route emails to:</span>
                            </div>
                            <Select
                              value={account.isGlobal ? "org" : "personal"}
                              onValueChange={(value) => handleRoutingChange(account.id, value === "org")}
                            >
                              <SelectTrigger className="w-[180px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="personal">
                                  <div className="flex items-center gap-2">
                                    <User className="h-4 w-4" />
                                    Personal Inbox
                                  </div>
                                </SelectItem>
                                <SelectItem value="org">
                                  <div className="flex items-center gap-2">
                                    <Building className="h-4 w-4" />
                                    Org Feed
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      ))}
                      <Separator />
                    </>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Mail className="h-12 w-12 mx-auto mb-4 opacity-20" />
                      <p className="font-medium">No email accounts connected</p>
                      <p className="text-sm mt-1">Connect your Microsoft 365 account to start syncing emails</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Your emails will be processed by AI to extract action items and create tasks
                      </p>

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
                          Connect to sync your personal emails
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

              {/* How It Works */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    How Email Intelligence Works
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-lg border bg-muted/30">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">1</div>
                        <p className="font-medium">Sync</p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Your emails are synced and processed securely in the background
                      </p>
                    </div>
                    <div className="p-4 rounded-lg border bg-muted/30">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-semibold">2</div>
                        <p className="font-medium">Analyze</p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        AI extracts action items, deadlines, and client mentions
                      </p>
                    </div>
                    <div className="p-4 rounded-lg border bg-muted/30">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-semibold">3</div>
                        <p className="font-medium">Create Tasks</p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        One-click task creation from extracted action items
                      </p>
                    </div>
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
