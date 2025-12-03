"use client";

import { Sidebar } from "./sidebar";
import { Header } from "./header";

interface AppLayoutProps {
  children: React.ReactNode;
  title: string;
  breadcrumb?: string;
}

export function AppLayout({ children, title, breadcrumb }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="pl-64">
        <Header title={title} breadcrumb={breadcrumb} />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
