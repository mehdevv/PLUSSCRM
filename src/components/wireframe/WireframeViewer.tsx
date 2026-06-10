import { useCallback } from "react";
import { Tldraw, loadSnapshot, type Editor } from "tldraw";
import "tldraw/tldraw.css";
import { wireframeToolOverrides, hasWireframeDocument } from "@/lib/wireframe-tools";
import type { WireframeDocument } from "@/types/wireframe";

interface WireframeViewerProps {
  document: WireframeDocument | Record<string, never>;
  className?: string;
}

export function WireframeViewer({ document, className }: WireframeViewerProps) {
  const onMount = useCallback(
    (editor: Editor) => {
      editor.updateInstanceState({ isReadonly: true });
      if (hasWireframeDocument(document)) {
        loadSnapshot(editor.store, { document: document as WireframeDocument });
      }
    },
    [document],
  );

  return (
    <div className={className ?? "wireframe-canvas h-full w-full min-h-0"}>
      <Tldraw
        onMount={onMount}
        overrides={wireframeToolOverrides}
        hideUi={false}
      />
    </div>
  );
}
