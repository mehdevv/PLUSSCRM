import { supabase } from "@/lib/supabase";
import type { Wireframe, WireframeDocument, WireframeListItem } from "@/types/wireframe";

function mapWireframe(row: Record<string, unknown>): Wireframe {
  return {
    id: row.id as string,
    title: row.title as string,
    document: (row.document ?? {}) as WireframeDocument,
    is_published: row.is_published as boolean,
    created_by: row.created_by as string,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function mapListItem(row: Record<string, unknown>): WireframeListItem {
  return {
    id: row.id as string,
    title: row.title as string,
    is_published: row.is_published as boolean,
    created_by: row.created_by as string,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export async function listWireframes(): Promise<WireframeListItem[]> {
  const { data, error } = await supabase
    .from("wireframes")
    .select("id, title, is_published, created_by, created_at, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => mapListItem(r as Record<string, unknown>));
}

export async function getWireframe(id: string): Promise<Wireframe> {
  const { data, error } = await supabase.from("wireframes").select("*").eq("id", id).single();
  if (error) throw error;
  return mapWireframe(data as Record<string, unknown>);
}

export async function createWireframe(title = "Untitled wireframe"): Promise<Wireframe> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("wireframes")
    .insert({ title, created_by: user.id, document: {} })
    .select()
    .single();
  if (error) throw error;
  return mapWireframe(data as Record<string, unknown>);
}

export async function updateWireframe(
  id: string,
  patch: Partial<Pick<Wireframe, "title" | "document" | "is_published">>,
): Promise<Wireframe> {
  const { data, error } = await supabase
    .from("wireframes")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return mapWireframe(data as Record<string, unknown>);
}

export async function deleteWireframe(id: string): Promise<void> {
  const { error } = await supabase.from("wireframes").delete().eq("id", id);
  if (error) throw error;
}
