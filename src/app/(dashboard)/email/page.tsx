"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Email page now redirects to Email Intelligence
 * The AI-powered Email Intelligence system is the primary email view
 */
export default function EmailPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/email-intelligence");
  }, [router]);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Redirecting to Email Intelligence...</p>
      </div>
    </div>
  );
}
