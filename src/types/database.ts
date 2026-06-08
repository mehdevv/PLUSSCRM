type Row = Record<string, unknown>;
type Insert = Record<string, unknown>;
type Update = Record<string, unknown>;

function table() {
  return { Row: {} as Row, Insert: {} as Insert, Update: {} as Update };
}

export interface Database {
  public: {
    Tables: {
      profiles: ReturnType<typeof table>;
      platform_settings: ReturnType<typeof table>;
      leads: ReturnType<typeof table>;
      lead_splits: ReturnType<typeof table>;
      import_jobs: ReturnType<typeof table>;
      assignment_queue: ReturnType<typeof table>;
      assignment_audit: ReturnType<typeof table>;
      deals: ReturnType<typeof table>;
      clients: ReturnType<typeof table>;
      client_notes: ReturnType<typeof table>;
      client_files: ReturnType<typeof table>;
      activities: ReturnType<typeof table>;
      payments: ReturnType<typeof table>;
      compensation_plans: ReturnType<typeof table>;
      rep_compensation: ReturnType<typeof table>;
      commissions: ReturnType<typeof table>;
      leaderboard_snapshots: ReturnType<typeof table>;
      notifications: ReturnType<typeof table>;
      expenses: ReturnType<typeof table>;
      split_state: ReturnType<typeof table>;
    };
    Functions: {
      get_dashboard_kpis: { Args: { p_user_id?: string | null }; Returns: unknown };
      get_revenue_trend: { Args: { p_user_id?: string | null }; Returns: unknown };
      get_activity_volume: { Args: { p_user_id?: string | null }; Returns: unknown };
      get_leads_by_source: { Args: { p_user_id?: string | null }; Returns: unknown };
      get_pipeline_funnel: { Args: { p_user_id?: string | null }; Returns: unknown };
      get_split_rule_efficiency: { Args: Record<string, never>; Returns: unknown };
      get_leaderboard: { Args: { p_period?: string }; Returns: unknown };
      run_split_engine: { Args: { p_lead_ids: string[]; p_rule_id: string }; Returns: unknown };
      rebalance_new_leads: { Args: { p_rule_id: string }; Returns: unknown };
    };
  };
}
