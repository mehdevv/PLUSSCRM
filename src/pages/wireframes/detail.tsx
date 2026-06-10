import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { Sidebar } from "@/components/layout/Sidebar";
import { WireframeEditor } from "@/components/wireframe/WireframeEditor";
import { WireframeViewer } from "@/components/wireframe/WireframeViewer";
import { WireframeToolbar, type WireframeSaveStatus } from "@/components/wireframe/WireframeToolbar";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { useWireframe, useWireframeMutations } from "@/hooks/useWireframes";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import type { WireframeDocument } from "@/types/wireframe";
import { X } from "lucide-react";

function usePresentMode() {
  const [location] = useLocation();
  return useMemo(() => {
    const q = location.includes("?") ? location.split("?")[1] : "";
    return new URLSearchParams(q).get("present") === "1";
  }, [location]);
}

function PresentOverlay({
  title,
  document,
  onExit,
}: {
  title: string;
  document: WireframeDocument | Record<string, never>;
  onExit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card shrink-0">
        <h1 className="font-display text-sm font-semibold truncate">{title}</h1>
        <Button variant="ghost" size="sm" onClick={onExit} className="gap-1.5">
          <X className="w-4 h-4" />
          Exit present
        </Button>
      </div>
      <div className="flex-1 min-h-0">
        <WireframeViewer document={document} className="wireframe-canvas wireframe-present h-full w-full" />
      </div>
    </div>
  );
}

export default function WireframeDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id ?? "";
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const isPresent = usePresentMode();

  const { data: wireframe, isLoading, isError } = useWireframe(id);
  const { update, remove } = useWireframeMutations();

  const [title, setTitle] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [saveStatus, setSaveStatus] = useState<WireframeSaveStatus>("idle");
  const titleRef = useRef(title);
  const savedFadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  titleRef.current = title;

  useEffect(() => {
    if (wireframe) {
      setTitle(wireframe.title);
      setIsPublished(wireframe.is_published);
    }
  }, [wireframe?.id]);

  useEffect(() => {
    return () => {
      if (savedFadeTimer.current) clearTimeout(savedFadeTimer.current);
    };
  }, []);

  const readOnly = !isAdmin;

  const persistWireframe = useCallback(
    (patch: { document?: WireframeDocument; title?: string }) => {
      if (!wireframe) return;
      setSaveStatus("saving");
      if (savedFadeTimer.current) clearTimeout(savedFadeTimer.current);

      update.mutate(
        { id: wireframe.id, ...patch },
        {
          onSuccess: () => {
            setSaveStatus("saved");
            savedFadeTimer.current = setTimeout(() => setSaveStatus("idle"), 2000);
          },
          onError: () => {
            setSaveStatus("error");
            toast({ title: "Failed to save wireframe", variant: "destructive" });
          },
        },
      );
    },
    [wireframe, update, toast],
  );

  const handleDocumentChange = useCallback(
    (document: WireframeDocument) => {
      persistWireframe({
        document,
        title: titleRef.current.trim() || "Untitled wireframe",
      });
    },
    [persistWireframe],
  );

  useEffect(() => {
    if (!wireframe || readOnly) return;
    const trimmed = title.trim();
    if (!trimmed || trimmed === wireframe.title) return;

    const timer = setTimeout(() => {
      persistWireframe({ title: trimmed });
    }, 600);

    return () => clearTimeout(timer);
  }, [title, wireframe, readOnly, persistWireframe]);

  const handlePublishChange = async (published: boolean) => {
    if (!wireframe) return;
    setIsPublished(published);
    try {
      await update.mutateAsync({ id: wireframe.id, is_published: published });
      toast({ title: published ? "Published for sales reps" : "Unpublished" });
    } catch {
      setIsPublished(!published);
      toast({ title: "Failed to update publish status", variant: "destructive" });
    }
  };

  const handlePresent = () => {
    setLocation(`/wireframes/${id}?present=1`);
  };

  const handleExitPresent = () => {
    setLocation(`/wireframes/${id}`);
  };

  const handleDelete = async () => {
    if (!wireframe) return;
    if (!window.confirm(`Delete "${wireframe.title}"? This cannot be undone.`)) return;
    try {
      await remove.mutateAsync(wireframe.id);
      toast({ title: "Wireframe deleted" });
      setLocation("/wireframes");
    } catch {
      toast({ title: "Failed to delete wireframe", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <Sidebar>
        <div className="flex items-center justify-center h-64">
          <Spinner className="text-primary" />
        </div>
      </Sidebar>
    );
  }

  if (isError || !wireframe) {
    return (
      <Sidebar>
        <div className="p-6 text-center">
          <p className="text-sm text-muted-foreground mb-4">Wireframe not found or you don&apos;t have access.</p>
          <Link href="/wireframes">
            <Button variant="outline" size="sm">Back to wireframes</Button>
          </Link>
        </div>
      </Sidebar>
    );
  }

  if (isPresent) {
    return (
      <PresentOverlay
        title={wireframe.title}
        document={wireframe.document}
        onExit={handleExitPresent}
      />
    );
  }

  const canvas = readOnly ? (
    <WireframeViewer document={wireframe.document} />
  ) : (
    <WireframeEditor
      document={wireframe.document}
      onDocumentChange={handleDocumentChange}
    />
  );

  return (
    <Sidebar>
      <div className="flex flex-col h-[calc(100vh-0px)] min-h-0">
        <WireframeToolbar
          title={title}
          isPublished={isPublished}
          saveStatus={saveStatus}
          onTitleChange={setTitle}
          onPublishChange={handlePublishChange}
          onPresent={handlePresent}
          onDelete={handleDelete}
          readOnly={readOnly}
        />
        <div className="flex-1 min-h-0 relative">{canvas}</div>
      </div>
    </Sidebar>
  );
}
