import { supabase } from "@/lib/supabase";
import { mapPayment } from "@/lib/mappers";
import type { Payment, PaymentStatus } from "@/types";

export async function fetchPayments(): Promise<Payment[]> {
  const { data, error } = await supabase
    .from("payments")
    .select("*, deals(value, leads(company))")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => {
    const deal = (r as { deals?: { value: number; leads?: { company: string } } }).deals;
    return mapPayment(r as Record<string, unknown>, deal?.leads?.company, Number(deal?.value ?? 0));
  });
}

export async function deletePayment(id: string) {
  const { error } = await supabase.from("payments").delete().eq("id", id);
  if (error) throw error;
}

export async function createPayment(input: {
  deal_id: string;
  invoice_ref: string;
  amount: number;
  method: string;
  status?: PaymentStatus;
  received_at?: string;
  currency?: string;
  notes?: string;
}) {
  const { data, error } = await supabase.from("payments").insert({
    deal_id: input.deal_id,
    invoice_ref: input.invoice_ref,
    amount: input.amount,
    method: input.method,
    status: input.status ?? "RECEIVED",
    received_at: input.received_at ?? new Date().toISOString(),
    currency: input.currency ?? "USD",
    notes: input.notes?.trim() || null,
  }).select().single();
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
