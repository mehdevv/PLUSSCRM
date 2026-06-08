import {
  getToolsForMode,
  buildSystemPrompt,
  executeCrmTool,
  previewWriteAction,
  extractSnippets,
  WRITE_TOOL_NAMES,
} from "./ai-chat-tools.mjs";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODELS = ["llama-3.1-8b-instant", "llama-3.3-70b-versatile"];
const MAX_TOOL_ROUNDS = 4;
const MAX_HISTORY = 6;
const MAX_TOOL_JSON_CHARS = 5000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMs(message) {
  const seconds = message?.match(/try again in ([\d.]+)s/i);
  if (seconds) return Math.ceil(Number(seconds[1]) * 1000) + 800;
  const ms = message?.match(/try again in ([\d.]+)ms/i);
  if (ms) return Math.ceil(Number(ms[1])) + 800;
  return 3000;
}

const PRESERVE_FULL_TOOLS = new Set([
  "query_lead_segment",
  "get_leads_full",
  "get_lead_details",
  "search_leads",
  "count_lead_segment",
]);

function compactLead(lead) {
  if (!lead || typeof lead !== "object") return lead;
  return {
    id: lead.id,
    name: lead.name,
    company: lead.company,
    status: lead.status,
    assigned_to: lead.assigned_to,
    value: lead.value,
    email: lead.email,
    phone: lead.phone,
    google_maps_link: lead.google_maps_link ?? null,
    website_link: lead.website_link ?? null,
    has_google_maps: lead.has_google_maps,
    has_website: lead.has_website,
  };
}

function compactToolResult(result) {
  if (!result || typeof result !== "object") return result;
  const out = { ...result };
  const trimList = (key, max = 20) => {
    if (!Array.isArray(out[key])) return;
    const total = out[key].length;
    out[key] = out[key].slice(0, max).map((row) => (
      row?.company != null || row?.status != null ? compactLead(row) : row
    ));
    if (total > max) out[`${key}_truncated`] = total - max;
  };

  trimList("leads");
  trimList("queue");
  trimList("payments", 15);
  if (Array.isArray(out.reps) && out.reps.length > 30) {
    out.reps = out.reps.slice(0, 30);
    out.reps_truncated = result.reps.length - 30;
  }
  if (out.lead && typeof out.lead === "object") out.lead = compactLead(out.lead);

  let json = JSON.stringify(out);
  if (json.length > MAX_TOOL_JSON_CHARS) {
    return {
      _truncated: true,
      preview: json.slice(0, MAX_TOOL_JSON_CHARS),
      note: "Result shortened for token limits — use smaller limits or pagination",
    };
  }
  return out;
}

function stringifyToolResult(result, toolName) {
  if (PRESERVE_FULL_TOOLS.has(toolName)) {
    const json = JSON.stringify(result);
    const max = toolName === "get_leads_full" ? 14000 : 12000;
    if (json.length <= max) return json;
    if (toolName === "get_leads_full") {
      return JSON.stringify({ error: "Too much data — request fewer lead_ids (max 10 per call)" });
    }
  }

  return JSON.stringify(compactToolResult(result));
}

function isRateLimitMessage(message) {
  return /rate limit|too many requests|tokens per minute/i.test(message ?? "");
}

const NUMERIC_TOOL_FIELDS = {
  search_leads: ["limit"],
  list_all_leads: ["limit", "offset"],
  query_lead_segment: ["limit", "offset"],
  get_queue_leads: ["limit"],
  get_clients: ["limit"],
  get_payments_summary: ["limit"],
  update_lead: ["value"],
};

function sanitizeToolArgs(toolName, args) {
  const out = { ...args };
  for (const field of NUMERIC_TOOL_FIELDS[toolName] ?? []) {
    if (out[field] != null && out[field] !== "") {
      const n = Number(out[field]);
      if (!Number.isNaN(n)) out[field] = n;
      else delete out[field];
    }
  }
  for (const field of [
    "unassigned_only", "has_google_maps", "has_website", "has_both_links", "has_any_link", "missing_links",
  ]) {
    if (out[field] != null && typeof out[field] === "string") {
      out[field] = out[field] === "true";
    }
  }
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (toolName === "get_leads_full" && Array.isArray(out.lead_ids)) {
    out.lead_ids = out.lead_ids.filter((id) => typeof id === "string" && uuidRe.test(id));
  }
  if ((toolName === "get_lead_details" || toolName === "update_lead") && out.lead_id && !uuidRe.test(String(out.lead_id))) {
    delete out.lead_id;
  }
  return out;
}

function sanitizeToolCalls(toolCalls) {
  return toolCalls.map((toolCall) => {
    const fn = toolCall.function;
    let args = {};
    try {
      args = JSON.parse(fn.arguments || "{}");
    } catch {
      args = {};
    }
    return {
      ...toolCall,
      function: {
        ...fn,
        arguments: JSON.stringify(sanitizeToolArgs(fn.name, args)),
      },
    };
  });
}

async function callGroq(apiKey, messages, tools, model) {
  const res = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      tools,
      tool_choice: "auto",
      temperature: 0.2,
      max_tokens: 768,
    }),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = payload?.error?.message ?? `Groq API error (${res.status})`;
    const err = new Error(msg);
    err.isRateLimit = res.status === 429 || isRateLimitMessage(msg);
    throw err;
  }

  const message = payload.choices?.[0]?.message;
  if (!message) throw new Error("Empty AI response");
  return message;
}

async function callGroqWithRetry(apiKey, messages, tools) {
  let lastError;
  for (const model of GROQ_MODELS) {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await callGroq(apiKey, messages, tools, model);
      } catch (err) {
        lastError = err;
        if (err.isRateLimit) {
          const waitMs = parseRetryAfterMs(err.message) + attempt * 1500;
          lastError.retryAfterMs = waitMs;
          if (attempt < 4) {
            await sleep(waitMs);
            continue;
          }
        }
        if (!err.isRateLimit) break;
      }
    }
  }
  throw lastError ?? new Error("AI request failed");
}

async function* readGroqSse(reader) {
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") return;
      try {
        yield JSON.parse(data);
      } catch {
        /* skip malformed chunks */
      }
    }
  }
}

async function callGroqStream(apiKey, messages, tools, model, onToken) {
  const res = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      tools,
      tool_choice: "auto",
      temperature: 0.2,
      max_tokens: 768,
      stream: true,
    }),
  });

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    const msg = payload?.error?.message ?? `Groq API error (${res.status})`;
    const err = new Error(msg);
    err.isRateLimit = res.status === 429 || isRateLimitMessage(msg);
    throw err;
  }

  if (!res.body) throw new Error("Empty AI stream");

  const toolCallsByIndex = {};
  let content = "";
  let sawToolCalls = false;

  for await (const chunk of readGroqSse(res.body.getReader())) {
    const delta = chunk.choices?.[0]?.delta;
    if (!delta) continue;

    if (delta.content) {
      content += delta.content;
      if (!sawToolCalls) onToken?.(delta.content);
    }

    if (delta.tool_calls?.length) {
      sawToolCalls = true;
      for (const tc of delta.tool_calls) {
        const idx = tc.index ?? 0;
        if (!toolCallsByIndex[idx]) {
          toolCallsByIndex[idx] = { id: "", type: "function", function: { name: "", arguments: "" } };
        }
        const slot = toolCallsByIndex[idx];
        if (tc.id) slot.id = tc.id;
        if (tc.function?.name) slot.function.name += tc.function.name;
        if (tc.function?.arguments) slot.function.arguments += tc.function.arguments;
      }
    }
  }

  const toolCalls = Object.keys(toolCallsByIndex)
    .sort((a, b) => Number(a) - Number(b))
    .map((k) => toolCallsByIndex[k])
    .filter((tc) => tc.id && tc.function?.name);

  return {
    content: sawToolCalls ? (content || null) : (content || null),
    tool_calls: toolCalls.length ? toolCalls : undefined,
    discardContent: sawToolCalls && toolCalls.length > 0,
  };
}

async function callGroqWithRetryStream(apiKey, messages, tools, onToken) {
  let lastError;
  for (const model of GROQ_MODELS) {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await callGroqStream(apiKey, messages, tools, model, onToken);
      } catch (err) {
        lastError = err;
        if (err.isRateLimit) {
          const waitMs = parseRetryAfterMs(err.message) + attempt * 1500;
          lastError.retryAfterMs = waitMs;
          if (attempt < 4) {
            await sleep(waitMs);
            continue;
          }
        }
        if (!err.isRateLimit) break;
      }
    }
  }
  throw lastError ?? new Error("AI request failed");
}

const TOOL_STATUS_LABELS = {
  get_crm_overview: "Loading CRM overview…",
  count_lead_segment: "Counting leads…",
  query_lead_segment: "Querying lead segment…",
  get_leads_full: "Loading full lead records…",
  get_lead_details: "Fetching lead details…",
  search_leads: "Searching leads…",
  list_all_leads: "Listing leads…",
  list_sales_reps: "Loading sales reps…",
  get_dashboard_stats: "Loading dashboard stats…",
  get_queue_leads: "Loading queue…",
};

export async function runAiChat({
  admin,
  groqApiKey,
  messages,
  mode = "agent",
  execution = "freewill",
  onEvent,
}) {
  if (!groqApiKey) throw new Error("AI not configured");

  const tools = getToolsForMode(mode);
  const recent = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content }));

  let systemPrompt = buildSystemPrompt(mode, execution);
  const lastUser = [...recent].reverse().find((m) => m.role === "user")?.content ?? "";
  if (mode === "ask" && /access|can you (see|read)|do you have/i.test(lastUser) && /lead/i.test(lastUser)) {
    systemPrompt += "\n\nThis user asks about lead data access. Call count_lead_segment (empty filters) or get_crm_overview. If tools return totals, answer YES — you have access. Report total and link_stats. Do not use get_leads_full or invented IDs.";
  }

  const chatMessages = [
    { role: "system", content: systemPrompt },
    ...recent,
  ];

  const actionsPerformed = [];
  const pendingActions = [];
  const snippets = [];
  let assistantMessage = "";

  const maxRounds = execution === "recursive" ? 10 : mode === "ask" ? 6 : MAX_TOOL_ROUNDS;

  const emitToken = (content) => onEvent?.({ type: "token", content });

  for (let round = 0; round < maxRounds; round++) {
    if (round > 0) await sleep(400);
    onEvent?.({ type: "status", message: round === 0 ? "Thinking…" : "Analyzing results…" });

    const response = onEvent
      ? await callGroqWithRetryStream(groqApiKey, chatMessages, tools, emitToken)
      : await callGroqWithRetry(groqApiKey, chatMessages, tools);

    if (response.tool_calls?.length) {
      if (response.discardContent && onEvent) {
        onEvent({ type: "reset" });
      }
      const toolCalls = sanitizeToolCalls(response.tool_calls);
      chatMessages.push({
        role: "assistant",
        content: response.content ?? null,
        tool_calls: toolCalls,
      });

      for (const toolCall of toolCalls) {
        const fn = toolCall.function;
        onEvent?.({
          type: "status",
          message: TOOL_STATUS_LABELS[fn.name] ?? `Running ${fn.name.replace(/_/g, " ")}…`,
        });
        let args = {};
        try {
          args = sanitizeToolArgs(fn.name, JSON.parse(fn.arguments || "{}"));
        } catch {
          args = {};
        }

        const isWrite = WRITE_TOOL_NAMES.has(fn.name);
        let result;

        try {
          if (mode === "ask" && isWrite) {
            result = { error: "Write actions disabled in Ask mode" };
          } else if (mode === "agent" && execution === "confirm" && isWrite) {
            const preview = await previewWriteAction(admin, fn.name, args);
            result = { status: "queued_for_approval", ...preview };
            pendingActions.push({
              id: toolCall.id,
              tool: fn.name,
              args,
              label: preview.label,
              description: preview.description,
            });
          } else {
            result = await executeCrmTool(admin, fn.name, args);
            if (result?.action) actionsPerformed.push(result);
            snippets.push(...extractSnippets(fn.name, result));
          }
        } catch (err) {
          result = { error: err instanceof Error ? err.message : "Action failed" };
        }

        chatMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: stringifyToolResult(result, fn.name),
        });
      }
      continue;
    }

    assistantMessage = response.content?.trim() ?? "I couldn't respond. Try again.";
    break;
  }

  if (!assistantMessage) {
    assistantMessage = pendingActions.length
      ? "I've prepared the actions above — review and approve when ready."
      : "I need a simpler request. Try again.";
    if (onEvent && assistantMessage) {
      for (const word of assistantMessage.split(/(\s+)/)) {
        emitToken(word);
        await sleep(12);
      }
    }
  }

  const result = { message: assistantMessage, actionsPerformed, pendingActions, snippets };
  onEvent?.({ type: "done", ...result });
  return result;
}

export async function runAgentAction({ admin, tool, args }) {
  const result = await executeCrmTool(admin, tool, sanitizeToolArgs(tool, args ?? {}));
  if (result?.error) throw new Error(result.error);
  return result;
}

export async function runAgentActionBatch({ admin, actions }) {
  const results = [];
  for (const action of actions ?? []) {
    const result = await runAgentAction({ admin, tool: action.tool, args: action.args });
    results.push({ tool: action.tool, result });
  }
  return results;
}
