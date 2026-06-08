-- AI assistant conversations and message history

CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New chat',
  mode TEXT NOT NULL DEFAULT 'agent' CHECK (mode IN ('ask', 'agent')),
  execution_mode TEXT NOT NULL DEFAULT 'confirm' CHECK (execution_mode IN ('confirm', 'freewill')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  snippets JSONB NOT NULL DEFAULT '[]',
  pending_actions JSONB NOT NULL DEFAULT '[]',
  actions_performed JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'complete' CHECK (status IN ('complete', 'awaiting_start')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user ON ai_conversations(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation ON ai_messages(conversation_id, created_at ASC);

ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_conversations_admin_select ON ai_conversations
  FOR SELECT USING (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY ai_conversations_admin_insert ON ai_conversations
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY ai_conversations_admin_update ON ai_conversations
  FOR UPDATE USING (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY ai_conversations_admin_delete ON ai_conversations
  FOR DELETE USING (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY ai_messages_admin_select ON ai_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM ai_conversations c
      WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY ai_messages_admin_insert ON ai_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM ai_conversations c
      WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY ai_messages_admin_update ON ai_messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM ai_conversations c
      WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY ai_messages_admin_delete ON ai_messages
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM ai_conversations c
      WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
