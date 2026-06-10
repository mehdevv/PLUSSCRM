import { useEffect, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks/useAuth";
import { useSuperMode } from "@/hooks/useSuperMode";
import { useSettings, useSettingsMutations, useSalesReps } from "@/hooks/queries";
import { Settings2, Bell, Zap, Shield, Check, UserCog, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const REP_NOTIF_KEY = "pluss_rep_notification_prefs";

const ALL_TABS = [
  { id: "platform", label: "Platform Config", icon: Settings2, adminOnly: true },
  { id: "super-mode", label: "Staff Super Mode", icon: UserCog, adminOnly: true },
  { id: "notifications", label: "Notifications", icon: Bell, adminOnly: false },
  { id: "integrations", label: "Integrations", icon: Zap, adminOnly: true },
  { id: "security", label: "Security", icon: Shield, adminOnly: false },
];

const EVENTS = [
  "New Lead Assigned",
  "Deal Stage Change",
  "Deal Won",
  "Deal Lost",
  "Payment Received",
  "Overdue Task",
  "New Team Member",
  "Leaderboard Update",
];

const integrationCards = [
  { name: "Typeform", desc: "Capture leads from Typeform surveys automatically.", logo: "T", status: "connected", color: "#262627" },
  { name: "Meta Lead Ads", desc: "Sync leads from Facebook & Instagram ad campaigns.", logo: "f", status: "connected", color: "#1877F2" },
  { name: "SendGrid", desc: "Send transactional emails and sequences via SendGrid.", logo: "S", status: "connected", color: "#1A82E2" },
  { name: "Slack", desc: "Post deal updates and team alerts to Slack channels.", logo: "Sl", status: "coming_soon", color: "#4A154B" },
  { name: "HubSpot", desc: "Bi-directional sync with HubSpot CRM contacts.", logo: "H", status: "coming_soon", color: "#FF7A59" },
  { name: "Zapier", desc: "Connect to 5,000+ apps via Zapier automation.", logo: "Z", status: "coming_soon", color: "#FF4A00" },
];

const TIMEZONE_OPTIONS = ["UTC-8 (PST)", "UTC-5 (EST)", "UTC+0 (GMT)", "UTC+1 (CET)", "UTC+5:30 (IST)"];
const CURRENCY_OPTIONS = ["USD", "DZD"] as const;
const DATE_FORMAT_OPTIONS = ["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"];

function notifKey(event: string, channel: string) {
  return `${event}::${channel}`;
}

export default function Settings() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const { data: settings, isLoading } = useSettings();
  const { updatePlatform, updatePassword } = useSettingsMutations();
  const { data: salesReps = [] } = useSalesReps();
  const { isSuperMode, superModeRep, activating, activate, deactivate } = useSuperMode();
  const [integrations, setIntegrations] = useState(integrationCards);

  const visibleTabs = ALL_TABS.filter((t) => isAdmin || !t.adminOnly);
  const [activeTab, setActiveTab] = useState(isAdmin ? "platform" : "security");

  const [companyName, setCompanyName] = useState("");
  const [timezone, setTimezone] = useState(TIMEZONE_OPTIONS[2]);
  const [currency, setCurrency] = useState<"USD" | "DZD">("USD");
  const [usdToDzdRate, setUsdToDzdRate] = useState("134");
  const [dateFormat, setDateFormat] = useState(DATE_FORMAT_OPTIONS[0]);
  const [previousRepIds, setPreviousRepIds] = useState<string[]>([]);
  const [notifs, setNotifs] = useState<Record<string, boolean>>({});
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [saved, setSaved] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [superRepId, setSuperRepId] = useState("");
  const [superPassword, setSuperPassword] = useState("");
  const [superError, setSuperError] = useState("");

  useEffect(() => {
    if (!settings) return;
    setCompanyName(settings.company_name);
    setTimezone(settings.timezone || TIMEZONE_OPTIONS[2]);
    setCurrency(settings.currency === "DZD" ? "DZD" : "USD");
    setUsdToDzdRate(String(settings.usd_to_dzd_rate ?? 134));
    setDateFormat(settings.date_format || DATE_FORMAT_OPTIONS[0]);
    setPreviousRepIds(settings.previous_rep_ids ?? []);
    if (isAdmin) {
      setNotifs(settings.notification_prefs ?? {});
    } else {
      const saved = localStorage.getItem(REP_NOTIF_KEY);
      setNotifs(saved ? JSON.parse(saved) as Record<string, boolean> : (settings.notification_prefs ?? {}));
    }
  }, [settings, isAdmin]);

  useEffect(() => {
    if (visibleTabs.some((t) => t.id === activeTab)) return;
    setActiveTab(visibleTabs[0]?.id ?? "security");
  }, [visibleTabs, activeTab]);

  const handleSavePlatform = () => {
    updatePlatform.mutate(
      {
        company_name: companyName,
        timezone,
        currency,
        usd_to_dzd_rate: Number(usdToDzdRate) || 134,
        date_format: dateFormat,
        notification_prefs: notifs,
        previous_rep_ids: previousRepIds,
      },
      {
        onSuccess: () => {
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        },
      },
    );
  };

  const handleSaveNotifications = () => {
    if (isAdmin) {
      updatePlatform.mutate(
        { notification_prefs: notifs },
        {
          onSuccess: () => {
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
          },
        },
      );
      return;
    }
    localStorage.setItem(REP_NOTIF_KEY, JSON.stringify(notifs));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    toast({ title: "Preferences saved", description: "Your notification preferences have been saved." });
  };

  const handleDisconnectIntegration = (name: string) => {
    setIntegrations((prev) => prev.map((c) => (c.name === name ? { ...c, status: "coming_soon" as const } : c)));
    toast({ title: "Disconnected", description: `${name} has been disconnected.` });
  };

  const handleApiKeyAction = (action: string) => {
    toast({ title: "API keys", description: `${action} is not available in this demo environment.` });
  };

  const handleActivateSuperMode = async () => {
    setSuperError("");
    const rep = salesReps.find((r) => r.id === superRepId);
    if (!rep) {
      setSuperError("Select a sales rep.");
      return;
    }
    if (!superPassword) {
      setSuperError("Enter your admin password to confirm.");
      return;
    }
    try {
      await activate(rep, superPassword);
      setSuperPassword("");
      toast({
        title: "Super mode active",
        description: `You can now manage ${rep.name}'s leads, pipeline, and clients.`,
      });
    } catch (err) {
      setSuperError(err instanceof Error ? err.message : "Could not activate super mode.");
    }
  };

  const handleDeactivateSuperMode = () => {
    deactivate();
    setSuperPassword("");
    setSuperError("");
    toast({ title: "Super mode ended", description: "Returned to normal admin view." });
  };

  const handleChangePassword = () => {
    setPasswordError("");
    if (passwords.next !== passwords.confirm) {
      setPasswordError("New passwords do not match.");
      return;
    }
    if (passwords.next.length < 8) {
      setPasswordError("Password must be at least 8 characters.");
      return;
    }
    updatePassword.mutate(passwords.next, {
      onSuccess: () => {
        setPasswords({ current: "", next: "", confirm: "" });
        setPasswordSaved(true);
        setTimeout(() => setPasswordSaved(false), 2000);
      },
      onError: (err) => setPasswordError(err instanceof Error ? err.message : "Failed to update password."),
    });
  };

  if (isLoading && isAdmin) {
    return (
      <Sidebar>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Spinner className="size-8 text-primary" />
        </div>
      </Sidebar>
    );
  }

  return (
    <Sidebar>
      <div className="p-6 min-h-full">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Settings</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Platform configuration and preferences</p>
          </div>
        </div>

        <div className="flex gap-6">
          <div className="flex-shrink-0 w-48">
            <nav className="space-y-1">
              {visibleTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-colors ${
                    activeTab === tab.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                  data-testid={`tab-${tab.id}`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex-1 min-w-0">
            {activeTab === "platform" && isAdmin && (
              <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
                <h2 className="font-display font-bold text-base text-foreground mb-5">Platform Configuration</h2>
                <div className="space-y-4 max-w-md">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Company Name</label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      data-testid="input-company-name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Timezone</label>
                    <select
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      data-testid="select-timezone"
                    >
                      {TIMEZONE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Display Currency</label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value as "USD" | "DZD")}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      data-testid="select-currency"
                    >
                      {CURRENCY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <p className="text-xs text-muted-foreground mt-1">All totals and reports use this currency.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">1 USD equals (DZD)</label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="e.g. 134.50"
                      value={usdToDzdRate}
                      onChange={(e) => setUsdToDzdRate(e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      data-testid="input-usd-to-dzd-rate"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Exchange rate used to convert USD and DZD amounts across the platform.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Date Format</label>
                    <select
                      value={dateFormat}
                      onChange={(e) => setDateFormat(e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      data-testid="select-date-format"
                    >
                      {DATE_FORMAT_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Pipeline Previous</label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Selected reps see a Previous button on pipeline cards to step back one stage and undo related data.
                    </p>
                    <div className="space-y-2 max-h-48 overflow-y-auto border border-border rounded-lg p-3">
                      {salesReps.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No sales reps found.</p>
                      ) : (
                        salesReps.map((rep) => (
                          <label key={rep.id} className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                              type="checkbox"
                              checked={previousRepIds.includes(rep.id)}
                              onChange={(e) => {
                                setPreviousRepIds((prev) =>
                                  e.target.checked ? [...prev, rep.id] : prev.filter((id) => id !== rep.id),
                                );
                              }}
                              className="rounded border-border"
                              data-testid={`previous-rep-${rep.id}`}
                            />
                            <span
                              className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                              style={{ backgroundColor: rep.color }}
                            >
                              {rep.initials}
                            </span>
                            <span>{rep.name}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                  <button
                    onClick={handleSavePlatform}
                    disabled={updatePlatform.isPending}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 ${saved ? "bg-emerald-500 text-white" : "bg-primary text-primary-foreground hover:opacity-90"}`}
                    data-testid="btn-save-platform"
                  >
                    {saved && <Check className="w-4 h-4" />}
                    {saved ? "Saved" : updatePlatform.isPending ? "Saving…" : "Save Changes"}
                  </button>
                </div>
              </div>
            )}

            {activeTab === "super-mode" && isAdmin && (
              <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm max-w-lg">
                <div className="flex items-start gap-3 mb-5">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                    <ShieldAlert className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h2 className="font-display font-bold text-base text-foreground">Staff Super Mode</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Enter a staff account to edit their leads, move deals in the pipeline, return leads to the board, and delete records — as if you were that rep.
                    </p>
                  </div>
                </div>

                {isSuperMode && superModeRep ? (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
                      <strong>Active:</strong> managing <strong>{superModeRep.name}</strong> ({superModeRep.email})
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Use <strong>Leads</strong> and <strong>Pipeline</strong> in the sidebar under Staff view. Exit when finished.
                    </p>
                    <button
                      type="button"
                      onClick={handleDeactivateSuperMode}
                      className="px-4 py-2 rounded-lg text-sm font-medium border border-amber-500/40 text-amber-800 bg-amber-500/10 hover:bg-amber-500/20 transition-colors"
                      data-testid="btn-exit-super-mode"
                    >
                      Exit Super Mode
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4 max-w-md">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">Sales rep</label>
                      <select
                        value={superRepId}
                        onChange={(e) => setSuperRepId(e.target.value)}
                        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        data-testid="select-super-rep"
                      >
                        <option value="">Select a rep…</option>
                        {salesReps.filter((r) => r.is_active).map((r) => (
                          <option key={r.id} value={r.id}>{r.name} — {r.email}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">Your admin password</label>
                      <input
                        type="password"
                        value={superPassword}
                        onChange={(e) => setSuperPassword(e.target.value)}
                        placeholder="Confirm with your password"
                        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        data-testid="input-super-password"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Re-authentication required for security.</p>
                    </div>
                    {superError && <p className="text-xs text-red-500">{superError}</p>}
                    <button
                      type="button"
                      onClick={handleActivateSuperMode}
                      disabled={activating || !superRepId || !superPassword}
                      className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-600 text-white hover:bg-amber-700 transition-colors disabled:opacity-50"
                      data-testid="btn-activate-super-mode"
                    >
                      {activating ? "Activating…" : "Enter Staff Account"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === "notifications" && (
              <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
                <h2 className="font-display font-bold text-base text-foreground mb-5">Notification Preferences</h2>
                <div className="overflow-hidden border border-border rounded-xl">
                  <table className="w-full text-sm" data-testid="notifications-table">
                    <thead className="bg-muted border-b border-border">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Event</th>
                        {["In-App", "Email"].map((ch) => (
                          <th key={ch} className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">{ch}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {EVENTS.map((event) => (
                        <tr key={event} className="hover:bg-muted/40 transition-colors">
                          <td className="px-4 py-3 text-foreground font-medium">{event}</td>
                          {["In-App", "Email"].map((ch) => (
                            <td key={ch} className="px-4 py-3 text-center">
                              <input
                                type="checkbox"
                                checked={notifs[notifKey(event, ch)] ?? false}
                                onChange={(e) =>
                                  setNotifs((prev) => ({
                                    ...prev,
                                    [notifKey(event, ch)]: e.target.checked,
                                  }))
                                }
                                className="w-4 h-4 accent-primary rounded cursor-pointer"
                                data-testid={`notif-${event.toLowerCase().replace(/\s/g, "-")}-${ch.toLowerCase()}`}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  type="button"
                  onClick={handleSaveNotifications}
                  disabled={isAdmin && updatePlatform.isPending}
                  className={`mt-4 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 ${saved ? "bg-emerald-500 text-white" : "bg-primary text-primary-foreground hover:opacity-90"}`}
                  data-testid="btn-save-notifications"
                >
                  {saved && <Check className="w-4 h-4" />}
                  {saved ? "Saved" : isAdmin && updatePlatform.isPending ? "Saving…" : "Save Preferences"}
                </button>
              </div>
            )}

            {activeTab === "integrations" && isAdmin && (
              <div>
                <h2 className="font-display font-bold text-base text-foreground mb-5">Integrations</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {integrations.map((card) => (
                    <div key={card.name} className="bg-card border border-card-border rounded-xl p-4 shadow-sm" data-testid={`integration-${card.name.toLowerCase().replace(/\s/g, "-")}`}>
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: card.color }}>
                          {card.logo}
                        </div>
                        {card.status === "connected" ? (
                          <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">Connected</span>
                        ) : (
                          <span className="text-[10px] font-semibold bg-muted text-muted-foreground border border-border px-2 py-0.5 rounded-full">Coming Soon</span>
                        )}
                      </div>
                      <div className="font-semibold text-sm text-foreground mb-1">{card.name}</div>
                      <div className="text-xs text-muted-foreground mb-3">{card.desc}</div>
                      <button
                        type="button"
                        onClick={() => card.status === "connected" && handleDisconnectIntegration(card.name)}
                        className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                          card.status === "connected"
                            ? "border-red-200 text-red-500 hover:bg-red-50"
                            : "border-border text-muted-foreground cursor-not-allowed"
                        }`}
                        disabled={card.status === "coming_soon"}
                        data-testid={`btn-integration-${card.name.toLowerCase().replace(/\s/g, "-")}`}
                      >
                        {card.status === "connected" ? "Disconnect" : "Coming Soon"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "security" && (
              <div className="space-y-5">
                <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
                  <h2 className="font-display font-bold text-base text-foreground mb-5">Change Password</h2>
                  <div className="space-y-4 max-w-md">
                    {[
                      { label: "Current Password", key: "current" as const },
                      { label: "New Password", key: "next" as const },
                      { label: "Confirm New Password", key: "confirm" as const },
                    ].map(({ label, key }) => (
                      <div key={label}>
                        <label className="block text-sm font-medium text-foreground mb-1.5">{label}</label>
                        <input
                          type="password"
                          value={passwords[key]}
                          onChange={(e) => setPasswords((prev) => ({ ...prev, [key]: e.target.value }))}
                          placeholder="••••••••"
                          className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                          data-testid={`input-${label.toLowerCase().replace(/\s/g, "-")}`}
                        />
                      </div>
                    ))}
                    {passwordError && <p className="text-xs text-red-500">{passwordError}</p>}
                    <button
                      onClick={handleChangePassword}
                      disabled={updatePassword.isPending || !passwords.next}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 ${
                        passwordSaved ? "bg-emerald-500 text-white" : "bg-primary text-primary-foreground hover:opacity-90"
                      }`}
                      data-testid="btn-change-password"
                    >
                      {passwordSaved ? "Password Updated" : updatePassword.isPending ? "Updating…" : "Update Password"}
                    </button>
                  </div>
                </div>

                {isAdmin && (
                  <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
                    <h2 className="font-display font-bold text-base text-foreground mb-5">API Key Management</h2>
                    <div className="space-y-3">
                      {[
                        { name: "Production API Key", key: "sk_live_••••••••••••••••••••••••••••XGT4", created: "Jan 15, 2025" },
                        { name: "Development API Key", key: "sk_dev_••••••••••••••••••••••••••••AK2M", created: "Mar 22, 2025" },
                      ].map((apiKey) => (
                        <div key={apiKey.name} className="flex items-center justify-between border border-border rounded-lg p-3 bg-muted/30" data-testid={`api-key-${apiKey.name.toLowerCase().replace(/\s/g, "-")}`}>
                          <div>
                            <div className="text-sm font-medium text-foreground">{apiKey.name}</div>
                            <div className="text-xs font-mono text-muted-foreground mt-0.5">{apiKey.key}</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">Created: {apiKey.created}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => handleApiKeyAction("Reveal")} className="text-xs text-primary font-medium px-2 py-1 hover:underline" data-testid="btn-reveal-key">Reveal</button>
                            <button type="button" onClick={() => handleApiKeyAction("Revoke")} className="text-xs text-red-500 font-medium px-2 py-1 hover:underline" data-testid="btn-revoke-key">Revoke</button>
                          </div>
                        </div>
                      ))}
                      <button type="button" onClick={() => handleApiKeyAction("Generate")} className="text-xs font-medium px-3 py-1.5 border border-border rounded-lg hover:bg-muted transition-colors" data-testid="btn-generate-key">
                        + Generate New Key
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Sidebar>
  );
}
