/**
 * Reusable Form Field Component
 * Provides consistent validation, error handling, and accessibility
 */

import React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface FormFieldProps {
  /** Field label */
  label: string;
  /** Field name/id */
  name: string;
  /** Field type (text, email, password, etc.) */
  type?: "text" | "email" | "password" | "number" | "tel" | "url" | "textarea";
  /** Current value */
  value: string | number;
  /** Change handler */
  onChange: (value: string) => void;
  /** Blur handler for validation triggering */
  onBlur?: () => void;
  /** Placeholder text */
  placeholder?: string;
  /** Error message to display */
  error?: string;
  /** Help text to show below field */
  helpText?: string;
  /** Whether field is required */
  required?: boolean;
  /** Whether field is disabled */
  disabled?: boolean;
  /** Whether to show success indicator when valid */
  showSuccess?: boolean;
  /** Maximum length for input */
  maxLength?: number;
  /** Minimum length for input */
  minLength?: number;
  /** Additional CSS classes */
  className?: string;
  /** Textarea-specific: number of rows */
  rows?: number;
  /** Icon to show in tooltip (optional info icon) */
  tooltipContent?: string;
  /** Auto-focus on mount */
  autoFocus?: boolean;
}

export function FormField({
  label,
  name,
  type = "text",
  value,
  onChange,
  onBlur,
  placeholder,
  error,
  helpText,
  required = false,
  disabled = false,
  showSuccess = true,
  maxLength,
  minLength,
  className,
  rows = 4,
  tooltipContent,
  autoFocus = false,
}: FormFieldProps) {
  const hasError = !!error;
  const isValid = !hasError && showSuccess && value && String(value).length > 0;
  const showCharCount = maxLength && type === "textarea";

  return (
    <div className={cn("space-y-2", className)}>
      {/* Label Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label
            htmlFor={name}
            className={cn(
              "text-sm font-medium",
              hasError && "text-destructive"
            )}
          >
            {label}
            {required && (
              <span className="text-destructive ml-1" aria-label="required">
                *
              </span>
            )}
          </Label>

          {tooltipContent && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-xs">{tooltipContent}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {showCharCount && (
          <span className="text-xs text-muted-foreground">
            {String(value).length} / {maxLength}
          </span>
        )}
      </div>

      {/* Input Field with Validation Icons */}
      <div className="relative">
        {type === "textarea" ? (
          <Textarea
            id={name}
            name={name}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            placeholder={placeholder}
            disabled={disabled}
            maxLength={maxLength}
            rows={rows}
            autoFocus={autoFocus}
            aria-invalid={hasError}
            aria-describedby={
              hasError
                ? `${name}-error`
                : helpText
                ? `${name}-help`
                : undefined
            }
            className={cn(
              "resize-none",
              hasError && "border-destructive focus-visible:ring-destructive",
              isValid && "border-green-500 focus-visible:ring-green-500"
            )}
          />
        ) : (
          <Input
            id={name}
            name={name}
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            placeholder={placeholder}
            disabled={disabled}
            maxLength={maxLength}
            minLength={minLength}
            autoFocus={autoFocus}
            aria-invalid={hasError}
            aria-describedby={
              hasError
                ? `${name}-error`
                : helpText
                ? `${name}-help`
                : undefined
            }
            className={cn(
              hasError && "border-destructive focus-visible:ring-destructive pr-10",
              isValid && "border-green-500 focus-visible:ring-green-500 pr-10"
            )}
          />
        )}

        {/* Validation Icons */}
        {type !== "textarea" && (
          <>
            {hasError && (
              <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" />
            )}
            {isValid && (
              <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
            )}
          </>
        )}
      </div>

      {/* Error Message */}
      {hasError && (
        <p
          id={`${name}-error`}
          className="text-sm text-destructive flex items-start gap-1.5"
          role="alert"
        >
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </p>
      )}

      {/* Help Text */}
      {!hasError && helpText && (
        <p id={`${name}-help`} className="text-sm text-muted-foreground">
          {helpText}
        </p>
      )}
    </div>
  );
}

/**
 * Form validation helper functions
 */
export const validators = {
  required: (value: string | number) => {
    const str = String(value).trim();
    return str.length > 0 ? null : "This field is required";
  },

  email: (value: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value) ? null : "Please enter a valid email address";
  },

  phone: (value: string) => {
    const phoneRegex = /^[\d\s\-\(\)\+]+$/;
    const cleaned = value.replace(/\D/g, "");
    if (cleaned.length < 10) {
      return "Phone number must be at least 10 digits";
    }
    return phoneRegex.test(value) ? null : "Please enter a valid phone number";
  },

  minLength: (min: number) => (value: string) => {
    return value.length >= min
      ? null
      : `Must be at least ${min} characters`;
  },

  maxLength: (max: number) => (value: string) => {
    return value.length <= max
      ? null
      : `Must be no more than ${max} characters`;
  },

  url: (value: string) => {
    try {
      new URL(value);
      return null;
    } catch {
      return "Please enter a valid URL";
    }
  },

  number: (value: string | number) => {
    const num = Number(value);
    return !isNaN(num) ? null : "Please enter a valid number";
  },

  positiveNumber: (value: string | number) => {
    const num = Number(value);
    if (isNaN(num)) return "Please enter a valid number";
    return num > 0 ? null : "Must be greater than 0";
  },

  zipCode: (value: string) => {
    const zipRegex = /^\d{5}(-\d{4})?$/;
    return zipRegex.test(value) ? null : "Please enter a valid ZIP code (12345 or 12345-6789)";
  },

  ssn: (value: string) => {
    const ssnRegex = /^\d{3}-?\d{2}-?\d{4}$/;
    return ssnRegex.test(value) ? null : "Please enter a valid SSN (XXX-XX-XXXX)";
  },

  ein: (value: string) => {
    const einRegex = /^\d{2}-?\d{7}$/;
    return einRegex.test(value) ? null : "Please enter a valid EIN (XX-XXXXXXX)";
  },
};

/**
 * Compose multiple validators
 */
export function composeValidators(
  ...validators: Array<(value: any) => string | null>
) {
  return (value: any): string | null => {
    for (const validator of validators) {
      const error = validator(value);
      if (error) return error;
    }
    return null;
  };
}
