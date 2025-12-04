"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Home, ChevronRight } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Fragment } from "react";

// Define human-readable labels for paths
const pathLabels: Record<string, string> = {
  dashboard: "Dashboard",
  tasks: "Tasks",
  email: "AI Email Tasks",
  calls: "AI Phone Agent",
  clients: "Clients",
  new: "Add New",
  documents: "Documents",
  analytics: "Analytics",
  calendar: "Calendar",
  activity: "Activity Log",
  settings: "Settings",
  admin: "Admin",
  users: "User Management",
  audit: "Audit Trail",
  system: "System Settings",
  support: "Help & Support",
};

interface PageBreadcrumbProps {
  /** Override the auto-generated breadcrumbs with custom items */
  customItems?: Array<{ label: string; href?: string }>;
  /** Additional item to append (useful for dynamic pages like /clients/CL001) */
  currentPageLabel?: string;
}

export function PageBreadcrumb({ customItems, currentPageLabel }: PageBreadcrumbProps) {
  const pathname = usePathname();

  // Generate breadcrumb items from pathname
  const generateBreadcrumbs = () => {
    if (customItems) {
      return customItems;
    }

    const segments = pathname.split("/").filter(Boolean);
    const items: Array<{ label: string; href?: string }> = [];

    let currentPath = "";
    segments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      const isLast = index === segments.length - 1;

      // Check if it's a dynamic segment (like CL001)
      const isDynamicSegment = /^[A-Z]{2}\d+$/.test(segment) || /^\d+$/.test(segment);

      // Get label for the segment
      let label = pathLabels[segment.toLowerCase()] || segment;

      // For dynamic segments, use currentPageLabel if provided
      if (isDynamicSegment && currentPageLabel && isLast) {
        label = currentPageLabel;
      } else if (isDynamicSegment) {
        // Format dynamic IDs nicely
        label = `#${segment}`;
      }

      items.push({
        label,
        href: isLast ? undefined : currentPath,
      });
    });

    return items;
  };

  const breadcrumbs = generateBreadcrumbs();

  // Don't show breadcrumbs on dashboard root
  if (pathname === "/dashboard" || pathname === "/") {
    return null;
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/dashboard" className="flex items-center gap-1">
              <Home className="h-3.5 w-3.5" />
              <span className="sr-only">Home</span>
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>

        {breadcrumbs.map((item, index) => (
          <Fragment key={index}>
            <BreadcrumbSeparator>
              <ChevronRight className="h-3.5 w-3.5" />
            </BreadcrumbSeparator>
            <BreadcrumbItem>
              {item.href ? (
                <BreadcrumbLink asChild>
                  <Link href={item.href}>{item.label}</Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>{item.label}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
