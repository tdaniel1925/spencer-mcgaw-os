"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { AIAssistant } from "@/components/ai-assistant/ai-assistant";
import { AuthGuard } from "@/components/auth/auth-guard";

interface DashboardContentProps {
  children: React.ReactNode;
}

export function DashboardContent({ children }: DashboardContentProps) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <Sidebar />
        {/* Responsive padding: no padding on mobile, pl-64 on desktop (lg+) */}
        <div className="lg:pl-64 pt-14 lg:pt-0">{children}</div>
        <AIAssistant />
      </div>
    </AuthGuard>
  );
}
