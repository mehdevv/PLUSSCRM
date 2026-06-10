import { useEffect, useMemo, useRef, useState } from "react";
import { activeBoardDeals, dealsInBoardColumn, PIPELINE_KANBAN_STAGES, terminalBoardDeals } from "@/lib/pipeline-board";
import { useLocation } from "wouter";
import { Sidebar } from "@/components/layout/Sidebar";
import { ACTIVE_PIPELINE_STAGES, STATUS_COLORS, STATUS_LABELS, LEADS_RETURN_OPTIONS } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { useCurrency } from "@/hooks/useCurrency";
import { useDeals, useDealMutations, useSalesReps, useLeads, useActivities, usePayments, useSettings } from "@/hooks/queries";
import { FreemoveControl } from "@/components/pipeline/FreemoveControl";
import { TerminalDealCard, FREEMOVE_DRAG_MIME } from "@/components/pipeline/TerminalDealCard";
import { repHasFreemove, type FreemoveTarget } from "@/lib/freemove";
import { cn } from "@/lib/utils";
import { formatClientLtvAmount } from "@/lib/client-ltv";
import { wonDealDisplayAmount } from "@/lib/deal-value";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { DealWonModal } from "@/components/pipeline/DealWonModal";
import { MeetingPendingModal } from "@/components/pipeline/MeetingPendingModal";
import { upsertMeetingBrief } from "@/services/meetingBriefs";
import type { MeetingBriefInput } from "@/types/meeting-brief";
import { findClientByLead } from "@/services/clients";
import { leadHasTerminalDeal } from "@/services/deals";
import { completeDealWon } from "@/services/won-deal";
import type { WonDealPaymentInput } from "@/services/won-deal";
import { queryKeys } from "@/hooks/queries/keys";
import {
  nextPipelineStage,
  moveDealToStage,
  PIPELINE_STAGE_OPTIONS,
  returnLeadToBoard,
  syncOrphanedPipelineLeads,
  type LeadsBoardTarget,
} from "@/services/deals";
import { useQueryClient } from "@tanstack/react-query";
import { useStaffView } from "@/hooks/useSuperMode";
import { LeadDetailsModal } from "@/components/leads/LeadDetailsModal";
import { LeadActivityLogModal } from "@/components/leads/LeadActivityLogModal";
import { LeadActivityPreview } from "@/components/leads/LeadActivityPreview";
import { groupActivitiesByLead, activitiesForLead } from "@/lib/activity-display";
import type { Activity, Deal, Lead, LeadStatus, Profile } from "@/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertCircle, X, ArrowRight, Trophy, XCircle, ClipboardList, Phone, Eye, Info, Calendar } from "lucide-react";

const STAGES = PIPELINE_KANBAN_STAGES;
type DropTarget = LeadStatus;

function PipelineDropColumn({
  dropKey,
  dropHighlight,
  onDragOver,
  onDrop,
  className,
  children,
}: {
  dropKey: DropTarget;
  dropHighlight: DropTarget | null;
  onDragOver: (key: DropTarget | null) => void;
  onDrop: (dealId: string, key: DropTarget) => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(className, dropHighlight === dropKey && "ring-2 ring-red-400/60 rounded-xl")}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(FREEMOVE_DRAG_MIME)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        onDragOver(dropKey);
      }}
      onDragLeave={(e) => {
        const related = e.relatedTarget as Node | null;
        if (related && e.currentTarget.contains(related)) return;
        onDragOver(null);
      }}
      onDrop={(e) => {
        e.preventDefault();
        const dealId = e.dataTransfer.getData(FREEMOVE_DRAG_MIME);
        if (dealId) onDrop(dealId, dropKey);
        onDragOver(null);
      }}
    >
      {children}
    </div>
  );
}

/** Active pipeline deals that can be marked Won */
const WINNABLE_STAGES: LeadStatus[] = [...ACTIVE_PIPELINE_STAGES];

function nextAdvanceLabel(stage: LeadStatus): string | null {
  const next = nextPipelineStage(stage);
  if (!next) return null;
  if (next === "WON") return "→ Won";
  return `→ ${STATUS_LABELS[next]}`;
}

const PIPELINE_ADVANCE_FLOW = PIPELINE_KANBAN_STAGES.map((s) => STATUS_LABELS[s]).join(" → ");

function PipelineOperationsHelp({ showStaffNote, showFreemoveNote }: { showStaffNote?: boolean; showFreemoveNote?: boolean }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center w-7 h-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Pipeline operations help"
        >
          <Info className="w-4 h-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 sm:w-96" align="start">
        <p className="font-medium text-foreground text-sm mb-2">Pipeline operations</p>
        <ul className="space-y-2 text-xs text-muted-foreground">
          <li>
            <strong className="text-foreground">Log</strong> — record a call, email, or meeting on the Activities page
          </li>
          <li>
            <strong className="text-foreground">Advance</strong> — move deal to the next stage ({PIPELINE_ADVANCE_FLOW}). At Meeting pending, fill in the meeting prep brief first.
          </li>
          <li>
            <strong className="text-foreground">Won</strong> — close the deal, record payment details, upload receipts, and open the client profile
          </li>
          <li>
            <strong className="text-foreground">Lost</strong> — mark the deal as lost
          </li>
          {showStaffNote && (
            <li>
              <strong className="text-foreground">Change stage</strong> — jump to any pipeline stage or return the lead to Assigned / Contacted on Leads
            </li>
          )}
          {showFreemoveNote && (
            <li>
              <strong className="text-foreground">Freemove</strong> — red button on a card: drag to any column or pick a destination from the menu
            </li>
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function StageSelect({
  deal,
  busy,
  onChange,
}: {
  deal: Deal;
  busy: boolean;
  onChange: (deal: Deal, value: string) => void;
}) {
  return (
    <select
      value={deal.stage}
      disabled={busy}
      onChange={(e) => onChange(deal, e.target.value)}
      className="w-full text-[10px] font-medium px-2 py-1.5 rounded-md border border-amber-500/40 bg-amber-500/5 text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500/50 disabled:opacity-50"
      data-testid={`stage-select-${deal.id}`}
    >
      <optgroup label="Pipeline">
        {PIPELINE_STAGE_OPTIONS.map((s) => (
          <option key={s} value={s}>{STATUS_LABELS[s]}</option>
        ))}
      </optgroup>
      <optgroup label="Return to Leads">
        {LEADS_RETURN_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </optgroup>
    </select>
  );
}

function RepBadge({ repId, reps }: { repId: string; reps: Profile[] }) {
  const rep = reps.find((r) => r.id === repId);
  if (!rep) return null;
  return (
    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0" style={{ backgroundColor: rep.color }} title={rep.name}>
      {rep.initials}
    </div>
  );
}

function DealCard({
  deal,
  lead,
  recentActivities,
  reps,
  busy,
  staffTools,
  onAdvance,
  onStageChange,
  onWon,
  onLost,
  onLogActivity,
  onViewLead,
  onViewActivities,
  onViewMeetingBrief,
  formatMoney,
  freemoveVisible,
  freemoveActive,
  onFreemoveToggle,
  onFreemoveMove,
  onFreemoveDragStart,
  onFreemoveDragEnd,
}: {
  deal: Deal;
  lead?: Lead;
  recentActivities: Activity[];
  reps: Profile[];
  busy: boolean;
  staffTools?: boolean;
  onAdvance: (deal: Deal) => void;
  onStageChange?: (deal: Deal, value: string) => void;
  onWon: (deal: Deal) => void;
  onLost: (deal: Deal) => void;
  onLogActivity: (deal: Deal) => void;
  onViewLead: (lead: Lead) => void;
  onViewActivities: (leadId: string) => void;
  onViewMeetingBrief?: (deal: Deal) => void;
  formatMoney: (n: number, c?: string) => string;
  freemoveVisible?: boolean;
  freemoveActive?: boolean;
  onFreemoveToggle?: (deal: Deal) => void;
  onFreemoveMove?: (deal: Deal, target: FreemoveTarget) => void;
  onFreemoveDragStart?: (deal: Deal) => void;
  onFreemoveDragEnd?: () => void;
}) {
  const color = STATUS_COLORS[deal.stage];
  const next = nextPipelineStage(deal.stage);
  const canAdvance = next != null && next !== "WON";
  const canMarkWon = WINNABLE_STAGES.includes(deal.stage);

  return (
    <div
      className={cn(
        "bg-card border border-card-border rounded-xl p-3.5 shadow-sm relative overflow-hidden",
        freemoveActive && "ring-2 ring-red-400/70 cursor-grab active:cursor-grabbing",
      )}
      data-testid={`deal-card-${deal.id}`}
      draggable={!!freemoveActive}
      onDragStart={(e) => {
        if (!freemoveActive) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.setData(FREEMOVE_DRAG_MIME, deal.id);
        e.dataTransfer.effectAllowed = "move";
        onFreemoveDragStart?.(deal);
      }}
      onDragEnd={() => onFreemoveDragEnd?.()}
    >
      {freemoveVisible && onFreemoveToggle && onFreemoveMove && (
        <FreemoveControl
          deal={deal}
          visible
          active={!!freemoveActive}
          busy={busy}
          onToggle={onFreemoveToggle}
          onMove={onFreemoveMove}
        />
      )}
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl" style={{ backgroundColor: color }} />
      <div className="pl-2">
        <div className="flex items-start justify-between mb-1.5 gap-2">
          <div className="min-w-0">
            <div className="font-display font-bold text-sm text-foreground">{deal.lead_name}</div>
            <div className="text-xs text-muted-foreground truncate">{deal.company}</div>
            {lead?.phone?.trim() ? (
              <a
                href={`tel:${lead.phone}`}
                className="inline-flex items-center gap-1 mt-1 text-xs font-medium text-blue-600 hover:underline"
                data-testid={`deal-phone-${deal.id}`}
              >
                <Phone className="w-3 h-3 shrink-0" />
                <span className="truncate">{lead.phone}</span>
              </a>
            ) : (
              <span className="inline-flex items-center gap-1 mt-1 text-xs text-muted-foreground/50 italic">
                <Phone className="w-3 h-3 shrink-0" /> No phone
              </span>
            )}
          </div>
          {deal.overdue && <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="font-semibold text-sm text-foreground">{formatMoney(deal.value, deal.currency)}</span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">{deal.days_in_stage}d in stage</span>
            <RepBadge repId={deal.rep_id} reps={reps} />
          </div>
        </div>
        <div className="mt-1.5 mb-2">
          <span className={`text-[10px] ${deal.overdue ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
            Close: {formatDate(deal.close_date)}
          </span>
        </div>
        {lead && (
          <LeadActivityPreview
            leadId={lead.id}
            activities={recentActivities}
            onViewAll={onViewActivities}
            compact
          />
        )}
        {staffTools && onStageChange && (
          <div className="mb-2">
            <StageSelect deal={deal} busy={busy} onChange={onStageChange} />
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          {lead && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onViewLead(lead)}
              className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md border border-border bg-background hover:bg-muted disabled:opacity-50"
              data-testid={`btn-lead-details-${deal.id}`}
            >
              <Eye className="w-3 h-3" /> Details
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => onLogActivity(deal)}
            className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md border border-border bg-background hover:bg-muted disabled:opacity-50"
          >
            <ClipboardList className="w-3 h-3" /> Log
          </button>
          {deal.stage === "MEETING_PENDING" && onViewMeetingBrief && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onViewMeetingBrief(deal)}
              className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md border border-violet-500/40 bg-violet-500/10 text-violet-700 hover:bg-violet-500/15 disabled:opacity-50"
            >
              <Calendar className="w-3 h-3" /> Brief
            </button>
          )}
          {!staffTools && canAdvance && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onAdvance(deal)}
              className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md text-white disabled:opacity-50"
              style={{ backgroundColor: color }}
            >
              <ArrowRight className="w-3 h-3" /> {nextAdvanceLabel(deal.stage) ?? "Advance"}
            </button>
          )}
          {!staffTools && canMarkWon && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onWon(deal)}
              className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
              data-testid={`btn-won-${deal.id}`}
            >
              <Trophy className="w-3 h-3" /> Won
            </button>
          )}
          {!staffTools && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onLost(deal)}
              className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md border border-border text-muted-foreground hover:text-destructive hover:border-destructive/30 disabled:opacity-50"
            >
              <XCircle className="w-3 h-3" /> Lost
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Pipeline() {
  const { user } = useAuth();
  const { effectiveRepId, canStaffOverride, effectiveRep } = useStaffView();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [viewingLead, setViewingLead] = useState<Lead | null>(null);
  const [activityLeadId, setActivityLeadId] = useState<string | null>(null);
  const [wonDeal, setWonDeal] = useState<Deal | null>(null);
  const [wonBusy, setWonBusy] = useState(false);
  const [meetingPendingDeal, setMeetingPendingDeal] = useState<Deal | null>(null);
  const [meetingBriefEditOnly, setMeetingBriefEditOnly] = useState(false);
  const [meetingBriefBusy, setMeetingBriefBusy] = useState(false);
  const [freemoveDealId, setFreemoveDealId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [dealForm, setDealForm] = useState({ lead_id: "", value: "", close_date: "", currency: "USD" as "USD" | "DZD" });
  const { formatMoney, convertAmount, displayCurrency } = useCurrency();
  const { data: platformSettings } = useSettings();
  const { data: salesReps = [] } = useSalesReps();
  const { data: leads = [], isLoading: leadsLoading } = useLeads();
  const { data: activities = [] } = useActivities();
  const activitiesByLead = useMemo(() => groupActivitiesByLead(activities), [activities]);
  const repId = effectiveRepId ?? user?.id;
  const { data: deals = [], isLoading: dealsLoading } = useDeals(repId);
  const { data: payments = [] } = usePayments();
  const paymentByLeadId = useMemo(
    () => new Map(payments.map((p) => [p.lead_id, p])),
    [payments],
  );
  const { updateStage, create } = useDealMutations();
  const queryClient = useQueryClient();
  const syncRan = useRef(false);
  const isLoading = leadsLoading || dealsLoading;

  useEffect(() => {
    if (!repId || isLoading || syncRan.current) return;

    const needsSync = leads.some(
      (l) =>
        l.assigned_to === repId &&
        ACTIVE_PIPELINE_STAGES.includes(l.status) &&
        !leadHasTerminalDeal(l.id, deals) &&
        !deals.some((d) => d.lead_id === l.id && ACTIVE_PIPELINE_STAGES.includes(d.stage)),
    );

    if (!needsSync) return;

    syncRan.current = true;
    void (async () => {
      try {
        const count = await syncOrphanedPipelineLeads(repId, leads, deals);
        if (count > 0) {
          await queryClient.invalidateQueries({ queryKey: ["deals"] });
          await queryClient.invalidateQueries({ queryKey: ["leads"] });
        }
      } catch {
        syncRan.current = false;
      }
    })();
  }, [repId, leads, deals, isLoading, queryClient]);

  const eligibleLeads = leads.filter(
    (l) => ACTIVE_PIPELINE_STAGES.includes(l.status) && l.assigned_to === repId
      && !deals.some((d) => d.lead_id === l.id && d.stage !== "LOST"),
  );

  const leadById = new Map(leads.map((l) => [l.id, l]));
  const activityLead = activityLeadId ? leadById.get(activityLeadId) : null;
  const pipelineDeals = useMemo(() => activeBoardDeals(deals), [deals]);
  const wonDeals = useMemo(() => terminalBoardDeals(deals, "WON"), [deals]);
  const lostDeals = useMemo(() => terminalBoardDeals(deals, "LOST"), [deals]);
  const busy = updateStage.isPending || create.isPending || meetingBriefBusy;
  const canFreemove = repHasFreemove(platformSettings, repId);
  const dealById = useMemo(() => new Map(deals.map((d) => [d.id, d])), [deals]);

  const handleFreemoveToggle = (deal: Deal) => {
    setFreemoveDealId((current) => (current === deal.id ? null : deal.id));
  };

  const totalValue = pipelineDeals.reduce((s, d) => s + convertAmount(d.value, d.currency), 0);
  const wonValue = wonDeals.reduce((s, d) => {
    const { amount, currency } = wonDealDisplayAmount(d, paymentByLeadId.get(d.lead_id));
    return s + convertAmount(amount, currency);
  }, 0);
  const lostValue = lostDeals.reduce((s, d) => s + convertAmount(d.value, d.currency), 0);

  const openMeetingBrief = (deal: Deal, editOnly = false) => {
    setMeetingBriefEditOnly(editOnly);
    setMeetingPendingDeal(deal);
  };

  const handleAdvance = async (deal: Deal) => {
    const next = nextPipelineStage(deal.stage);
    if (!next || next === "WON") return;
    if (next === "MEETING_PENDING") {
      openMeetingBrief(deal, false);
      return;
    }
    try {
      await updateStage.mutateAsync({ id: deal.id, stage: next, leadId: deal.lead_id });
      toast({ title: "Stage updated", description: `Moved to ${STATUS_LABELS[next] ?? next}.` });
    } catch (err) {
      toast({ title: "Update failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    }
  };

  const handleMeetingBriefSubmit = async (input: MeetingBriefInput) => {
    if (!meetingPendingDeal) return;
    setMeetingBriefBusy(true);
    try {
      await upsertMeetingBrief(input);
      if (!meetingBriefEditOnly) {
        await updateStage.mutateAsync({
          id: meetingPendingDeal.id,
          stage: "MEETING_PENDING",
          leadId: meetingPendingDeal.lead_id,
        });
        toast({
          title: "Meeting brief saved",
          description: `Deal moved to ${STATUS_LABELS.MEETING_PENDING}.`,
        });
      } else {
        toast({ title: "Meeting brief updated" });
      }
      setMeetingPendingDeal(null);
    } catch (err) {
      toast({
        title: "Could not save meeting brief",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setMeetingBriefBusy(false);
    }
  };

  const openWonModal = (deal: Deal) => setWonDeal(deal);

  const handleWonSubmit = async (payment: WonDealPaymentInput, files: File[]) => {
    if (!wonDeal) return;
    const lead = leadById.get(wonDeal.lead_id);
    if (!lead) {
      toast({ title: "Lead not found", variant: "destructive" });
      return;
    }
    setWonBusy(true);
    const wonDealId = wonDeal.id;
    const wonLeadId = wonDeal.lead_id;
    queryClient.setQueriesData<Deal[]>({ queryKey: ["deals"] }, (old) => {
      if (!old) return old;
      return old
        .map((d) => (d.id === wonDealId ? { ...d, stage: "WON" as const } : d))
        .filter(
          (d) => d.id === wonDealId || d.lead_id !== wonLeadId || !ACTIVE_PIPELINE_STAGES.includes(d.stage),
        );
    });
    try {
      const client = await completeDealWon(wonDeal, lead, payment, files);
      await queryClient.invalidateQueries({ queryKey: queryKeys.clients });
      await queryClient.invalidateQueries({ queryKey: queryKeys.payments });
      await queryClient.invalidateQueries({ queryKey: ["deals"] });
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
      setWonDeal(null);
      if (!client) {
        toast({
          title: "Deal won!",
          description: `${lead.company ?? wonDeal.lead_name} — no client record (zero value).`,
        });
        setLocation("/clients");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.client(client.id) });
      await queryClient.invalidateQueries({ queryKey: [...queryKeys.client(client.id), "files"] });
      toast({
        title: "Deal won!",
        description: payment.recordPayment
          ? `${lead.company ?? wonDeal.lead_name} — payment recorded.`
          : `${lead.company ?? wonDeal.lead_name} is now in Clients.`,
      });
      setLocation(`/clients/${client.id}`);
    } catch (err) {
      toast({ title: "Could not mark won", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setWonBusy(false);
    }
  };

  const handleLost = async (deal: Deal) => {
    try {
      await updateStage.mutateAsync({ id: deal.id, stage: "LOST", leadId: deal.lead_id });
      toast({ title: "Deal marked lost", description: "Moved to Lost column." });
    } catch (err) {
      toast({ title: "Update failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    }
  };

  const handleLogActivity = (deal: Deal) => {
    setLocation(`/activities?lead=${deal.lead_id}`);
  };

  const invalidatePipeline = async () => {
    await queryClient.invalidateQueries({ queryKey: ["deals"] });
    await queryClient.invalidateQueries({ queryKey: ["leads"] });
  };

  const handleReturnToBoard = async (deal: Deal, target: LeadsBoardTarget) => {
    const label = target === "ASSIGNED" ? "Assigned" : "Contacted";
    if (!window.confirm(`Return "${deal.lead_name}" to Leads (${label})? The pipeline deal will be removed.`)) return;
    try {
      await returnLeadToBoard(deal.lead_id, deal.id, target);
      await invalidatePipeline();
      toast({ title: "Returned to Leads", description: `Lead is on the ${label} column.` });
      setLocation("/leads");
    } catch (err) {
      toast({ title: "Could not return lead", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    }
  };

  const handleStageChange = async (deal: Deal, value: string) => {
    if (value === deal.stage) return;

    const leadsReturn = LEADS_RETURN_OPTIONS.find((o) => o.value === value);
    if (leadsReturn) {
      await handleReturnToBoard(deal, leadsReturn.status);
      return;
    }

    const stage = value as LeadStatus;
    if (!PIPELINE_STAGE_OPTIONS.includes(stage)) return;

    try {
      if (stage === "WON") {
        openWonModal(deal);
        return;
      }
      if (stage === "MEETING_PENDING" && deal.stage !== "MEETING_PENDING") {
        openMeetingBrief(deal, false);
        return;
      }
      await moveDealToStage(deal.id, deal.lead_id, stage);
      await invalidatePipeline();
      toast({ title: "Stage updated", description: `Moved to ${STATUS_LABELS[stage]}.` });
    } catch (err) {
      toast({ title: "Update failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    }
  };

  const handleFreemoveMove = async (deal: Deal, target: FreemoveTarget) => {
    setFreemoveDealId(null);
    setDropTarget(null);
    if (target.kind === "leads") {
      const leadsReturn = LEADS_RETURN_OPTIONS.find((o) => o.value === target.value);
      if (leadsReturn) await handleReturnToBoard(deal, leadsReturn.status);
      return;
    }
    if (target.value === deal.stage) return;
    await handleStageChange(deal, target.value);
  };

  const handleFreemoveDrop = async (dealId: string, stage: DropTarget) => {
    const deal = dealById.get(dealId);
    if (!deal || deal.stage === stage) {
      setFreemoveDealId(null);
      setDropTarget(null);
      return;
    }
    setFreemoveDealId(null);
    setDropTarget(null);
    await handleStageChange(deal, stage);
  };

  const freemoveProps = canFreemove
    ? {
        freemoveVisible: true as const,
        freemoveActive: (id: string) => freemoveDealId === id,
        onFreemoveToggle: handleFreemoveToggle,
        onFreemoveMove: handleFreemoveMove,
        onFreemoveDragStart: () => {},
        onFreemoveDragEnd: () => setDropTarget(null),
      }
    : null;

  const handleCreateDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    const lead = leads.find((l) => l.id === dealForm.lead_id);
    const assignedRep = lead?.assigned_to || user?.id;
    if (!dealForm.lead_id || !assignedRep) {
      toast({ title: "Missing fields", description: "Select a lead assigned to you.", variant: "destructive" });
      return;
    }
    try {
      await create.mutateAsync({
        lead_id: dealForm.lead_id,
        rep_id: assignedRep,
        value: dealForm.value ? Number(dealForm.value) : (lead?.value ?? 0),
        stage: "CONTACTED",
        close_date: dealForm.close_date || undefined,
        currency: dealForm.currency,
      });
      setDealForm({ lead_id: "", value: "", close_date: "", currency: displayCurrency });
      setShowCreate(false);
      toast({ title: "Deal created", description: "Added to Contacted column." });
    } catch (err) {
      toast({ title: "Failed to create deal", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    }
  };

  if (isLoading) {
    return <Sidebar><div className="p-6 min-h-full text-muted-foreground">Loading...</div></Sidebar>;
  }

  return (
    <Sidebar>
      <div className="p-6 min-h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-display text-2xl font-bold text-foreground">Pipeline</h1>
              <PipelineOperationsHelp showStaffNote={canStaffOverride} showFreemoveNote={canFreemove} />
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {canStaffOverride && effectiveRep ? (
                <>Managing <strong>{effectiveRep.name}</strong>&apos;s pipeline — {pipelineDeals.length} active deals</>
              ) : (
                <>{pipelineDeals.length} active deals · <span className="font-semibold text-foreground">{formatMoney(totalValue)}</span> in pipeline</>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="text-xs font-medium px-3 py-1.5 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity"
            data-testid="btn-new-deal"
          >
            + New Deal
          </button>
        </div>

        <div className="flex gap-4 overflow-x-auto flex-1 pb-4">
          {STAGES.map((stage) => {
            const stageDeals = dealsInBoardColumn(pipelineDeals, stage)
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            const stageValue = stageDeals.reduce((s, d) => s + convertAmount(d.value, d.currency), 0);
            const color = STATUS_COLORS[stage];
            return (
              <PipelineDropColumn
                key={stage}
                dropKey={stage}
                dropHighlight={dropTarget}
                onDragOver={setDropTarget}
                onDrop={handleFreemoveDrop}
                className="flex-shrink-0 w-80"
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-sm font-semibold text-foreground">{STATUS_LABELS[stage]}</span>
                  <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full ml-auto">{stageDeals.length}</span>
                </div>
                <div className="text-xs text-muted-foreground mb-2.5 pl-1">{formatMoney(stageValue)} total</div>
                <div className="space-y-2.5">
                  {stageDeals.map((deal) => (
                    <DealCard
                      key={deal.id}
                      deal={deal}
                      lead={leadById.get(deal.lead_id)}
                      recentActivities={activitiesForLead(activitiesByLead, deal.lead_id, 2)}
                      reps={salesReps}
                      busy={busy}
                      staffTools={canStaffOverride}
                      onAdvance={handleAdvance}
                      onStageChange={canStaffOverride ? handleStageChange : undefined}
                      onWon={openWonModal}
                      onLost={handleLost}
                      onLogActivity={handleLogActivity}
                      onViewLead={setViewingLead}
                      onViewActivities={setActivityLeadId}
                      onViewMeetingBrief={(d) => openMeetingBrief(d, true)}
                      formatMoney={formatMoney}
                      freemoveVisible={freemoveProps?.freemoveVisible}
                      freemoveActive={freemoveProps?.freemoveActive(deal.id)}
                      onFreemoveToggle={freemoveProps?.onFreemoveToggle}
                      onFreemoveMove={freemoveProps?.onFreemoveMove}
                      onFreemoveDragStart={freemoveProps?.onFreemoveDragStart}
                      onFreemoveDragEnd={freemoveProps?.onFreemoveDragEnd}
                    />
                  ))}
                  {stageDeals.length === 0 && (
                    <div className="border-2 border-dashed border-border rounded-xl p-6 text-center text-xs text-muted-foreground">
                      No deals in this stage
                    </div>
                  )}
                </div>
              </PipelineDropColumn>
            );
          })}

          <PipelineDropColumn
            dropKey="WON"
            dropHighlight={dropTarget}
            onDragOver={setDropTarget}
            onDrop={handleFreemoveDrop}
            className="flex-shrink-0 w-56"
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-sm font-semibold text-foreground">Won</span>
              <span className="text-xs bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-full ml-auto">{wonDeals.length}</span>
            </div>
            <div className="text-xs text-muted-foreground mb-2.5 pl-1">{formatMoney(wonValue)} total</div>
            <div className="space-y-2">
              {wonDeals.map((deal) => {
                const wonAmount = wonDealDisplayAmount(deal, paymentByLeadId.get(deal.lead_id));
                return (
                  <TerminalDealCard
                    key={deal.id}
                    deal={deal}
                    variant="won"
                    freemoveVisible={!!freemoveProps}
                    freemoveActive={freemoveProps?.freemoveActive(deal.id) ?? false}
                    freemoveBusy={busy}
                    onFreemoveToggle={handleFreemoveToggle}
                    onFreemoveMove={handleFreemoveMove}
                    onDragStart={() => {}}
                    onDragEnd={() => setDropTarget(null)}
                    footer={canStaffOverride ? (
                      <div className="mt-2 pt-2 border-t border-emerald-200/80">
                        <StageSelect deal={deal} busy={busy} onChange={handleStageChange} />
                      </div>
                    ) : undefined}
                  >
                    <button
                      type="button"
                      onClick={async () => {
                        const lead = leadById.get(deal.lead_id);
                        const client = await findClientByLead(lead?.company ?? deal.company, lead?.email);
                        if (client) setLocation(`/clients/${client.id}`);
                        else setLocation("/clients");
                      }}
                      className="w-full text-left hover:opacity-80 transition-opacity pr-7"
                    >
                      <div className="font-semibold text-emerald-800">{deal.lead_name}</div>
                      <div className="text-emerald-600 mt-0.5">{formatClientLtvAmount(wonAmount.amount, wonAmount.currency)}</div>
                      <div className="text-[10px] text-emerald-700 mt-1">View client →</div>
                    </button>
                  </TerminalDealCard>
                );
              })}
              {wonDeals.length === 0 && (
                <div className="border-2 border-dashed border-border rounded-lg p-4 text-center text-xs text-muted-foreground">No won deals</div>
              )}
            </div>
          </PipelineDropColumn>

          <PipelineDropColumn
            dropKey="LOST"
            dropHighlight={dropTarget}
            onDragOver={setDropTarget}
            onDrop={handleFreemoveDrop}
            className="flex-shrink-0 w-56"
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2.5 h-2.5 rounded-full bg-gray-400" />
              <span className="text-sm font-semibold text-foreground">Lost</span>
              <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full ml-auto">{lostDeals.length}</span>
            </div>
            <div className="text-xs text-muted-foreground mb-2.5 pl-1">{formatMoney(lostValue)} total</div>
            <div className="space-y-2">
              {lostDeals.map((deal) => (
                <TerminalDealCard
                  key={deal.id}
                  deal={deal}
                  variant="lost"
                  freemoveVisible={!!freemoveProps}
                  freemoveActive={freemoveProps?.freemoveActive(deal.id) ?? false}
                  freemoveBusy={busy}
                  onFreemoveToggle={handleFreemoveToggle}
                  onFreemoveMove={handleFreemoveMove}
                  onDragStart={() => {}}
                  onDragEnd={() => setDropTarget(null)}
                  footer={canStaffOverride ? (
                    <div className="mt-2 pt-2 border-t border-border">
                      <StageSelect deal={deal} busy={busy} onChange={handleStageChange} />
                    </div>
                  ) : undefined}
                >
                  <div className="pr-7">
                    <div className="font-semibold text-foreground">{deal.lead_name}</div>
                    <div className="text-muted-foreground mt-0.5">{formatMoney(deal.value, deal.currency)}</div>
                  </div>
                </TerminalDealCard>
              ))}
              {lostDeals.length === 0 && (
                <div className="border-2 border-dashed border-border rounded-lg p-4 text-center text-xs text-muted-foreground">No lost deals</div>
              )}
            </div>
          </PipelineDropColumn>
        </div>
      </div>

      <LeadDetailsModal
        lead={viewingLead}
        open={!!viewingLead}
        onClose={() => setViewingLead(null)}
        formatMoney={formatMoney}
      />
      <LeadActivityLogModal
        leadId={activityLeadId}
        leadName={activityLead?.name ?? "Lead"}
        activities={activities}
        open={!!activityLeadId}
        onClose={() => setActivityLeadId(null)}
      />
      <DealWonModal
        deal={wonDeal}
        lead={wonDeal ? leadById.get(wonDeal.lead_id) ?? null : null}
        open={!!wonDeal}
        busy={wonBusy}
        formatMoney={formatMoney}
        onClose={() => !wonBusy && setWonDeal(null)}
        onSubmit={handleWonSubmit}
      />
      <MeetingPendingModal
        deal={meetingPendingDeal}
        lead={meetingPendingDeal ? leadById.get(meetingPendingDeal.lead_id) ?? null : null}
        open={!!meetingPendingDeal}
        busy={meetingBriefBusy}
        editOnly={meetingBriefEditOnly}
        onClose={() => !meetingBriefBusy && setMeetingPendingDeal(null)}
        onSubmit={handleMeetingBriefSubmit}
      />

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-card-border rounded-xl shadow-lg w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold text-foreground">New Deal</h2>
              <button type="button" onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateDeal} className="space-y-3">
              <select
                required
                value={dealForm.lead_id}
                onChange={(e) => {
                  const lead = leads.find((l) => l.id === e.target.value);
                  setDealForm({ ...dealForm, lead_id: e.target.value, value: lead ? String(lead.value) : dealForm.value });
                }}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
              >
                <option value="">Select lead</option>
                {eligibleLeads.map((l) => (
                  <option key={l.id} value={l.id}>{l.name} — {l.company}</option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input type="number" min="0" required placeholder="Deal value" value={dealForm.value} onChange={(e) => setDealForm({ ...dealForm, value: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm" />
                <select value={dealForm.currency} onChange={(e) => setDealForm({ ...dealForm, currency: e.target.value as "USD" | "DZD" })} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm">
                  <option value="USD">USD</option>
                  <option value="DZD">DZD</option>
                </select>
              </div>
              <input type="date" value={dealForm.close_date} onChange={(e) => setDealForm({ ...dealForm, close_date: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm" />
              <button type="submit" disabled={create.isPending} className="w-full py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                {create.isPending ? "Creating..." : "Create Deal"}
              </button>
            </form>
          </div>
        </div>
      )}
    </Sidebar>
  );
}
