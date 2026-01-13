import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/shared/crypto";
import { z } from "zod";

const MICROSOFT_GRAPH_URL = "https://graph.microsoft.com/v1.0";

// Email validation schema
const emailSchema = z.string().email();
const emailArraySchema = z.array(emailSchema).min(1).max(50);

const sendEmailSchema = z.object({
  to: emailArraySchema,
  cc: z.array(emailSchema).max(50).optional(),
  bcc: z.array(emailSchema).max(50).optional(),
  subject: z.string().min(1).max(500),
  content: z.string().max(1000000), // 1MB max content
  contentType: z.enum(["html", "text"]).default("html"),
  attachments: z.array(z.object({
    name: z.string().max(255),
    contentType: z.string().max(100),
    content: z.string(), // Base64
  })).max(10).optional().default([]),
  replyToId: z.string().optional(),
  saveToSentItems: z.boolean().default(true),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Get email connection
  const { data: connection, error: connError } = await supabase
    .from("email_connections")
    .select("*")
    .eq("user_id", user.id)
    .eq("provider", "microsoft")
    .single();

  if (connError || !connection) {
    return NextResponse.json(
      { error: "Email not connected" },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();

    // Validate with Zod schema
    const parseResult = sendEmailSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { to, cc, bcc, subject, content, contentType, attachments, replyToId, saveToSentItems } = parseResult.data;

    // Build the email message
    const message: any = {
      subject,
      body: {
        contentType: contentType === "html" ? "HTML" : "Text",
        content,
      },
      toRecipients: to.map((email: string) => ({
        emailAddress: { address: email },
      })),
    };

    if (cc && cc.length) {
      message.ccRecipients = cc.map((email: string) => ({
        emailAddress: { address: email },
      }));
    }

    if (bcc && bcc.length) {
      message.bccRecipients = bcc.map((email: string) => ({
        emailAddress: { address: email },
      }));
    }

    // Handle attachments if present
    if (attachments.length > 0) {
      message.attachments = attachments.map((att: any) => ({
        "@odata.type": "#microsoft.graph.fileAttachment",
        name: att.name,
        contentType: att.contentType,
        contentBytes: att.content, // Base64 encoded
      }));
    }

    // Determine endpoint based on whether this is a reply
    let endpoint = `${MICROSOFT_GRAPH_URL}/me/sendMail`;
    let requestBody: any = { message, saveToSentItems };

    if (replyToId) {
      // If replying, use the reply endpoint
      endpoint = `${MICROSOFT_GRAPH_URL}/me/messages/${replyToId}/reply`;
      requestBody = {
        message: {
          body: message.body,
          toRecipients: message.toRecipients,
        },
      };
    }

    // Send the email via Microsoft Graph (decrypt stored token)
    const accessToken = decrypt(connection.access_token);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Graph API send error:", errorData);
      return NextResponse.json(
        { error: "Failed to send email", details: errorData },
        { status: response.status }
      );
    }

    // Log the activity
    await supabase.from("activity_log").insert({
      user_id: user.id,
      type: "email_sent",
      description: `Sent email: ${subject}`,
      metadata: {
        to,
        subject,
        replyToId,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Email sent successfully",
    });
  } catch (error) {
    console.error("Error sending email:", error);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}
