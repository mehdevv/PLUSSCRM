import { cn } from "@/lib/utils";

interface TerminalDealCardProps {
  variant: "won" | "lost";
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function TerminalDealCard({ variant, children, footer }: TerminalDealCardProps) {
  const base =
    variant === "won"
      ? "bg-emerald-50 border border-emerald-100"
      : "bg-muted border border-border";

  return (
    <div className={cn("relative rounded-lg p-3 text-xs", base)}>
      {children}
      {footer}
    </div>
  );
}
