import { useMemo, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/Sidebar";
import { Spinner } from "@/components/ui/spinner";
import {
  useClient, useClientNotes, useClientMutations,
  useSalesReps, useDeals, usePayments, useActivities, useLeads,
} from "@/hooks/queries";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { fetchClientFiles } from "@/services/clients";
import { PaymentReceiptLinks } from "@/components/clients/PaymentReceiptLinks";
import { queryKeys } from "@/hooks/queries/keys";
import { formatDate } from "@/lib/format";
import { formatClientLtvAmount, paymentsForClient, resolveClientLtv } from "@/lib/client-ltv";
import { wonDealDisplayAmount } from "@/lib/deal-value";
import { ArrowLeft, Phone, Mail, MapPin, Flag } from "lucide-react";

const tabs = ["Deal History", "Payment History", "Activity Timeline", "Notes & Files"];

const ACTIVITY_ICONS: Record<string, string> = {
  CALL: "C",
  EMAIL: "E",
  MEETING: "M",
  NOTE: "N",
  TASK: "T",
  STAGE_CHANGE: "S",
  WHATSAPP: "W",
};

const ACTIVITY_COLORS: Record<string, string> = {
  CALL: "#1A1AFF",
  EMAIL: "#06B6D4",
  MEETING: "#8B5CF6",
  NOTE: "#F59E0B",
  TASK: "#F97316",
  STAGE_CHANGE: "#10B981",
  WHATSAPP: "#22C55E",
};

export default function ClientProfile() {
  const params = useParams<{ id: string }>();
  const clientId = params.id ?? "";
  const [activeTab, setActiveTab] = useState("Deal History");
  const [noteText, setNoteText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { user } = useAuth();
  const { toast } = useToast();
  const { data: client, isLoading, isError } = useClient(clientId);
  const { data: notes = [], isLoading: notesLoading } = useClientNotes(clientId);
  const { data: salesReps = [] } = useSalesReps();
  const { data: allDeals = [] } = useDeals();
  const { data: allPayments = [] } = usePayments();
  const { data: leads = [] } = useLeads();
  const { data: allActivities = [] } = useActivities();
  const leadEmailById = useMemo(() => new Map(leads.map((l) => [l.id, l.email])), [leads]);
  const { addNote, uploadFile, flagRenewal } = useClientMutations();
  const { data: files = [], isLoading: filesLoading } = useQuery({
    queryKey: [...queryKeys.client(clientId), "files"],
    queryFn: () => fetchClientFiles(clientId),
    enabled: !!clientId,
  });

  const manager = client ? salesReps.find((r) => r.id === client.manager_id) : undefined;
  const clientDeals = client ? allDeals.filter((d) => d.stage === "WON" && d.rep_id === client.manager_id && d.company?.trim().toLowerCase() === client.company?.trim().toLowerCase()) : [];
  const clientPayments = client ? paymentsForClient(client, allDeals, allPayments, leadEmailById) : [];
  const paymentByDealId = useMemo(
    () => new Map(clientPayments.map((p) => [p.deal_id, p])),
    [clientPayments],
  );
  const filesByPayment = files.reduce<Map<string, typeof files>>((map, file) => {
    if (!file.payment_id) return map;
    const list = map.get(file.payment_id) ?? [];
    list.push(file);
    map.set(file.payment_id, list);
    return map;
  }, new Map());
  const generalFiles = files.filter((f) => !f.payment_id);
  const clientActivities = client ? allActivities.filter((a) => a.company === client.company).slice(0, 20) : [];
  const clientLtv = client
    ? resolveClientLtv(client, allDeals, allPayments, leadEmailById)
    : { amount: 0, currency: "DZD" };

  const handleAddNote = async () => {
    if (!noteText.trim() || !user?.id) return;
    await addNote.mutateAsync({ clientId, userId: user.id, content: noteText.trim() });
    setNoteText("");
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadFile.mutateAsync({ clientId, file });
    e.target.value = "";
  };

  const handleFlagRenewal = async () => {
    if (!user?.id) return;
    try {
      await flagRenewal.mutateAsync({ clientId, userId: user.id });
      toast({ title: "Renewal flagged", description: "A follow-up note has been added to this client." });
    } catch (err) {
      toast({ title: "Failed to flag renewal", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <Sidebar>
        <div className="flex items-center justify-center min-h-full py-16">
          <Spinner className="w-6 h-6 text-primary" />
        </div>
      </Sidebar>
    );
  }

  if (isError || !client) {
    return (
      <Sidebar>
        <div className="p-6 min-h-full">
          <Link href="/clients" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="w-4 h-4" /> Back to Clients
          </Link>
          <div className="text-center py-16 text-sm text-muted-foreground">Client not found.</div>
        </div>
      </Sidebar>
    );
  }

  return (
    <Sidebar>
      <div className="p-6 min-h-full">
        <div className="flex items-center gap-2 mb-5">
          <Link href="/clients" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <span className="text-muted-foreground text-sm">Clients</span>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-medium">{client.company}</span>
        </div>

        <div className="bg-card border border-card-border rounded-xl p-6 mb-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground">{client.company}</h1>
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                {client.country && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{client.country}</span>}
                {client.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{client.phone}</span>}
                <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{client.email}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground mb-1">Lifetime Value</div>
              <div className="font-display text-2xl font-bold text-primary">{formatClientLtvAmount(clientLtv.amount, clientLtv.currency)}</div>
              <div className="text-xs text-muted-foreground mt-1">{client.deals_count} closed deals</div>
            </div>
          </div>

          <div className="flex items-center gap-6 mt-4 pt-4 border-t border-border">
            {manager && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: manager.color }}>
                  {manager.initials}
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Account Manager</div>
                  <div className="text-sm font-medium text-foreground">{manager.name}</div>
                </div>
              </div>
            )}
            <div>
              <div className="text-xs text-muted-foreground">Last Activity</div>
              <div className="text-sm font-medium text-foreground">{formatDate(client.last_activity)}</div>
            </div>
            <div className="ml-auto">
              <button
                type="button"
                onClick={handleFlagRenewal}
                disabled={flagRenewal.isPending}
                className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-50"
                data-testid="btn-flag-renewal"
              >
                <Flag className="w-3.5 h-3.5" />Flag for Renewal
              </button>
            </div>
          </div>
        </div>

        <div className="flex border-b border-border mb-5">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`tab-${tab.toLowerCase().replace(/\s/g, "-")}`}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === "Deal History" && (
          clientDeals.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground bg-card border border-card-border rounded-xl">No closed deals yet.</div>
          ) : (
            <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Deal</th>
                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Value</th>
                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Closed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {clientDeals.map((d) => {
                    const displayAmount = wonDealDisplayAmount(d, paymentByDealId.get(d.id));
                    return (
                    <tr key={d.id} className="hover:bg-muted/40 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{d.lead_name}</td>
                      <td className="px-4 py-3 font-semibold">{formatClientLtvAmount(displayAmount.amount, displayAmount.currency)}</td>
                      <td className="px-4 py-3"><span className="bg-emerald-50 text-emerald-700 text-xs font-medium px-2 py-0.5 rounded-full border border-emerald-200">{d.stage}</span></td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(d.won_at ?? d.close_date)}</td>
                    </tr>
                  );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}

        {activeTab === "Payment History" && (
          clientPayments.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground bg-card border border-card-border rounded-xl">No payments recorded.</div>
          ) : (
            <div className="space-y-3">
              {clientPayments.map((p) => (
                <div key={p.id} className="bg-card border border-card-border rounded-xl p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs font-medium text-foreground">{p.invoice_ref}</p>
                      <p className="text-lg font-semibold text-foreground mt-0.5">{formatClientLtvAmount(p.amount, p.currency)}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                      p.status === "RECEIVED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                      p.status === "PENDING" ? "bg-amber-50 text-amber-700 border-amber-200" :
                      p.status === "PARTIAL" ? "bg-blue-50 text-blue-700 border-blue-200" :
                      "bg-red-50 text-red-600 border-red-200"
                    }`}>{p.status}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                    <span>{p.method}</span>
                    <span>{formatDate(p.received_at)}</span>
                  </div>
                  {p.notes && (
                    <p className="text-xs text-muted-foreground mt-2 bg-muted/50 rounded-lg px-3 py-2">{p.notes}</p>
                  )}
                  <PaymentReceiptLinks files={filesByPayment.get(p.id) ?? []} />
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === "Activity Timeline" && (
          clientActivities.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground bg-card border border-card-border rounded-xl">No activities logged yet.</div>
          ) : (
            <div className="space-y-3">
              {clientActivities.map((act) => (
                <div key={act.id} className="flex items-start gap-3 bg-card border border-card-border rounded-xl p-4">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ backgroundColor: ACTIVITY_COLORS[act.type] }}>
                    {ACTIVITY_ICONS[act.type]}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-foreground">{act.lead_name}</span>
                      <span className="text-xs text-muted-foreground">—</span>
                      <span className="text-xs text-muted-foreground">{act.type}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{act.note}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{formatDate(act.created_at, "MMM d, yyyy h:mm a")}</p>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === "Notes & Files" && (
          <div className="space-y-3">
            <div className="bg-card border border-card-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm text-foreground">Internal Notes</h3>
                <button
                  onClick={handleAddNote}
                  disabled={!noteText.trim() || addNote.isPending}
                  className="text-xs text-primary font-medium hover:underline disabled:opacity-50"
                >
                  + Add Note
                </button>
              </div>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Write a note..."
                rows={2}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 mb-3"
              />
              {notesLoading ? (
                <div className="flex justify-center py-4"><Spinner className="w-4 h-4 text-primary" /></div>
              ) : notes.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-4">No notes yet.</div>
              ) : (
                <div className="space-y-2">
                  {notes.map((note) => (
                    <div key={note.id} className="text-xs text-muted-foreground bg-muted rounded-lg p-3 border-l-2 border-primary">{note.content}</div>
                  ))}
                </div>
              )}
            </div>
            <div className="bg-card border border-card-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm text-foreground">Files</h3>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadFile.isPending}
                  className="text-xs text-primary font-medium hover:underline disabled:opacity-50"
                >
                  + Upload
                </button>
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} />
              </div>
              {filesLoading ? (
                <div className="flex justify-center py-4"><Spinner className="w-4 h-4 text-primary" /></div>
              ) : generalFiles.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-4">No general files uploaded. Payment receipts appear under Payment History.</div>
              ) : (
                <div className="space-y-2">
                  {generalFiles.map((f) => (
                    <div key={f.id} className="flex items-center justify-between text-xs py-2 border-b border-border last:border-0">
                      <span className="font-medium text-foreground">{f.file_name}</span>
                      <span className="text-muted-foreground">{formatDate(f.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Sidebar>
  );
}
