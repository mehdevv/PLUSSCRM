import { useState } from "react";
import { ROLE_GUIDE } from "@/lib/permissions";
import { Shield, Users, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function RoleRulesContent() {
  return (
    <>
      <p className="text-sm text-muted-foreground mb-4">
        Admins manage operations. Reps work assigned leads only. Edit and delete follow the same rules.
      </p>
      <div className="grid md:grid-cols-2 gap-4">
        {(["admin", "sales_rep"] as const).map((role) => {
          const guide = ROLE_GUIDE[role];
          const Icon = role === "admin" ? Shield : Users;
          return (
            <div key={role} className="rounded-lg border border-border p-4 bg-muted/30">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-sm text-foreground">{guide.title}</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-3">{guide.summary}</p>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Can</p>
              <ul className="text-xs text-foreground space-y-1 mb-3 list-disc list-inside">
                {guide.can.map((item) => <li key={item}>{item}</li>)}
              </ul>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Cannot</p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                {guide.cannot.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          );
        })}
      </div>
    </>
  );
}

export function RoleRulesInfoButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-9 w-9 shrink-0"
        onClick={() => setOpen(true)}
        title="Who can do what"
        aria-label="Role permissions information"
        data-testid="btn-role-rules-info"
      >
        <Info className="w-4 h-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Who can do what</DialogTitle>
          </DialogHeader>
          <RoleRulesContent />
        </DialogContent>
      </Dialog>
    </>
  );
}

/** @deprecated Use RoleRulesInfoButton — kept for compatibility */
export function RoleRulesCard() {
  return (
    <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm mb-5" data-testid="role-rules-card">
      <h2 className="font-display font-bold text-base text-foreground mb-1">Who can do what</h2>
      <RoleRulesContent />
    </div>
  );
}
