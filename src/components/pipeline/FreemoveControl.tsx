import { Move } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FREEMOVE_TARGETS, type FreemoveTarget } from "@/lib/freemove";
import { cn } from "@/lib/utils";
import type { Deal } from "@/types";

interface FreemoveControlProps {
  deal: Deal;
  visible: boolean;
  active: boolean;
  busy?: boolean;
  onToggle: (deal: Deal) => void;
  onMove: (deal: Deal, target: FreemoveTarget) => void;
  className?: string;
}

export function FreemoveControl({
  deal,
  visible,
  active,
  busy,
  onToggle,
  onMove,
  className,
}: FreemoveControlProps) {
  if (!visible) return null;

  return (
    <Popover
      open={active}
      onOpenChange={(open) => {
        if (!open && active) onToggle(deal);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={busy}
          onClick={(e) => {
            e.stopPropagation();
            onToggle(deal);
          }}
          className={cn(
            "absolute top-2 right-2 z-10 w-6 h-6 rounded-md flex items-center justify-center",
            "bg-red-600 text-white shadow-sm hover:bg-red-700 disabled:opacity-50 transition-colors",
            active && "ring-2 ring-red-400 ring-offset-1",
            className,
          )}
          title="Freemove — drag card or pick a destination"
          aria-label="Freemove"
          data-testid={`freemove-${deal.id}`}
        >
          <Move className="w-3 h-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-1" align="end" side="bottom">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-2 py-1.5">
          Freemove
        </p>
        <p className="text-[10px] text-muted-foreground px-2 pb-1.5">
          Drag this card to a column, or choose below
        </p>
        <div className="max-h-48 overflow-y-auto scrollbar-minimal">
          {FREEMOVE_TARGETS.map((target) => (
            <button
              key={`${target.kind}-${target.value}`}
              type="button"
              disabled={busy || (target.kind === "stage" && target.value === deal.stage)}
              onClick={() => onMove(deal, target)}
              className="w-full text-left text-xs px-2 py-1.5 rounded-md hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent"
            >
              {target.label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
