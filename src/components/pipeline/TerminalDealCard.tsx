import { FreemoveControl } from "@/components/pipeline/FreemoveControl";
import type { FreemoveTarget } from "@/lib/freemove";
import { cn } from "@/lib/utils";
import type { Deal } from "@/types";

export const FREEMOVE_DRAG_MIME = "application/x-pluss-deal-id";

interface TerminalDealCardProps {
  deal: Deal;
  variant: "won" | "lost";
  freemoveVisible: boolean;
  freemoveActive: boolean;
  freemoveBusy?: boolean;
  onFreemoveToggle: (deal: Deal) => void;
  onFreemoveMove: (deal: Deal, target: FreemoveTarget) => void;
  onDragStart: (deal: Deal) => void;
  onDragEnd: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function TerminalDealCard({
  deal,
  variant,
  freemoveVisible,
  freemoveActive,
  freemoveBusy,
  onFreemoveToggle,
  onFreemoveMove,
  onDragStart,
  onDragEnd,
  children,
  footer,
}: TerminalDealCardProps) {
  const base =
    variant === "won"
      ? "bg-emerald-50 border border-emerald-100"
      : "bg-muted border border-border";

  return (
    <div
      className={cn(
        "relative rounded-lg p-3 text-xs",
        base,
        freemoveActive && "ring-2 ring-red-400/70 cursor-grab active:cursor-grabbing",
      )}
      draggable={freemoveActive}
      onDragStart={(e) => {
        if (!freemoveActive) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.setData(FREEMOVE_DRAG_MIME, deal.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart(deal);
      }}
      onDragEnd={onDragEnd}
    >
      <FreemoveControl
        deal={deal}
        visible={freemoveVisible}
        active={freemoveActive}
        busy={freemoveBusy}
        onToggle={onFreemoveToggle}
        onMove={onFreemoveMove}
      />
      {children}
      {footer}
    </div>
  );
}
