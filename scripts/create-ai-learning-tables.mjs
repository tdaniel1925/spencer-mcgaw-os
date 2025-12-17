import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  host: "db.cyygkhwujcrbhzgjqipj.supabase.co",
  port: 5432,
  database: "postgres",
  user: "postgres",
  password: process.env.SUPABASE_DB_PASSWORD || "ttandSellaBella1234",
  ssl: { rejectUnauthorized: false },
});

async function createTables() {
  const client = await pool.connect();

  try {
    console.log("Creating AI learning tables...\n");

    // 1. Task AI Suggestions table - stores suggested tasks before approval
    console.log("Creating task_ai_suggestions table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS task_ai_suggestions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

        -- Source information
        source_type VARCHAR(50) NOT NULL, -- 'phone_call', 'email', 'form'
        source_id UUID, -- ID of call, email, etc.
        source_metadata JSONB DEFAULT '{}',

        -- Suggested task details
        suggested_title TEXT NOT NULL,
        suggested_description TEXT,
        suggested_action_type_id UUID REFERENCES task_action_types(id),
        suggested_client_id UUID REFERENCES clients(id),
        suggested_priority VARCHAR(20) DEFAULT 'medium',
        suggested_due_date DATE,
        suggested_assigned_to UUID REFERENCES user_profiles(id),

        -- AI analysis
        ai_reasoning TEXT, -- Why AI suggested this task
        ai_confidence DECIMAL(3,2) DEFAULT 0.5, -- 0.00 to 1.00
        ai_category VARCHAR(100), -- Call category that triggered suggestion
        ai_keywords TEXT[], -- Keywords that influenced the suggestion
        ai_pattern_matches JSONB DEFAULT '[]', -- Which learned patterns matched

        -- Status tracking
        status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'declined', 'expired'

        -- Review outcome
        reviewed_by UUID REFERENCES user_profiles(id),
        reviewed_at TIMESTAMP WITH TIME ZONE,
        review_action VARCHAR(20), -- 'approved', 'declined', 'modified', 'reassigned'
        decline_reason TEXT, -- Required when declined
        decline_category VARCHAR(50), -- 'not_needed', 'duplicate', 'wrong_type', 'wrong_assignee', 'other'

        -- If approved, link to created task
        created_task_id UUID REFERENCES tasks(id),

        -- If modified during approval
        modifications JSONB, -- What was changed from suggestion

        -- Timestamps
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);
    console.log("  ✓ task_ai_suggestions created\n");

    // 2. Task AI Feedback table - tracks all user decisions for learning
    console.log("Creating task_ai_feedback table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS task_ai_feedback (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

        -- What triggered this feedback
        feedback_type VARCHAR(50) NOT NULL, -- 'suggestion_reviewed', 'task_reassigned', 'task_completed', 'task_cancelled'
        suggestion_id UUID REFERENCES task_ai_suggestions(id),
        task_id UUID REFERENCES tasks(id),

        -- Context at time of feedback
        source_type VARCHAR(50), -- 'phone_call', 'email', 'form'
        source_id UUID,
        call_category VARCHAR(100),
        call_keywords TEXT[],
        client_id UUID REFERENCES clients(id),
        caller_phone VARCHAR(50),

        -- AI's original suggestion
        ai_suggested_action VARCHAR(50), -- What AI suggested
        ai_suggested_assignee UUID REFERENCES user_profiles(id),
        ai_suggested_priority VARCHAR(20),
        ai_confidence DECIMAL(3,2),

        -- User's actual decision
        user_action VARCHAR(50) NOT NULL, -- 'approved', 'declined', 'modified', 'reassigned', 'completed', 'cancelled'
        user_assigned_to UUID REFERENCES user_profiles(id),
        user_priority VARCHAR(20),

        -- Learning signals
        was_ai_correct BOOLEAN, -- Did user accept AI suggestion as-is?
        correction_type VARCHAR(50), -- 'assignee', 'priority', 'action_type', 'not_needed', etc.
        correction_reason TEXT,

        -- Who provided feedback
        feedback_by UUID REFERENCES user_profiles(id),
        feedback_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

        -- Metadata for pattern extraction
        metadata JSONB DEFAULT '{}'
      )
    `);
    console.log("  ✓ task_ai_feedback created\n");

    // 3. Task AI Patterns table - stores learned patterns for auto-assignment
    console.log("Creating task_ai_patterns table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS task_ai_patterns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

        -- Pattern matching criteria
        pattern_type VARCHAR(50) NOT NULL, -- 'category_to_user', 'client_to_user', 'keyword_to_action', 'time_based'

        -- Match conditions (any combination)
        match_call_category VARCHAR(100),
        match_keywords TEXT[],
        match_client_id UUID REFERENCES clients(id),
        match_caller_phone VARCHAR(50),
        match_time_range JSONB, -- { "start": "09:00", "end": "17:00", "days": ["mon", "tue"] }
        match_source_type VARCHAR(50),

        -- Suggested action when pattern matches
        suggest_assigned_to UUID REFERENCES user_profiles(id),
        suggest_action_type_id UUID REFERENCES task_action_types(id),
        suggest_priority VARCHAR(20),
        suggest_create_task BOOLEAN DEFAULT true, -- Should a task be created?

        -- Learning metrics
        times_matched INTEGER DEFAULT 0,
        times_accepted INTEGER DEFAULT 0,
        times_rejected INTEGER DEFAULT 0,
        acceptance_rate DECIMAL(3,2) DEFAULT 0.5,
        confidence_score DECIMAL(3,2) DEFAULT 0.5,

        -- Status
        is_active BOOLEAN DEFAULT true,
        requires_review BOOLEAN DEFAULT true, -- If false, auto-apply
        min_confidence_for_auto DECIMAL(3,2) DEFAULT 0.85, -- Auto-apply threshold

        -- Audit
        learned_from_feedback_ids UUID[],
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        last_matched_at TIMESTAMP WITH TIME ZONE
      )
    `);
    console.log("  ✓ task_ai_patterns created\n");

    // 4. Create indexes for performance
    console.log("Creating indexes...");

    await client.query(`CREATE INDEX IF NOT EXISTS idx_ai_suggestions_status ON task_ai_suggestions(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ai_suggestions_source ON task_ai_suggestions(source_type, source_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ai_suggestions_created ON task_ai_suggestions(created_at DESC)`);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_ai_feedback_type ON task_ai_feedback(feedback_type)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ai_feedback_category ON task_ai_feedback(call_category)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ai_feedback_client ON task_ai_feedback(client_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ai_feedback_date ON task_ai_feedback(feedback_at DESC)`);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_ai_patterns_type ON task_ai_patterns(pattern_type)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ai_patterns_active ON task_ai_patterns(is_active)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ai_patterns_category ON task_ai_patterns(match_call_category)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ai_patterns_client ON task_ai_patterns(match_client_id)`);

    console.log("  ✓ Indexes created\n");

    // 5. Add source_call_id to tasks table if not exists
    console.log("Adding source_call_id to tasks table...");
    try {
      await client.query(`
        ALTER TABLE tasks
        ADD COLUMN IF NOT EXISTS source_call_id UUID REFERENCES calls(id)
      `);
      console.log("  ✓ source_call_id added to tasks\n");
    } catch (e) {
      console.log("  - source_call_id may already exist\n");
    }

    console.log("✅ All AI learning tables created successfully!");
  } finally {
    client.release();
    await pool.end();
  }
}

createTables().catch((err) => {
  console.error("Error creating tables:", err);
  process.exit(1);
});
