import { supabase } from "@/lib/supabase";
import type { AgentConfig, AgentMessage, DataSnippet, PendingAction } from "@/types/agent";

export interface AiConversation {
  id: string;
  user_id: string;
  title: string;
  mode: AgentConfig["mode"];
  execution_mode: AgentConfig["execution"];
  created_at: string;
  updated_at: string;
}

type DbMessage = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  snippets: DataSnippet[];
  pending_actions: PendingAction[];
  actions_performed: Record<string, unknown>[];
  status: "complete" | "awaiting_start";
  created_at: string;
};

function mapMessage(row: DbMessage): AgentMessage {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    snippets: row.snippets?.length ? row.snippets : undefined,
    pendingActions: row.pending_actions?.length ? row.pending_actions : undefined,
    actionsPerformed: row.actions_performed?.length ? row.actions_performed as AgentMessage["actionsPerformed"] : undefined,
    status: row.status,
  };
}

export async function listConversations(): Promise<AiConversation[]> {
  const { data, error } = await supabase
    .from("ai_conversations")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as AiConversation[];
}

export async function createConversation(config: AgentConfig, title = "New chat"): Promise<AiConversation> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("ai_conversations")
    .insert({
      user_id: user.id,
      title,
      mode: config.mode,
      execution_mode: config.execution,
    })
    .select()
    .single();
  if (error) throw error;
  return data as AiConversation;
}

export async function updateConversation(
  id: string,
  patch: Partial<Pick<AiConversation, "title" | "mode" | "execution_mode">>,
) {
  const { error } = await supabase
    .from("ai_conversations")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteConversation(id: string) {
  const { error } = await supabase.from("ai_conversations").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchMessages(conversationId: string): Promise<AgentMessage[]> {
  const { data, error } = await supabase
    .from("ai_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => mapMessage(r as DbMessage));
}

export async function insertMessage(
  conversationId: string,
  message: Omit<AgentMessage, "id"> & { id?: string },
): Promise<AgentMessage> {
  const payload = {
    id: message.id,
    conversation_id: conversationId,
    role: message.role,
    content: message.content,
    snippets: message.snippets ?? [],
    pending_actions: message.pendingActions ?? [],
    actions_performed: message.actionsPerformed ?? [],
    status: message.status ?? "complete",
  };

  const { data, error } = await supabase
    .from("ai_messages")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;

  await supabase
    .from("ai_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  return mapMessage(data as DbMessage);
}

export async function patchMessage(
  messageId: string,
  patch: Partial<Pick<AgentMessage, "content" | "snippets" | "pendingActions" | "actionsPerformed" | "status">>,
) {
  const dbPatch: Record<string, unknown> = {};
  if (patch.content != null) dbPatch.content = patch.content;
  if (patch.snippets != null) dbPatch.snippets = patch.snippets;
  if (patch.pendingActions != null) dbPatch.pending_actions = patch.pendingActions;
  if (patch.actionsPerformed != null) dbPatch.actions_performed = patch.actionsPerformed;
  if (patch.status != null) dbPatch.status = patch.status;

  const { error } = await supabase.from("ai_messages").update(dbPatch).eq("id", messageId);
  if (error) throw error;
}

export function titleFromMessage(text: string) {
  const t = text.trim().slice(0, 60);
  return t.length < text.trim().length ? `${t}…` : t || "New chat";
}
