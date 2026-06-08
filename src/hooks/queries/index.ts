import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "./keys";
import { fetchProfiles, fetchSalesReps, updateProfile } from "@/services/profiles";
import {
  fetchLeads, createLead, updateLead, assignLead, unassignLead, bulkAssignLeads,
  fetchQueueLeads, importLeadsFromRows, softDeleteLead,
} from "@/services/leads";
import { fetchSplitRules, createSplitRule, updateSplitRule, toggleSplitRule, rebalanceLeads, deleteSplitRule } from "@/services/splitRules";
import { fetchDeals, createDeal, updateDealStageWithLead, deleteDeal } from "@/services/deals";
import type { Deal } from "@/types";
import { fetchClients, fetchClient, createClient, fetchClientNotes, addClientNote, uploadClientFile, deleteClient } from "@/services/clients";
import { fetchActivities, createActivity, completeActivity, deleteActivity } from "@/services/activities";
import { fetchPayments, createPayment, deletePayment } from "@/services/payments";
import {
  fetchDashboardKpis, fetchRevenueTrend, fetchActivityVolume, fetchLeadsBySource,
  fetchPipelineFunnel, fetchSplitRuleEfficiency, fetchActivityFeed, fetchLeaderboard,
} from "@/services/dashboard";
import {
  fetchCompensationPlans, fetchCommissions, payCommission, updateCommission,
  fetchAccountingSummary, inviteSalesRep, deleteSalesRep, deleteCommission,
} from "@/services/team";
import { flagClientRenewal } from "@/services/clients";
import { fetchPlatformSettings, updatePlatformSettings, updatePassword } from "@/services/settings";
import { fetchNotifications, markNotificationRead } from "@/services/notifications";
import { useAuth } from "@/hooks/useAuth";
import type { Lead, LeadStatus, SplitMode } from "@/types";

export function useSalesReps() {
  return useQuery({ queryKey: queryKeys.salesReps, queryFn: fetchSalesReps });
}

export function useProfiles() {
  return useQuery({ queryKey: queryKeys.profiles, queryFn: fetchProfiles });
}

export function useLeads(filters?: { status?: LeadStatus; search?: string }) {
  return useQuery({ queryKey: queryKeys.leads(filters), queryFn: () => fetchLeads(filters) });
}

export function useQueueLeads() {
  return useQuery({ queryKey: queryKeys.queueLeads, queryFn: fetchQueueLeads });
}

export function useSplitRules() {
  return useQuery({ queryKey: queryKeys.splitRules, queryFn: fetchSplitRules });
}

export function useDeals(repId?: string) {
  return useQuery({ queryKey: queryKeys.deals(repId), queryFn: () => fetchDeals(repId) });
}

export function useClients() {
  return useQuery({ queryKey: queryKeys.clients, queryFn: fetchClients });
}

export function useClient(id: string) {
  return useQuery({ queryKey: queryKeys.client(id), queryFn: () => fetchClient(id), enabled: !!id });
}

export function useClientNotes(id: string) {
  return useQuery({ queryKey: queryKeys.clientNotes(id), queryFn: () => fetchClientNotes(id), enabled: !!id });
}

export function useActivities() {
  return useQuery({ queryKey: queryKeys.activities, queryFn: fetchActivities });
}

export function usePayments() {
  return useQuery({ queryKey: queryKeys.payments, queryFn: fetchPayments });
}

export function useDashboard() {
  const { isAdmin, user, profile } = useAuth();
  const userId = isAdmin ? undefined : user?.id;
  const enabled = !!user;
  const kpis = useQuery({ queryKey: queryKeys.dashboardKpis(userId), queryFn: () => fetchDashboardKpis(userId), enabled });
  const revenue = useQuery({ queryKey: queryKeys.revenueTrend(userId), queryFn: () => fetchRevenueTrend(userId), enabled });
  const activityVolume = useQuery({ queryKey: queryKeys.activityVolume(userId), queryFn: () => fetchActivityVolume(userId), enabled });
  const leadsBySource = useQuery({ queryKey: queryKeys.leadsBySource(userId), queryFn: () => fetchLeadsBySource(userId), enabled });
  const pipelineFunnel = useQuery({ queryKey: queryKeys.pipelineFunnel(userId), queryFn: () => fetchPipelineFunnel(userId), enabled });
  const splitEfficiency = useQuery({ queryKey: queryKeys.splitEfficiency, queryFn: fetchSplitRuleEfficiency, enabled: enabled && isAdmin });
  const activityFeed = useQuery({ queryKey: queryKeys.activityFeed(userId), queryFn: () => fetchActivityFeed(userId), enabled });
  const leaderboard = useQuery({ queryKey: queryKeys.leaderboard("monthly"), queryFn: () => fetchLeaderboard("monthly"), enabled: enabled && !isAdmin });
  return { kpis, revenue, activityVolume, leadsBySource, pipelineFunnel, splitEfficiency, activityFeed, leaderboard, isAdmin, profile, user };
}

export function useLeaderboard(period: string, enabled = true) {
  return useQuery({ queryKey: queryKeys.leaderboard(period), queryFn: () => fetchLeaderboard(period), enabled });
}

export function useRepDashboard(repId: string | null) {
  const enabled = !!repId;
  const kpis = useQuery({ queryKey: queryKeys.dashboardKpis(repId ?? undefined), queryFn: () => fetchDashboardKpis(repId!), enabled });
  const revenue = useQuery({ queryKey: queryKeys.revenueTrend(repId ?? undefined), queryFn: () => fetchRevenueTrend(repId!), enabled });
  const activityVolume = useQuery({ queryKey: queryKeys.activityVolume(repId ?? undefined), queryFn: () => fetchActivityVolume(repId!), enabled });
  const pipelineFunnel = useQuery({ queryKey: queryKeys.pipelineFunnel(repId ?? undefined), queryFn: () => fetchPipelineFunnel(repId!), enabled });
  const activityFeed = useQuery({ queryKey: queryKeys.activityFeed(repId ?? undefined), queryFn: () => fetchActivityFeed(repId!), enabled });
  return { kpis, revenue, activityVolume, pipelineFunnel, activityFeed };
}

export function useCommissions() {
  return useQuery({ queryKey: queryKeys.commissions, queryFn: fetchCommissions });
}

export function useCompPlans() {
  return useQuery({ queryKey: queryKeys.compPlans, queryFn: fetchCompensationPlans });
}

export function useAccounting() {
  return useQuery({ queryKey: queryKeys.accounting, queryFn: fetchAccountingSummary });
}

export function useSettings() {
  const { session, loading } = useAuth();
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: fetchPlatformSettings,
    enabled: !loading && !!session,
  });
}

export function useNotifications() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.notifications(user?.id ?? ""),
    queryFn: () => fetchNotifications(user!.id),
    enabled: !!user?.id,
  });
}

export function useLeadMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["leads"] });
    qc.invalidateQueries({ queryKey: queryKeys.queueLeads });
  };
  return {
    create: useMutation({ mutationFn: createLead, onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ id, updates }: { id: string; updates: Partial<Lead> }) => updateLead(id, updates),
      onSuccess: invalidate,
    }),
    assign: useMutation({ mutationFn: ({ leadId, repId }: { leadId: string; repId: string }) => assignLead(leadId, repId), onSuccess: invalidate }),
    unassign: useMutation({ mutationFn: unassignLead, onSuccess: invalidate }),
    bulkAssign: useMutation({ mutationFn: ({ leadIds, repId }: { leadIds: string[]; repId: string }) => bulkAssignLeads(leadIds, repId), onSuccess: invalidate }),
    importCsv: useMutation({
      mutationFn: ({ rows, mapping, splitRuleId, userId }: { rows: Record<string, string>[]; mapping: Record<string, string>; splitRuleId: string; userId: string }) =>
        importLeadsFromRows(rows, mapping, splitRuleId, userId),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: softDeleteLead, onSuccess: invalidate }),
  };
}

export function useSplitRuleMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: queryKeys.splitRules });
  return {
    create: useMutation({
      mutationFn: (input: { name: string; mode: SplitMode; rep_pool: string[]; is_active?: boolean }) => createSplitRule(input),
      onSuccess: invalidate,
    }),
    update: useMutation({ mutationFn: ({ id, updates }: { id: string; updates: Parameters<typeof updateSplitRule>[1] }) => updateSplitRule(id, updates), onSuccess: invalidate }),
    toggle: useMutation({ mutationFn: ({ id, active }: { id: string; active: boolean }) => toggleSplitRule(id, active), onSuccess: invalidate }),
    rebalance: useMutation({ mutationFn: rebalanceLeads, onSuccess: invalidate }),
    remove: useMutation({ mutationFn: deleteSplitRule, onSuccess: invalidate }),
  };
}

export function useDealMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["deals"] });
    qc.invalidateQueries({ queryKey: ["leads"] });
    qc.invalidateQueries({ queryKey: queryKeys.clients });
  };
  return {
    create: useMutation({ mutationFn: createDeal, onSuccess: invalidate }),
    updateStage: useMutation({
      mutationFn: ({ id, stage, leadId }: { id: string; stage: LeadStatus; leadId: string }) =>
        updateDealStageWithLead(id, stage, leadId),
      onMutate: async ({ id, stage, leadId }) => {
        await qc.cancelQueries({ queryKey: ["deals"] });
        const snapshots = qc.getQueriesData<Deal[]>({ queryKey: ["deals"] });
        const activeStages: LeadStatus[] = ["CONTACTED", "QUALIFYING", "NEGOTIATION", "PROPOSAL"];
        qc.setQueriesData<Deal[]>({ queryKey: ["deals"] }, (old) => {
          if (!old) return old;
          let next = old.map((d) => (d.id === id ? { ...d, stage } : d));
          if (stage === "WON" || stage === "LOST") {
            next = next.filter(
              (d) => d.id === id || d.lead_id !== leadId || !activeStages.includes(d.stage),
            );
          }
          return next;
        });
        return { snapshots };
      },
      onError: (_err, _vars, context) => {
        context?.snapshots?.forEach(([key, data]) => qc.setQueryData(key, data));
      },
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: deleteDeal, onSuccess: invalidate }),
  };
}

export function useClientMutations() {
  const qc = useQueryClient();
  return {
    create: useMutation({ mutationFn: createClient, onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.clients }) }),
    addNote: useMutation({
      mutationFn: ({ clientId, userId, content }: { clientId: string; userId: string; content: string }) => addClientNote(clientId, userId, content),
      onSuccess: (_, v) => qc.invalidateQueries({ queryKey: queryKeys.clientNotes(v.clientId) }),
    }),
    uploadFile: useMutation({
      mutationFn: ({ clientId, file }: { clientId: string; file: File }) => uploadClientFile(clientId, file),
      onSuccess: (_, v) => qc.invalidateQueries({ queryKey: queryKeys.client(v.clientId) }),
    }),
    flagRenewal: useMutation({
      mutationFn: ({ clientId, userId }: { clientId: string; userId: string }) => flagClientRenewal(clientId, userId),
      onSuccess: (_, v) => {
        qc.invalidateQueries({ queryKey: queryKeys.client(v.clientId) });
        qc.invalidateQueries({ queryKey: queryKeys.clientNotes(v.clientId) });
        qc.invalidateQueries({ queryKey: queryKeys.clients });
      },
    }),
    remove: useMutation({ mutationFn: deleteClient, onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.clients }) }),
  };
}

export function useActivityMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: queryKeys.activities });
  return {
    create: useMutation({ mutationFn: createActivity, onSuccess: invalidate }),
    complete: useMutation({ mutationFn: completeActivity, onSuccess: invalidate }),
    remove: useMutation({ mutationFn: deleteActivity, onSuccess: invalidate }),
  };
}

export function usePaymentMutations() {
  const qc = useQueryClient();
  return {
    create: useMutation({ mutationFn: createPayment, onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.payments }) }),
    remove: useMutation({
      mutationFn: deletePayment,
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: queryKeys.payments });
        qc.invalidateQueries({ queryKey: queryKeys.accounting });
      },
    }),
  };
}

export function useTeamMutations() {
  const qc = useQueryClient();
  const invalidateTeam = () => {
    qc.invalidateQueries({ queryKey: queryKeys.profiles });
    qc.invalidateQueries({ queryKey: queryKeys.salesReps });
    qc.invalidateQueries({ queryKey: queryKeys.leaderboard("monthly") });
    qc.invalidateQueries({ queryKey: ["leads"] });
    qc.invalidateQueries({ queryKey: queryKeys.deals() });
    qc.invalidateQueries({ queryKey: queryKeys.clients });
    qc.invalidateQueries({ queryKey: queryKeys.commissions });
  };
  return {
    updateProfile: useMutation({
      mutationFn: ({ id, updates }: { id: string; updates: Parameters<typeof updateProfile>[1] }) => updateProfile(id, updates),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: queryKeys.profiles });
        qc.invalidateQueries({ queryKey: queryKeys.salesReps });
      },
    }),
    payCommission: useMutation({ mutationFn: payCommission, onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.commissions }) }),
    updateCommission: useMutation({
      mutationFn: ({ id, updates }: { id: string; updates: Parameters<typeof updateCommission>[1] }) => updateCommission(id, updates),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: queryKeys.commissions });
        qc.invalidateQueries({ queryKey: queryKeys.accounting });
      },
    }),
    deleteCommission: useMutation({
      mutationFn: deleteCommission,
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: queryKeys.commissions });
        qc.invalidateQueries({ queryKey: queryKeys.accounting });
      },
    }),
    inviteRep: useMutation({ mutationFn: inviteSalesRep, onSuccess: invalidateTeam }),
    deleteRep: useMutation({ mutationFn: deleteSalesRep, onSuccess: invalidateTeam }),
  };
}

export function useSettingsMutations() {
  const qc = useQueryClient();
  return {
    updatePlatform: useMutation({ mutationFn: updatePlatformSettings, onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.settings }) }),
    updatePassword: useMutation({ mutationFn: updatePassword }),
    markRead: useMutation({ mutationFn: markNotificationRead, onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }) }),
  };
}
