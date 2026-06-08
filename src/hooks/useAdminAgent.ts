import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { streamAiChatMessage } from "@/services/aiChat";
import {
  createConversation,
  deleteConversation,
  fetchMessages,
  insertMessage,
  listConversations,
  patchMessage,
  titleFromMessage,
  updateConversation,
  type AiConversation,
} from "@/services/aiConversations";
import { friendlyAgentError } from "@/lib/agent-errors";
import { queryKeys } from "@/hooks/queries/keys";
import { useAuth } from "@/hooks/useAuth";
import type { AgentConfig, AgentMessage, AgentMode, ExecutionMode } from "@/types/agent";

const STORAGE_KEY = "pluss-agent-config";
const CONV_STORAGE_KEY = "pluss-agent-conversation-id";

const VALID_EXECUTION: ExecutionMode[] = ["confirm", "freewill", "recursive"];

function loadConfig(): AgentConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AgentConfig;
      if (!VALID_EXECUTION.includes(parsed.execution)) parsed.execution = "confirm";
      return parsed;
    }
  } catch { /* ignore */ }
  return { mode: "agent", execution: "confirm" };
}

function saveConfig(config: AgentConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

function needsConfirmStart(config: AgentConfig) {
  return config.mode === "agent" && (config.execution === "confirm" || config.execution === "recursive");
}

export function useAdminAgent() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [config, setConfigState] = useState<AgentConfig>(loadConfig);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [startingWork, setStartingWork] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [streamStatus, setStreamStatus] = useState<string | null>(null);

  const setConfig = useCallback((patch: Partial<AgentConfig>) => {
    setConfigState((prev) => {
      const next = { ...prev, ...patch };
      saveConfig(next);
      if (conversationId) {
        updateConversation(conversationId, {
          mode: next.mode,
          execution_mode: next.execution,
        }).catch(() => {});
      }
      return next;
    });
  }, [conversationId]);

  const setMode = useCallback((mode: AgentMode) => setConfig({ mode }), [setConfig]);
  const setExecution = useCallback((execution: ExecutionMode) => setConfig({ execution }), [setConfig]);

  const invalidateCrm = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.leads() });
    queryClient.invalidateQueries({ queryKey: queryKeys.queueLeads });
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboardKpis() });
    queryClient.invalidateQueries({ queryKey: queryKeys.salesReps });
  }, [queryClient]);

  const refreshConversations = useCallback(async () => {
    const list = await listConversations();
    setConversations(list);
    return list;
  }, []);

  const loadConversation = useCallback(async (id: string) => {
    const rows = await fetchMessages(id);
    setConversationId(id);
    setMessages(rows);
    localStorage.setItem(CONV_STORAGE_KEY, id);
    const conv = conversations.find((c) => c.id === id);
    if (conv) {
      setConfigState({ mode: conv.mode, execution: conv.execution_mode });
      saveConfig({ mode: conv.mode, execution: conv.execution_mode });
    }
  }, [conversations]);

  const ensureConversation = useCallback(async (firstMessage?: string) => {
    if (conversationId) return conversationId;
    const conv = await createConversation(config, firstMessage ? titleFromMessage(firstMessage) : "New chat");
    setConversationId(conv.id);
    setConversations((prev) => [conv, ...prev]);
    localStorage.setItem(CONV_STORAGE_KEY, conv.id);
    return conv.id;
  }, [conversationId, config]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      try {
        const list = await listConversations();
        if (cancelled) return;
        setConversations(list);

        const savedId = localStorage.getItem(CONV_STORAGE_KEY);
        const target = savedId && list.some((c) => c.id === savedId) ? savedId : list[0]?.id;

        if (target) {
          const rows = await fetchMessages(target);
          if (cancelled) return;
          setConversationId(target);
          setMessages(rows);
          const conv = list.find((c) => c.id === target);
          if (conv) {
            const cfg = { mode: conv.mode, execution: conv.execution_mode };
            setConfigState(cfg);
            saveConfig(cfg);
          }
        }
      } catch {
        if (!cancelled) setMessages([]);
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user]);

  const runAgent = useCallback(async (
    convId: string,
    history: { role: "user" | "assistant"; content: string }[],
    runConfig: AgentConfig,
  ) => {
    const streamId = `stream-${Date.now()}`;
    setStreamStatus("Thinking…");
    setMessages((prev) => [
      ...prev,
      { id: streamId, role: "assistant", content: "", status: "complete", streaming: true },
    ]);

    try {
      const res = await streamAiChatMessage(history, {
        ...runConfig,
        execution: runConfig.mode === "agent" ? "freewill" : runConfig.execution,
      }, {
        onToken: (chunk) => {
          setStreamStatus(null);
          setMessages((prev) => prev.map((m) => (
            m.id === streamId ? { ...m, content: m.content + chunk } : m
          )));
        },
        onStatus: (message) => setStreamStatus(message),
        onReset: () => setMessages((prev) => prev.map((m) => (
          m.id === streamId ? { ...m, content: "" } : m
        ))),
      });

      setStreamStatus(null);

      const assistant = await insertMessage(convId, {
        role: "assistant",
        content: res.message,
        snippets: res.snippets,
        pendingActions: res.pendingActions,
        actionsPerformed: res.actionsPerformed,
        status: "complete",
      });

      setMessages((prev) => prev.map((m) => (m.id === streamId ? assistant : m)));
      if (res.actionsPerformed?.length) invalidateCrm();
      await refreshConversations();
      return assistant;
    } catch (err) {
      setStreamStatus(null);
      setMessages((prev) => prev.filter((m) => m.id !== streamId));
      throw err;
    }
  }, [invalidateCrm, refreshConversations]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading || startingWork) return;

    setLoading(true);
    try {
      const convId = await ensureConversation(trimmed);
      const isFirst = messages.length === 0;
      if (isFirst) {
        await updateConversation(convId, { title: titleFromMessage(trimmed) });
        await refreshConversations();
      }

      const userMsg = await insertMessage(convId, {
        role: "user",
        content: trimmed,
        status: needsConfirmStart(config) ? "awaiting_start" : "complete",
      });

      setMessages((prev) => [...prev, userMsg]);

      if (needsConfirmStart(config)) {
        return;
      }

      const history = [...messages, userMsg]
        .filter((m) => m.status !== "awaiting_start" || m.id === userMsg.id)
        .slice(-6)
        .map(({ role, content }) => ({ role, content }));
      await runAgent(convId, history, config);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, role: "assistant", content: friendlyAgentError(err), status: "complete" },
      ]);
    } finally {
      setLoading(false);
    }
  }, [loading, startingWork, messages, config, ensureConversation, runAgent, refreshConversations]);

  const startWork = useCallback(async (userMessageId: string) => {
    if (startingWork || loading || !conversationId) return;

    const userMsg = messages.find((m) => m.id === userMessageId);
    if (!userMsg || userMsg.status !== "awaiting_start") return;

    setStartingWork(true);
    try {
      await patchMessage(userMessageId, { status: "complete" });
      setMessages((prev) => prev.map((m) => (
        m.id === userMessageId ? { ...m, status: "complete" } : m
      )));

      const history = messages
        .map((m) => (m.id === userMessageId ? { ...m, status: "complete" as const } : m))
        .filter((m) => m.status !== "awaiting_start")
        .slice(-6)
        .map(({ role, content }) => ({ role, content }));

      await runAgent(conversationId, history, config);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, role: "assistant", content: friendlyAgentError(err), status: "complete" },
      ]);
    } finally {
      setStartingWork(false);
    }
  }, [startingWork, loading, conversationId, messages, config, runAgent]);

  const newChat = useCallback(async () => {
    const conv = await createConversation(config);
    setConversationId(conv.id);
    setMessages([]);
    setConversations((prev) => [conv, ...prev]);
    localStorage.setItem(CONV_STORAGE_KEY, conv.id);
  }, [config]);

  const selectConversation = useCallback(async (id: string) => {
    setBootstrapping(true);
    try {
      await loadConversation(id);
    } finally {
      setBootstrapping(false);
    }
  }, [loadConversation]);

  const removeConversation = useCallback(async (id: string) => {
    await deleteConversation(id);
    const list = await refreshConversations();
    if (conversationId === id) {
      if (list[0]) {
        await loadConversation(list[0].id);
      } else {
        setConversationId(null);
        setMessages([]);
        localStorage.removeItem(CONV_STORAGE_KEY);
      }
    }
  }, [conversationId, refreshConversations, loadConversation]);

  const awaitingMessage = messages.find((m) => m.status === "awaiting_start");

  return {
    config,
    setMode,
    setExecution,
    messages,
    loading,
    startingWork,
    bootstrapping,
    streamStatus,
    conversations,
    conversationId,
    awaitingMessage,
    sendMessage,
    startWork,
    newChat,
    selectConversation,
    removeConversation,
  };
}
