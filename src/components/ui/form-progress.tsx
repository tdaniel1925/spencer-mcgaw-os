"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FormStep {
  id: string;
  label: string;
  description?: string;
}

interface FormProgressProps {
  steps: FormStep[];
  currentStep: number;
  className?: string;
}

export function FormProgress({ steps, currentStep, className }: FormProgressProps) {
  return (
    <nav aria-label="Progress" className={cn("w-full", className)}>
      <ol className="flex items-center">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isLast = index === steps.length - 1;

          return (
            <li
              key={step.id}
              className={cn("relative", !isLast && "flex-1")}
            >
              <div className="flex items-center">
                {/* Step Circle */}
                <div
                  className={cn(
                    "relative flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors",
                    isCompleted && "bg-primary border-primary",
                    isCurrent && "border-primary bg-background",
                    !isCompleted && !isCurrent && "border-muted-foreground/30 bg-background"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4 text-primary-foreground" />
                  ) : (
                    <span
                      className={cn(
                        "text-sm font-medium",
                        isCurrent && "text-primary",
                        !isCurrent && "text-muted-foreground"
                      )}
                    >
                      {index + 1}
                    </span>
                  )}
                </div>

                {/* Step Label (shown on larger screens) */}
                <div className="ml-3 hidden sm:block">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      isCompleted && "text-primary",
                      isCurrent && "text-foreground",
                      !isCompleted && !isCurrent && "text-muted-foreground"
                    )}
                  >
                    {step.label}
                  </p>
                  {step.description && (
                    <p className="text-xs text-muted-foreground">
                      {step.description}
                    </p>
                  )}
                </div>

                {/* Connector Line */}
                {!isLast && (
                  <div
                    className={cn(
                      "ml-3 flex-1 h-0.5 transition-colors",
                      isCompleted ? "bg-primary" : "bg-muted-foreground/30"
                    )}
                  />
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {/* Mobile Step Label */}
      <div className="mt-4 sm:hidden text-center">
        <p className="text-sm font-medium">{steps[currentStep]?.label}</p>
        <p className="text-xs text-muted-foreground">
          Step {currentStep + 1} of {steps.length}
        </p>
      </div>
    </nav>
  );
}

// Hook for managing form progress state
import { useState, useCallback } from "react";

interface UseFormProgressOptions {
  totalSteps: number;
  initialStep?: number;
}

export function useFormProgress({ totalSteps, initialStep = 0 }: UseFormProgressOptions) {
  const [currentStep, setCurrentStep] = useState(initialStep);

  const goToStep = useCallback((step: number) => {
    if (step >= 0 && step < totalSteps) {
      setCurrentStep(step);
    }
  }, [totalSteps]);

  const nextStep = useCallback(() => {
    setCurrentStep((prev) => Math.min(prev + 1, totalSteps - 1));
  }, [totalSteps]);

  const prevStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  return {
    currentStep,
    goToStep,
    nextStep,
    prevStep,
    isFirstStep,
    isLastStep,
  };
}
