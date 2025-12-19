export * from "./types";
export * from "./email-context";
export * from "./email-classifier";
// Note: ai-classifier, client-matcher, and assignment-engine use server-side imports
// Import them directly in server components/API routes:
// import { classifyEmailWithAI } from "@/lib/email/ai-classifier";
// import { matchEmailToClient } from "@/lib/email/client-matcher";
// import { determineAssignment } from "@/lib/email/assignment-engine";

// Email notification service (server-side only)
// import { emailTaskAssigned, emailTaskCompleted } from "@/lib/email/email-service";
