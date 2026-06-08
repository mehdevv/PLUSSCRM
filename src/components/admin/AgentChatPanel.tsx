import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import {
  Bot, Send, Loader2, Sparkles, MessageSquare, Zap, Shield, Rocket, Repeat,
  Database, X, ExternalLink, Plus, Play, Trash2, History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useAdminAgent } from "@/hooks/useAdminAgent";
import { QUICK_PROMPTS, type AgentConfig, type DataSnippet } from "@/types/agent";
import { formatRelativeTime } from "@/lib/format";

function SnippetTable({ snippet }: { snippet: DataSnippet }) {
  if (snippet.type === "stats" && snippet.rows.length === 1) {
    const row = snippet.rows[0];
    return (
      <div className="grid grid-cols-2 gap-2 text-xs">
        {Object.entries(row).map(([k, v]) => (
          <div key={k} className="bg-background/60 rounded-lg px-2.5 py-2 border border-border/50">
            <p className="text-muted-foreground capitalize">{k.replace(/([A-Z])/g, " $1").trim()}</p>
            <p className="font-semibold text-foreground mt-0.5">
              {typeof v === "number" && k.toLowerCase().includes("revenue") ? `$${Number(v).toLocaleString()}` : String(v)}
            </p>
          </div>
        ))}
      </div>
    );
  }

  const cols = snippet.type === "leads" || snippet.type === "queue"
    ? ["company", "name", "status", "assigned_to"]
    : snippet.type === "reps"
      ? ["name", "tier", "points", "email"]
      : snippet.type === "leaderboard"
        ? ["name", "rank", "revenue", "deals_mtd"]
        : snippet.type === "clients"
          ? ["company", "contact", "ltv", "deals_count"]
          : Object.keys(snippet.rows[0] ?? {}).slice(0, 4);

  return (
    <div className="overflow-x-auto rounded-lg border border-border/60 scrollbar-minimal">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-muted/50 text-muted-foreground">
            {cols.map((c) => (
              <th key={c} className="text-left px-2.5 py-1.5 font-medium capitalize">{c.replace(/_/g, " ")}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {snippet.rows.slice(0, 8).map((row, i) => (
            <tr key={i} className="border-t border-border/40">
              {cols.map((c) => (
                <td key={c} className="px-2.5 py-1.5 text-foreground truncate max-w-[120px]">
                  {row[c] != null ? String(row[c]) : "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {snippet.rows.length > 8 && (
        <p className="text-[10px] text-muted-foreground px-2.5 py-1">+{snippet.rows.length - 8} more</p>
      )}
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

function ModeToolbar({
  config,
  setMode,
  setExecution,
  compact,
}: {
  config: AgentConfig;
  setMode: (m: AgentConfig["mode"]) => void;
  setExecution: (e: AgentConfig["execution"]) => void;
  compact?: boolean;
}) {
  return (
    <div className={cn("space-y-2", compact && "space-y-1.5")}>
      <div className="flex rounded-lg border border-border bg-muted/30 p-0.5 gap-0.5">
        <Pill active={config.mode === "ask"} onClick={() => setMode("ask")}>
          <span className="inline-flex items-center justify-center gap-1">
            <MessageSquare className="w-3 h-3" />
            Ask
          </span>
        </Pill>
        <Pill active={config.mode === "agent"} onClick={() => setMode("agent")}>
          <span className="inline-flex items-center justify-center gap-1">
            <Zap className="w-3 h-3" />
            Agent
          </span>
        </Pill>
      </div>

      {config.mode === "agent" && (
        <div className="grid grid-cols-3 rounded-lg border border-border bg-muted/30 p-0.5 gap-0.5">
          <Pill
            active={config.execution === "confirm"}
            onClick={() => setExecution("confirm")}
            className={config.execution === "confirm" ? "bg-amber-500 text-white" : undefined}
          >
            <span className="inline-flex items-center justify-center gap-1">
              <Shield className="w-3 h-3" />
              Confirm
            </span>
          </Pill>
          <Pill
            active={config.execution === "recursive"}
            onClick={() => setExecution("recursive")}
            className={config.execution === "recursive" ? "bg-violet-600 text-white" : undefined}
          >
            <span className="inline-flex items-center justify-center gap-1">
              <Repeat className="w-3 h-3" />
              Recursive
            </span>
          </Pill>
          <Pill
            active={config.execution === "freewill"}
            onClick={() => setExecution("freewill")}
            className={config.execution === "freewill" ? "bg-emerald-600 text-white" : undefined}
          >
            <span className="inline-flex items-center justify-center gap-1">
              <Rocket className="w-3 h-3" />
              Freewill
            </span>
          </Pill>
        </div>
      )}
    </div>
  );
}

interface AgentChatPanelProps {
  variant?: "page" | "bubble";
  onClose?: () => void;
}

export function AgentChatPanel({ variant = "page", onClose }: AgentChatPanelProps) {
  const isPage = variant === "page";
  const {
    config, setMode, setExecution, messages, loading, startingWork, bootstrapping, streamStatus,
    conversations, conversationId, awaitingMessage,
    sendMessage, startWork, newChat, selectConversation, removeConversation,
  } = useAdminAgent();

  const isStreaming = messages.some((m) => m.streaming);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading, startingWork]);

  const submit = () => {
    if (!input.trim() || loading || startingWork) return;
    sendMessage(input);
    setInput("");
  };

  const statusLabel = config.mode === "ask"
    ? "read only"
    : config.execution === "confirm"
      ? "confirm first"
      : config.execution === "recursive"
        ? "read segment → edit"
        : "freewill";

  const inputPlaceholder = config.mode === "ask"
    ? "Ask about your CRM data…"
    : config.execution === "recursive"
      ? "Describe the lead segment and edits, then Start work…"
      : config.execution === "confirm"
        ? "Describe the task, then click Start work…"
        : "Tell me what to do…";

  const messageList = (
    <>
      {bootstrapping ? (
        <div className="flex items-center justify-center py-16">
          <Spinner className="text-primary" />
        </div>
      ) : (
        messages.map((msg) => (
          <div key={msg.id} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[90%] space-y-2", msg.role === "user" ? "items-end" : "items-start")}>
                <div className={cn(
                  "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                  msg.role === "user" ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted text-foreground rounded-bl-md",
                )}>
                  {msg.content}
                  {msg.streaming && (
                    <span className="inline-block w-2 h-4 ml-0.5 align-middle bg-primary/70 animate-pulse rounded-sm" />
                  )}
                </div>

              {msg.snippets?.map((s, i) => (
                <div key={i} className="w-full max-w-md space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                    <Database className="w-3 h-3" />
                    {s.title}
                  </p>
                  <SnippetTable snippet={s} />
                </div>
              ))}

              {msg.status === "awaiting_start" && (
                <Button
                  size="sm"
                  className="gap-1.5 h-8"
                  disabled={startingWork}
                  onClick={() => startWork(msg.id)}
                >
                  {startingWork ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  Start work
                </Button>
              )}
            </div>
          </div>
        ))
      )}

        {(loading || startingWork) && !isStreaming && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl rounded-bl-md px-3.5 py-2.5 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {startingWork ? "Running agent…" : "Thinking…"}
            </div>
          </div>
        )}

        {isStreaming && streamStatus && (
          <div className="flex justify-start">
            <p className="text-xs text-muted-foreground px-2 py-1">{streamStatus}</p>
          </div>
        )}
    </>
  );

  const chatInputForm = (
    <form className="flex gap-2 items-end" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <Textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
        }}
        placeholder={inputPlaceholder}
        className="min-h-[44px] max-h-28 resize-none text-sm border-0 bg-transparent shadow-none focus-visible:ring-0"
        rows={1}
        disabled={loading || startingWork || !!awaitingMessage}
      />
      <Button type="submit" size="icon" className="h-10 w-10 shrink-0 rounded-xl" disabled={loading || startingWork || !input.trim() || !!awaitingMessage}>
        <Send className="w-4 h-4" />
      </Button>
    </form>
  );

  const awaitingStartBar = awaitingMessage && (
    <Button size="sm" className="w-full gap-2 mb-2" disabled={startingWork} onClick={() => startWork(awaitingMessage.id)}>
      {startingWork ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
      Start work
    </Button>
  );

  const floatingInputShell = (
    <div className={cn(
      "rounded-2xl border border-border bg-card/95 backdrop-blur-md shadow-lg p-2 w-full max-w-2xl",
      awaitingMessage && "ring-1 ring-amber-500/30",
    )}>
      {awaitingStartBar}
      {chatInputForm}
    </div>
  );

  const chatArea = isPage ? (
    <div className="relative flex flex-col flex-1 min-h-0">
      {messages.length === 0 && !bootstrapping ? (
        <div className="flex-1 flex flex-col items-center justify-center px-4 gap-5">
          <div className="text-center px-4">
            <Bot className="w-10 h-10 text-primary/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Send a message to start. Chats are saved automatically.</p>
          </div>
          {floatingInputShell}
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pt-4 pb-36 space-y-4 scrollbar-minimal">
            {messageList}
          </div>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-full max-w-2xl px-3 z-10 pointer-events-none">
            <div className="pointer-events-auto">{floatingInputShell}</div>
          </div>
        </>
      )}
    </div>
  ) : (
    <div className="flex flex-col flex-1 min-h-0">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-minimal">
        {messages.length === 0 && !bootstrapping && (
          <div className="text-center py-12 px-4">
            <Bot className="w-10 h-10 text-primary/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Send a message to start. Chats are saved automatically.</p>
          </div>
        )}
        {messageList}
      </div>
      {awaitingMessage && (
        <div className="px-4 py-2 border-t border-amber-500/20 bg-amber-500/5 shrink-0">
          {awaitingStartBar}
        </div>
      )}
      <div className="p-3 border-t border-border bg-card shrink-0">
        {chatInputForm}
      </div>
    </div>
  );

  const historyList = (
    <div className="space-y-0.5">
      {conversations.map((c) => (
        <div
          key={c.id}
          className={cn(
            "group flex items-center gap-1 rounded-md px-2 py-1.5 cursor-pointer transition-colors",
            c.id === conversationId ? "bg-primary/10 text-foreground" : "hover:bg-muted/60 text-muted-foreground",
          )}
        >
          <button
            type="button"
            className="flex-1 text-left min-w-0"
            onClick={() => {
              selectConversation(c.id);
              setMobileHistoryOpen(false);
            }}
          >
            <p className="text-xs font-medium truncate">{c.title}</p>
            <p className="text-[10px] opacity-70">{formatRelativeTime(c.updated_at)}</p>
          </button>
          <button
            type="button"
            className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-opacity shrink-0"
            onClick={(e) => { e.stopPropagation(); removeConversation(c.id); }}
            title="Delete"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      ))}
      {!conversations.length && (
        <p className="text-[11px] text-muted-foreground px-2 py-3 text-center">No chats yet</p>
      )}
    </div>
  );

  const sidebar = isPage && (
    <aside className="hidden lg:flex flex-col w-52 shrink-0 min-h-0 bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border shrink-0">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <History className="w-3.5 h-3.5" />
          Chats
        </span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={newChat} title="New chat">
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2 scrollbar-minimal">
        {historyList}
      </div>

      <div className="border-t border-border px-3 py-3 space-y-3 shrink-0">
        <ModeToolbar config={config} setMode={setMode} setExecution={setExecution} />

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Quick prompts</p>
          <div className="max-h-28 overflow-y-auto space-y-1 scrollbar-minimal">
            {QUICK_PROMPTS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => sendMessage(p)}
                disabled={loading || startingWork}
                className="w-full text-left text-[11px] leading-snug px-2 py-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );

  if (!isPage) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-card">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-primary/5 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold">CRM Agent</p>
              <p className="text-[10px] text-muted-foreground capitalize">{config.mode} · {statusLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Link href="/assistant">
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Open full page">
                <ExternalLink className="w-4 h-4" />
              </Button>
            </Link>
            {onClose && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
        <div className="px-3 py-2 border-b border-border shrink-0">
          <ModeToolbar config={config} setMode={setMode} setExecution={setExecution} compact />
        </div>
        {chatArea}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 gap-3">
      {sidebar}

      <div className="flex-1 flex flex-col min-h-0 bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display font-bold text-base leading-tight">CRM Agent</h2>
              <p className="text-[11px] text-muted-foreground capitalize truncate">{config.mode} · {statusLabel}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 lg:hidden shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setMobileHistoryOpen((v) => !v)}
            >
              <History className="w-3.5 h-3.5" />
              History
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={newChat} title="New chat">
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {mobileHistoryOpen && (
          <div className="lg:hidden border-b border-border px-3 py-2 max-h-40 overflow-y-auto scrollbar-minimal shrink-0 bg-muted/20">
            {historyList}
          </div>
        )}

        <div className="lg:hidden px-3 py-2 border-b border-border shrink-0">
          <ModeToolbar config={config} setMode={setMode} setExecution={setExecution} compact />
        </div>

        {chatArea}
      </div>
    </div>
  );
}
