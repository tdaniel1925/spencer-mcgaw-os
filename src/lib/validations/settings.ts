import { z } from "zod";

/**
 * Validation schemas for settings endpoints
 */

// Profile settings validation
export const profileSchema = z.object({
  fullName: z.string().min(1, "Full name is required").max(255, "Full name must be less than 255 characters"),
  phone: z.string().max(20, "Phone number must be less than 20 characters").optional().or(z.literal("")),
  department: z.string().max(100, "Department must be less than 100 characters").optional().or(z.literal("")),
  jobTitle: z.string().max(100, "Job title must be less than 100 characters").optional().or(z.literal("")),
  bio: z.string().max(500, "Bio must be less than 500 characters").optional().or(z.literal("")),
});

export type ProfileInput = z.infer<typeof profileSchema>;

// Company settings validation
export const companySchema = z.object({
  companyName: z.string().min(1, "Company name is required").max(255, "Company name must be less than 255 characters"),
  address: z.string().max(500, "Address must be less than 500 characters").optional().or(z.literal("")),
  phone: z.string().max(20, "Phone number must be less than 20 characters").optional().or(z.literal("")),
  website: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  taxId: z.string().max(50, "Tax ID must be less than 50 characters").optional().or(z.literal("")),
});

export type CompanyInput = z.infer<typeof companySchema>;

// Password change validation
export const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password must be less than 100 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
}).refine((data) => data.newPassword !== data.currentPassword, {
  message: "New password must be different from current password",
  path: ["newPassword"],
});

export type PasswordInput = z.infer<typeof passwordSchema>;

// Call data management settings validation
export const callDataSchema = z.object({
  autoDeleteEnabled: z.boolean().optional(),
  deleteAfterDays: z.number().int().min(1, "Delete after days must be at least 1 day").max(365, "Delete after days must be less than 365 days").optional(),
  deleteOnDay: z.enum(["", "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]).optional(),
});

export type CallDataInput = z.infer<typeof callDataSchema>;

// Notification settings validation
export const notificationSchema = z.object({
  emailNewTask: z.boolean().optional(),
  emailTaskAssigned: z.boolean().optional(),
  emailTaskDueSoon: z.boolean().optional(),
  emailTaskOverdue: z.boolean().optional(),
  emailClientActivity: z.boolean().optional(),
  emailWeeklySummary: z.boolean().optional(),
  inappNewTask: z.boolean().optional(),
  inappTaskAssigned: z.boolean().optional(),
  inappTaskDueSoon: z.boolean().optional(),
  inappMentions: z.boolean().optional(),
  inappClientActivity: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  smsUrgentOnly: z.boolean().optional(),
  smsTaskDueSoon: z.boolean().optional(),
  quietHoursEnabled: z.boolean().optional(),
  quietHoursStart: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Must be valid time (HH:MM)").optional(),
  quietHoursEnd: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Must be valid time (HH:MM)").optional(),
  aiSuggestions: z.boolean().optional(),
  aiPrioritization: z.boolean().optional(),
  aiActionItemsExtracted: z.boolean().optional(),
});

export type NotificationInput = z.infer<typeof notificationSchema>;
