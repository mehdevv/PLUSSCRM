import { useLocation } from "wouter";
import { Sidebar } from "@/components/layout/Sidebar";
import { WireframeList } from "@/components/wireframe/WireframeList";
import { useWireframeMutations, useWireframes } from "@/hooks/useWireframes";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export default function WireframesPage() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { data: wireframes = [], isLoading } = useWireframes();
  const { create } = useWireframeMutations();

  const handleCreate = async () => {
    try {
      const wf = await create.mutateAsync(undefined);
      setLocation(`/wireframes/${wf.id}`);
    } catch {
      toast({ title: "Failed to create wireframe", variant: "destructive" });
    }
  };

  return (
    <Sidebar>
      <div className="p-4 lg:p-6 max-w-6xl">
        <div className="mb-6">
          <h1 className="font-display text-xl font-bold text-foreground">Wireframes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isAdmin
              ? "Sketch UI flows and sales process diagrams to share with your team."
              : "View wireframes published by your admin."}
          </p>
        </div>
        <WireframeList
          wireframes={wireframes}
          loading={isLoading}
          isAdmin={isAdmin}
          onCreate={handleCreate}
          creating={create.isPending}
        />
      </div>
    </Sidebar>
  );
}
