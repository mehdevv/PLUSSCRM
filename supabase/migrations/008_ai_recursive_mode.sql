-- Allow recursive execution mode for AI assistant

ALTER TABLE ai_conversations DROP CONSTRAINT IF EXISTS ai_conversations_execution_mode_check;
ALTER TABLE ai_conversations ADD CONSTRAINT ai_conversations_execution_mode_check
  CHECK (execution_mode IN ('confirm', 'freewill', 'recursive'));
