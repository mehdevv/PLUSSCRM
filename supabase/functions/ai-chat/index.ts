import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsResponse, jsonResponse } from "../_shared/cors.ts";
import { CRM_TOOLS, SYSTEM_PROMPT, executeCrmTool } from "../_shared/ai-chat-tools.ts";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";
const MAX_TOOL_ROUNDS = 6;

const NUMERIC_TOOL_FIELDS: Record<string, string[]> = {
  search_leads: ["limit"],
  get_queue_leads: ["limit"],
  get_clients: ["limit"],
  get_payments_summary: ["limit"],
};

function sanitizeToolArgs(toolName: string, args: Record<string, unknown>) {
  const out = { ...args };
  for (const field of NUMERIC_TOOL_FIELDS[toolName] ?? []) {
    if (out[field] != null && out[field] !== "") {
      const n = Number(out[field]);
      if (!Number.isNaN(n)) out[field] = n;
      else delete out[field];
    }
  }
  if (out.unassigned_only != null && typeof out.unassigned_only === "string") {
    out.unassigned_only = out.unassigned_only === "true";
  }
  return out;
}

function sanitizeToolCalls(toolCalls: { id: string; function: { name: string; arguments: string } }[]) {
  return toolCalls.map((toolCall) => {
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(toolCall.function.arguments || "{}");
    } catch { /* empty */ }
    return {
      ...toolCall,
      function: {
        ...toolCall.function,
        arguments: JSON.stringify(sanitizeToolArgs(toolCall.function.name, args)),
      },
    };
  });
}

type ChatMessage = { role: string; content: string };

async function callGroq(apiKey: string, messages: unknown[]) {
  const res = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      tools: CRM_TOOLS,
      tool_choice: "auto",
      temperature: 0.3,
      max_tokens: 2048,
    }),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (payload as { error?: { message?: string } })?.error?.message ?? `Groq API error (${res.status})`;
    throw new Error(msg);
  }
  return (payload as { choices?: { message?: Record<string, unknown> }[] }).choices?.[0]?.message;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse("ok");
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const groqApiKey = Deno.env.get("GROQ_API_KEY") ?? "";

    if (!groqApiKey) return jsonResponse({ error: "GROQ_API_KEY is not configured" }, 500);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Unauthorized" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") return jsonResponse({ error: "Admin access required" }, 403);

    const body = await req.json() as { messages?: ChatMessage[] };
    const messages = body.messages;
    if (!Array.isArray(messages) || !messages.length) {
      return jsonResponse({ error: "messages array is required" }, 400);
    }

    const chatMessages: unknown[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const actionsPerformed: unknown[] = [];
    let assistantMessage = "";

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await callGroq(groqApiKey, chatMessages);
      const toolCalls = response?.tool_calls as { id: string; function: { name: string; arguments: string } }[] | undefined;

      if (toolCalls?.length) {
        const sanitizedCalls = sanitizeToolCalls(toolCalls);
        chatMessages.push({ role: "assistant", content: response?.content ?? null, tool_calls: sanitizedCalls });

        for (const toolCall of sanitizedCalls) {
          let args: Record<string, unknown> = {};
          try {
            args = sanitizeToolArgs(toolCall.function.name, JSON.parse(toolCall.function.arguments || "{}"));
          } catch { /* empty */ }

          let result: unknown;
          try {
            result = await executeCrmTool(admin, toolCall.function.name, args);
            if (result && typeof result === "object" && "action" in result) {
              actionsPerformed.push(result);
            }
          } catch (err) {
            result = { error: err instanceof Error ? err.message : "Tool execution failed" };
          }

          chatMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        }
        continue;
      }

      assistantMessage = String(response?.content ?? "").trim() || "I couldn't generate a response. Please try again.";
      break;
    }

    if (!assistantMessage) {
      assistantMessage = "I reached the maximum number of steps. Please try a simpler request.";
    }

    return jsonResponse({ message: assistantMessage, actionsPerformed });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return jsonResponse({ error: message }, 500);
  }
});
