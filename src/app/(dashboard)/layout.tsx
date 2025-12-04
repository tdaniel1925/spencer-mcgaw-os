import { Sidebar } from "@/components/layout/sidebar";
import { AuthProvider } from "@/lib/supabase/auth-context";
import { AuditProvider } from "@/lib/audit/audit-context";
import { EmailProvider } from "@/lib/email/email-context";
import { CallProvider } from "@/lib/calls/call-context";
import { NotificationProvider } from "@/lib/notifications";
import { DashboardProvider } from "@/lib/dashboard";
import { FileProvider } from "@/lib/files";
import { AIAssistant } from "@/components/ai-assistant/ai-assistant";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // In production, these would come from an API/database
  const initialNotificationCounts = {
    general: 0,
    messages: 0,
    chat: 0,
  };

  const initialTaskProgress = {
    completed: 0,
    total: 0,
  };

  return (
    <AuthProvider>
      <AuditProvider>
        <EmailProvider>
          <CallProvider>
            <DashboardProvider>
              <FileProvider>
                <NotificationProvider
                  initialCounts={initialNotificationCounts}
                  initialTaskProgress={initialTaskProgress}
                >
                  <div className="min-h-screen bg-background">
                    <Sidebar />
                    {/* Responsive padding: no padding on mobile, pl-64 on desktop (lg+) */}
                    <div className="lg:pl-64 pt-14 lg:pt-0">{children}</div>
                    <AIAssistant />
                  </div>
                </NotificationProvider>
              </FileProvider>
            </DashboardProvider>
          </CallProvider>
        </EmailProvider>
      </AuditProvider>
    </AuthProvider>
  );
}
