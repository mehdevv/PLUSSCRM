import { useState } from "react";
import { useLocation } from "wouter";
import { Bot, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { AgentChatPanel } from "@/components/admin/AgentChatPanel";

export function AdminChatbot() {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);

  if (location === "/assistant") return null;

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[400px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[calc(100vh-8rem)] flex flex-col bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200">
          <AgentChatPanel variant="bubble" onClose={() => setOpen(false)} />
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all",
          open ? "bg-muted text-foreground scale-95" : "bg-primary text-primary-foreground hover:scale-105",
        )}
        aria-label={open ? "Close CRM agent" : "Open CRM agent"}
      >
        {open ? <X className="w-6 h-6" /> : <Bot className="w-6 h-6" />}
      </button>
    </>
  );
}
