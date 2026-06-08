import type { ReactNode } from "react";
import { STATUS_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import type { Lead } from "@/types";
import { X, Phone, Mail, Globe, MapPin, ExternalLink } from "lucide-react";

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="py-2 border-b border-border/60 last:border-0">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">{label}</div>
      <div className="text-sm text-foreground break-words">{children}</div>
    </div>
  );
}

function linkLabel(url: string, max = 48) {
  const cleaned = url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  return cleaned.length > max ? `${cleaned.slice(0, max)}…` : cleaned;
}

interface LeadDetailsModalProps {
  lead: Lead | null;
  open: boolean;
  onClose: () => void;
  formatMoney?: (n: number, c?: string) => string;
}

export function LeadDetailsModal({ lead, open, onClose, formatMoney }: LeadDetailsModalProps) {
  if (!open || !lead) return null;

  const region = [lead.wilaya, lead.country].filter(Boolean).join(", ");

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-card-border rounded-xl shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold text-foreground">{lead.name}</h2>
            <p className="text-sm text-muted-foreground truncate">{lead.company || "—"}</p>
          </div>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-0.5 mb-4">
          <DetailRow label="Phone">
            {lead.phone?.trim() ? (
              <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1.5 text-blue-600 hover:underline">
                <Phone className="w-3.5 h-3.5" /> {lead.phone}
              </a>
            ) : (
              <span className="text-muted-foreground italic">No phone</span>
            )}
          </DetailRow>
          <DetailRow label="Email">
            {lead.email?.trim() ? (
              <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1.5 text-blue-600 hover:underline">
                <Mail className="w-3.5 h-3.5" /> {lead.email}
              </a>
            ) : (
              <span className="text-muted-foreground italic">No email</span>
            )}
          </DetailRow>
          <DetailRow label="Website">
            {lead.website_link?.trim() ? (
              <a href={lead.website_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-blue-600 hover:underline">
                <Globe className="w-3.5 h-3.5" /> {linkLabel(lead.website_link)} <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <span className="text-muted-foreground italic">No website</span>
            )}
          </DetailRow>
          <DetailRow label="Google Maps">
            {lead.google_maps_link?.trim() ? (
              <a href={lead.google_maps_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-blue-600 hover:underline">
                <MapPin className="w-3.5 h-3.5" /> {linkLabel(lead.google_maps_link)} <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <span className="text-muted-foreground italic">No map link</span>
            )}
          </DetailRow>
          <DetailRow label="Status">{STATUS_LABELS[lead.status]}</DetailRow>
          <DetailRow label="Source">{lead.source || "—"}</DetailRow>
          <DetailRow label="Region">{region || "—"}</DetailRow>
          <DetailRow label="Industry">{lead.industry || "—"}</DetailRow>
          <DetailRow label="Value">
            {formatMoney ? formatMoney(lead.value, "USD") : `$${lead.value.toLocaleString()}`}
          </DetailRow>
          {lead.notes?.trim() && (
            <DetailRow label="Notes">
              <p className="text-sm whitespace-pre-wrap">{lead.notes}</p>
            </DetailRow>
          )}
          <DetailRow label="Last activity">
            {lead.last_activity_at
              ? `${lead.last_activity ?? "Activity"} · ${formatDate(lead.last_activity_at, "MMM d, yyyy h:mm a")}`
              : "—"}
          </DetailRow>
          <DetailRow label="Created">{formatDate(lead.created_at, "MMM d, yyyy")}</DetailRow>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2 rounded-lg text-sm font-medium border border-border hover:bg-muted transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}
