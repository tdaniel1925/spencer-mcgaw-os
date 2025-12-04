-- Create email_training_feedback table
CREATE TABLE IF NOT EXISTS public.email_training_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  email_message_id TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  sender_domain TEXT NOT NULL,
  subject TEXT,
  original_classification TEXT NOT NULL,
  user_classification TEXT NOT NULL,
  original_category TEXT,
  created_by UUID REFERENCES auth.users(id)
);

-- Create email_sender_rules table
CREATE TABLE IF NOT EXISTS public.email_sender_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  rule_type TEXT NOT NULL,
  match_type TEXT NOT NULL,
  match_value TEXT NOT NULL,
  action TEXT NOT NULL,
  reason TEXT,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(rule_type, match_type, match_value)
);

-- Create app_settings table
CREATE TABLE IF NOT EXISTS public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.email_training_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_sender_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate
DROP POLICY IF EXISTS "Users can view all training feedback" ON public.email_training_feedback;
DROP POLICY IF EXISTS "Users can insert training feedback" ON public.email_training_feedback;
DROP POLICY IF EXISTS "Users can view all sender rules" ON public.email_sender_rules;
DROP POLICY IF EXISTS "Users can insert sender rules" ON public.email_sender_rules;
DROP POLICY IF EXISTS "Users can update sender rules" ON public.email_sender_rules;
DROP POLICY IF EXISTS "Users can view app settings" ON public.app_settings;
DROP POLICY IF EXISTS "Users can insert app settings" ON public.app_settings;
DROP POLICY IF EXISTS "Users can update app settings" ON public.app_settings;
DROP POLICY IF EXISTS "Users can delete app settings" ON public.app_settings;

-- Create policies for email_training_feedback
CREATE POLICY "Users can view all training feedback" ON public.email_training_feedback FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert training feedback" ON public.email_training_feedback FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

-- Create policies for email_sender_rules
CREATE POLICY "Users can view all sender rules" ON public.email_sender_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert sender rules" ON public.email_sender_rules FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can update sender rules" ON public.email_sender_rules FOR UPDATE TO authenticated USING (true);

-- Create policies for app_settings
CREATE POLICY "Users can view app settings" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert app settings" ON public.app_settings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update app settings" ON public.app_settings FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Users can delete app settings" ON public.app_settings FOR DELETE TO authenticated USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_email_training_feedback_sender_domain ON public.email_training_feedback(sender_domain);
CREATE INDEX IF NOT EXISTS idx_email_training_feedback_sender_email ON public.email_training_feedback(sender_email);
CREATE INDEX IF NOT EXISTS idx_email_sender_rules_match_value ON public.email_sender_rules(match_value);
CREATE INDEX IF NOT EXISTS idx_email_sender_rules_action ON public.email_sender_rules(action);
CREATE INDEX IF NOT EXISTS idx_app_settings_key ON public.app_settings(key);
