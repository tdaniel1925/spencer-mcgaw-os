"use client";

import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

interface WelcomeBannerProps {
  userName: string;
  message?: string;
  className?: string;
}

export function WelcomeBanner({
  userName,
  message = "Welcome back, your dashboard is ready!",
  className,
}: WelcomeBannerProps) {
  return (
    <div className={cn("relative overflow-hidden rounded-2xl bg-gradient-to-r from-accent/90 to-accent p-6 text-accent-foreground", className)}>
      <div className="relative z-10">
        <h2 className="text-2xl font-bold mb-1">Hello, {userName}</h2>
        <p className="text-accent-foreground/80 mb-4">{message}</p>
        <Button
          variant="secondary"
          className="bg-white/20 hover:bg-white/30 text-accent-foreground border-0"
        >
          Get Started
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>

      {/* Decorative elements */}
      <div className="absolute right-4 bottom-0 opacity-20">
        <svg
          width="200"
          height="140"
          viewBox="0 0 200 140"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="160" cy="100" r="80" fill="currentColor" />
          <circle cx="100" cy="60" r="40" fill="currentColor" />
        </svg>
      </div>
    </div>
  );
}
