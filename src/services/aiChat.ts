import { supabase } from "@/lib/supabase";
import { friendlyAgentError } from "@/lib/agent-errors";
import type { AgentConfig, AiChatResponse, ChatMessage } from "@/types/agent";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type StreamEvent =
  | { type: "token"; content: string }
  | { type: "status"; message: string }
  | { type: "reset" }
  | { type: "done" } & AiChatResponse
  | { type: "error"; message: string; status?: number };

export interface StreamHandlers {
  onToken: (chunk: string) => void;
  onStatus?: (message: string) => void;
  onReset?: () => void;
}

async function agentFetch<T>(path: string, body: unknown, attempt = 0): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in");

  const res = await fetch(path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = await res.json().catch(() => ({})) as { error?: string } & T;

  if (res.ok) return payload;

  if (res.status === 429 && attempt < 4) {
    const retryHeader = Number(res.headers.get("Retry-After"));
    const waitSec = Number.isFinite(retryHeader) && retryHeader > 0
      ? retryHeader
      : 3 + attempt * 2;
    await sleep(waitSec * 1000);
    return agentFetch(path, body, attempt + 1);
  }

  if (res.status === 404 && path.startsWith("/api/")) {
    const fn = path.includes("execute") ? "ai-chat/execute" : "ai-chat";
    const { data, error } = await supabase.functions.invoke(fn, { body: body as Record<string, unknown> });
    if (error) throw new Error(friendlyAgentError(error.message));
    if (data?.error) throw new Error(friendlyAgentError(data.error as string));
    return data as T;
  }

  if (res.status === 429) {
    throw new Error(friendlyAgentError("rate limit"));
  }

  throw new Error(friendlyAgentError(payload.error || `Request failed (${res.status})`));
}

async function readSseStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onEvent: (event: StreamEvent) => void,
) {
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      const line = part.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      const raw = line.slice(5).trim();
      if (!raw) continue;
      try {
        onEvent(JSON.parse(raw) as StreamEvent);
      } catch {
        /* ignore */
      }
    }
  }
}

export async function streamAiChatMessage(
  messages: ChatMessage[],
  config: AgentConfig,
  handlers: StreamHandlers,
): Promise<AiChatResponse> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in");

  const res = await fetch("/api/ai-chat", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages,
      mode: config.mode,
      execution: config.execution,
      stream: true,
    }),
  });

  if (res.status === 404) {
    return sendAiChatMessage(messages, config);
  }

  if (!res.ok && res.headers.get("content-type")?.includes("application/json")) {
    const payload = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(friendlyAgentError(payload.error || `Request failed (${res.status})`));
  }

  if (!res.body) throw new Error("No stream body");

  let result: AiChatResponse | null = null;
  let streamError: string | null = null;

  await readSseStream(res.body.getReader(), (event) => {
    if (event.type === "token") handlers.onToken(event.content);
    if (event.type === "status") handlers.onStatus?.(event.message);
    if (event.type === "reset") handlers.onReset?.();
    if (event.type === "done") {
      result = {
        message: event.message,
        snippets: event.snippets,
        pendingActions: event.pendingActions,
        actionsPerformed: event.actionsPerformed,
      };
    }
    if (event.type === "error") streamError = event.message;
  });

  if (streamError) throw new Error(friendlyAgentError(streamError));
  if (!result) throw new Error(friendlyAgentError("Stream ended without a response"));
  return result;
}

export async function sendAiChatMessage(
  messages: ChatMessage[],
  config: AgentConfig,
): Promise<AiChatResponse> {
  return agentFetch<AiChatResponse>("/api/ai-chat", {
    messages,
    mode: config.mode,
    execution: config.execution,
  });
}

export async function executeAgentAction(
  tool: string,
  args: Record<string, unknown>,
): Promise<{ result: Record<string, unknown> }> {
  return agentFetch<{ result: Record<string, unknown> }>("/api/ai-chat/execute", { tool, args });
}

export async function executeAgentActionBatch(
  actions: { tool: string; args: Record<string, unknown> }[],
): Promise<{ results: { tool: string; result: Record<string, unknown> }[] }> {
  return agentFetch("/api/ai-chat/execute", { actions });
}

export type { ChatMessage, AiChatResponse };
