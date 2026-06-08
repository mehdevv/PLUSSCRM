import { useEffect, useState } from "react";
import { STATUS_LABELS } from "@/lib/constants";
import type { Lead, LeadStatus } from "@/types";
import { X } from "lucide-react";

export interface LeadFormValues {
  first_name: string;
  last_name: string;
  email: string;
  company: string;
  phone: string;
  wilaya: string;
  google_maps_link: string;
  website_link: string;
  source: string;
  value: string;
  status: LeadStatus;
  notes: string;
}

function leadToForm(lead: Lead): LeadFormValues {
  return {
    first_name: lead.first_name,
    last_name: lead.last_name,
    email: lead.email,
    company: lead.company ?? "",
    phone: lead.phone ?? "",
    wilaya: lead.wilaya ?? "",
    google_maps_link: lead.google_maps_link ?? "",
    website_link: lead.website_link ?? "",
    source: lead.source ?? "",
    value: String(lead.value ?? 0),
    status: lead.status,
    notes: lead.notes ?? "",
  };
}

interface LeadEditModalProps {
  lead: Lead | null;
  open: boolean;
  isAdmin?: boolean;
  saving?: boolean;
  onClose: () => void;
  onSave: (values: LeadFormValues) => void;
}

export function LeadEditModal({ lead, open, isAdmin = false, saving, onClose, onSave }: LeadEditModalProps) {
  const [form, setForm] = useState<LeadFormValues | null>(null);

  useEffect(() => {
    if (lead && open) setForm(leadToForm(lead));
  }, [lead, open]);

  if (!open || !lead || !form) return null;

  const field = (key: keyof LeadFormValues, label: string, opts?: { type?: string; required?: boolean }) => (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type={opts?.type ?? "text"}
        required={opts?.required}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="mt-1 w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
      />
    </label>
  );

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-card-border rounded-xl shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-bold text-foreground">Edit Lead</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); onSave(form); }}
          className="grid grid-cols-2 gap-3"
        >
          {field("first_name", "First name", { required: true })}
          {field("last_name", "Last name", { required: true })}
          <div className="col-span-2">{field("email", "Email", { type: "email", required: true })}</div>
          <div className="col-span-2">{field("company", "Company")}</div>
          {field("phone", "Number")}
          {field("wilaya", "Wilaya")}
          <div className="col-span-2">{field("google_maps_link", "Google Maps link")}</div>
          <div className="col-span-2">{field("website_link", "Website link")}</div>
          {field("source", "Source")}
          {field("value", "Value (USD)", { type: "number" })}
          {isAdmin && (
            <label className="block col-span-2">
              <span className="text-xs font-medium text-muted-foreground">Status</span>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as LeadStatus })}
                className="mt-1 w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
              >
                {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
          )}
          <label className="block col-span-2">
            <span className="text-xs font-medium text-muted-foreground">Notes</span>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="mt-1 w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
            />
          </label>
          <div className="col-span-2 flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-border rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50">
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
