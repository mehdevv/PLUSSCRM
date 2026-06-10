export type MeetingFormat = "IN_PERSON" | "VIDEO" | "PHONE";

export interface MeetingBrief {
  id: string;
  deal_id: string;
  lead_id: string;
  rep_id: string;
  contact_role: string | null;
  meeting_scheduled_at: string | null;
  meeting_format: MeetingFormat;
  attendees: string | null;
  lead_needs: string;
  pain_points: string | null;
  budget_notes: string | null;
  talking_points: string | null;
  additional_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MeetingBriefInput {
  deal_id: string;
  lead_id: string;
  rep_id: string;
  contact_role?: string;
  meeting_scheduled_at?: string | null;
  meeting_format: MeetingFormat;
  attendees?: string;
  lead_needs: string;
  pain_points?: string;
  budget_notes?: string;
  talking_points?: string;
  additional_notes?: string;
}
