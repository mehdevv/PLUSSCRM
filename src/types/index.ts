export type UserRole = "admin" | "sales_rep";
export type RepTier = "BRONZE" | "SILVER" | "GOLD" | "DIAMOND";
export type LeadStatus =
  | "NEW"
  | "ASSIGNED"
  | "CONTACTED"
  | "QUALIFIED"
  | "FOLLOW_UP"
  | "MEETING_PENDING"
  | "QUALIFYING"
  | "PROPOSAL"
  | "NEGOTIATION"
  | "WON"
  | "LOST"
  | "DORMANT";
export type PaymentStatus = "RECEIVED" | "PENDING" | "PARTIAL" | "REFUNDED";
export type ActivityType = "CALL" | "EMAIL" | "MEETING" | "NOTE" | "TASK" | "STAGE_CHANGE" | "WHATSAPP";
export type SplitMode = "ROUND_ROBIN" | "WEIGHTED" | "PERFORMANCE" | "SOURCE" | "GEOGRAPHY" | "INDUSTRY";
export type CommissionStatus = "PAID" | "PENDING";
export type ImportJobStatus = "pending" | "processing" | "completed" | "failed";

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar_url: string | null;
  initials: string;
  tier: RepTier;
  points: number;
  is_active: boolean;
  vacation_mode: boolean;
  color: string;
  created_at: string;
}

export interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  name: string;
  company: string;
  email: string;
  phone: string | null;
  status: LeadStatus;
  source: string | null;
  assigned_to: string | null;
  split_rule_id: string | null;
  country: string | null;
  wilaya: string | null;
  google_maps_link: string | null;
  website_link: string | null;
  industry: string | null;
  notes: string | null;
  value: number;
  last_activity: string | null;
  last_activity_at: string | null;
  created_at: string;
  deleted_at: string | null;
}

export interface Deal {
  id: string;
  lead_id: string;
  lead_name: string;
  company: string;
  value: number;
  stage: LeadStatus;
  rep_id: string;
  currency: string;
  close_date: string | null;
  won_at: string | null;
  days_in_stage: number;
  overdue: boolean;
  created_at: string;
}

export interface Client {
  id: string;
  company: string;
  contact: string;
  email: string;
  phone: string | null;
  ltv: number;
  deals_count: number;
  last_activity: string | null;
  manager_id: string;
  country: string | null;
  currency: string;
  created_at: string;
}

export interface Payment {
  id: string;
  lead_id: string;
  deal_id: string | null;
  invoice_ref: string;
  company: string;
  deal_value: number;
  amount: number;
  method: string;
  status: PaymentStatus;
  received_at: string | null;
  currency: string;
  notes: string | null;
}

export interface Activity {
  id: string;
  type: ActivityType;
  lead_id: string | null;
  deal_id: string | null;
  lead_name: string;
  company: string;
  user_id: string;
  note: string;
  outcome: string | null;
  scheduled_at: string | null;
  due_date: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | null;
  done: boolean;
  created_at: string;
}

export interface SplitRule {
  id: string;
  name: string;
  mode: SplitMode;
  rep_pool: string[];
  weights_json: Record<string, number>;
  rule_conditions: unknown[];
  fallback_mode: string;
  max_per_rep: number | null;
  is_active: boolean;
  priority: number;
  leads_assigned: number;
  win_rate: number;
  created_at: string;
}

export interface Commission {
  id: string;
  user_id: string;
  rep_name: string;
  deal_label: string;
  rate: number;
  amount: number;
  status: CommissionStatus;
  paid_at: string | null;
  created_at: string;
}

export interface CompensationPlan {
  id: string;
  name: string;
  base_rate: number;
  tier_multiplier: number;
  accelerator: number;
  cap: number | null;
  created_at: string;
}

export interface RepCompensation {
  id: string;
  user_id: string;
  plan_id: string;
  plan_name: string;
  base_rate: number;
  tier_multiplier: number;
  accelerator: number;
  created_at: string;
}

export type CurrencyCode = "USD" | "DZD";

export interface PlatformSettings {
  id: string;
  company_name: string;
  timezone: string;
  currency: CurrencyCode;
  usd_to_dzd_rate: number;
  date_format: string;
  notification_prefs: Record<string, boolean>;
  freemove_rep_ids: string[];
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

export interface ImportJob {
  id: string;
  status: ImportJobStatus;
  file_path: string | null;
  mapping: Record<string, string>;
  error_report: unknown[];
  split_summary: Record<string, unknown> | null;
  total_rows: number;
  success_rows: number;
  failed_rows: number;
  created_at: string;
}

export interface AssignmentQueueItem {
  id: string;
  lead_id: string;
  lead: Lead;
  reason: string;
  created_at: string;
}

export interface ClientNote {
  id: string;
  client_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export interface ClientFile {
  id: string;
  client_id: string;
  file_name: string;
  file_path: string;
  payment_id: string | null;
  created_at: string;
}

export interface Expense {
  id: string;
  category: string;
  amount: number;
  description: string;
  expense_date: string;
  created_at: string;
}

export interface DashboardKpis {
  totalRevenueMtd: number;
  dealsWonMtd: number;
  winRate: number;
  avgDealSize: number;
  pipelineValue: number;
  revenueChange?: number | null;
  dealsWonChange?: number | null;
  winRateChange?: number | null;
  avgDealSizeChange?: number | null;
  pipelineChange?: number | null;
}

export interface ActivityFeedItem {
  id: string;
  note: string;
  type: string;
  created_at: string;
  profiles?: { name: string; initials: string; color: string } | null;
  leads?: { first_name: string; last_name: string; company: string } | null;
}

export interface LeadsBySourceItem {
  name: string;
  value: number;
  count: number;
  color: string;
}

export interface PipelineFunnelItem {
  stage: string;
  count: number;
  value: number;
  color: string;
}

export interface SplitRuleEfficiencyItem {
  name: string;
  winRate: number;
  deals: number;
}

export interface LeaderboardEntry {
  user_id: string;
  name: string;
  initials: string;
  tier: RepTier;
  points: number;
  deals_mtd: number;
  win_rate: number;
  revenue: number;
  rank: number;
  color: string;
}
