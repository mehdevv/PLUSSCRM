import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Spinner } from "@/components/ui/spinner";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { LeadEditModal, type LeadFormValues } from "@/components/leads/LeadEditModal";
import { useLeads, useSalesReps, useLeadMutations } from "@/hooks/queries";
import { useToast } from "@/hooks/use-toast";
import { leadFormToUpdates } from "@/lib/lead-form";
import { confirmDeleteMessage } from "@/lib/permissions";
import type { LeadStatus, Profile } from "@/types";
import type { Lead } from "@/types";
import { Search, ExternalLink, MapPin, Pencil, Trash2, Link2 } from "lucide-react";

type LinkFilter = "ALL" | "GOOGLE_MAPS" | "WEBSITE" | "BOTH" | "ANY" | "NONE";

function hasGoogleMapsLink(lead: Lead) {
  return !!lead.google_maps_link?.trim();
}

function hasWebsiteLink(lead: Lead) {
  return !!lead.website_link?.trim();
}

function matchesLinkFilter(lead: Lead, filter: LinkFilter) {
  const maps = hasGoogleMapsLink(lead);
  const web = hasWebsiteLink(lead);
  switch (filter) {
    case "GOOGLE_MAPS": return maps;
    case "WEBSITE": return web;
    case "BOTH": return maps && web;
    case "ANY": return maps || web;
    case "NONE": return !maps && !web;
    default: return true;
  }
}

function RepCell({
  leadId,
  assignedTo,
  reps,
  onAssign,
  isPending,
}: {
  leadId: string;
  assignedTo: string | null;
  reps: Profile[];
  onAssign: (leadId: string, repId: string | null) => void;
  isPending: boolean;
}) {
  const rep = assignedTo ? reps.find((r) => r.id === assignedTo) : null;
  const salesReps = reps.filter((r) => r.role === "sales_rep" && r.is_active);

  return (
    <div className="flex items-center gap-2 min-w-[180px]">
      {rep && (
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
          style={{ backgroundColor: rep.color }}
        >
          {rep.initials}
        </div>
      )}
      <select
        value={assignedTo ?? ""}
        disabled={isPending}
        onChange={(e) => onAssign(leadId, e.target.value || null)}
        className="flex-1 text-xs border border-border rounded-lg px-2 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
        data-testid={`assign-rep-${leadId}`}
      >
        <option value="">Unassigned</option>
        {salesReps.map((r) => (
          <option key={r.id} value={r.id}>{r.name}</option>
        ))}
      </select>
    </div>
  );
}

export default function AllLeads() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [repFilter, setRepFilter] = useState("ALL");
  const [linkFilter, setLinkFilter] = useState<LinkFilter>("ALL");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const { toast } = useToast();

  const { data: leads = [], isLoading, isError } = useLeads({
    status: statusFilter !== "ALL" ? (statusFilter as LeadStatus) : undefined,
    search: search || undefined,
  });
  const { data: reps = [] } = useSalesReps();
  const { assign, unassign, update, remove } = useLeadMutations();

  const filtered = leads.filter((lead) => {
    if (repFilter === "UNASSIGNED" && lead.assigned_to) return false;
    if (repFilter !== "ALL" && repFilter !== "UNASSIGNED" && lead.assigned_to !== repFilter) return false;
    if (!matchesLinkFilter(lead, linkFilter)) return false;
    return true;
  });

  const assignedCount = filtered.filter((l) => l.assigned_to).length;
  const unassignedCount = filtered.length - assignedCount;

  const handleAssign = (leadId: string, repId: string | null) => {
    const onSuccess = () => toast({ title: repId ? "Rep assigned" : "Lead unassigned", description: "Lead responsibility updated." });
    const onError = (err: Error) => toast({ title: "Update failed", description: err.message, variant: "destructive" });
    if (repId) assign.mutate({ leadId, repId }, { onSuccess, onError });
    else unassign.mutate(leadId, { onSuccess, onError });
  };

  const handleSaveLead = (values: LeadFormValues) => {
    if (!editingLead) return;
    update.mutate(
      { id: editingLead.id, updates: leadFormToUpdates(values, true) },
      {
        onSuccess: () => {
          setEditingLead(null);
          toast({ title: "Lead updated" });
        },
        onError: (err: Error) => toast({ title: "Save failed", description: err.message, variant: "destructive" }),
      },
    );
  };

  const handleDelete = (lead: Lead) => {
    const label = lead.company ? `${lead.name} (${lead.company})` : lead.name;
    if (!confirmDeleteMessage(label, "This lead will be removed from the system.")) return;
    setDeletingId(lead.id);
    remove.mutate(lead.id, {
      onSuccess: () => toast({ title: "Lead deleted", description: `${lead.name} has been removed.` }),
      onError: (err) => toast({ title: "Delete failed", description: err.message, variant: "destructive" }),
      onSettled: () => setDeletingId(null),
    });
  };

  return (
    <Sidebar>
      <div className="p-6 min-h-full">
        <div className="mb-5">
          <h1 className="font-display text-2xl font-bold text-foreground">All Leads</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Every lead in the system and who is responsible for it
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          <div className="bg-card border border-card-border rounded-xl p-4 shadow-sm">
            <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Leads</div>
            <div className="font-display text-2xl font-bold text-foreground mt-1">{isLoading ? "—" : filtered.length}</div>
          </div>
          <div className="bg-card border border-card-border rounded-xl p-4 shadow-sm">
            <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Assigned</div>
            <div className="font-display text-2xl font-bold text-emerald-600 mt-1">{isLoading ? "—" : assignedCount}</div>
          </div>
          <div className="bg-card border border-card-border rounded-xl p-4 shadow-sm">
            <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Unassigned</div>
            <div className="font-display text-2xl font-bold text-amber-600 mt-1">{isLoading ? "—" : unassignedCount}</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search name or company..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-background"
          >
            <option value="ALL">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select
            value={repFilter}
            onChange={(e) => setRepFilter(e.target.value)}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-background"
          >
            <option value="ALL">All reps</option>
            <option value="UNASSIGNED">Unassigned only</option>
            {reps.filter((r) => r.role === "sales_rep").map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <select
            value={linkFilter}
            onChange={(e) => setLinkFilter(e.target.value as LinkFilter)}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-background"
            data-testid="link-filter"
          >
            <option value="ALL">All links</option>
            <option value="GOOGLE_MAPS">Has Google Maps</option>
            <option value="WEBSITE">Has website</option>
            <option value="BOTH">Has both links</option>
            <option value="ANY">Has any link</option>
            <option value="NONE">No links</option>
          </select>
          {linkFilter !== "ALL" && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Link2 className="w-3.5 h-3.5" />
              {linkFilter === "GOOGLE_MAPS" && <MapPin className="w-3.5 h-3.5" />}
              {linkFilter === "WEBSITE" && <ExternalLink className="w-3.5 h-3.5" />}
              {filtered.length} lead{filtered.length === 1 ? "" : "s"}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner className="w-6 h-6 text-primary" />
          </div>
        ) : isError ? (
          <div className="text-center py-16 text-sm text-red-500">Failed to load leads.</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-sm text-muted-foreground bg-card border border-card-border rounded-xl">
            No leads match your filters.
          </div>
        ) : (
          <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left" data-testid="all-leads-table">
                <thead className="bg-muted border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lead</th>
                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Company</th>
                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Number</th>
                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Wilaya</th>
                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Responsible Rep</th>
                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Links</th>
                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Added</th>
                    <th className="px-4 py-3 w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((lead) => {
                    const color = STATUS_COLORS[lead.status];
                    return (
                      <tr key={lead.id} className="hover:bg-muted/40 transition-colors" data-testid={`all-lead-row-${lead.id}`}>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-foreground">{lead.name}</div>
                          <div className="text-xs text-muted-foreground">{lead.source ?? "—"}</div>
                        </td>
                        <td className="px-4 py-3 font-medium text-foreground">{lead.company || "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{lead.phone ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{lead.wilaya ?? lead.country ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span
                            className="text-[10px] font-medium px-2 py-0.5 rounded-full border"
                            style={{ color, borderColor: `${color}40`, backgroundColor: `${color}12` }}
                          >
                            {STATUS_LABELS[lead.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <RepCell
                            leadId={lead.id}
                            assignedTo={lead.assigned_to}
                            reps={reps}
                            onAssign={handleAssign}
                            isPending={assign.isPending || unassign.isPending}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {lead.google_maps_link && (
                              <a href={lead.google_maps_link} target="_blank" rel="noopener noreferrer" className="text-primary hover:opacity-80" title="Google Maps">
                                <MapPin className="w-4 h-4" />
                              </a>
                            )}
                            {lead.website_link && (
                              <a href={lead.website_link.startsWith("http") ? lead.website_link : `https://${lead.website_link}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:opacity-80" title="Website">
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            )}
                            {!lead.google_maps_link && !lead.website_link && (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatDate(lead.created_at)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button type="button" onClick={() => setEditingLead(lead)} className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10" title="Edit lead" data-testid={`btn-edit-lead-${lead.id}`}>
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button type="button" onClick={() => handleDelete(lead)} disabled={deletingId === lead.id || remove.isPending} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-50" title="Delete lead" data-testid={`btn-delete-lead-${lead.id}`}>
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      <LeadEditModal
        lead={editingLead}
        open={!!editingLead}
        isAdmin
        saving={update.isPending}
        onClose={() => setEditingLead(null)}
        onSave={handleSaveLead}
      />
    </Sidebar>
  );
}
