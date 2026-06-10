import type { TLUiOverrides } from "tldraw";

const WIREFRAME_TOOL_IDS = new Set([
  "select",
  "hand",
  "eraser",
  "draw",
  "rectangle",
  "ellipse",
  "arrow",
  "line",
  "text",
]);

export const wireframeToolOverrides: TLUiOverrides = {
  tools(_editor, tools) {
    return Object.fromEntries(
      Object.entries(tools).filter(([id]) => WIREFRAME_TOOL_IDS.has(id)),
    );
  },
};

export function hasWireframeDocument(doc: unknown): boolean {
  if (!doc || typeof doc !== "object") return false;
  const store = (doc as { store?: unknown }).store;
  if (!store || typeof store !== "object") return false;
  return Object.keys(store as object).length > 0;
}
