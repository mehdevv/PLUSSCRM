import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Calendar, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMeetingBriefByDeal } from "@/services/meetingBriefs";
import type { Deal, Lead } from "@/types";
import type { MeetingBriefInput, MeetingFormat } from "@/types/meeting-brief";

const FORMAT_OPTIONS: { value: MeetingFormat; label: string }[] = [
  { value: "VIDEO", label: "Video call" },
  { value: "IN_PERSON", label: "In person" },
  { value: "PHONE", label: "Phone" },
];

export interface MeetingPendingModalProps {
  deal: Deal | null;
  lead: Lead | null;
  open: boolean;
  busy?: boolean;
  /** When true, only save the brief (deal is already in Meeting pending). */
  editOnly?: boolean;
  onClose: () => void;
  onSubmit: (input: MeetingBriefInput) => Promise<void>;
}

export function MeetingPendingModal({
  deal,
  lead,
  open,
  busy,
  editOnly = false,
  onClose,
  onSubmit,
}: MeetingPendingModalProps) {
  const [contactRole, setContactRole] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [meetingTime, setMeetingTime] = useState("");
  const [meetingFormat, setMeetingFormat] = useState<MeetingFormat>("VIDEO");
  const [attendees, setAttendees] = useState("");
  const [leadNeeds, setLeadNeeds] = useState("");
  const [painPoints, setPainPoints] = useState("");
  const [budgetNotes, setBudgetNotes] = useState("");
  const [talkingPoints, setTalkingPoints] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [loadingBrief, setLoadingBrief] = useState(false);

  useEffect(() => {
    if (!open || !deal || !lead) return;

    let cancelled = false;
    setLoadingBrief(true);

    void (async () => {
      try {
        const existing = await getMeetingBriefByDeal(deal.id);
        if (cancelled) return;

        if (existing) {
          setContactRole(existing.contact_role ?? "");
          if (existing.meeting_scheduled_at) {
            const d = new Date(existing.meeting_scheduled_at);
            setMeetingDate(format(d, "yyyy-MM-dd"));
            setMeetingTime(format(d, "HH:mm"));
          } else {
            setMeetingDate("");
            setMeetingTime("");
          }
          setMeetingFormat(existing.meeting_format);
          setAttendees(existing.attendees ?? "");
          setLeadNeeds(existing.lead_needs);
          setPainPoints(existing.pain_points ?? "");
          setBudgetNotes(existing.budget_notes ?? "");
          setTalkingPoints(existing.talking_points ?? "");
          setAdditionalNotes(existing.additional_notes ?? "");
        } else {
          setContactRole("");
          setMeetingDate("");
          setMeetingTime("");
          setMeetingFormat("VIDEO");
          setAttendees("");
          setLeadNeeds(lead.notes?.trim() ?? "");
          setPainPoints("");
          setBudgetNotes("");
          setTalkingPoints("");
          setAdditionalNotes("");
        }
      } catch {
        if (!cancelled) {
          setLeadNeeds(lead.notes?.trim() ?? "");
        }
      } finally {
        if (!cancelled) setLoadingBrief(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, deal, lead]);

  if (!open || !deal || !lead) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadNeeds.trim()) return;

    let meeting_scheduled_at: string | null = null;
    if (meetingDate) {
      const time = meetingTime || "09:00";
      meeting_scheduled_at = new Date(`${meetingDate}T${time}`).toISOString();
    }

    await onSubmit({
      deal_id: deal.id,
      lead_id: lead.id,
      rep_id: deal.rep_id,
      contact_role: contactRole,
      meeting_scheduled_at,
      meeting_format: meetingFormat,
      attendees,
      lead_needs: leadNeeds,
      pain_points: painPoints,
      budget_notes: budgetNotes,
      talking_points: talkingPoints,
      additional_notes: additionalNotes,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-card-border rounded-xl shadow-lg w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between gap-3 p-5 border-b border-border shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-primary mb-1">
              <Calendar className="w-4 h-4 shrink-0" />
              <span className="text-xs font-semibold uppercase tracking-wide">Meeting prep</span>
            </div>
            <h2 className="font-display text-lg font-bold text-foreground">
              {editOnly ? "Meeting brief" : "Move to Meeting pending"}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5 truncate">
              {lead.name} · {lead.company}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="text-muted-foreground hover:text-foreground shrink-0 disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {loadingBrief ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
            <div className="flex-1 overflow-y-auto p-5 space-y-3 scrollbar-minimal">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Contact</label>
                  <p className="mt-1 text-foreground">{lead.name}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Company</label>
                  <p className="mt-1 text-foreground truncate">{lead.company || "—"}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Phone</label>
                  <p className="mt-1 text-foreground">{lead.phone || "—"}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Email</label>
                  <p className="mt-1 text-foreground truncate">{lead.email || "—"}</p>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Contact role / title</label>
                <input
                  value={contactRole}
                  onChange={(e) => setContactRole(e.target.value)}
                  placeholder="e.g. Director, Owner"
                  className="mt-1 w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Meeting date</label>
                  <input
                    type="date"
                    value={meetingDate}
                    onChange={(e) => setMeetingDate(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Time</label>
                  <input
                    type="time"
                    value={meetingTime}
                    onChange={(e) => setMeetingTime(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Meeting format</label>
                <select
                  value={meetingFormat}
                  onChange={(e) => setMeetingFormat(e.target.value as MeetingFormat)}
                  className="mt-1 w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
                >
                  {FORMAT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Other attendees</label>
                <input
                  value={attendees}
                  onChange={(e) => setAttendees(e.target.value)}
                  placeholder="Names or roles joining the meeting"
                  className="mt-1 w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  What does the lead need? <span className="text-destructive">*</span>
                </label>
                <textarea
                  required
                  value={leadNeeds}
                  onChange={(e) => setLeadNeeds(e.target.value)}
                  rows={3}
                  placeholder="Products, services, or outcomes they expect from this meeting"
                  className="mt-1 w-full px-3 py-2 border border-border rounded-lg bg-background text-sm resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Pain points / challenges</label>
                <textarea
                  value={painPoints}
                  onChange={(e) => setPainPoints(e.target.value)}
                  rows={2}
                  placeholder="Problems they're trying to solve"
                  className="mt-1 w-full px-3 py-2 border border-border rounded-lg bg-background text-sm resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Budget / pricing notes</label>
                <textarea
                  value={budgetNotes}
                  onChange={(e) => setBudgetNotes(e.target.value)}
                  rows={2}
                  placeholder="Budget range or pricing discussed so far"
                  className="mt-1 w-full px-3 py-2 border border-border rounded-lg bg-background text-sm resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Talking points for the meeting</label>
                <textarea
                  value={talkingPoints}
                  onChange={(e) => setTalkingPoints(e.target.value)}
                  rows={2}
                  placeholder="What you plan to cover or demo"
                  className="mt-1 w-full px-3 py-2 border border-border rounded-lg bg-background text-sm resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Additional notes</label>
                <textarea
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  rows={2}
                  placeholder="Anything else the team should know"
                  className="mt-1 w-full px-3 py-2 border border-border rounded-lg bg-background text-sm resize-none"
                />
              </div>
            </div>

            <div className="p-5 border-t border-border flex gap-2 shrink-0">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={busy || !leadNeeds.trim()}>
                {busy ? "Saving…" : editOnly ? "Save brief" : "Save & move to Meeting pending"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
