/** Reassign or clear data before removing a sales rep account. */
export async function cleanupRepBeforeDelete(admin, repId, fallbackAdminId) {
  const { data: rep, error: repErr } = await admin
    .from("profiles")
    .select("id, role, name")
    .eq("id", repId)
    .single();

  if (repErr || !rep) throw new Error("Sales rep not found");
  if (rep.role !== "sales_rep") throw new Error("Only sales rep accounts can be deleted here");

  const now = new Date().toISOString();

  const { error: leadsErr } = await admin
    .from("leads")
    .update({
      assigned_to: null,
      split_rule_id: null,
      status: "NEW",
      updated_at: now,
    })
    .eq("assigned_to", repId);
  if (leadsErr) throw new Error(leadsErr.message);

  const { count: remainingLeads, error: checkErr } = await admin
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("assigned_to", repId);
  if (checkErr) throw new Error(checkErr.message);
  if ((remainingLeads ?? 0) > 0) {
    throw new Error(`Could not unassign ${remainingLeads} lead(s) from this rep`);
  }

  const tables = [
    { table: "deals", column: "rep_id" },
    { table: "clients", column: "manager_id" },
    { table: "commissions", column: "user_id" },
    { table: "activities", column: "user_id" },
    { table: "import_jobs", column: "created_by" },
  ];

  for (const { table, column } of tables) {
    const { error } = await admin.from(table).update({ [column]: fallbackAdminId }).eq(column, repId);
    if (error) throw new Error(error.message);
  }

  await admin.from("assignment_audit").delete().eq("rep_id", repId);
  await admin.from("leaderboard_snapshots").delete().eq("user_id", repId);

  const { error: profileErr } = await admin.from("profiles").delete().eq("id", repId);
  if (profileErr) throw new Error(profileErr.message);

  return { repId, repName: rep.name };
}
