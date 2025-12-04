import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();

  // Check if user is admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Check admin role
  const { data: userData } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (userData?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    // Create email_training_feedback table (shared across all users)
    const { error: feedbackError } = await supabase.rpc("exec_sql", {
      sql: `
        CREATE TABLE IF NOT EXISTS email_training_feedback (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
          email_message_id TEXT NOT NULL,
          sender_email TEXT NOT NULL,
          sender_domain TEXT NOT NULL,
          subject TEXT,
          original_classification TEXT NOT NULL,
          user_classification TEXT NOT NULL,
          original_category TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          CONSTRAINT valid_user_classification CHECK (user_classification IN ('relevant', 'rejected'))
        );

        CREATE INDEX IF NOT EXISTS idx_training_feedback_sender_domain ON email_training_feedback(sender_domain);
        CREATE INDEX IF NOT EXISTS idx_training_feedback_sender_email ON email_training_feedback(sender_email);
        CREATE INDEX IF NOT EXISTS idx_training_feedback_created ON email_training_feedback(created_at DESC);
      `
    });

    // Create sender_rules table (shared whitelist/blacklist)
    const { error: rulesError } = await supabase.rpc("exec_sql", {
      sql: `
        CREATE TABLE IF NOT EXISTS email_sender_rules (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
          rule_type TEXT NOT NULL,
          match_type TEXT NOT NULL,
          match_value TEXT NOT NULL,
          action TEXT NOT NULL,
          reason TEXT,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          CONSTRAINT valid_rule_type CHECK (rule_type IN ('email', 'domain')),
          CONSTRAINT valid_match_type CHECK (match_type IN ('exact', 'contains', 'ends_with')),
          CONSTRAINT valid_action CHECK (action IN ('whitelist', 'blacklist')),
          UNIQUE(rule_type, match_type, match_value)
        );

        CREATE INDEX IF NOT EXISTS idx_sender_rules_match ON email_sender_rules(match_value);
        CREATE INDEX IF NOT EXISTS idx_sender_rules_action ON email_sender_rules(action);
        CREATE INDEX IF NOT EXISTS idx_sender_rules_active ON email_sender_rules(is_active) WHERE is_active = true;
      `
    });

    // If RPC doesn't exist, try direct SQL
    if (feedbackError || rulesError) {
      // Fallback: Create tables via raw query approach
      // This might fail if the tables already exist, which is fine

      return NextResponse.json({
        message: "Migration attempted. Please run the following SQL in Supabase dashboard:",
        sql: `
-- Email Training Feedback table (shared across all users for ML)
CREATE TABLE IF NOT EXISTS email_training_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email_message_id TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  sender_domain TEXT NOT NULL,
  subject TEXT,
  original_classification TEXT NOT NULL,
  user_classification TEXT NOT NULL,
  original_category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_user_classification CHECK (user_classification IN ('relevant', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_training_feedback_sender_domain ON email_training_feedback(sender_domain);
CREATE INDEX IF NOT EXISTS idx_training_feedback_sender_email ON email_training_feedback(sender_email);
CREATE INDEX IF NOT EXISTS idx_training_feedback_created ON email_training_feedback(created_at DESC);

-- Sender Rules table (shared whitelist/blacklist)
CREATE TABLE IF NOT EXISTS email_sender_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rule_type TEXT NOT NULL,
  match_type TEXT NOT NULL,
  match_value TEXT NOT NULL,
  action TEXT NOT NULL,
  reason TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_rule_type CHECK (rule_type IN ('email', 'domain')),
  CONSTRAINT valid_match_type CHECK (match_type IN ('exact', 'contains', 'ends_with')),
  CONSTRAINT valid_action CHECK (action IN ('whitelist', 'blacklist')),
  UNIQUE(rule_type, match_type, match_value)
);

CREATE INDEX IF NOT EXISTS idx_sender_rules_match ON email_sender_rules(match_value);
CREATE INDEX IF NOT EXISTS idx_sender_rules_action ON email_sender_rules(action);
CREATE INDEX IF NOT EXISTS idx_sender_rules_active ON email_sender_rules(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE email_training_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_sender_rules ENABLE ROW LEVEL SECURITY;

-- Policies: All authenticated users can read rules, admins can modify
CREATE POLICY "Users can read training feedback" ON email_training_feedback FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert training feedback" ON email_training_feedback FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read sender rules" ON email_sender_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage sender rules" ON email_sender_rules FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
        `,
        errors: { feedbackError, rulesError }
      });
    }

    return NextResponse.json({
      success: true,
      message: "Email training tables created successfully"
    });

  } catch (error) {
    console.error("Migration error:", error);
    return NextResponse.json({ error: "Migration failed", details: error }, { status: 500 });
  }
}
