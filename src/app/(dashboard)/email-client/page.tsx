"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * Email Client - Temporarily Disabled
 *
 * This full email client has been disabled due to OAuth provider limitations.
 * Currently redirecting to dashboard while we focus on the shared inbox workflow.
 *
 * For email functionality, please use Email Intelligence instead.
 */
export default function EmailClientPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <Loader2 className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Redirecting to dashboard...</p>
      </div>
    </div>
  );
}
