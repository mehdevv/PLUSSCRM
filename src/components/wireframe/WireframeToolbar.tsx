import { Link } from "wouter";
import { ArrowLeft, Check, Loader2, Monitor, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type WireframeSaveStatus = "idle" | "saving" | "saved" | "error";

interface WireframeToolbarProps {
  title: string;
  isPublished: boolean;
  saveStatus: WireframeSaveStatus;
  onTitleChange: (title: string) => void;
  onPublishChange: (published: boolean) => void;
  onPresent: () => void;
  onDelete: () => void;
  backHref?: string;
  readOnly?: boolean;
}

function SaveStatus({ status }: { status: WireframeSaveStatus }) {
  if (status === "idle") return null;

  return (
    <span
      className={cn(
        "text-xs flex items-center gap-1.5 px-2",
        status === "saved" && "text-muted-foreground",
        status === "saving" && "text-muted-foreground",
        status === "error" && "text-destructive",
      )}
    >
      {status === "saving" && <Loader2 className="w-3 h-3 animate-spin" />}
      {status === "saved" && <Check className="w-3 h-3" />}
      {status === "saving" && "Saving…"}
      {status === "saved" && "Saved"}
      {status === "error" && "Save failed"}
    </span>
  );
}

export function WireframeToolbar({
  title,
  isPublished,
  saveStatus,
  onTitleChange,
  onPublishChange,
  onPresent,
  onDelete,
  backHref = "/wireframes",
  readOnly = false,
}: WireframeToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 p-3 border-b border-border bg-card shrink-0">
      <Link href={backHref}>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
      </Link>

      {readOnly ? (
        <h1 className="font-display text-sm font-semibold text-foreground truncate flex-1 min-w-0">
          {title}
        </h1>
      ) : (
        <Input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="max-w-xs h-8 text-sm font-medium"
          placeholder="Wireframe title"
        />
      )}

      <div className="flex items-center gap-2 ml-auto flex-wrap">
        {!readOnly && (
          <>
            <div className="flex items-center gap-2 px-2">
              <Switch
                id="publish-wireframe"
                checked={isPublished}
                onCheckedChange={onPublishChange}
              />
              <Label htmlFor="publish-wireframe" className="text-xs text-muted-foreground whitespace-nowrap">
                Published
              </Label>
            </div>

            <SaveStatus status={saveStatus} />

            <Button variant="outline" size="sm" onClick={onPresent} className="gap-1.5">
              <Monitor className="w-3.5 h-3.5" />
              Present
            </Button>

            <Button variant="destructive" size="sm" onClick={onDelete} className="gap-1.5">
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </Button>
          </>
        )}

        {readOnly && (
          <Button variant="outline" size="sm" onClick={onPresent} className="gap-1.5">
            <Monitor className="w-3.5 h-3.5" />
            Present
          </Button>
        )}
      </div>
    </div>
  );
}
