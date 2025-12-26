/**
 * VAPI Webhook Handler
 *
 * This module handles incoming webhooks from VAPI for real-time call events.
 * Configure your webhook URL in the VAPI dashboard to point to /api/vapi/webhook
 *
 * Webhook Events:
 * - call.started: When a call begins
 * - call.ended: When a call ends
 * - transcript.update: Real-time transcript updates
 * - function.call: When the AI wants to execute a function
 */

import { db } from "@/db";
import { calls, tasks, activityLogs } from "@/db/schema";

export type WebhookEventType =
  | "call.started"
  | "call.ended"
  | "transcript.update"
  | "function.call"
  | "assistant.message"
  | "user.message";

export interface WebhookPayload {
  type: WebhookEventType;
  timestamp?: string | number; // For replay attack prevention
  call: {
    id: string;
    phoneNumber: string;
    direction: "inbound" | "outbound";
    status: string;
    duration?: number;
    transcript?: Array<{
      role: "assistant" | "user";
      message: string;
      timestamp: number;
    }>;
    summary?: string;
    recordingUrl?: string;
    metadata?: Record<string, any>;
  };
  message?: {
    role: "assistant" | "user";
    content: string;
  };
  functionCall?: {
    name: string;
    parameters: Record<string, any>;
  };
}

/**
 * Process incoming webhook from VAPI
 */
export async function processWebhook(payload: WebhookPayload): Promise<any> {
  switch (payload.type) {
    case "call.started":
      return handleCallStarted(payload);
    case "call.ended":
      return handleCallEnded(payload);
    case "function.call":
      return handleFunctionCall(payload);
    default:
      return { success: true };
  }
}

/**
 * Handle call started event
 */
async function handleCallStarted(payload: WebhookPayload) {
  const { call } = payload;

  // Create call record in database
  await db.insert(calls).values({
    vapiCallId: call.id,
    callerPhone: call.phoneNumber,
    status: "completed", // Will be updated when call ends
    direction: call.direction,
    metadata: call.metadata || {},
  });

  // Log activity
  await db.insert(activityLogs).values({
    type: call.direction === "inbound" ? "call_received" : "call_made",
    description: `${call.direction === "inbound" ? "Inbound" : "Outbound"} call ${call.direction === "inbound" ? "from" : "to"} ${call.phoneNumber}`,
    metadata: { vapiCallId: call.id },
  });

  return { success: true };
}

/**
 * Handle call ended event
 */
async function handleCallEnded(payload: WebhookPayload) {
  // Update call record with final details
  // Note: In production, you'd update the existing record
  return { success: true };
}

/**
 * Handle function call from AI agent
 * This is where you implement custom actions the AI can take during calls
 */
async function handleFunctionCall(payload: WebhookPayload) {
  const { functionCall } = payload;

  if (!functionCall) {
    return { error: "No function call data" };
  }

  switch (functionCall.name) {
    case "createTask":
      return handleCreateTask(functionCall.parameters);
    case "lookupClient":
      return handleLookupClient(functionCall.parameters);
    case "getDocumentStatus":
      return handleGetDocumentStatus(functionCall.parameters);
    case "scheduleCallback":
      return handleScheduleCallback(functionCall.parameters);
    case "transferCall":
      return handleTransferCall(functionCall.parameters);
    default:
      return { error: `Unknown function: ${functionCall.name}` };
  }
}

/**
 * Create a task from the phone call
 */
async function handleCreateTask(params: Record<string, any>) {
  const { title, description, priority, clientId } = params;

  await db.insert(tasks).values({
    title,
    description,
    priority: priority || "medium",
    source: "phone_call",
    clientId,
    status: "pending",
  });

  return {
    success: true,
    message: `Task "${title}" has been created and assigned to the team.`,
  };
}

/**
 * Look up client information
 */
async function handleLookupClient(params: Record<string, any>) {
  const { phoneNumber, name, email } = params;

  // In production, query the database for client info
  // For now, return a stub response
  return {
    success: true,
    client: {
      found: true,
      name: "John Smith",
      accountNumber: "CL001",
      assignedTo: "Hunter McGaw",
    },
    message: "Client found in the system.",
  };
}

/**
 * Get document status for a client
 */
async function handleGetDocumentStatus(params: Record<string, any>) {
  const { clientId, documentType, year } = params;

  // In production, query the database for document status
  return {
    success: true,
    status: "filed",
    message: `The ${year} ${documentType} has been filed and is available.`,
  };
}

/**
 * Schedule a callback
 */
async function handleScheduleCallback(params: Record<string, any>) {
  const { phoneNumber, preferredTime, reason } = params;

  // In production, create a calendar event or task for callback
  return {
    success: true,
    message: `A callback has been scheduled for ${preferredTime}. Someone from our team will call you back.`,
  };
}

/**
 * Transfer the call to a staff member
 */
async function handleTransferCall(params: Record<string, any>) {
  const { department, reason, urgent } = params;

  // Return the transfer destination
  // VAPI will handle the actual transfer
  const transferNumbers: Record<string, string> = {
    tax: "+15551234567", // Hunter's number
    bookkeeping: "+15551234568", // Britney's number
    general: "+15551234569", // Elizabeth's number
  };

  return {
    success: true,
    transferTo: transferNumbers[department] || transferNumbers.general,
    message: `Transferring you to our ${department} department now.`,
  };
}

/**
 * Define the functions available to the AI agent
 * This configuration should be set up in your VAPI assistant
 */
export const agentFunctions = [
  {
    name: "createTask",
    description:
      "Create a task for the office staff when a caller requests something that requires follow-up",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Brief title of the task",
        },
        description: {
          type: "string",
          description: "Detailed description of what needs to be done",
        },
        priority: {
          type: "string",
          enum: ["low", "medium", "high", "urgent"],
          description: "Priority level of the task",
        },
        clientId: {
          type: "string",
          description: "The client ID if known",
        },
      },
      required: ["title", "description"],
    },
  },
  {
    name: "lookupClient",
    description:
      "Look up a client in the system by phone number, name, or email",
    parameters: {
      type: "object",
      properties: {
        phoneNumber: { type: "string" },
        name: { type: "string" },
        email: { type: "string" },
      },
    },
  },
  {
    name: "getDocumentStatus",
    description: "Check the status of a document for a client",
    parameters: {
      type: "object",
      properties: {
        clientId: { type: "string" },
        documentType: {
          type: "string",
          enum: ["tax_return", "w2", "1099", "bank_statement"],
        },
        year: { type: "number" },
      },
      required: ["documentType"],
    },
  },
  {
    name: "scheduleCallback",
    description: "Schedule a callback for the caller",
    parameters: {
      type: "object",
      properties: {
        phoneNumber: { type: "string" },
        preferredTime: { type: "string" },
        reason: { type: "string" },
      },
      required: ["phoneNumber", "reason"],
    },
  },
  {
    name: "transferCall",
    description: "Transfer the call to a staff member",
    parameters: {
      type: "object",
      properties: {
        department: {
          type: "string",
          enum: ["tax", "bookkeeping", "general"],
        },
        reason: { type: "string" },
        urgent: { type: "boolean" },
      },
      required: ["department"],
    },
  },
];
