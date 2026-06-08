import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, corsResponse, jsonResponse } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return corsResponse("ok");
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") {
      return jsonResponse({ error: "Admin access required" }, 403);
    }

    const body = await req.json() as {
      email: string;
      password: string;
      name: string;
      initials?: string;
      color?: string;
      tier?: string;
    };

    const email = body.email?.trim().toLowerCase();
    if (!email || !body.password || !body.name?.trim()) {
      return jsonResponse({ error: "Name, email, and password are required" }, 400);
    }

    const name = body.name.trim();
    const initials = body.initials?.trim() || name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
    const color = body.color ?? "#8B5CF6";
    const tier = body.tier ?? "BRONZE";
    const authPayload = {
      password: body.password,
      email_confirm: true,
      user_metadata: { name, role: "sales_rep" },
      app_metadata: { role: "sales_rep" },
    };

    let userId: string;
    const { data: created, error: createError } = await admin.auth.admin.createUser({ email, ...authPayload });

    if (createError) {
      const alreadyExists = /already|registered|exists/i.test(createError.message);
      if (!alreadyExists) return jsonResponse({ error: createError.message }, 400);

      const { data: list, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
      if (listError) return jsonResponse({ error: listError.message }, 400);
      const existing = list?.users?.find((u) => u.email?.toLowerCase() === email);
      if (!existing) return jsonResponse({ error: createError.message }, 400);

      userId = existing.id;
      const { error: updateError } = await admin.auth.admin.updateUserById(userId, authPayload);
      if (updateError) return jsonResponse({ error: updateError.message }, 400);
    } else {
      userId = created.user.id;
    }

    const { error: profileError } = await admin.from("profiles").upsert({
      id: userId,
      email,
      name,
      initials,
      role: "sales_rep",
      color,
      tier,
      points: 0,
      is_active: true,
      vacation_mode: false,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });

    if (profileError) return jsonResponse({ error: profileError.message }, 400);

    return jsonResponse({ userId, email });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return jsonResponse({ error: message }, 500);
  }
});
