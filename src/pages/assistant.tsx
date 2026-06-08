import { Sidebar } from "@/components/layout/Sidebar";
import { AgentChatPanel } from "@/components/admin/AgentChatPanel";

export default function AssistantPage() {
  return (
    <Sidebar>
      <div className="p-4 lg:p-5 h-full flex flex-col min-h-0">
        <h1 className="font-display text-xl font-bold text-foreground mb-3 shrink-0">AI Assistant</h1>
        <div className="flex-1 min-h-0">
          <AgentChatPanel variant="page" />
        </div>
      </div>
    </Sidebar>
  );
}
