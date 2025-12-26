import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { formatDistanceToNow, format } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Safe date formatting utilities to prevent RangeError crashes

export function safeFormatDistanceToNow(
  dateString: string | Date | null | undefined,
  options?: { addSuffix?: boolean }
): string {
  if (!dateString) return "Unknown";
  try {
    const date = typeof dateString === "string" ? new Date(dateString) : dateString;
    if (isNaN(date.getTime())) return "Unknown";
    return formatDistanceToNow(date, options);
  } catch {
    return "Unknown";
  }
}

export function safeFormatDate(
  dateString: string | Date | null | undefined,
  formatStr: string
): string | null {
  if (!dateString) return null;
  try {
    const date = typeof dateString === "string" ? new Date(dateString) : dateString;
    if (isNaN(date.getTime())) return null;
    return format(date, formatStr);
  } catch {
    return null;
  }
}

export function isValidDate(dateString: string | Date | null | undefined): boolean {
  if (!dateString) return false;
  try {
    const date = typeof dateString === "string" ? new Date(dateString) : dateString;
    return !isNaN(date.getTime());
  } catch {
    return false;
  }
}
