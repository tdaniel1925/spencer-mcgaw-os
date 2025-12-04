"use client";

import { Sidebar } from "./sidebar";
import { Header } from "./header";

interface AppLayoutProps {
  children: React.ReactNode;
  title: string;
  /** Custom breadcrumb items to override auto-generated ones */
  breadcrumbItems?: Array<{ label: string; href?: string }>;
  /** Label for the current page (useful for dynamic pages) */
  currentPageLabel?: string;
}

export function AppLayout({ children, title, breadcrumbItems, currentPageLabel }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="pl-64">
        <Header title={title} breadcrumbItems={breadcrumbItems} currentPageLabel={currentPageLabel} />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
