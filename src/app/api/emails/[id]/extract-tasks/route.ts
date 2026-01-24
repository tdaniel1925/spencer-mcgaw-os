/**
 * Extract Tasks from Email - AI-powered task generation
 *
 * @route POST /api/emails/[id]/extract-tasks
 */

import { NextRequest, NextResponse } from "next/server";
import { GraphEmailService } from "@/lib/email/graph-service";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const TASK_EXTRACTION_PROMPT = `You are an AI assistant for a CPA/accounting firm. Analyze the following email and extract actionable tasks.

For each task, provide:
1. title: Clear, concise task title (max 100 chars)
2. description: Detailed description of what needs to be done
3. priority: low, medium, high, or urgent
4. due_date: Suggested due date (ISO format) or null
5. category: tax_return, bookkeeping, payroll, client_communication, document_request, meeting, or other

Return ONLY a JSON array of tasks. If no tasks, return empty array [].

Example:
[
  {
    "title": "Prepare 2023 1040 for John Smith",
    "description": "Client has sent all W-2s and 1099s. Ready to prepare personal return.",
    "priority": "high",
    "due_date": "2024-04-15T00:00:00Z",
    "category": "tax_return"
  }
]

Email:
From: {from}
Subject: {subject}
Body: {body}`;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Fetch email
    const graphService = await GraphEmailService.fromConnection(user.id);
    if (!graphService) {
      return NextResponse.json(
        { error: "Email not connected", needsConnection: true },
        { status: 400 }
      );
    }

    const email = await graphService.getEmail(id);

    // Extract text content
    const bodyText =
      email.body.contentType === "html"
        ? email.body.content.replace(/<[^>]*>/g, " ").trim()
        : email.body.content;

    const prompt = TASK_EXTRACTION_PROMPT.replace("{from}", email.from.emailAddress.name)
      .replace("{subject}", email.subject)
      .replace("{body}", bodyText.slice(0, 2000)); // Limit to 2000 chars

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a helpful AI assistant that extracts actionable tasks from emails.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    });

    const responseText = completion.choices[0].message.content || "[]";

    // Parse JSON
    let tasks: Array<{
      title: string;
      description: string;
      priority: string;
      due_date: string | null;
      category: string;
    }> = [];

    try {
      tasks = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Failed to parse AI response:", responseText);
      return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
    }

    // Save tasks to database (if user wants to create them)
    // For now, just return the suggestions
    return NextResponse.json({
      tasks,
      emailId: id,
      emailSubject: email.subject,
    });
  } catch (error) {
    console.error("[API] Error extracting tasks:", error);
    return NextResponse.json({ error: "Failed to extract tasks" }, { status: 500 });
  }
}
