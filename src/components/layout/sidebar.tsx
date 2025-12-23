"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  Phone,
  FileText,
  FolderOpen,
  FolderKanban,
  BarChart3,
  Calendar,
  Activity,
  Settings,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  LogOut,
  Mail,
  Shield,
  UserCog,
  UserPen,
  Menu,
  X,
  Webhook,
  Sparkles,
  MessageSquare,
  MessagesSquare,
  Kanban,
  FileSpreadsheet,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/supabase/auth-context";
import { Permission, roleInfo } from "@/lib/permissions";
import { useNotifications, getProgressPercentage } from "@/lib/notifications";

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
  children?: { title: string; href: string; permission?: Permission }[];
  permission?: Permission; // Required permission to view this nav item
  adminOnly?: boolean; // Only show to admin/owner
}

// Define navigation with permissions - organized by category
interface NavSection {
  label?: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    // Core section - main navigation
    items: [
      {
        title: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        permission: "dashboard:view",
      },
    ],
  },
  {
    label: "Inbox",
    items: [
      {
        title: "Org Feed",
        href: "/org-feed",
        icon: Activity,
        permission: "dashboard:view",
      },
      {
        title: "My Inbox",
        href: "/my-inbox",
        icon: Mail,
        permission: "email:view",
      },
    ],
  },
  {
    label: "Work",
    items: [
      {
        title: "My Tasks",
        href: "/tasks",
        icon: ClipboardList,
        permission: "tasks:view",
      },
      {
        title: "Org Tasks",
        href: "/org-tasks",
        icon: Kanban,
        permission: "tasks:view",
      },
      {
        title: "Calendar",
        href: "/calendar",
        icon: Calendar,
        permission: "calendar:view",
      },
    ],
  },
  {
    label: "Team",
    items: [
      {
        title: "Chat",
        href: "/chat",
        icon: MessagesSquare,
        permission: "dashboard:view",
      },
    ],
  },
  {
    label: "Business",
    items: [
      {
        title: "Clients",
        href: "/clients",
        icon: Users,
        permission: "clients:view",
      },
      {
        title: "Projects",
        href: "/projects",
        icon: FolderKanban,
        permission: "clients:view",
      },
      {
        title: "Files",
        href: "/files",
        icon: FolderOpen,
        permission: "documents:view",
      },
    ],
  },
  {
    label: "Admin",
    items: [
      {
        title: "Oversight",
        href: "/oversight",
        icon: BarChart3,
        permission: "system:view_audit_logs",
        adminOnly: true,
      },
    ],
  },
  {
    items: [
      {
        title: "Settings",
        href: "/settings",
        icon: Settings,
      },
      {
        title: "Help",
        href: "/help",
        icon: HelpCircle,
      },
    ],
  },
];

// Admin-only navigation items
const adminNavItems: NavItem[] = [
  {
    title: "User Management",
    href: "/admin/users",
    icon: UserCog,
    permission: "users:view",
    adminOnly: true,
  },
  {
    title: "Webhook Monitor",
    href: "/admin/webhooks",
    icon: Webhook,
    permission: "system:view_audit_logs",
    adminOnly: true,
  },
  {
    title: "Audit Trail",
    href: "/admin/audit",
    icon: Activity,
    permission: "system:view_audit_logs",
    adminOnly: true,
  },
  {
    title: "System Settings",
    href: "/admin/system",
    icon: Shield,
    permission: "system:view_audit_logs",
    adminOnly: true,
  },
  {
    title: "SMS Settings",
    href: "/admin/sms-settings",
    icon: MessageSquare,
    permission: "system:view_audit_logs",
    adminOnly: true,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);
  const { user, signOut, can, isAdmin } = useAuth();
  const { taskProgress } = useNotifications();
  const progressPercentage = getProgressPercentage(taskProgress);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Filter nav sections based on permissions - include user?.role in deps to ensure recalculation
  const filteredNavSections = useMemo(() => {
    return navSections
      .map((section) => ({
        ...section,
        items: section.items
          .filter((item) => {
            // Check admin-only restriction
            if (item.adminOnly && !isAdmin) return false;
            // Check permission
            if (!item.permission) return true;
            return can(item.permission);
          })
          .map((item) => {
            if (item.children) {
              return {
                ...item,
                children: item.children.filter((child) => {
                  if (!child.permission) return true;
                  return can(child.permission);
                }),
              };
            }
            return item;
          }),
      }))
      .filter((section) => section.items.length > 0);
  }, [can, isAdmin, user?.role]);

  // Filter admin nav items - include user?.role in deps to ensure recalculation
  const filteredAdminNav = useMemo(() => {
    if (!isAdmin) return [];
    return adminNavItems.filter((item) => {
      if (!item.permission) return true;
      return can(item.permission);
    });
  }, [can, isAdmin, user?.role]);

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
    router.refresh();
  };

  const getUserInitials = () => {
    if (!user?.full_name) return user?.email?.charAt(0).toUpperCase() || "U";
    return user.full_name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  const toggleExpand = (title: string) => {
    setExpandedItems((prev) =>
      prev.includes(title)
        ? prev.filter((item) => item !== title)
        : [...prev, title]
    );
  };

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === href || pathname === "/";
    }
    return pathname.startsWith(href);
  };

  // Get role display info
  const userRoleInfo = user?.role ? roleInfo[user.role] : null;

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    const active = isActive(item.href);
    const expanded = expandedItems.includes(item.title);
    const hasChildren = item.children && item.children.length > 0;

    return (
      <div key={item.title}>
        {hasChildren ? (
          <button
            onClick={() => toggleExpand(item.title)}
            aria-expanded={expanded}
            aria-controls={`submenu-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
            className={cn(
              "flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
              active
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            <div className="flex items-center gap-3">
              <Icon className="h-5 w-5 flex-shrink-0" />
              <span className="truncate">{item.title}</span>
            </div>
            <div className="flex items-center gap-2">
              {item.badge && (
                <span className="bg-sidebar-primary text-sidebar-primary-foreground text-xs px-2 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )}
              {expanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </div>
          </button>
        ) : (
          <Link
            href={item.href}
            className={cn(
              "flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            <div className="flex items-center gap-3">
              <Icon className="h-5 w-5 flex-shrink-0" />
              <span className="truncate">{item.title}</span>
            </div>
            {item.badge && (
              <span className={cn(
                "text-xs px-2 py-0.5 rounded-full",
                active
                  ? "bg-sidebar-foreground/20 text-sidebar-primary-foreground"
                  : "bg-sidebar-primary text-sidebar-primary-foreground"
              )}>
                {item.badge}
              </span>
            )}
          </Link>
        )}

        {/* Children/Submenu */}
        {hasChildren && expanded && (
          <div
            id={`submenu-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
            role="group"
            aria-label={`${item.title} submenu`}
            className="ml-4 mt-1 space-y-1 border-l border-sidebar-border pl-4"
          >
            {item.children?.map((child) => (
              <Link
                key={child.href}
                href={child.href}
                className={cn(
                  "block px-3 py-2 rounded-lg text-sm transition-colors",
                  pathname === child.href
                    ? "text-sidebar-primary font-medium"
                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground"
                )}
              >
                {child.title}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Mobile state
  const [mobileOpen, setMobileOpen] = useState(false);

  // Shared sidebar content component
  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-sidebar-border px-6 gap-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center flex-shrink-0">
            <span className="text-sidebar-primary-foreground font-bold text-sm">SM</span>
          </div>
          <div className="overflow-hidden">
            <span className="font-semibold text-lg text-sidebar-foreground whitespace-nowrap">
              Spencer<span className="text-sidebar-primary">|</span>McGaw
            </span>
            <span className="text-xs text-sidebar-foreground/70 block -mt-1">
              Business OS
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 min-h-0 py-4 px-3">
        <nav className="space-y-1">
          {filteredNavSections.map((section, sectionIdx) => (
            <div key={sectionIdx}>
              {section.label && (
                <div className="pt-3 pb-1.5 first:pt-0">
                  <span className="text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-wider px-3">
                    {section.label}
                  </span>
                </div>
              )}
              {section.items.map(renderNavItem)}
            </div>
          ))}

        </nav>
      </ScrollArea>

      {/* Bottom Section */}
      <div className="border-t border-sidebar-border p-4 flex-shrink-0">
        {/* Tasks Progress */}
        {taskProgress.total > 0 && (
          <div className="mb-4">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-sidebar-foreground/70">Today&apos;s Tasks</span>
              <span className="text-sidebar-foreground">{taskProgress.completed}/{taskProgress.total}</span>
            </div>
            <Progress value={progressPercentage} className="h-1.5 bg-sidebar-accent" />
          </div>
        )}

        {/* User Profile */}
        {mounted ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="User profile menu"
                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-sidebar-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
              >
                <Avatar className="h-9 w-9 flex-shrink-0">
                  <AvatarImage src={user?.avatar_url || ""} />
                  <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-sm">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left overflow-hidden">
                  <p className="text-sm font-medium text-sidebar-foreground truncate">
                    {user?.full_name || user?.email || "User"}
                  </p>
                  <div className="flex items-center gap-1.5">
                    {userRoleInfo && (
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-[10px] px-1.5 py-0 h-4",
                          userRoleInfo.color,
                          "text-white border-0"
                        )}
                      >
                        {userRoleInfo.name}
                      </Badge>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-sidebar-foreground/50 flex-shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span>{user?.full_name || "User"}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {user?.email}
                  </span>
                  {userRoleInfo && (
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-[10px] px-1.5 py-0 h-4 w-fit mt-1",
                        userRoleInfo.color,
                        "text-white border-0"
                      )}
                    >
                      {userRoleInfo.name}
                    </Badge>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <UserPen className="mr-2 h-4 w-4" />
                  Edit Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/help">
                  <HelpCircle className="mr-2 h-4 w-4" />
                  Help & Support
                </Link>
              </DropdownMenuItem>
              {/* Admin Section */}
              {filteredAdminNav.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                    Admin
                  </DropdownMenuLabel>
                  <DropdownMenuItem asChild>
                    <Link href="/analytics">
                      <BarChart3 className="mr-2 h-4 w-4" />
                      Analytics
                    </Link>
                  </DropdownMenuItem>
                  {filteredAdminNav.map((item) => (
                    <DropdownMenuItem key={item.href} asChild>
                      <Link href={item.href}>
                        <item.icon className="mr-2 h-4 w-4" />
                        {item.title}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  handleSignOut();
                }}
                className="text-red-600 cursor-pointer"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="w-full flex items-center gap-3 p-2 rounded-lg">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-sm">
                U
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                Loading...
              </p>
              <p className="text-xs text-sidebar-foreground/70">
                Staff
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Menu Button - shown only on mobile */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden fixed left-4 top-4 z-50"
            aria-label="Open navigation menu"
          >
            <Menu className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-64 bg-sidebar text-sidebar-foreground">
          <SidebarContent />
        </SheetContent>
      </Sheet>

      {/* Desktop Sidebar - hidden on mobile */}
      <aside className="hidden lg:flex fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar text-sidebar-foreground flex-col shadow-lg overflow-hidden">
        <SidebarContent />
      </aside>
    </>
  );
}



