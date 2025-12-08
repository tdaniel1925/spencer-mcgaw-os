"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Users,
  UserPlus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
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
  Key,
  Eye,
  EyeOff,
  Copy,
  RefreshCw,
  AlertTriangle,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import {
  UserRole,
  Permission,
  roleInfo,
  rolePermissions,
  permissionCategories,
  permissionNames,
} from "@/lib/permissions";
import { useAuth } from "@/lib/supabase/auth-context";

// Types
interface TeamMember {
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
  invited_by?: string;
}

const departments = [
  "Executive",
  "Tax",
  "Accounting",
  "Audit",
  "Client Services",
  "Administration",
];

// Role icon component
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

export default function UserManagementPage() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Dialog states
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [editUserOpen, setEditUserOpen] = useState(false);
  const [deleteUserOpen, setDeleteUserOpen] = useState(false);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<TeamMember | null>(null);
  const [saving, setSaving] = useState(false);

  // New user form state
  const [newUser, setNewUser] = useState({
    email: "",
    full_name: "",
    role: "staff" as UserRole,
    department: "",
    job_title: "",
    phone: "",
    sendInvite: true,
    show_in_taskpool: true,
  });

  const { can, isAdmin, isOwner } = useAuth();

  // Fetch users from database
  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/users");
      if (response.ok) {
        const data = await response.json();
        setMembers(data.users || []);
      } else {
        console.error("Failed to load users");
        toast.error("Failed to load users");
      }
    } catch (error) {
      console.error("Error loading users:", error);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    loadUsers();
  }, [loadUsers]);

  // Filter members
  const filteredMembers = members.filter((member) => {
    const matchesSearch =
      member.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.department?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "all" || member.role === roleFilter;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && member.is_active) ||
      (statusFilter === "inactive" && !member.is_active);
    return matchesSearch && matchesRole && matchesStatus;
  });

  // Stats
  const stats = {
    total: members.length,
    active: members.filter((m) => m.is_active).length,
    admins: members.filter((m) => m.role === "admin" || m.role === "owner").length,
    recentlyActive: members.filter(
      (m) => m.last_login && Date.now() - new Date(m.last_login).getTime() < 1000 * 60 * 60 * 24
    ).length,
  };

  const handleAddUser = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newUser.email,
          full_name: newUser.full_name,
          role: newUser.role,
          department: newUser.department,
          job_title: newUser.job_title,
          phone: newUser.phone,
          show_in_taskpool: newUser.show_in_taskpool,
        }),
      });

      if (response.ok) {
        toast.success("User added successfully");
        setAddUserOpen(false);
        setNewUser({
          email: "",
          full_name: "",
          role: "staff",
          department: "",
          job_title: "",
          phone: "",
          sendInvite: true,
          show_in_taskpool: true,
        });
        loadUsers();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to add user");
      }
    } catch (error) {
      console.error("Error adding user:", error);
      toast.error("Failed to add user");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: selectedUser.full_name,
          role: selectedUser.role,
          department: selectedUser.department,
          job_title: selectedUser.job_title,
          phone: selectedUser.phone,
          is_active: selectedUser.is_active,
          show_in_taskpool: selectedUser.show_in_taskpool,
        }),
      });

      if (response.ok) {
        toast.success("User updated successfully");
        setEditUserOpen(false);
        setSelectedUser(null);
        loadUsers();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to update user");
      }
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error("Failed to update user");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("User deleted successfully");
        setDeleteUserOpen(false);
        setSelectedUser(null);
        loadUsers();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to delete user");
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error("Failed to delete user");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (userId: string) => {
    const member = members.find(m => m.id === userId);
    if (!member) return;

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !member.is_active }),
      });

      if (response.ok) {
        toast.success(member.is_active ? "User deactivated" : "User activated");
        loadUsers();
      } else {
        toast.error("Failed to update user status");
      }
    } catch (error) {
      console.error("Error toggling user status:", error);
      toast.error("Failed to update user status");
    }
  };


  const getUserInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  if (!mounted) return null;

  return (
    <>
      <Header title="User Management" />
      <main className="p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total Users</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.active}</p>
                <p className="text-sm text-muted-foreground">Active Users</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Shield className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.admins}</p>
                <p className="text-sm text-muted-foreground">Administrators</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.recentlyActive}</p>
                <p className="text-sm text-muted-foreground">Active Today</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters and Actions */}
        <Card className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex flex-1 gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {(Object.keys(roleInfo) as UserRole[]).map((role) => (
                    <SelectItem key={role} value={role}>
                      {roleInfo[role].name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {can("users:create") && (
              <Button onClick={() => setAddUserOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            )}
          </div>
        </Card>

        {/* Users Table */}
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Active</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMembers.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={member.avatar_url} />
                        <AvatarFallback className="text-xs">
                          {getUserInitials(member.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{member.full_name}</p>
                        <p className="text-sm text-muted-foreground">{member.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "gap-1",
                        roleInfo[member.role].color,
                        "text-white border-0"
                      )}
                    >
                      <RoleIcon role={member.role} />
                      {roleInfo[member.role].name}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm">{member.department || "-"}</span>
                      {member.job_title && (
                        <span className="text-xs text-muted-foreground">
                          {member.job_title}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={member.is_active ? "default" : "secondary"}
                      className={cn(
                        member.is_active
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                      )}
                    >
                      {member.is_active ? (
                        <>
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Active
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3 w-3 mr-1" />
                          Inactive
                        </>
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {member.last_login ? (
                      <span
                        className="text-sm text-muted-foreground"
                        suppressHydrationWarning
                      >
                        {formatDistanceToNow(member.last_login, { addSuffix: true })}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">Never</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedUser(member);
                            setEditUserOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit User
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedUser(member);
                            setPermissionsOpen(true);
                          }}
                        >
                          <Key className="h-4 w-4 mr-2" />
                          View Permissions
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleToggleActive(member.id)}
                        >
                          {member.is_active ? (
                            <>
                              <Lock className="h-4 w-4 mr-2" />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Activate
                            </>
                          )}
                        </DropdownMenuItem>
                        {can("users:delete") && member.role !== "owner" && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => {
                                setSelectedUser(member);
                                setDeleteUserOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete User
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        {/* Role Legend */}
        <Card className="p-4">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Role Permissions Overview
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(Object.keys(roleInfo) as UserRole[]).map((role) => (
              <div
                key={role}
                className="p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Badge
                    variant="secondary"
                    className={cn(
                      "gap-1",
                      roleInfo[role].color,
                      "text-white border-0"
                    )}
                  >
                    <RoleIcon role={role} />
                    {roleInfo[role].name}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {roleInfo[role].description}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {rolePermissions[role].length} permissions
                </p>
              </div>
            ))}
          </div>
        </Card>
      </main>

      {/* Add User Dialog */}
      <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Add New User
            </DialogTitle>
            <DialogDescription>
              Add a new team member to your organization. They will receive an email
              invitation to set up their account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name *</Label>
                <Input
                  id="full_name"
                  value={newUser.full_name}
                  onChange={(e) =>
                    setNewUser((prev) => ({ ...prev, full_name: e.target.value }))
                  }
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={newUser.email}
                  onChange={(e) =>
                    setNewUser((prev) => ({ ...prev, email: e.target.value }))
                  }
                  placeholder="john@company.com"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <Select
                  value={newUser.role}
                  onValueChange={(value: UserRole) =>
                    setNewUser((prev) => ({ ...prev, role: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(roleInfo) as UserRole[])
                      .filter((r) => isOwner || r !== "owner")
                      .filter((r) => isAdmin || (r !== "admin" && r !== "owner"))
                      .map((role) => (
                        <SelectItem key={role} value={role}>
                          <div className="flex items-center gap-2">
                            <RoleIcon role={role} />
                            {roleInfo[role].name}
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Select
                  value={newUser.department}
                  onValueChange={(value) =>
                    setNewUser((prev) => ({ ...prev, department: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="job_title">Job Title</Label>
                <Input
                  id="job_title"
                  value={newUser.job_title}
                  onChange={(e) =>
                    setNewUser((prev) => ({ ...prev, job_title: e.target.value }))
                  }
                  placeholder="Senior Accountant"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={newUser.phone}
                  onChange={(e) =>
                    setNewUser((prev) => ({ ...prev, phone: e.target.value }))
                  }
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="sendInvite"
                checked={newUser.sendInvite}
                onCheckedChange={(checked) =>
                  setNewUser((prev) => ({ ...prev, sendInvite: !!checked }))
                }
              />
              <Label htmlFor="sendInvite" className="text-sm font-normal">
                Send email invitation to set up account
              </Label>
            </div>
            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="show_in_taskpool"
                checked={newUser.show_in_taskpool}
                onCheckedChange={(checked) =>
                  setNewUser((prev) => ({ ...prev, show_in_taskpool: !!checked }))
                }
              />
              <Label htmlFor="show_in_taskpool" className="text-sm font-normal">
                Show in TaskPool assignment ribbon
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddUserOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddUser}
              disabled={!newUser.email || !newUser.full_name}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      {selectedUser && (
        <Dialog open={editUserOpen} onOpenChange={setEditUserOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit className="h-5 w-5" />
                Edit User
              </DialogTitle>
              <DialogDescription>
                Update user information and permissions.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_full_name">Full Name</Label>
                  <Input
                    id="edit_full_name"
                    value={selectedUser.full_name}
                    onChange={(e) =>
                      setSelectedUser((prev) =>
                        prev ? { ...prev, full_name: e.target.value } : null
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_email">Email</Label>
                  <Input
                    id="edit_email"
                    type="email"
                    value={selectedUser.email}
                    onChange={(e) =>
                      setSelectedUser((prev) =>
                        prev ? { ...prev, email: e.target.value } : null
                      )
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_role">Role</Label>
                  <Select
                    value={selectedUser.role}
                    onValueChange={(value: UserRole) =>
                      setSelectedUser((prev) =>
                        prev ? { ...prev, role: value } : null
                      )
                    }
                    disabled={selectedUser.role === "owner" && !isOwner}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(roleInfo) as UserRole[])
                        .filter((r) => isOwner || r !== "owner")
                        .map((role) => (
                          <SelectItem key={role} value={role}>
                            <div className="flex items-center gap-2">
                              <RoleIcon role={role} />
                              {roleInfo[role].name}
                            </div>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_department">Department</Label>
                  <Select
                    value={selectedUser.department || ""}
                    onValueChange={(value) =>
                      setSelectedUser((prev) =>
                        prev ? { ...prev, department: value } : null
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept} value={dept}>
                          {dept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_job_title">Job Title</Label>
                  <Input
                    id="edit_job_title"
                    value={selectedUser.job_title || ""}
                    onChange={(e) =>
                      setSelectedUser((prev) =>
                        prev ? { ...prev, job_title: e.target.value } : null
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_phone">Phone</Label>
                  <Input
                    id="edit_phone"
                    value={selectedUser.phone || ""}
                    onChange={(e) =>
                      setSelectedUser((prev) =>
                        prev ? { ...prev, phone: e.target.value } : null
                      )
                    }
                  />
                </div>
              </div>
              <div className="flex items-center justify-between pt-2">
                <Label htmlFor="edit_active">Account Status</Label>
                <div className="flex items-center gap-2">
                  <Switch
                    id="edit_active"
                    checked={selectedUser.is_active}
                    onCheckedChange={(checked) =>
                      setSelectedUser((prev) =>
                        prev ? { ...prev, is_active: checked } : null
                      )
                    }
                  />
                  <span className="text-sm text-muted-foreground">
                    {selectedUser.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t">
                <div>
                  <Label htmlFor="edit_taskpool">Show in TaskPool</Label>
                  <p className="text-xs text-muted-foreground">
                    User appears in task assignment ribbon
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="edit_taskpool"
                    checked={selectedUser.show_in_taskpool}
                    onCheckedChange={(checked) =>
                      setSelectedUser((prev) =>
                        prev ? { ...prev, show_in_taskpool: !!checked } : null
                      )
                    }
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditUserOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateUser}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete User Dialog */}
      {selectedUser && (
        <Dialog open={deleteUserOpen} onOpenChange={setDeleteUserOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Delete User
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this user? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={selectedUser.avatar_url} />
                  <AvatarFallback>
                    {getUserInitials(selectedUser.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{selectedUser.full_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedUser.email}
                  </p>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteUserOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteUser}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete User
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Permissions Dialog */}
      {selectedUser && (
        <Dialog open={permissionsOpen} onOpenChange={setPermissionsOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Permissions for {selectedUser.full_name}
              </DialogTitle>
              <DialogDescription>
                <span className="flex items-center gap-2 mt-2">
                  Role:
                  <Badge
                    variant="secondary"
                    className={cn(
                      "gap-1",
                      roleInfo[selectedUser.role].color,
                      "text-white border-0"
                    )}
                  >
                    <RoleIcon role={selectedUser.role} />
                    {roleInfo[selectedUser.role].name}
                  </Badge>
                </span>
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[50vh] pr-4">
              <div className="space-y-6 py-4">
                {Object.entries(permissionCategories).map(([key, category]) => {
                  const userPerms = rolePermissions[selectedUser.role];
                  const categoryPerms = category.permissions;
                  const hasAny = categoryPerms.some((p) => userPerms.includes(p));

                  return (
                    <div key={key} className="space-y-2">
                      <h4 className="font-medium text-sm flex items-center gap-2">
                        {category.name}
                        {hasAny ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        {categoryPerms.map((perm) => {
                          const hasPermission = userPerms.includes(perm);
                          return (
                            <div
                              key={perm}
                              className={cn(
                                "flex items-center gap-2 text-sm p-2 rounded",
                                hasPermission
                                  ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                                  : "bg-muted/50 text-muted-foreground"
                              )}
                            >
                              {hasPermission ? (
                                <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5 flex-shrink-0" />
                              )}
                              <span>{permissionNames[perm]}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPermissionsOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
