import { supabase } from "@/lib/supabase";
import { mapPayment } from "@/lib/mappers";
import type { Payment, PaymentStatus } from "@/types";

export async function fetchPayments(): Promise<Payment[]> {
  const { data, error } = await supabase
    .from("payments")
    .select("*, leads(company, value, assigned_to), deals(value)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => {
    const lead = (r as { leads?: { company?: string; value?: number } }).leads;
    const deal = (r as { deals?: { value?: number } }).deals;
    return mapPayment(
      r as Record<string, unknown>,
      lead?.company,
      Number(deal?.value ?? lead?.value ?? 0),
    );
  });
}

export async function deletePayment(id: string) {
  const { error } = await supabase.from("payments").delete().eq("id", id);
  if (error) throw error;
}

export async function deletePaymentsForLead(leadId: string) {
  const { error } = await supabase.from("payments").delete().eq("lead_id", leadId);
  if (error) throw error;
}

/** @deprecated Use deletePaymentsForLead — resolves lead from deal when needed. */
export async function deletePaymentsForDeal(dealId: string) {
  const { data, error } = await supabase.from("deals").select("lead_id").eq("id", dealId).maybeSingle();
  if (error) throw error;
  if (data?.lead_id) {
    await deletePaymentsForLead(data.lead_id as string);
    return;
  }
  const { error: delErr } = await supabase.from("payments").delete().eq("deal_id", dealId);
  if (delErr) throw delErr;
}

export async function createPayment(input: {
  lead_id: string;
  deal_id?: string | null;
  invoice_ref: string;
  amount: number;
  method: string;
  status?: PaymentStatus;
  received_at?: string;
  currency?: string;
  notes?: string;
}) {
  const row: Record<string, unknown> = {
    lead_id: input.lead_id,
    invoice_ref: input.invoice_ref,
    amount: input.amount,
    method: input.method,
    status: input.status ?? "RECEIVED",
    received_at: input.received_at ?? new Date().toISOString(),
    currency: input.currency ?? "USD",
    notes: input.notes?.trim() || null,
  };
  if (input.deal_id) row.deal_id = input.deal_id;

  const { data, error } = await supabase.from("payments").insert(row).select().single();
  if (error) throw error;
  return mapPayment(data as Record<string, unknown>);
}

export const PAYMENT_METHODS = [
  "Bank Transfer",
  "Cash",
  "Card",
  "Check",
  "Mobile Payment",
  "Other",
] as const;
