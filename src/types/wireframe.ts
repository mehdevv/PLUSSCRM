import type { TLStoreSnapshot } from "tldraw";

export type WireframeDocument = TLStoreSnapshot;

export interface Wireframe {
  id: string;
  title: string;
  document: WireframeDocument;
  is_published: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface WireframeListItem {
  id: string;
  title: string;
  is_published: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}
