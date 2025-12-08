import Anthropic from "@anthropic-ai/sdk";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/constants";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface ActionType {
  id: string;
  code: string;
  label: string;
  description: string;
}

interface ExtractedTask {
  title: string;
  description: string;
  action_type_code: string;
  priority: "urgent" | "high" | "medium" | "low";
  due_date?: string;
  confidence: number;
}

interface ExtractionResult {
  tasks: ExtractedTask[];
  client_match?: {
    name?: string;
    email?: string;
    company?: string;
  };
  summary: string;
}

export async function extractTasksFromEmail(
  emailContent: {
    subject: string;
    body: string;
    from: string;
    to: string;
    date: string;
  },
  actionTypes: ActionType[]
): Promise<ExtractionResult> {
  const actionTypesList = actionTypes
    .map((at) => `- ${at.code}: ${at.label} - ${at.description}`)
    .join("\n");

  const prompt = `You are an AI assistant that extracts actionable tasks from emails for a professional services firm.

Analyze the following email and extract any tasks that need to be completed.

Available action types:
${actionTypesList}

For each task, determine:
1. A clear, concise title (what needs to be done)
2. A description with context from the email
3. The most appropriate action type code
4. Priority level (urgent, high, medium, low) based on:
   - Deadlines mentioned
   - Urgency language used
   - Client importance
5. Due date if mentioned or implied

Also extract any client identification information (name, email, company).

EMAIL:
Subject: ${emailContent.subject}
From: ${emailContent.from}
To: ${emailContent.to}
Date: ${emailContent.date}

Body:
${emailContent.body}

Respond in JSON format:
{
  "tasks": [
    {
      "title": "string",
      "description": "string",
      "action_type_code": "string",
      "priority": "urgent|high|medium|low",
      "due_date": "YYYY-MM-DD or null",
      "confidence": 0.0-1.0
    }
  ],
  "client_match": {
    "name": "string or null",
    "email": "string or null",
    "company": "string or null"
  },
  "summary": "Brief summary of the email content"
}

Guidelines:
- Only extract actionable tasks, not informational content
- Be specific in task titles
- Include relevant context in descriptions
- Set confidence lower if the task is implicit rather than explicit
- If no tasks are found, return an empty tasks array
- Extract sender information for client matching`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    // Extract the text content from the response
    const textContent = response.content.find((block) => block.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text content in response");
    }

    // Parse the JSON response
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const result = JSON.parse(jsonMatch[0]) as ExtractionResult;
    return result;
  } catch (error) {
    console.error("Error extracting tasks from email:", error);
    throw error;
  }
}

export async function matchClientFromExtraction(
  extraction: ExtractionResult["client_match"],
  supabase: any
): Promise<string | null> {
  if (!extraction) return null;

  try {
    // Try matching by email first (most reliable)
    if (extraction.email) {
      const { data: byEmail } = await supabase
        .from("client_contacts")
        .select("id")
        .eq("email", extraction.email)
        .single();

      if (byEmail) return byEmail.id;
    }

    // Try matching by name
    if (extraction.name) {
      const nameParts = extraction.name.split(" ");
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(" ");

      const { data: byName } = await supabase
        .from("client_contacts")
        .select("id")
        .ilike("first_name", `%${firstName}%`)
        .ilike("last_name", `%${lastName}%`)
        .single();

      if (byName) return byName.id;
    }

    // Try matching by company
    if (extraction.company) {
      const { data: byCompany } = await supabase
        .from("client_contacts")
        .select("id")
        .ilike("company", `%${extraction.company}%`)
        .limit(1)
        .single();

      if (byCompany) return byCompany.id;
    }

    return null;
  } catch (error) {
    console.error("Error matching client:", error);
    return null;
  }
}

export async function createTasksFromExtraction(
  extraction: ExtractionResult,
  emailId: string,
  actionTypes: ActionType[],
  clientId: string | null,
  userId: string,
  supabase: any
): Promise<string[]> {
  const createdTaskIds: string[] = [];

  for (const task of extraction.tasks) {
    // Find the action type by code
    const actionType = actionTypes.find(
      (at) => at.code === task.action_type_code
    );

    if (!actionType) {
      console.warn(`Unknown action type: ${task.action_type_code}`);
      continue;
    }

    try {
      const { data: newTask, error } = await supabase
        .from("tasks")
        .insert({
          title: task.title,
          description: task.description,
          action_type_id: actionType.id,
          client_id: clientId,
          priority: task.priority,
          due_date: task.due_date || null,
          source_type: "email",
          source_email_id: emailId,
          source_metadata: {
            extraction_summary: extraction.summary,
          },
          ai_confidence: task.confidence,
          ai_extracted_data: {
            original_task: task,
            client_match: extraction.client_match,
          },
          status: "open",
          organization_id: DEFAULT_ORGANIZATION_ID,
          created_by: userId,
        })
        .select("id")
        .single();

      if (error) {
        console.error("Error creating task:", error);
        continue;
      }

      createdTaskIds.push(newTask.id);

      // Log activity
      await supabase.from("task_activity_log").insert({
        task_id: newTask.id,
        action: "created",
        details: {
          source: "ai_extraction",
          email_id: emailId,
          confidence: task.confidence,
        },
        performed_by: userId,
      });
    } catch (error) {
      console.error("Error creating task from extraction:", error);
    }
  }

  return createdTaskIds;
}
