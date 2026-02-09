"use client";

import { useImpersonation } from "@/lib/impersonation/use-impersonation";
import { Button } from "@/components/ui/button";
import { AlertTriangle, User, X } from "lucide-react";
import { toast } from "sonner";

export function ImpersonationBanner() {
  const { isImpersonating, impersonatedUser, stopImpersonation } = useImpersonation();

  if (!isImpersonating || !impersonatedUser) {
    return null;
  }

  const handleStopImpersonation = async () => {
    const success = await stopImpersonation();
    if (!success) {
      toast.error("Failed to stop impersonation");
    }
  };

  return (
    <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-between shadow-lg z-50">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 flex-shrink-0" />
        <div className="flex items-center gap-2 text-sm font-medium">
          <span>Impersonating:</span>
          <div className="flex items-center gap-1.5 bg-white/20 px-2 py-1 rounded">
            <User className="h-4 w-4" />
            <span className="font-semibold">{impersonatedUser.fullName}</span>
            <span className="opacity-75">({impersonatedUser.email})</span>
          </div>
        </div>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={handleStopImpersonation}
        className="text-white hover:bg-white/20 h-8"
      >
        <X className="h-4 w-4 mr-2" />
        Stop Impersonating
      </Button>
    </div>
  );
}
