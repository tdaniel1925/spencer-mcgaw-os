"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  ArrowLeft,
  Mail,
  Phone,
  Shield,
  ShieldCheck,
  ShieldAlert,
  UserCog,
  CheckCircle,
  XCircle,
  Clock,
  Building2,
  Briefcase,
  Edit,
  Trash2,
  Save,
  RefreshCw,
  Activity,
  Key,
  AlertTriangle,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import {
  UserRole,
  Permission,
  roleInfo,
  rolePermissions,
  permissionCategories,
  permissionNames,
  PermissionOverride,
  getUserPermissions,
} from "@/lib/permissions";
import { useAuth } from "@/lib/supabase/auth-context";

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  department?: string;
  job_title?: string;
  phone?: string;
  avatar_url?: string;
  is_active: boolean;
  show_in_taskpool: boolean;
  last_login?: string;
  created_at: string;
  updated_at?: string;
  bio?: string;
}

interface ActivityLog {
  id: string;
  action: string;
  resource_type: string;
  resource_name: string;
  created_at: string;
}

const departments = [
  "Executive",
  "Tax",
  "Accounting",
  "Audit",
  "Client Services",
  "Administration",
];

function RoleIcon({ role }: { role: UserRole }) {
  switch (role) {
    case "owner":
      return <ShieldCheck className="h-4 w-4" />;
    case "admin":
      return <ShieldAlert className="h-4 w-4" />;
    case "manager":
      return <Shield className="h-4 w-4" />;
    default:
      return <UserCog className="h-4 w-4" />;
  }
}

function RoleBadge({ role }: { role: UserRole }) {
  const info = roleInfo[role];
  return (
    <Badge className={info?.color || "bg-gray-100 text-gray-700"}>
      <RoleIcon role={role} />
      <span className="ml-1">{info?.name || role}</span>
    </Badge>
  );
}

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { can, isAdmin, isOwner } = useAuth();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({
    full_name: "",
    role: "" as UserRole,
    department: "",
    job_title: "",
    phone: "",
    is_active: true,
    show_in_taskpool: true,
  });

  // Activity log state
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);

  // Permission overrides
  const [permissionOverrides, setPermissionOverrides] = useState<PermissionOverride[]>([]);
  const [loadingOverrides, setLoadingOverrides] = useState(false);

  // Load user details
  useEffect(() => {
    async function loadUser() {
      try {
        const response = await fetch(`/api/admin/users/${id}`);
        if (!response.ok) {
          if (response.status === 404) {
            toast.error("User not found");
            router.push("/admin/users");
            return;
          }
          throw new Error("Failed to load user");
        }

        const data = await response.json();
        setUser(data.user);
        setEditForm({
          full_name: data.user.full_name || "",
          role: data.user.role || "staff",
          department: data.user.department || "",
          job_title: data.user.job_title || "",
          phone: data.user.phone || "",
          is_active: data.user.is_active !== false,
          show_in_taskpool: data.user.show_in_taskpool !== false,
        });
      } catch (error) {
        console.error("Error loading user:", error);
        toast.error("Failed to load user");
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, [id, router]);

  // Load activity log
  useEffect(() => {
    async function loadActivity() {
      setLoadingActivity(true);
      try {
        const response = await fetch(`/api/activity?user_id=${id}&limit=20`);
        if (response.ok) {
          const data = await response.json();
          setActivityLog(data.activities || []);
        }
      } catch (error) {
        console.error("Error loading activity:", error);
      } finally {
        setLoadingActivity(false);
      }
    }

    if (user) {
      loadActivity();
    }
  }, [id, user]);

  // Load permission overrides
  useEffect(() => {
    async function loadOverrides() {
      setLoadingOverrides(true);
      try {
        const response = await fetch(`/api/users/${id}/permissions`);
        if (response.ok) {
          const data = await response.json();
          setPermissionOverrides(data.overrides || []);
        }
      } catch (error) {
        console.error("Error loading permission overrides:", error);
      } finally {
        setLoadingOverrides(false);
      }
    }

    if (user) {
      loadOverrides();
    }
  }, [id, user]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update user");
      }

      const data = await response.json();
      setUser(data.user);
      setEditMode(false);
      toast.success("User updated successfully");
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update user");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/admin/users/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete user");
      }

      toast.success("User deleted successfully");
      router.push("/admin/users");
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete user");
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  const handleResetPassword = async () => {
    try {
      const response = await fetch(`/api/admin/users/${id}/reset-password`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to send reset email");
      }

      toast.success("Password reset email sent");
    } catch (error) {
      console.error("Error resetting password:", error);
      toast.error(error instanceof Error ? error.message : "Failed to send reset email");
    }
  };

  if (loading) {
    return (
      <>
        <Header title="User Details" />
        <main className="p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            <Skeleton className="h-10 w-32" />
            <Card>
              <CardHeader>
                <Skeleton className="h-20 w-20 rounded-full" />
                <Skeleton className="h-6 w-48 mt-4" />
                <Skeleton className="h-4 w-32" />
              </CardHeader>
            </Card>
          </div>
        </main>
      </>
    );
  }

  if (!user) {
    return null;
  }

  const canEdit = can("users:edit");
  const canDelete = can("users:delete") && user.role !== "owner";
  const effectivePermissions = getUserPermissions(user.role, permissionOverrides);

  return (
    <>
      <Header title="User Details" />
      <main className="p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Back button */}
          <Button
            variant="ghost"
            onClick={() => router.push("/admin/users")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Users
          </Button>

          {/* User Profile Card */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={user.avatar_url} />
                    <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                      {user.full_name?.split(" ").map(n => n[0]).join("") || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-2xl font-bold">{user.full_name || "Unnamed User"}</h2>
                      {!user.is_active && (
                        <Badge variant="secondary" className="bg-red-100 text-red-700">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground">{user.email}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <RoleBadge role={user.role} />
                      {user.show_in_taskpool && (
                        <Badge variant="outline" className="text-xs">
                          In Task Pool
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {canEdit && !editMode && (
                    <Button variant="outline" onClick={() => setEditMode(true)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  )}
                  {canDelete && (
                    <Button variant="outline" className="text-destructive" onClick={() => setDeleteOpen(true)}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Tabs for different sections */}
          <Tabs defaultValue="details">
            <TabsList>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="permissions">Permissions</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>

            {/* Details Tab */}
            <TabsContent value="details" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Contact Information</CardTitle>
                  <CardDescription>User's contact and organization details</CardDescription>
                </CardHeader>
                <CardContent>
                  {editMode ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="full_name">Full Name</Label>
                        <Input
                          id="full_name"
                          value={editForm.full_name}
                          onChange={(e) => setEditForm(f => ({ ...f, full_name: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="role">Role</Label>
                        <Select
                          value={editForm.role}
                          onValueChange={(v) => setEditForm(f => ({ ...f, role: v as UserRole }))}
                          disabled={!isOwner && (user.role === "owner" || user.role === "admin")}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {isOwner && <SelectItem value="owner">Owner</SelectItem>}
                            {isOwner && <SelectItem value="admin">Admin</SelectItem>}
                            {(isOwner || isAdmin) && <SelectItem value="manager">Manager</SelectItem>}
                            <SelectItem value="accountant">Accountant</SelectItem>
                            <SelectItem value="staff">Staff</SelectItem>
                            <SelectItem value="viewer">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="department">Department</Label>
                        <Select
                          value={editForm.department || "__none__"}
                          onValueChange={(v) => setEditForm(f => ({ ...f, department: v === "__none__" ? "" : v }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">No department</SelectItem>
                            {departments.map(d => (
                              <SelectItem key={d} value={d}>{d}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="job_title">Job Title</Label>
                        <Input
                          id="job_title"
                          value={editForm.job_title}
                          onChange={(e) => setEditForm(f => ({ ...f, job_title: e.target.value }))}
                          placeholder="e.g., Senior Accountant"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone</Label>
                        <Input
                          id="phone"
                          value={editForm.phone}
                          onChange={(e) => setEditForm(f => ({ ...f, phone: e.target.value }))}
                          placeholder="(555) 123-4567"
                        />
                      </div>
                      <div className="space-y-4 col-span-2 pt-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Active Status</Label>
                            <p className="text-sm text-muted-foreground">Inactive users cannot log in</p>
                          </div>
                          <Switch
                            checked={editForm.is_active}
                            onCheckedChange={(v) => setEditForm(f => ({ ...f, is_active: v }))}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Show in Task Pool</Label>
                            <p className="text-sm text-muted-foreground">User can be assigned tasks</p>
                          </div>
                          <Switch
                            checked={editForm.show_in_taskpool}
                            onCheckedChange={(v) => setEditForm(f => ({ ...f, show_in_taskpool: v }))}
                          />
                        </div>
                      </div>
                      <div className="col-span-2 flex justify-end gap-2 pt-4">
                        <Button variant="outline" onClick={() => setEditMode(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={saving}>
                          {saving ? (
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4 mr-2" />
                          )}
                          Save Changes
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="flex items-center gap-3">
                        <Mail className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Email</p>
                          <p className="font-medium">{user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Phone className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Phone</p>
                          <p className="font-medium">{user.phone || "Not set"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Department</p>
                          <p className="font-medium">{user.department || "Not set"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Briefcase className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Job Title</p>
                          <p className="font-medium">{user.job_title || "Not set"}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Account Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Last Login</p>
                        <p className="font-medium">
                          {user.last_login
                            ? formatDistanceToNow(new Date(user.last_login), { addSuffix: true })
                            : "Never"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Member Since</p>
                        <p className="font-medium">
                          {format(new Date(user.created_at), "MMM d, yyyy")}
                        </p>
                      </div>
                    </div>
                  </div>

                  {canEdit && (
                    <>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Password Reset</p>
                          <p className="text-sm text-muted-foreground">
                            Send a password reset email to this user
                          </p>
                        </div>
                        <Button variant="outline" onClick={handleResetPassword}>
                          <Key className="h-4 w-4 mr-2" />
                          Send Reset Email
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Permissions Tab */}
            <TabsContent value="permissions">
              <Card>
                <CardHeader>
                  <CardTitle>User Permissions</CardTitle>
                  <CardDescription>
                    Permissions are based on role ({roleInfo[user.role]?.name}).
                    Overrides can be applied to grant or deny specific permissions.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingOverrides ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map(i => (
                        <Skeleton key={i} className="h-12" />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {Object.entries(permissionCategories).map(([category, categoryData]) => (
                        <div key={category}>
                          <h4 className="font-medium text-sm text-muted-foreground mb-3 uppercase">
                            {categoryData.name}
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {categoryData.permissions.map((permission: Permission) => {
                              const hasPermission = effectivePermissions.includes(permission);
                              const override = permissionOverrides.find(o => o.permission === permission);

                              return (
                                <div
                                  key={permission}
                                  className={`flex items-center justify-between p-3 rounded-lg border ${
                                    hasPermission ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    {hasPermission ? (
                                      <CheckCircle className="h-4 w-4 text-green-600" />
                                    ) : (
                                      <XCircle className="h-4 w-4 text-gray-400" />
                                    )}
                                    <span className="text-sm">{permissionNames[permission] || permission}</span>
                                  </div>
                                  {override && (
                                    <Badge variant="outline" className="text-xs">
                                      {override.granted ? "Granted" : "Denied"}
                                    </Badge>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Activity Tab */}
            <TabsContent value="activity">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Recent Activity
                  </CardTitle>
                  <CardDescription>
                    Actions performed by this user
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingActivity ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map(i => (
                        <Skeleton key={i} className="h-16" />
                      ))}
                    </div>
                  ) : activityLog.length > 0 ? (
                    <div className="space-y-3">
                      {activityLog.map(activity => (
                        <div
                          key={activity.id}
                          className="flex items-start gap-3 p-3 rounded-lg border"
                        >
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                            <Activity className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm">
                              <span className="font-medium capitalize">{activity.action}</span>
                              {" "}
                              <span className="text-muted-foreground">{activity.resource_type}</span>
                              {activity.resource_name && (
                                <>
                                  {": "}
                                  <span className="font-medium">{activity.resource_name}</span>
                                </>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Activity className="h-12 w-12 mx-auto mb-4 opacity-20" />
                      <p>No activity recorded</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Delete User
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to delete {user.full_name}? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                <strong>Warning:</strong> This will permanently delete the user account and all associated data including:
              </p>
              <ul className="text-sm text-amber-700 mt-2 list-disc list-inside">
                <li>User profile and settings</li>
                <li>Authentication credentials</li>
                <li>Permission overrides</li>
              </ul>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Delete User
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </>
  );
}
