import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MICROSOFT_GRAPH_URL = "https://graph.microsoft.com/v1.0";

// AI classification categories
type EmailClassification =
  | "document_submission"
  | "question"
  | "urgent"
  | "appointment_request"
  | "complaint"
  | "new_client"
  | "internal"
  | "spam";

interface ProcessingResult {
  classification: EmailClassification;
  confidence: number;
  clientMatch?: {
    id: string;
    name: string;
  };
  actions: string[];
  taskCreated?: string;
  documentsExtracted?: number;
}

// Simple keyword-based classification (replace with actual AI in production)
function classifyEmail(subject: string, body: string, from: string): EmailClassification {
  const text = `${subject} ${body}`.toLowerCase();

  if (text.includes("urgent") || text.includes("asap") || text.includes("immediately") || text.includes("irs notice")) {
    return "urgent";
  }
  if (text.includes("w-2") || text.includes("w2") || text.includes("1099") || text.includes("tax return") || text.includes("attached") || text.includes("documents")) {
    return "document_submission";
  }
  if (text.includes("schedule") || text.includes("appointment") || text.includes("meeting") || text.includes("available")) {
    return "appointment_request";
  }
  if (text.includes("status") || text.includes("question") || text.includes("when") || text.includes("how") || text.includes("?")) {
    return "question";
  }
  if (text.includes("complaint") || text.includes("unhappy") || text.includes("disappointed") || text.includes("wrong")) {
    return "complaint";
  }
  if (text.includes("new client") || text.includes("interested in") || text.includes("services")) {
    return "new_client";
  }

  return "question"; // Default
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { emailId, autoProcess = true } = body;

    if (!emailId) {
      return NextResponse.json(
        { error: "Missing emailId" },
        { status: 400 }
      );
    }

    // Get email connection
    const { data: connection } = await supabase
      .from("email_connections")
      .select("*")
      .eq("user_id", user.id)
      .eq("provider", "microsoft")
      .single();

    if (!connection) {
      return NextResponse.json(
        { error: "Email not connected" },
        { status: 400 }
      );
    }

    // Fetch the full email from Microsoft Graph
    const emailResponse = await fetch(
      `${MICROSOFT_GRAPH_URL}/me/messages/${emailId}?$expand=attachments`,
      {
        headers: {
          Authorization: `Bearer ${connection.access_token}`,
        },
      }
    );

    if (!emailResponse.ok) {
      return NextResponse.json(
        { error: "Failed to fetch email" },
        { status: 500 }
      );
    }

    const email = await emailResponse.json();
    const senderEmail = email.from?.emailAddress?.address || "";

    // Try to match sender to a client
    const { data: clients } = await supabase
      .from("clients")
      .select("id, first_name, last_name, company_name, email")
      .ilike("email", senderEmail);

    const clientMatch = clients && clients.length > 0 ? {
      id: clients[0].id,
      name: clients[0].company_name || `${clients[0].first_name} ${clients[0].last_name}`,
    } : undefined;

    // Classify the email
    const classification = classifyEmail(
      email.subject || "",
      email.bodyPreview || "",
      senderEmail
    );

    const result: ProcessingResult = {
      classification,
      confidence: 0.85, // Placeholder - real AI would provide this
      clientMatch,
      actions: [],
    };

    if (!autoProcess) {
      // Just return classification without taking actions
      return NextResponse.json(result);
    }

    // Take automated actions based on classification
    const actions: string[] = [];

    // Handle attachments for document submissions
    if (classification === "document_submission" && email.attachments?.length > 0) {
      // In production: download attachments and save to documents table
      const docTypes = email.attachments.map((a: any) => a.name).join(", ");
      actions.push(`Extracted ${email.attachments.length} attachments: ${docTypes}`);
      result.documentsExtracted = email.attachments.length;

      // Log to documents table (simplified)
      for (const attachment of email.attachments) {
        await supabase.from("documents").insert({
          name: attachment.name,
          type: attachment.contentType,
          size: attachment.size,
          client_id: clientMatch?.id,
          source: "email",
          source_email_id: emailId,
          uploaded_by: user.id,
          status: "pending",
        });
      }
    }

    // Create tasks for certain classifications
    if (["urgent", "question", "complaint", "document_submission"].includes(classification)) {
      const taskTitle = classification === "urgent"
        ? `URGENT: Respond to ${clientMatch?.name || senderEmail}`
        : classification === "complaint"
        ? `Handle complaint from ${clientMatch?.name || senderEmail}`
        : classification === "document_submission"
        ? `Review documents from ${clientMatch?.name || senderEmail}`
        : `Follow up with ${clientMatch?.name || senderEmail}`;

      const priority = classification === "urgent" || classification === "complaint"
        ? "high"
        : "medium";

      const { data: task } = await supabase.from("tasks").insert({
        title: taskTitle,
        description: `Email subject: ${email.subject}\n\nPreview: ${email.bodyPreview}`,
        client_id: clientMatch?.id,
        source: "email",
        source_email_id: emailId,
        priority,
        status: "pending",
        created_by: user.id,
      }).select().single();

      if (task) {
        actions.push(`Created task: ${taskTitle}`);
        result.taskCreated = task.id;
      }
    }

    // Mark email as processed in our system
    await supabase.from("processed_emails").insert({
      email_id: emailId,
      user_id: user.id,
      classification,
      client_id: clientMatch?.id,
      actions_taken: actions,
      processed_at: new Date().toISOString(),
    });

    // Log activity
    await supabase.from("activity_log").insert({
      user_id: user.id,
      type: "email_processed",
      description: `Processed email: ${email.subject}`,
      client_id: clientMatch?.id,
      metadata: {
        emailId,
        classification,
        actions,
      },
    });

    result.actions = actions;

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error processing email:", error);
    return NextResponse.json(
      { error: "Failed to process email" },
      { status: 500 }
    );
  }
}
