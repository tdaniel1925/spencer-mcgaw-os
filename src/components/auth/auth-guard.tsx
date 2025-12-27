"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/supabase/auth-context";

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { loading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [showLoader, setShowLoader] = useState(false);

  // Only show loader after a brief delay to prevent flash
  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => setShowLoader(true), 200);
      return () => clearTimeout(timer);
    }
    setShowLoader(false);
  }, [loading]);

  useEffect(() => {
    // Wait until loading is complete before checking auth
    if (!loading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [loading, isAuthenticated, router]);

  // Show loading state only after delay (prevents flash for fast auth)
  if (loading && showLoader) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // While loading (before delay), render nothing briefly
  if (loading) {
    return null;
  }

  // Don't render children if not authenticated (redirect will happen)
  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
