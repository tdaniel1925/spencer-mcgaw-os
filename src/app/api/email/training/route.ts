import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Record training feedback when user marks email as relevant/rejected
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      emailMessageId,
      senderEmail,
      subject,
      originalClassification, // 'relevant' or 'rejected'
      userClassification,     // 'relevant' or 'rejected'
      originalCategory,       // spam, marketing, client_communication, etc.
    } = body;

    if (!emailMessageId || !senderEmail || !originalClassification || !userClassification) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Extract domain from email
    const senderDomain = senderEmail.split("@")[1]?.toLowerCase() || "";

    const { data, error } = await supabase
      .from("email_training_feedback")
      .insert({
        user_id: user.id,
        email_message_id: emailMessageId,
        sender_email: senderEmail.toLowerCase(),
        sender_domain: senderDomain,
        subject,
        original_classification: originalClassification,
        user_classification: userClassification,
        original_category: originalCategory,
      })
      .select()
      .single();

    if (error) {
      console.error("Error saving training feedback:", error);
      return NextResponse.json({ error: "Failed to save feedback" }, { status: 500 });
    }

    return NextResponse.json({ success: true, feedback: data });
  } catch (error) {
    console.error("Training feedback error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Get training stats and learned patterns
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    // Get domain-level learned patterns (aggregated from all users)
    const { data: domainPatterns, error: domainError } = await supabase
      .from("email_training_feedback")
      .select("sender_domain, user_classification")
      .order("created_at", { ascending: false });

    if (domainError) {
      console.error("Error fetching domain patterns:", domainError);
    }

    // Aggregate domain feedback
    const domainStats = new Map<string, { relevant: number; rejected: number }>();
    domainPatterns?.forEach((feedback) => {
      const stats = domainStats.get(feedback.sender_domain) || { relevant: 0, rejected: 0 };
      if (feedback.user_classification === "relevant") {
        stats.relevant++;
      } else {
        stats.rejected++;
      }
      domainStats.set(feedback.sender_domain, stats);
    });

    // Convert to learned rules (domains with strong consensus)
    const learnedDomains: { domain: string; action: "whitelist" | "blacklist"; confidence: number }[] = [];
    domainStats.forEach((stats, domain) => {
      const total = stats.relevant + stats.rejected;
      if (total >= 2) { // Minimum 2 samples
        const relevantRatio = stats.relevant / total;
        if (relevantRatio >= 0.8) {
          learnedDomains.push({ domain, action: "whitelist", confidence: relevantRatio });
        } else if (relevantRatio <= 0.2) {
          learnedDomains.push({ domain, action: "blacklist", confidence: 1 - relevantRatio });
        }
      }
    });

    // Get sender-level patterns
    const { data: senderPatterns, error: senderError } = await supabase
      .from("email_training_feedback")
      .select("sender_email, user_classification")
      .order("created_at", { ascending: false });

    if (senderError) {
      console.error("Error fetching sender patterns:", senderError);
    }

    // Aggregate sender feedback
    const senderStats = new Map<string, { relevant: number; rejected: number }>();
    senderPatterns?.forEach((feedback) => {
      const stats = senderStats.get(feedback.sender_email) || { relevant: 0, rejected: 0 };
      if (feedback.user_classification === "relevant") {
        stats.relevant++;
      } else {
        stats.rejected++;
      }
      senderStats.set(feedback.sender_email, stats);
    });

    // Convert to learned rules (senders with any feedback)
    const learnedSenders: { email: string; action: "whitelist" | "blacklist"; confidence: number }[] = [];
    senderStats.forEach((stats, email) => {
      const total = stats.relevant + stats.rejected;
      if (total >= 1) {
        const relevantRatio = stats.relevant / total;
        if (relevantRatio >= 0.5) {
          learnedSenders.push({ email, action: "whitelist", confidence: relevantRatio });
        } else {
          learnedSenders.push({ email, action: "blacklist", confidence: 1 - relevantRatio });
        }
      }
    });

    return NextResponse.json({
      learnedDomains: learnedDomains.sort((a, b) => b.confidence - a.confidence),
      learnedSenders: learnedSenders.sort((a, b) => b.confidence - a.confidence),
      totalFeedback: domainPatterns?.length || 0,
    });
  } catch (error) {
    console.error("Get training data error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
