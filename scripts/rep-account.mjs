/** Shared logic: create or refresh a sales rep auth user + profile for login at /login */

export async function ensureSalesRepAccount(admin, input) {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  const password = input.password;
  const initials = input.initials?.trim()
    || name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const color = input.color ?? "#8B5CF6";
  const tier = input.tier ?? "BRONZE";

  if (!email || !password || !name) {
    throw new Error("Name, email, and password are required");
  }
  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  const authPayload = {
    password,
    email_confirm: true,
    user_metadata: { name, role: "sales_rep" },
    app_metadata: { role: "sales_rep" },
  };

  let userId;
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    ...authPayload,
  });

  if (createError) {
    const alreadyExists = /already|registered|exists/i.test(createError.message);
    if (!alreadyExists) throw createError;

    const { data: list, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (listError) throw listError;

    const existing = list?.users?.find((u) => u.email?.toLowerCase() === email);
    if (!existing) throw createError;

    userId = existing.id;
    const { error: updateError } = await admin.auth.admin.updateUserById(userId, authPayload);
    if (updateError) throw updateError;
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

  if (profileError) throw profileError;

  return { userId, email };
}
