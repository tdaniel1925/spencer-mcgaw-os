import { Sidebar } from "@/components/layout/sidebar";
import { AuthProvider } from "@/lib/supabase/auth-context";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <div className="pl-64">{children}</div>
      </div>
    </AuthProvider>
  );
}
