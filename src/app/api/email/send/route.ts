import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MICROSOFT_GRAPH_URL = "https://graph.microsoft.com/v1.0";

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
    const { to, cc, bcc, subject, content, contentType = "html", attachments = [], replyToId, saveToSentItems = true } = body;

    // Validate required fields
    if (!to || !to.length || !subject) {
      return NextResponse.json(
        { error: "Missing required fields: to, subject" },
        { status: 400 }
      );
    }

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

    // Send the email via Microsoft Graph
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${connection.access_token}`,
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
