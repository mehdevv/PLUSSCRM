import { Link } from "wouter";
import { formatRelativeTime } from "@/lib/format";
import type { WireframeListItem } from "@/types/wireframe";
import { LayoutTemplate, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

interface WireframeListProps {
  wireframes: WireframeListItem[];
  loading?: boolean;
  isAdmin?: boolean;
  onCreate?: () => void;
  creating?: boolean;
}

export function WireframeList({
  wireframes,
  loading,
  isAdmin,
  onCreate,
  creating,
}: WireframeListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isAdmin && onCreate && (
        <Button onClick={onCreate} disabled={creating} className="gap-2">
          {creating ? <Spinner className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          New wireframe
        </Button>
      )}

      {wireframes.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <LayoutTemplate className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? "No wireframes yet. Create one to sketch flows for your sales team."
              : "No published wireframes yet. Your admin will share boards here."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {wireframes.map((wf) => (
            <Link key={wf.id} href={`/wireframes/${wf.id}`}>
              <div className="bg-card border border-card-border rounded-xl p-4 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer h-full">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-display font-semibold text-sm text-foreground line-clamp-2">
                    {wf.title}
                  </h3>
                  {wf.is_published && (
                    <span className="text-[10px] font-medium bg-primary/10 text-primary px-1.5 py-0.5 rounded-full shrink-0">
                      Published
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Updated {formatRelativeTime(wf.updated_at)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
