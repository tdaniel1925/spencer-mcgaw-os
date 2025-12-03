"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  Phone,
  FileText,
  BarChart3,
  Calendar,
  MessageSquare,
  Activity,
  Settings,
  HelpCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
  children?: { title: string; href: string }[];
}

const mainNavItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Tasks",
    href: "/tasks",
    icon: ClipboardList,
    badge: 12,
  },
  {
    title: "Clients",
    href: "/clients",
    icon: Users,
    children: [
      { title: "Client List", href: "/clients" },
      { title: "Add Client", href: "/clients/new" },
    ],
  },
  {
    title: "Calls",
    href: "/calls",
    icon: Phone,
    badge: 3,
    children: [
      { title: "Call Log", href: "/calls" },
      { title: "Phone Agent", href: "/calls/agent" },
    ],
  },
  {
    title: "Documents",
    href: "/documents",
    icon: FileText,
  },
  {
    title: "Analytics",
    href: "/analytics",
    icon: BarChart3,
  },
  {
    title: "Calendar",
    href: "/calendar",
    icon: Calendar,
  },
  {
    title: "Activity Log",
    href: "/activity",
    icon: Activity,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

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

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar text-sidebar-foreground flex flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 px-6 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <span className="text-sidebar-primary-foreground font-bold text-sm">SM</span>
          </div>
          <div>
            <span className="font-semibold text-lg text-sidebar-foreground">
              McGaw CPA
            </span>
            <span className="text-xs text-sidebar-foreground/70 block -mt-1">
              Hub
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            const expanded = expandedItems.includes(item.title);
            const hasChildren = item.children && item.children.length > 0;

            return (
              <div key={item.title}>
                {hasChildren ? (
                  <button
                    onClick={() => toggleExpand(item.title)}
                    className={cn(
                      "flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      active
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5" />
                      <span>{item.title}</span>
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
                      <Icon className="h-5 w-5" />
                      <span>{item.title}</span>
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
                  <div className="ml-4 mt-1 space-y-1 border-l border-sidebar-border pl-4">
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
          })}
        </nav>
      </ScrollArea>

      {/* Bottom Stats Section */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-sidebar-foreground/70">Today&apos;s Tasks</span>
            <span className="text-sidebar-foreground">8/12</span>
          </div>
          <Progress value={66} className="h-1.5 bg-sidebar-accent" />
        </div>

        {/* Help Card */}
        <div className="bg-sidebar-accent rounded-xl p-4 relative overflow-hidden">
          <div className="relative z-10">
            <h4 className="font-semibold text-sidebar-accent-foreground text-sm mb-1">
              Need Help?
            </h4>
            <p className="text-xs text-sidebar-accent-foreground/70 mb-3">
              Contact support for assistance
            </p>
            <Link
              href="/support"
              className="inline-flex items-center gap-1 text-xs font-medium bg-sidebar-foreground/10 hover:bg-sidebar-foreground/20 text-sidebar-accent-foreground px-3 py-1.5 rounded-lg transition-colors"
            >
              <HelpCircle className="h-3 w-3" />
              Contact Us
            </Link>
          </div>
        </div>
      </div>
    </aside>
  );
}
