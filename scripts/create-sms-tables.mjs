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

async function createSMSTables() {
  const client = await pool.connect();

  try {
    console.log("Creating SMS tables...\n");

    // 1. SMS Conversations table (groups messages by contact)
    console.log("1. Creating sms_conversations table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS sms_conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        contact_id UUID NOT NULL REFERENCES client_contacts(id) ON DELETE CASCADE,
        client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        phone_number TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        is_opted_in BOOLEAN DEFAULT true,
        opted_in_at TIMESTAMPTZ,
        opted_out_at TIMESTAMPTZ,
        last_message_at TIMESTAMPTZ,
        last_message_preview TEXT,
        unread_count INTEGER DEFAULT 0,
        assigned_to UUID,
        is_priority BOOLEAN DEFAULT false,
        is_archived BOOLEAN DEFAULT false,
        tags TEXT[],
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(contact_id)
      );

      CREATE INDEX IF NOT EXISTS idx_sms_conversations_contact_id ON sms_conversations(contact_id);
      CREATE INDEX IF NOT EXISTS idx_sms_conversations_client_id ON sms_conversations(client_id);
      CREATE INDEX IF NOT EXISTS idx_sms_conversations_phone ON sms_conversations(phone_number);
      CREATE INDEX IF NOT EXISTS idx_sms_conversations_last_message ON sms_conversations(last_message_at DESC);
      CREATE INDEX IF NOT EXISTS idx_sms_conversations_unread ON sms_conversations(unread_count) WHERE unread_count > 0;
      CREATE INDEX IF NOT EXISTS idx_sms_conversations_assigned ON sms_conversations(assigned_to);
    `);
    console.log("   ✓ sms_conversations table created\n");

    // 2. SMS Messages table
    console.log("2. Creating sms_messages table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS sms_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID NOT NULL REFERENCES sms_conversations(id) ON DELETE CASCADE,
        contact_id UUID NOT NULL REFERENCES client_contacts(id) ON DELETE CASCADE,
        client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
        from_number TEXT NOT NULL,
        to_number TEXT NOT NULL,
        body TEXT NOT NULL,
        media_urls TEXT[],
        status TEXT DEFAULT 'pending',
        error_code TEXT,
        error_message TEXT,
        twilio_sid TEXT,
        sent_by UUID,
        sent_at TIMESTAMPTZ,
        delivered_at TIMESTAMPTZ,
        read_at TIMESTAMPTZ,
        scheduled_for TIMESTAMPTZ,
        is_scheduled BOOLEAN DEFAULT false,
        template_id UUID,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_sms_messages_conversation ON sms_messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_sms_messages_contact ON sms_messages(contact_id);
      CREATE INDEX IF NOT EXISTS idx_sms_messages_client ON sms_messages(client_id);
      CREATE INDEX IF NOT EXISTS idx_sms_messages_created ON sms_messages(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_sms_messages_twilio ON sms_messages(twilio_sid);
      CREATE INDEX IF NOT EXISTS idx_sms_messages_scheduled ON sms_messages(scheduled_for) WHERE is_scheduled = true;
      CREATE INDEX IF NOT EXISTS idx_sms_messages_status ON sms_messages(status);
    `);
    console.log("   ✓ sms_messages table created\n");

    // 3. SMS Templates table
    console.log("3. Creating sms_templates table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS sms_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        body TEXT NOT NULL,
        variables TEXT[],
        is_active BOOLEAN DEFAULT true,
        use_count INTEGER DEFAULT 0,
        created_by UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_sms_templates_category ON sms_templates(category);
      CREATE INDEX IF NOT EXISTS idx_sms_templates_active ON sms_templates(is_active);
    `);
    console.log("   ✓ sms_templates table created\n");

    // 4. SMS Canned Responses table (quick replies)
    console.log("4. Creating sms_canned_responses table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS sms_canned_responses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        shortcut TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        category TEXT,
        use_count INTEGER DEFAULT 0,
        created_by UUID,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_sms_canned_shortcut ON sms_canned_responses(shortcut);
    `);
    console.log("   ✓ sms_canned_responses table created\n");

    // 5. SMS Opt-out Log table (TCPA compliance)
    console.log("5. Creating sms_opt_out_log table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS sms_opt_out_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        phone_number TEXT NOT NULL,
        contact_id UUID REFERENCES client_contacts(id) ON DELETE SET NULL,
        action TEXT NOT NULL CHECK (action IN ('opt_in', 'opt_out')),
        method TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        recorded_by UUID,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_sms_opt_out_phone ON sms_opt_out_log(phone_number);
      CREATE INDEX IF NOT EXISTS idx_sms_opt_out_contact ON sms_opt_out_log(contact_id);
    `);
    console.log("   ✓ sms_opt_out_log table created\n");

    // 6. SMS Bulk Campaigns table
    console.log("6. Creating sms_bulk_campaigns table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS sms_bulk_campaigns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        template_id UUID REFERENCES sms_templates(id),
        message_body TEXT NOT NULL,
        status TEXT DEFAULT 'draft',
        scheduled_for TIMESTAMPTZ,
        sent_at TIMESTAMPTZ,
        total_recipients INTEGER DEFAULT 0,
        sent_count INTEGER DEFAULT 0,
        delivered_count INTEGER DEFAULT 0,
        failed_count INTEGER DEFAULT 0,
        filter_criteria JSONB DEFAULT '{}',
        created_by UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_sms_campaigns_status ON sms_bulk_campaigns(status);
      CREATE INDEX IF NOT EXISTS idx_sms_campaigns_scheduled ON sms_bulk_campaigns(scheduled_for);
    `);
    console.log("   ✓ sms_bulk_campaigns table created\n");

    // 7. SMS Campaign Recipients table
    console.log("7. Creating sms_campaign_recipients table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS sms_campaign_recipients (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_id UUID NOT NULL REFERENCES sms_bulk_campaigns(id) ON DELETE CASCADE,
        contact_id UUID NOT NULL REFERENCES client_contacts(id) ON DELETE CASCADE,
        phone_number TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        message_id UUID REFERENCES sms_messages(id),
        sent_at TIMESTAMPTZ,
        error_message TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_sms_campaign_recipients_campaign ON sms_campaign_recipients(campaign_id);
      CREATE INDEX IF NOT EXISTS idx_sms_campaign_recipients_contact ON sms_campaign_recipients(contact_id);
    `);
    console.log("   ✓ sms_campaign_recipients table created\n");

    // 8. SMS Auto-responders table
    console.log("8. Creating sms_auto_responders table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS sms_auto_responders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        trigger_type TEXT NOT NULL,
        trigger_keywords TEXT[],
        response_body TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true,
        active_hours_start TIME,
        active_hours_end TIME,
        active_days INTEGER[],
        priority INTEGER DEFAULT 0,
        use_count INTEGER DEFAULT 0,
        created_by UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_sms_auto_responders_active ON sms_auto_responders(is_active);
      CREATE INDEX IF NOT EXISTS idx_sms_auto_responders_trigger ON sms_auto_responders(trigger_type);
    `);
    console.log("   ✓ sms_auto_responders table created\n");

    // 9. SMS Settings table
    console.log("9. Creating sms_settings table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS sms_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        twilio_account_sid TEXT,
        twilio_auth_token TEXT,
        twilio_phone_number TEXT,
        default_sender_name TEXT,
        after_hours_message TEXT,
        business_hours_start TIME DEFAULT '09:00',
        business_hours_end TIME DEFAULT '17:00',
        business_days INTEGER[] DEFAULT '{1,2,3,4,5}',
        opt_out_keywords TEXT[] DEFAULT '{STOP, UNSUBSCRIBE, CANCEL, END, QUIT}',
        opt_in_keywords TEXT[] DEFAULT '{START, YES, UNSTOP}',
        auto_opt_out_reply TEXT DEFAULT 'You have been unsubscribed from SMS messages. Reply START to resubscribe.',
        compliance_footer TEXT,
        max_daily_messages INTEGER DEFAULT 1000,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log("   ✓ sms_settings table created\n");

    // 10. SMS Analytics table (daily aggregates)
    console.log("10. Creating sms_analytics table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS sms_analytics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        date DATE NOT NULL,
        messages_sent INTEGER DEFAULT 0,
        messages_received INTEGER DEFAULT 0,
        messages_delivered INTEGER DEFAULT 0,
        messages_failed INTEGER DEFAULT 0,
        unique_contacts INTEGER DEFAULT 0,
        opt_outs INTEGER DEFAULT 0,
        opt_ins INTEGER DEFAULT 0,
        avg_response_time_minutes DECIMAL(10,2),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(date)
      );

      CREATE INDEX IF NOT EXISTS idx_sms_analytics_date ON sms_analytics(date DESC);
    `);
    console.log("   ✓ sms_analytics table created\n");

    // 11. Enable RLS on all tables
    console.log("11. Enabling Row Level Security...");
    const tables = [
      'sms_conversations',
      'sms_messages',
      'sms_templates',
      'sms_canned_responses',
      'sms_opt_out_log',
      'sms_bulk_campaigns',
      'sms_campaign_recipients',
      'sms_auto_responders',
      'sms_settings',
      'sms_analytics'
    ];

    for (const table of tables) {
      await client.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
      await client.query(`
        DROP POLICY IF EXISTS "${table}_policy" ON ${table};
        CREATE POLICY "${table}_policy" ON ${table}
          FOR ALL
          TO authenticated
          USING (true)
          WITH CHECK (true);
      `);
    }
    console.log("   ✓ RLS enabled on all tables\n");

    // 12. Create updated_at triggers
    console.log("12. Creating updated_at triggers...");
    const tablesWithUpdatedAt = [
      'sms_conversations',
      'sms_templates',
      'sms_bulk_campaigns',
      'sms_auto_responders',
      'sms_settings'
    ];

    for (const table of tablesWithUpdatedAt) {
      await client.query(`
        DROP TRIGGER IF EXISTS update_${table}_updated_at ON ${table};
        CREATE TRIGGER update_${table}_updated_at
          BEFORE UPDATE ON ${table}
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
      `);
    }
    console.log("   ✓ Updated_at triggers created\n");

    // 13. Insert default templates
    console.log("13. Inserting default SMS templates...");
    const paymentReminderBody = 'Hi {{first_name}}, this is a friendly reminder that your invoice #{{invoice_number}} for ${{amount}} is due on {{due_date}}. - Spencer McGaw CPA';
    await client.query(`
      INSERT INTO sms_templates (name, category, body, variables) VALUES
        ('Document Reminder', 'tax', 'Hi {{first_name}}, this is a reminder that we still need your {{document_type}} for your {{tax_year}} tax return. Please upload it at your earliest convenience. - Spencer McGaw CPA', ARRAY['first_name', 'document_type', 'tax_year']),
        ('Appointment Confirmation', 'scheduling', 'Hi {{first_name}}, this confirms your appointment on {{date}} at {{time}}. Reply YES to confirm or call us to reschedule. - Spencer McGaw CPA', ARRAY['first_name', 'date', 'time']),
        ('Appointment Reminder', 'scheduling', 'Hi {{first_name}}, reminder: You have an appointment tomorrow at {{time}}. See you then! - Spencer McGaw CPA', ARRAY['first_name', 'time']),
        ('Tax Return Ready', 'tax', 'Great news {{first_name}}! Your {{tax_year}} tax return is ready for review. Please log in to your portal or call us to schedule a review meeting. - Spencer McGaw CPA', ARRAY['first_name', 'tax_year']),
        ('Payment Reminder', 'billing', $1, ARRAY['first_name', 'invoice_number', 'amount', 'due_date']),
        ('Deadline Alert', 'tax', 'Hi {{first_name}}, important reminder: The {{deadline_type}} deadline is {{date}}. Please contact us if you need assistance. - Spencer McGaw CPA', ARRAY['first_name', 'deadline_type', 'date']),
        ('Thank You', 'general', 'Thank you {{first_name}} for choosing Spencer McGaw CPA! We appreciate your business. Let us know if you have any questions.', ARRAY['first_name']),
        ('After Hours', 'auto', 'Thank you for your message. Our office hours are Mon-Fri 9AM-5PM. We will respond on the next business day. For urgent matters, please call our emergency line.', ARRAY[]::TEXT[])
      ON CONFLICT DO NOTHING;
    `, [paymentReminderBody]);
    console.log("   ✓ Default templates inserted\n");

    // 14. Insert default canned responses
    console.log("14. Inserting default canned responses...");
    await client.query(`
      INSERT INTO sms_canned_responses (shortcut, title, body, category) VALUES
        ('/thanks', 'Thank You', 'Thank you! Let me know if you need anything else.', 'general'),
        ('/received', 'Document Received', 'Got it! We have received your document and will process it shortly.', 'documents'),
        ('/call', 'Request Call', 'Of course! What time works best for a call?', 'scheduling'),
        ('/hours', 'Business Hours', 'Our office hours are Monday-Friday, 9AM-5PM. How can we help?', 'general'),
        ('/portal', 'Portal Link', 'You can access your client portal at: https://portal.spencermcgaw.com', 'general'),
        ('/deadline', 'Deadline Info', 'The tax filing deadline is April 15th. Extensions are available if needed.', 'tax'),
        ('/docs', 'Documents Needed', 'For your tax return, we typically need: W-2s, 1099s, mortgage interest statement, and any deduction receipts.', 'tax'),
        ('/appt', 'Schedule Appointment', 'I would be happy to schedule an appointment. What day and time work best for you?', 'scheduling')
      ON CONFLICT DO NOTHING;
    `);
    console.log("   ✓ Default canned responses inserted\n");

    // 15. Insert default auto-responder
    console.log("15. Inserting default auto-responder...");
    await client.query(`
      INSERT INTO sms_auto_responders (name, trigger_type, trigger_keywords, response_body, is_active, active_hours_start, active_hours_end, active_days, priority) VALUES
        ('After Hours', 'after_hours', ARRAY[]::TEXT[], 'Thank you for your message. Our office is currently closed. We will respond during business hours (Mon-Fri, 9AM-5PM). For urgent tax matters, please email urgent@spencermcgaw.com', true, '17:00', '09:00', ARRAY[1,2,3,4,5,6,7], 100),
        ('Stop Response', 'keyword', ARRAY['STOP', 'UNSUBSCRIBE', 'CANCEL'], 'You have been unsubscribed from SMS messages from Spencer McGaw CPA. Reply START to resubscribe.', true, NULL, NULL, NULL, 999)
      ON CONFLICT DO NOTHING;
    `);
    console.log("   ✓ Default auto-responders inserted\n");

    // 16. Insert default settings
    console.log("16. Inserting default SMS settings...");
    await client.query(`
      INSERT INTO sms_settings (
        default_sender_name,
        after_hours_message,
        business_hours_start,
        business_hours_end,
        business_days,
        compliance_footer
      ) VALUES (
        'Spencer McGaw CPA',
        'Our office is currently closed. We will respond during business hours.',
        '09:00',
        '17:00',
        ARRAY[1,2,3,4,5],
        'Msg&Data rates may apply. Reply STOP to opt out.'
      ) ON CONFLICT DO NOTHING;
    `);
    console.log("   ✓ Default settings inserted\n");

    console.log("========================================");
    console.log("All SMS tables created successfully!");
    console.log("========================================\n");

    console.log("Tables created:");
    console.log("  - sms_conversations (conversation threads)");
    console.log("  - sms_messages (individual messages)");
    console.log("  - sms_templates (message templates)");
    console.log("  - sms_canned_responses (quick replies)");
    console.log("  - sms_opt_out_log (TCPA compliance)");
    console.log("  - sms_bulk_campaigns (bulk messaging)");
    console.log("  - sms_campaign_recipients (campaign targets)");
    console.log("  - sms_auto_responders (auto-replies)");
    console.log("  - sms_settings (configuration)");
    console.log("  - sms_analytics (daily metrics)");

  } catch (error) {
    console.error("Error creating SMS tables:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

createSMSTables();
