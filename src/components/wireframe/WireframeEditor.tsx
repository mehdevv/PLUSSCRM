import { useCallback, useRef } from "react";
import { Tldraw, getSnapshot, loadSnapshot, type Editor } from "tldraw";
import "tldraw/tldraw.css";
import { wireframeToolOverrides, hasWireframeDocument } from "@/lib/wireframe-tools";
import type { WireframeDocument } from "@/types/wireframe";

const AUTOSAVE_DEBOUNCE_MS = 800;

interface WireframeEditorProps {
  document: WireframeDocument | Record<string, never>;
  onEditorReady?: (editor: Editor) => void;
  onDocumentChange?: (document: WireframeDocument) => void;
  className?: string;
}

export function WireframeEditor({ document, onEditorReady, onDocumentChange, className }: WireframeEditorProps) {
  const editorRef = useRef<Editor | null>(null);
  const onDocumentChangeRef = useRef(onDocumentChange);
  onDocumentChangeRef.current = onDocumentChange;

  const onMount = useCallback(
    (editor: Editor) => {
      editorRef.current = editor;
      if (hasWireframeDocument(document)) {
        loadSnapshot(editor.store, { document: document as WireframeDocument });
      }
      onEditorReady?.(editor);

      if (!onDocumentChangeRef.current) return;

      let timer: ReturnType<typeof setTimeout> | null = null;
      const unlisten = editor.store.listen(
        () => {
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => {
            onDocumentChangeRef.current?.(getWireframeSnapshot(editor));
          }, AUTOSAVE_DEBOUNCE_MS);
        },
        { source: "user", scope: "document" },
      );

      return () => {
        if (timer) clearTimeout(timer);
        unlisten();
      };
    },
    [document, onEditorReady],
  );

  return (
    <div className={className ?? "wireframe-canvas h-full w-full min-h-0"}>
      <Tldraw onMount={onMount} overrides={wireframeToolOverrides} />
    </div>
  );
}

export function getWireframeSnapshot(editor: Editor): WireframeDocument {
  const { document } = getSnapshot(editor.store);
  return document;
}
