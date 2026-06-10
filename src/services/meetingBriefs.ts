import { supabase } from "@/lib/supabase";
import type { MeetingBrief, MeetingBriefInput } from "@/types/meeting-brief";

function mapRow(row: Record<string, unknown>): MeetingBrief {
  return {
    id: row.id as string,
    deal_id: row.deal_id as string,
    lead_id: row.lead_id as string,
    rep_id: row.rep_id as string,
    contact_role: (row.contact_role as string) ?? null,
    meeting_scheduled_at: (row.meeting_scheduled_at as string) ?? null,
    meeting_format: row.meeting_format as MeetingBrief["meeting_format"],
    attendees: (row.attendees as string) ?? null,
    lead_needs: row.lead_needs as string,
    pain_points: (row.pain_points as string) ?? null,
    budget_notes: (row.budget_notes as string) ?? null,
    talking_points: (row.talking_points as string) ?? null,
    additional_notes: (row.additional_notes as string) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export async function getMeetingBriefByDeal(dealId: string): Promise<MeetingBrief | null> {
  const { data, error } = await supabase
    .from("meeting_briefs")
    .select("*")
    .eq("deal_id", dealId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRow(data as Record<string, unknown>) : null;
}

export async function deleteMeetingBriefForDeal(dealId: string) {
  const { error } = await supabase.from("meeting_briefs").delete().eq("deal_id", dealId);
  if (error) throw error;
}

export async function upsertMeetingBrief(input: MeetingBriefInput): Promise<MeetingBrief> {
  const payload = {
    deal_id: input.deal_id,
    lead_id: input.lead_id,
    rep_id: input.rep_id,
    contact_role: input.contact_role?.trim() || null,
    meeting_scheduled_at: input.meeting_scheduled_at || null,
    meeting_format: input.meeting_format,
    attendees: input.attendees?.trim() || null,
    lead_needs: input.lead_needs.trim(),
    pain_points: input.pain_points?.trim() || null,
    budget_notes: input.budget_notes?.trim() || null,
    talking_points: input.talking_points?.trim() || null,
    additional_notes: input.additional_notes?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("meeting_briefs")
    .upsert(payload, { onConflict: "deal_id" })
    .select()
    .single();
  if (error) throw error;
  return mapRow(data as Record<string, unknown>);
}
