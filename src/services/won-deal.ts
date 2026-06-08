import { supabase } from "@/lib/supabase";
import { mapClient } from "@/lib/mappers";
import { ensureClientFromWonDeal, findClientByLead, syncClientLtvFromPayments, uploadClientFile } from "@/services/clients";
import { createPayment } from "@/services/payments";
import { syncDealValue, updateDealStageWithLead } from "@/services/deals";
import { dealValueFromRow } from "@/lib/deal-value";
import type { Client, Deal, Lead, PaymentStatus } from "@/types";

export type WonDealPaymentInput = {
  recordPayment: boolean;
  invoice_ref: string;
  amount: number;
  method: string;
  status: PaymentStatus;
  received_at: string;
  currency: string;
  notes?: string;
};

export async function resolveClientForWonDeal(
  deal: Deal,
  lead: Lead,
  dealValue: number,
  currency: string,
): Promise<Client> {
  let client = await findClientByLead(lead.company, lead.email);
  if (!client) {
    await new Promise((r) => setTimeout(r, 400));
    client = await findClientByLead(lead.company, lead.email);
  }
  if (!client) {
    client = await ensureClientFromWonDeal(
      {
        leadId: lead.id,
        company: lead.company,
        contact: lead.name,
        email: lead.email,
        phone: lead.phone,
        country: lead.country,
      },
      deal.rep_id,
      dealValue,
      currency,
    );
  }
  return client;
}

export async function completeDealWon(
  deal: Deal,
  lead: Lead,
  payment: WonDealPaymentInput,
  receiptFiles: File[],
): Promise<Client> {
  const effectiveValue =
    payment.recordPayment && payment.amount > 0
      ? payment.amount
      : dealValueFromRow(deal.value);
  const effectiveCurrency = payment.currency || deal.currency || "USD";

  if (effectiveValue > 0) {
    await syncDealValue(deal.id, effectiveValue, effectiveCurrency);
  }

  await updateDealStageWithLead(deal.id, "WON", deal.lead_id);
  let client = await resolveClientForWonDeal(deal, lead, effectiveValue, effectiveCurrency);

  if (payment.recordPayment) {
    const created = await createPayment({
      deal_id: deal.id,
      invoice_ref: payment.invoice_ref,
      amount: payment.amount,
      method: payment.method,
      status: payment.status,
      received_at: payment.received_at,
      currency: payment.currency,
      notes: payment.notes,
    });

    for (const file of receiptFiles) {
      await uploadClientFile(client.id, file, created.id);
    }

    client = await syncClientLtvFromPayments(client);
  } else if (effectiveValue > 0) {
    const { data, error } = await supabase
      .from("clients")
      .update({
        ltv: effectiveValue,
        currency: effectiveCurrency,
        updated_at: new Date().toISOString(),
      })
      .eq("id", client.id)
      .select()
      .single();
    if (!error && data) client = mapClient(data as Record<string, unknown>);
  }

  return client;
}
