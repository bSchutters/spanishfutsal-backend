export async function upsertLffsUpdate(
  type: "ranking" | "matches",
  options: {
    status?: "success" | "error" | "in_progress";
    error_message?: string;
    items_processed?: number;
  } = {}
) {
  const { status = "success", error_message, items_processed } = options;
  
  const existing = await strapi.db
    .query("api::lffs-update.lffs-update")
    .findOne({
      where: { type },
    });

  const updateData = {
    last_update: new Date(),
    status,
    error_message: error_message || null,
    items_processed: items_processed || null,
  };

  if (existing) {
    await strapi.db.query("api::lffs-update.lffs-update").update({
      where: { id: existing.id },
      data: updateData,
    });
  } else {
    await strapi.db.query("api::lffs-update.lffs-update").create({
      data: { type, ...updateData },
    });
  }
}
