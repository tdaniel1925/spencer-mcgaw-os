import { AuthProvider } from "@/lib/supabase/auth-context";
import { AuditProvider } from "@/lib/audit/audit-context";

export default function FullPageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <AuditProvider>
        <div className="min-h-screen bg-background">
          {children}
        </div>
      </AuditProvider>
    </AuthProvider>
  );
}
