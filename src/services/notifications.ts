import { supabase } from "@/lib/supabase";
import type { Notification } from "@/types";

export async function fetchNotifications(userId: string): Promise<Notification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []).map((n) => ({
    id: n.id,
    user_id: n.user_id,
    title: n.title,
    message: n.message,
    read: n.read,
    created_at: n.created_at,
  }));
}

export async function markNotificationRead(id: string) {
  await supabase.from("notifications").update({ read: true }).eq("id", id);
}
