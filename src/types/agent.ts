export type AgentMode = "ask" | "agent";
export type ExecutionMode = "confirm" | "freewill" | "recursive";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface PendingAction {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  label: string;
  description: string;
}

export interface DataSnippet {
  type: string;
  title: string;
  rows: Record<string, unknown>[];
}

export type MessageStatus = "complete" | "awaiting_start";

export interface AgentMessage extends ChatMessage {
  id: string;
  snippets?: DataSnippet[];
  pendingActions?: PendingAction[];
  actionsPerformed?: { action?: string; success?: boolean; assigned_to?: string; lead?: string }[];
  status?: MessageStatus;
  streaming?: boolean;
}

export interface AiConversation {
  id: string;
  user_id: string;
  title: string;
  mode: AgentMode;
  execution_mode: ExecutionMode;
  created_at: string;
  updated_at: string;
}

export interface AgentConfig {
  mode: AgentMode;
  execution: ExecutionMode;
}

export interface AiChatResponse {
  message: string;
  actionsPerformed?: { action?: string; success?: boolean; assigned_to?: string; lead?: string }[];
  pendingActions?: PendingAction[];
  snippets?: DataSnippet[];
}

export const AGENT_CAPABILITIES = [
  { icon: "search", label: "All leads & queue", desc: "Full lead database with pagination" },
  { icon: "users", label: "All reps & workloads", desc: "Every rep with assigned lead counts" },
  { icon: "chart", label: "Dashboard KPIs", desc: "Revenue, pipeline, win rate" },
  { icon: "assign", label: "Assign leads", desc: "Single or bulk assignment" },
  { icon: "edit", label: "Edit lead data", desc: "Update fields, segments & bulk edits" },
  { icon: "data", label: "Clients & payments", desc: "Pull CRM data snippets" },
] as const;

export const QUICK_PROMPTS = [
  "How many leads have Google Maps or website links?",
  "Give me a full CRM overview of leads and reps",
  "Show 15 leads that have both Google Maps and website links",
  "How many unassigned leads are in the queue?",
  "What are our dashboard KPIs?",
];
