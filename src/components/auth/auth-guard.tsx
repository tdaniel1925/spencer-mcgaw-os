"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/supabase/auth-context";

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Wait until loading is complete before checking auth
    if (!loading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [loading, isAuthenticated, router]);

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render children if not authenticated (redirect will happen)
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
