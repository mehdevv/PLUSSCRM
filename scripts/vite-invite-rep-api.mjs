import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./load-env.mjs";
import { ensureSalesRepAccount } from "./rep-account.mjs";
import { runAiChat, runAgentAction, runAgentActionBatch } from "./ai-chat-handler.mjs";
import { cleanupRepBeforeDelete } from "./rep-cleanup.mjs";

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

async function handleInviteRep(req, res, url, serviceKey, anonKey) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return sendJson(res, 401, { error: "Unauthorized" });

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return sendJson(res, 401, { error: "Unauthorized" });

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return sendJson(res, 403, { error: "Admin access required" });

  const body = JSON.parse(await readBody(req));
  try {
    const result = await ensureSalesRepAccount(admin, body);
    return sendJson(res, 200, result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create rep";
    return sendJson(res, 400, { error: message });
  }
}

async function handleDeleteRep(req, res, url, serviceKey, anonKey) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return sendJson(res, 401, { error: "Unauthorized" });

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return sendJson(res, 401, { error: "Unauthorized" });

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: callerProfile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (callerProfile?.role !== "admin") return sendJson(res, 403, { error: "Admin access required" });

  const body = JSON.parse(await readBody(req));
  const repId = body.repId?.trim();
  if (!repId) return sendJson(res, 400, { error: "repId is required" });
  if (repId === user.id) return sendJson(res, 400, { error: "Cannot delete your own account" });

  try {
    await cleanupRepBeforeDelete(admin, repId, user.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cleanup failed";
    return sendJson(res, 400, { error: message });
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(repId);
  if (deleteError) return sendJson(res, 400, { error: deleteError.message });

  return sendJson(res, 200, { repId });
}

async function handleAiChat(req, res, url, serviceKey, anonKey, groqApiKey) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return sendJson(res, 401, { error: "Unauthorized" });

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return sendJson(res, 401, { error: "Unauthorized" });

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return sendJson(res, 403, { error: "Admin access required" });

  const body = JSON.parse(await readBody(req));
  const messages = body.messages;
  if (!Array.isArray(messages) || !messages.length) {
    return sendJson(res, 400, { error: "messages array is required" });
  }
  if (!groqApiKey) {
    return sendJson(res, 500, { error: "AI not configured" });
  }

  const stream = body.stream === true;

  try {
    const chatOpts = {
      admin,
      groqApiKey,
      messages,
      mode: body.mode === "ask" ? "ask" : "agent",
      execution: body.execution === "recursive"
        ? "recursive"
        : body.execution === "confirm"
          ? "confirm"
          : "freewill",
    };

    if (stream) {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      const send = (data) => {
        if (!res.writableEnded) res.write(`data: ${JSON.stringify(data)}\n\n`);
      };
      try {
        await runAiChat({
          ...chatOpts,
          onEvent: send,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "AI chat failed";
        const status = err.isRateLimit ? 429 : 500;
        if (status === 500) console.error("[ai-chat stream]", message);
        send({ type: "error", message, status });
      }
      if (!res.writableEnded) res.end();
      return;
    }

    const result = await runAiChat(chatOpts);
    return sendJson(res, 200, result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI chat failed";
    const status = err.isRateLimit ? 429 : 500;
    if (status === 500) console.error("[ai-chat]", message);
    if (status === 429) {
      const retrySec = Math.ceil((err.retryAfterMs ?? 8000) / 1000);
      res.setHeader("Retry-After", String(retrySec));
    }
    return sendJson(res, status, { error: message });
  }
}

async function handleAiChatExecute(req, res, url, serviceKey, anonKey) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return sendJson(res, 401, { error: "Unauthorized" });

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return sendJson(res, 401, { error: "Unauthorized" });

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return sendJson(res, 403, { error: "Admin access required" });

  const body = JSON.parse(await readBody(req));

  try {
    if (body.actions?.length) {
      const results = await runAgentActionBatch({ admin, actions: body.actions });
      return sendJson(res, 200, { results });
    }
    if (!body.tool) return sendJson(res, 400, { error: "tool is required" });
    const result = await runAgentAction({ admin, tool: body.tool, args: body.args ?? {} });
    return sendJson(res, 200, { result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Action failed";
    return sendJson(res, 400, { error: message });
  }
}

function createHandler() {
  return async (req, res, next) => {
    loadEnv();
    const url = process.env.VITE_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
    const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const groqApiKey = process.env.GROQ_API_KEY;
    const path = req.url?.split("?")[0];
    if (path !== "/api/invite-rep" && path !== "/api/delete-rep" && path !== "/api/ai-chat" && path !== "/api/ai-chat/execute") return next();

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "authorization, content-type");

    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }

    if (req.method !== "POST") {
      return sendJson(res, 405, { error: "Method not allowed" });
    }

    if (!url || !serviceKey || !anonKey) {
      return sendJson(res, 500, {
        error: "Add SUPABASE_SERVICE_ROLE_KEY to .env and restart npm run dev",
      });
    }

    try {
      if (path === "/api/invite-rep") {
        await handleInviteRep(req, res, url, serviceKey, anonKey);
      } else if (path === "/api/delete-rep") {
        await handleDeleteRep(req, res, url, serviceKey, anonKey);
      } else if (path === "/api/ai-chat") {
        await handleAiChat(req, res, url, serviceKey, anonKey, groqApiKey);
      } else {
        await handleAiChatExecute(req, res, url, serviceKey, anonKey);
      }
    } catch (err) {
      sendJson(res, 500, { error: err instanceof Error ? err.message : "Server error" });
    }
  };
}

/** Vite plugin: local API for Add Rep / Delete Rep (no Edge Function deploy needed in dev). */
export function inviteRepApiPlugin() {
  const handler = createHandler();
  return {
    name: "invite-rep-api",
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}
