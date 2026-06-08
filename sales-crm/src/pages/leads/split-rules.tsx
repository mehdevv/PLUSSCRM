import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { mockSplitRules, type SplitRule } from "@/lib/mock-data";
import { Plus, RefreshCw, TrendingUp, MapPin, Tag, Building2, ToggleLeft, ToggleRight, ChevronRight } from "lucide-react";

const MODE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  ROUND_ROBIN: RefreshCw,
  WEIGHTED: TrendingUp,
  PERFORMANCE: TrendingUp,
  SOURCE: Tag,
  GEOGRAPHY: MapPin,
  INDUSTRY: Building2,
};

const MODE_LABELS: Record<string, string> = {
  ROUND_ROBIN: "Round-Robin",
  WEIGHTED: "Weighted",
  PERFORMANCE: "Performance",
  SOURCE: "Source-Based",
  GEOGRAPHY: "Geography",
  INDUSTRY: "Industry",
};

const MODE_COLORS: Record<string, string> = {
  ROUND_ROBIN: "#06B6D4",
  WEIGHTED: "#8B5CF6",
  PERFORMANCE: "#1A1AFF",
  SOURCE: "#F59E0B",
  GEOGRAPHY: "#10B981",
  INDUSTRY: "#F97316",
};

const MODE_DESC: Record<string, string> = {
  ROUND_ROBIN: "Distributes leads evenly to reps in rotation, one at a time.",
  WEIGHTED: "Assigns more leads to reps with higher weight scores.",
  PERFORMANCE: "Prioritizes reps with higher win rates and close velocity.",
  SOURCE: "Routes leads to specific reps based on lead source (e.g. Ads, Referral).",
  GEOGRAPHY: "Assigns leads based on lead's country or region.",
  INDUSTRY: "Routes leads by company industry or vertical.",
};

export default function SplitRules() {
  const [rules, setRules] = useState(mockSplitRules);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  const toggleRule = (id: number) => {
    setRules((prev) => prev.map((r) => r.id === id ? { ...r, active: !r.active } : r));
  };

  return (
    <Sidebar>
      <div className="p-6 min-h-full">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Split Rules</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Control how leads are assigned to your team</p>
          </div>
          <button
            onClick={() => { setShowCreate(true); setStep(0); setSelectedMode(null); }}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            data-testid="btn-create-rule"
          >
            <Plus className="w-4 h-4" />Create Rule
          </button>
        </div>

        {!showCreate ? (
          <div className="space-y-3">
            {rules.map((rule: SplitRule) => {
              const Icon = MODE_ICONS[rule.mode] || RefreshCw;
              const color = MODE_COLORS[rule.mode];
              return (
                <div key={rule.id} className="bg-card border border-card-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow" data-testid={`rule-card-${rule.id}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}18` }}>
                        <Icon className="w-5 h-5" style={{ color }} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <h3 className="font-display font-bold text-base text-foreground">{rule.name}</h3>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                            rule.active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-muted text-muted-foreground border-border"
                          }`}>{rule.active ? "Active" : "Inactive"}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mb-3">{MODE_LABELS[rule.mode]} · {rule.poolSize} reps · Created {rule.createdAt}</div>
                        <div className="flex items-center gap-5 text-xs">
                          <div><span className="text-muted-foreground">Leads assigned:</span> <span className="font-semibold text-foreground">{rule.leadsAssigned.toLocaleString()}</span></div>
                          <div><span className="text-muted-foreground">Win rate:</span> <span className="font-semibold text-foreground">{rule.winRate}%</span></div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={() => toggleRule(rule.id)} className="flex items-center" data-testid={`toggle-rule-${rule.id}`}>
                        {rule.active ? <ToggleRight className="w-7 h-7 text-primary" /> : <ToggleLeft className="w-7 h-7 text-muted-foreground" />}
                      </button>
                      <button className="flex items-center gap-1 text-xs text-primary font-medium hover:underline" data-testid={`btn-edit-rule-${rule.id}`}>
                        Edit <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="max-w-xl space-y-5">
            {step === 0 && (
              <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
                <h2 className="font-display font-bold text-base text-foreground mb-4">Choose Distribution Mode</h2>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(MODE_LABELS).map(([key, label]) => {
                    const Icon = MODE_ICONS[key];
                    const color = MODE_COLORS[key];
                    return (
                      <button
                        key={key}
                        onClick={() => setSelectedMode(key)}
                        className={`flex flex-col items-start gap-2 p-4 border rounded-xl text-left transition-all hover:shadow-sm ${
                          selectedMode === key ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"
                        }`}
                        data-testid={`mode-card-${key.toLowerCase()}`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}18` }}>
                            <Icon className="w-4 h-4" style={{ color }} />
                          </div>
                          <span className="font-semibold text-sm text-foreground">{label}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-snug">{MODE_DESC[key]}</p>
                      </button>
                    );
                  })}
                </div>
                <div className="flex justify-between mt-5">
                  <button onClick={() => setShowCreate(false)} className="px-3 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
                  <button onClick={() => setStep(1)} disabled={!selectedMode} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50" data-testid="btn-next-configure">
                    Configure Rule
                  </button>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  {selectedMode && (() => {
                    const Icon = MODE_ICONS[selectedMode];
                    const color = MODE_COLORS[selectedMode];
                    return <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}18` }}><Icon className="w-4 h-4" style={{ color }} /></div>;
                  })()}
                  <h2 className="font-display font-bold text-base text-foreground">Configure: {selectedMode ? MODE_LABELS[selectedMode] : ""}</h2>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Rule Name</label>
                    <input type="text" placeholder="e.g. East Coast Paid Ads" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" data-testid="input-rule-name" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Rep Pool</label>
                    <div className="text-xs text-muted-foreground bg-muted rounded-lg p-3 border border-border">Select reps who will receive leads from this rule.</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <input type="checkbox" id="rule-active" defaultChecked className="w-4 h-4 accent-primary rounded" data-testid="checkbox-rule-active" />
                    <label htmlFor="rule-active" className="text-sm font-medium text-foreground">Activate rule immediately</label>
                  </div>
                </div>
                <div className="flex justify-between mt-5">
                  <button onClick={() => setStep(0)} className="px-3 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors">Back</button>
                  <button onClick={() => setShowCreate(false)} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity" data-testid="btn-save-rule">
                    Save Rule
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Sidebar>
  );
}
