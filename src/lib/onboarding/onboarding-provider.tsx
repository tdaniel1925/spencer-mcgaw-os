"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/supabase/auth-context";
import { OnboardingDialog } from "@/components/onboarding/onboarding-dialog";

interface OnboardingContextType {
  showOnboarding: boolean;
  setShowOnboarding: (show: boolean) => void;
  isCompleted: boolean;
  triggerOnboarding: () => void;
  resetOnboarding: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isCompleted, setIsCompleted] = useState(true); // Default to true to prevent flash
  const [isLoading, setIsLoading] = useState(true);

  // Check onboarding status on mount
  useEffect(() => {
    const checkOnboarding = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/user/onboarding");
        if (response.ok) {
          const data = await response.json();
          setIsCompleted(data.completed);

          // Show onboarding if not completed
          if (!data.completed) {
            // Small delay to let the page load first
            setTimeout(() => setShowOnboarding(true), 500);
          }
        }
      } catch (error) {
        console.error("[Onboarding] Error checking status:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkOnboarding();
  }, [user]);

  // Complete onboarding
  const handleComplete = useCallback(async () => {
    try {
      await fetch("/api/user/onboarding", { method: "POST" });
      setIsCompleted(true);
    } catch (error) {
      console.error("[Onboarding] Error completing:", error);
    }
  }, []);

  // Trigger onboarding manually (from menu)
  const triggerOnboarding = useCallback(() => {
    setShowOnboarding(true);
  }, []);

  // Reset onboarding (for admins/testing)
  const resetOnboarding = useCallback(async () => {
    try {
      await fetch("/api/user/onboarding", { method: "DELETE" });
      setIsCompleted(false);
      setShowOnboarding(true);
    } catch (error) {
      console.error("[Onboarding] Error resetting:", error);
    }
  }, []);

  return (
    <OnboardingContext.Provider
      value={{
        showOnboarding,
        setShowOnboarding,
        isCompleted,
        triggerOnboarding,
        resetOnboarding,
      }}
    >
      {children}
      {user && (
        <OnboardingDialog
          open={showOnboarding}
          onOpenChange={setShowOnboarding}
          userName={user.full_name || user.email || ""}
          onComplete={handleComplete}
        />
      )}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error("useOnboarding must be used within an OnboardingProvider");
  }
  return context;
}
