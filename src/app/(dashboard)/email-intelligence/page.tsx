"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * Email Intelligence - Redirects to Dashboard
 *
 * This feature has been consolidated into the Dashboard's AI Task Suggestions widget.
 * All email-based task suggestions now appear on the main dashboard.
 */
export default function EmailIntelligencePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <Loader2 className="animate-spin h-8 w-8 mx-auto mb-4" />
        <p className="text-muted-foreground">Redirecting to dashboard...</p>
        <p className="text-sm text-muted-foreground mt-2">
          Email Intelligence is now part of AI Task Suggestions
        </p>
      </div>
    </div>
  );
}
