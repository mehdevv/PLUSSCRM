import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Sidebar } from "@/components/layout/Sidebar";
import { LeadActivityLogModal } from "@/components/leads/LeadActivityLogModal";
import { LeadActivityPreview } from "@/components/leads/LeadActivityPreview";
import { STATUS_COLORS, STATUS_LABELS, LEADS_BOARD_STATUSES } from "@/lib/constants";
import { groupActivitiesByLead, activitiesForLead } from "@/lib/activity-display";
import { useCurrency } from "@/hooks/useCurrency";
import { useLeads, useSalesReps, useLeadMutations, useActivities } from "@/hooks/queries";
import { ensureLeadInPipeline } from "@/services/deals";
import { useQueryClient } from "@tanstack/react-query";
import { useStaffView } from "@/hooks/useSuperMode";
import { useToast } from "@/hooks/use-toast";
import { LeadEditModal, type LeadFormValues } from "@/components/leads/LeadEditModal";
import { leadFormToUpdates } from "@/lib/lead-form";
import { confirmDeleteMessage } from "@/lib/permissions";
import type { Activity, Lead, LeadStatus, Profile } from "@/types";
import { Search, Phone, Mail, Globe, MapPin, Pencil, Trash2 } from "lucide-react";

const BOARD_CTA: Partial<Record<LeadStatus, string>> = {
  ASSIGNED: "Contact",
  CONTACTED: "Pipeline",
};

function iconClass(has: boolean) {
  return has ? "text-blue-600" : "text-muted-foreground/35";
}

function linkLabel(url: string, max = 36) {
  const cleaned = url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  return cleaned.length > max ? `${cleaned.slice(0, max)}…` : cleaned;
}

function ContactRow({
  icon: Icon, has, href, label, testId,
}: {
  icon: typeof Phone; has: boolean; href?: string; label: string; testId?: string;
}) {
  const content = (
    <>
      <Icon className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${iconClass(has)}`} />
      <span className={`text-xs leading-snug break-all ${has ? "text-foreground" : "text-muted-foreground/50 italic"}`}>{label}</span>
    </>
  );
  if (has && href) {
    return (
      <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noopener noreferrer" : undefined} className="flex items-start gap-2 hover:opacity-80 transition-opacity" data-testid={testId}>
        {content}
      </a>
    );
  }
  return <div className="flex items-start gap-2" data-testid={testId}>{content}</div>;
}

function RepAvatar({ repId, reps }: { repId: string | null; reps: Profile[] }) {
  const rep = repId ? reps.find((r) => r.id === repId) : null;
  if (!rep) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ backgroundColor: rep.color }}>{rep.initials}</div>
      <span className="text-xs text-muted-foreground">{rep.name.split(" ")[0]}</span>
    </div>
  );
}

function LeadCard({
  lead, reps, recentActivities, onCta, onEdit, onDelete, onViewActivities, staffTools, ctaLoading, deleting, formatMoney,
}: {
  lead: Lead;
  reps: Profile[];
  recentActivities: Activity[];
  onCta: (lead: Lead) => void;
  onEdit?: (lead: Lead) => void;
  onDelete?: (lead: Lead) => void;
  onViewActivities: (leadId: string) => void;
  staffTools?: boolean;
  ctaLoading: boolean;
  deleting?: boolean;
  formatMoney: (n: number, c?: string) => string;
}) {
  const color = STATUS_COLORS[lead.status];
  const ctaLabel = BOARD_CTA[lead.status];
  const region = lead.wilaya?.trim() || lead.country?.trim();

  return (
    <div className="bg-background border border-border rounded-lg relative overflow-hidden hover:shadow-md transition-shadow" data-testid={`lead-card-${lead.id}`}>
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg" style={{ backgroundColor: color }} />
      <div className="pl-4 pr-3 pt-3 pb-3 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-display font-bold text-sm text-foreground leading-tight">{lead.name}</div>
            <div className="text-xs text-muted-foreground truncate">{lead.company || "—"}</div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {staffTools && onEdit && (
              <button type="button" onClick={() => onEdit(lead)} className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10" title="Edit lead">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            {staffTools && onDelete && (
              <button type="button" onClick={() => onDelete(lead)} disabled={deleting} className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-50" title="Delete lead">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border" style={{ color, borderColor: `${color}40`, backgroundColor: `${color}12` }}>
              {STATUS_LABELS[lead.status]}
            </span>
          </div>
        </div>
        <div className="space-y-1.5 border-t border-border/60 pt-2">
          <ContactRow icon={Phone} has={!!lead.phone?.trim()} href={lead.phone ? `tel:${lead.phone}` : undefined} label={lead.phone?.trim() || "No phone"} testId={`lead-phone-${lead.id}`} />
          <ContactRow icon={Mail} has={!!lead.email?.trim()} href={lead.email ? `mailto:${lead.email}` : undefined} label={lead.email || "No email"} testId={`lead-email-${lead.id}`} />
          <ContactRow icon={Globe} has={!!lead.website_link?.trim()} href={lead.website_link || undefined} label={lead.website_link?.trim() ? linkLabel(lead.website_link) : "No website"} testId={`lead-website-${lead.id}`} />
          <ContactRow icon={MapPin} has={!!lead.google_maps_link?.trim()} href={lead.google_maps_link || undefined} label={lead.google_maps_link?.trim() ? linkLabel(lead.google_maps_link) : "No Google Maps"} testId={`lead-maps-${lead.id}`} />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {lead.source && <span className="text-[10px] px-2 py-0.5 bg-cyan-50 text-cyan-700 rounded-full border border-cyan-200">{lead.source}</span>}
          {region && <span className="text-[10px] px-2 py-0.5 bg-muted text-muted-foreground rounded-full border border-border">{region}</span>}
        </div>
        <LeadActivityPreview
          leadId={lead.id}
          activities={recentActivities}
          onViewAll={onViewActivities}
        />
        <div className="flex items-center justify-between">
          <RepAvatar repId={lead.assigned_to} reps={reps} />
        </div>
        <div className="flex items-center justify-between pt-0.5">
          <span className="text-xs font-semibold text-foreground">{formatMoney(lead.value, "USD")}</span>
          {ctaLabel && (
            <button type="button" onClick={() => onCta(lead)} disabled={ctaLoading} className="text-[11px] font-medium px-2.5 py-1 rounded-md text-white transition-opacity hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: color }} data-testid={`btn-cta-${lead.id}`}>
              {ctaLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Leads() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [activityLeadId, setActivityLeadId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { effectiveRepId, canStaffOverride, effectiveRep } = useStaffView();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { formatMoney } = useCurrency();
  const { data: leads = [], isLoading } = useLeads({
    status: statusFilter !== "ALL" ? (statusFilter as LeadStatus) : undefined,
    search: search || undefined,
  });
  const { data: reps = [] } = useSalesReps();
  const { data: activities = [] } = useActivities();
  const { update, remove } = useLeadMutations();
  const activitiesByLead = useMemo(() => groupActivitiesByLead(activities), [activities]);
  const queryClient = useQueryClient();
  const [contacting, setContacting] = useState(false);
  const ctaLoading = contacting || update.isPending;

  const boardLeads = leads.filter((l) => {
    if (!LEADS_BOARD_STATUSES.includes(l.status)) return false;
    if (effectiveRepId && l.assigned_to !== effectiveRepId) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return l.name.toLowerCase().includes(q) || l.company.toLowerCase().includes(q);
  });

  const activityLead = activityLeadId
    ? leads.find((l) => l.id === activityLeadId)
    : null;

  const moveToPipeline = async (lead: Lead) => {
    const repId = effectiveRepId ?? lead.assigned_to;
    if (!repId) return;
    setContacting(true);
    try {
      await ensureLeadInPipeline(lead.id, repId, lead.value, "CONTACTED");
      await queryClient.invalidateQueries({ queryKey: ["deals"] });
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast({ title: "Lead contacted", description: "Moved to Contacted. Open Pipeline when ready to advance." });
    } catch (err) {
      toast({
        title: "Could not move to pipeline",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setContacting(false);
    }
  };

  const handleCta = async (lead: Lead) => {
    if (lead.status === "ASSIGNED") {
      await moveToPipeline(lead);
      return;
    }
    if (lead.status === "CONTACTED") {
      setLocation("/pipeline");
    }
  };

  const handleSaveLead = (values: LeadFormValues) => {
    if (!editingLead) return;
    update.mutate(
      { id: editingLead.id, updates: leadFormToUpdates(values, canStaffOverride) },
      {
        onSuccess: () => { setEditingLead(null); toast({ title: "Lead updated" }); },
        onError: (err: Error) => toast({ title: "Save failed", description: err.message, variant: "destructive" }),
      },
    );
  };

  const handleDelete = (lead: Lead) => {
    const label = lead.company ? `${lead.name} (${lead.company})` : lead.name;
    if (!confirmDeleteMessage(label, "This lead will be permanently removed.")) return;
    setDeletingId(lead.id);
    remove.mutate(lead.id, {
      onSuccess: () => toast({ title: "Lead deleted" }),
      onError: (err: Error) => toast({ title: "Delete failed", description: err.message, variant: "destructive" }),
      onSettled: () => setDeletingId(null),
    });
  };

  if (isLoading) return <Sidebar><div className="p-6 min-h-full text-muted-foreground">Loading...</div></Sidebar>;

  return (
    <Sidebar>
      <div className="p-6 min-h-full">
        <div className="mb-5">
          <h1 className="font-display text-2xl font-bold text-foreground">Leads</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {canStaffOverride && effectiveRep ? (
              <>Managing <strong>{effectiveRep.name}</strong>&apos;s board — {boardLeads.length} lead{boardLeads.length === 1 ? "" : "s"}</>
            ) : (
              <>
                {boardLeads.length} lead{boardLeads.length === 1 ? "" : "s"} · Assigned → Contacted →{" "}
                <button type="button" onClick={() => setLocation("/pipeline")} className="text-primary hover:underline font-medium">Pipeline</button>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="search" placeholder="Search leads..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-border rounded-lg px-3 py-2 text-sm bg-background">
            <option value="ALL">All on board</option>
            {LEADS_BOARD_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </div>
        {boardLeads.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-xl">
            <p className="font-medium text-foreground">No leads on this board</p>
            <p className="text-sm mt-1">Assigned leads appear here. After contact, they move to Contacted then Pipeline.</p>
            <button type="button" onClick={() => setLocation("/pipeline")} className="mt-4 text-sm font-medium text-primary hover:underline">Open Pipeline →</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {LEADS_BOARD_STATUSES.map((status) => {
              const columnLeads = boardLeads.filter((l) => l.status === status);
              const color = STATUS_COLORS[status];
              return (
                <div key={status} className="flex flex-col min-h-[200px]">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                      <h2 className="font-display font-semibold text-sm text-foreground">{STATUS_LABELS[status]}</h2>
                    </div>
                    <span className="text-xs text-muted-foreground font-medium">{columnLeads.length}</span>
                  </div>
                  <div className="flex-1 space-y-3 rounded-xl border border-border/80 bg-muted/20 p-3">
                    {columnLeads.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-8 italic">No {STATUS_LABELS[status].toLowerCase()} leads</p>
                    ) : (
                      columnLeads.map((lead) => (
                        <LeadCard
                          key={lead.id}
                          lead={lead}
                          reps={reps}
                          recentActivities={activitiesForLead(activitiesByLead, lead.id, 2)}
                          onCta={handleCta}
                          onEdit={canStaffOverride ? setEditingLead : undefined}
                          onDelete={canStaffOverride ? handleDelete : undefined}
                          onViewActivities={setActivityLeadId}
                          staffTools={canStaffOverride}
                          ctaLoading={ctaLoading}
                          deleting={deletingId === lead.id}
                          formatMoney={formatMoney}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <LeadEditModal
        lead={editingLead}
        open={!!editingLead}
        isAdmin={canStaffOverride}
        saving={update.isPending}
        onClose={() => setEditingLead(null)}
        onSave={handleSaveLead}
      />
      <LeadActivityLogModal
        leadId={activityLeadId}
        leadName={activityLead?.name ?? "Lead"}
        activities={activities}
        open={!!activityLeadId}
        onClose={() => setActivityLeadId(null)}
      />
    </Sidebar>
  );
}
