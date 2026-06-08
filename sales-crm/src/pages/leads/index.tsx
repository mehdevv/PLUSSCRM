import { useState } from "react";
import { Link } from "wouter";
import { Sidebar } from "@/components/layout/Sidebar";
import { mockLeads, salesReps, STATUS_COLORS, type Lead, type LeadStatus } from "@/lib/mock-data";
import { Search, Phone, Mail, Plus, Upload, Filter, LayoutGrid, List } from "lucide-react";

const STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "New",
  ASSIGNED: "Assigned",
  CONTACTED: "Contacted",
  QUALIFYING: "Qualifying",
  PROPOSAL: "Proposal",
  NEGOTIATION: "Negotiation",
  WON: "Won",
  LOST: "Lost",
  DORMANT: "Dormant",
};

const CTA_MAP: Record<LeadStatus, string> = {
  NEW: "Assign",
  ASSIGNED: "Contact",
  CONTACTED: "Log Activity",
  QUALIFYING: "Log Activity",
  PROPOSAL: "Open Deal",
  NEGOTIATION: "Open Deal",
  WON: "View Client",
  LOST: "Reactivate",
  DORMANT: "Contact",
};

function RepAvatar({ repId }: { repId: number | null }) {
  const rep = repId ? salesReps.find((r) => r.id === repId) : null;
  if (!rep) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ backgroundColor: rep.color }}>
        {rep.initials}
      </div>
      <span className="text-xs text-muted-foreground">{rep.name.split(" ")[0]}</span>
    </div>
  );
}

function LeadCard({ lead }: { lead: Lead }) {
  const color = STATUS_COLORS[lead.status];
  return (
    <div className="bg-background border border-border rounded-lg relative overflow-hidden hover:shadow-md transition-shadow" data-testid={`lead-card-${lead.id}`}>
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg" style={{ backgroundColor: color }} />
      <div className="pl-4 pr-3 pt-3 pb-3">
        <div className="flex items-start justify-between mb-1.5">
          <div>
            <div className="font-display font-bold text-sm text-foreground leading-tight">{lead.name}</div>
            <div className="text-xs text-muted-foreground">{lead.company}</div>
          </div>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border" style={{ color, borderColor: `${color}40`, backgroundColor: `${color}12` }}>
            {STATUS_LABELS[lead.status]}
          </span>
        </div>

        <div className="flex items-center gap-2 mb-2">
          <button className="p-1.5 rounded hover:bg-muted transition-colors" data-testid={`btn-phone-${lead.id}`}><Phone className="w-3 h-3 text-muted-foreground" /></button>
          <button className="p-1.5 rounded hover:bg-muted transition-colors" data-testid={`btn-email-${lead.id}`}><Mail className="w-3 h-3 text-muted-foreground" /></button>
          <span className="ml-1 text-[10px] px-2 py-0.5 bg-cyan-50 text-cyan-700 rounded-full border border-cyan-200">{lead.source}</span>
        </div>

        <div className="flex items-center justify-between mb-2.5">
          <RepAvatar repId={lead.repId} />
          <div className="text-[10px] text-muted-foreground">
            {lead.lastActivity !== "No activity" ? (
              <span>{lead.lastActivity} · {lead.lastActivityTime}</span>
            ) : (
              <span className="italic">No activity</span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground">${lead.value.toLocaleString()}</span>
          <button
            className="text-[11px] font-medium px-2.5 py-1 rounded-md text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: color }}
            data-testid={`btn-cta-${lead.id}`}
          >
            {CTA_MAP[lead.status]}
          </button>
        </div>
      </div>
    </div>
  );
}

const KANBAN_STATUSES: LeadStatus[] = ["NEW", "ASSIGNED", "CONTACTED", "QUALIFYING", "PROPOSAL", "NEGOTIATION"];

function KanbanView({ leads }: { leads: Lead[] }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {KANBAN_STATUSES.map((status) => {
        const col = leads.filter((l) => l.status === status);
        const color = STATUS_COLORS[status];
        return (
          <div key={status} className="flex-shrink-0 w-64">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-xs font-semibold text-foreground uppercase tracking-wide">{STATUS_LABELS[status]}</span>
              <span className="ml-auto text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{col.length}</span>
            </div>
            <div className="space-y-2">
              {col.map((lead) => <LeadCard key={lead.id} lead={lead} />)}
              {col.length === 0 && (
                <div className="border-2 border-dashed border-border rounded-lg p-4 text-center text-xs text-muted-foreground">No leads</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Leads() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [view, setView] = useState<"grid" | "kanban">("grid");

  const filtered = mockLeads.filter((l) => {
    const matchSearch = l.name.toLowerCase().includes(search.toLowerCase()) || l.company.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "ALL" || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <Sidebar>
      <div className="p-6 min-h-full">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Leads</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{mockLeads.length} total leads</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/leads/import" className="flex items-center gap-1.5 px-3 py-2 border border-border bg-card text-foreground rounded-lg text-sm font-medium hover:bg-muted transition-colors" data-testid="btn-import">
              <Upload className="w-4 h-4" />Import
            </Link>
            <Link href="/leads/split-rules" className="flex items-center gap-1.5 px-3 py-2 border border-border bg-card text-foreground rounded-lg text-sm font-medium hover:bg-muted transition-colors">
              Split Rules
            </Link>
            <Link href="/leads/queue" className="flex items-center gap-1.5 px-3 py-2 border border-border bg-card text-foreground rounded-lg text-sm font-medium hover:bg-muted transition-colors">
              Queue <span className="bg-amber-100 text-amber-700 text-[10px] px-1.5 rounded-full ml-1">23</span>
            </Link>
            <button className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity" data-testid="btn-new-lead">
              <Plus className="w-4 h-4" />New Lead
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search leads..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              data-testid="input-search-leads"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              data-testid="select-status-filter"
            >
              <option value="ALL">All Statuses</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-1 border border-border rounded-lg p-1 bg-card">
            <button onClick={() => setView("grid")} className={`p-1.5 rounded-md transition-colors ${view === "grid" ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted"}`} data-testid="btn-view-grid"><LayoutGrid className="w-4 h-4" /></button>
            <button onClick={() => setView("kanban")} className={`p-1.5 rounded-md transition-colors ${view === "kanban" ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted"}`} data-testid="btn-view-kanban"><List className="w-4 h-4" /></button>
          </div>
        </div>

        {view === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map((lead) => <LeadCard key={lead.id} lead={lead} />)}
            {filtered.length === 0 && (
              <div className="col-span-full text-center py-16 text-muted-foreground">
                <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No leads found</p>
                <p className="text-sm">Try adjusting your filters</p>
              </div>
            )}
          </div>
        ) : (
          <KanbanView leads={filtered} />
        )}
      </div>
    </Sidebar>
  );
}
