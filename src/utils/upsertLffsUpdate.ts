export async function upsertLffsUpdate(type: "ranking" | "matches") {
  const existing = await strapi.db
    .query("api::lffs-update.lffs-update")
    .findOne({
      where: { type },
    });

  if (existing) {
    await strapi.db.query("api::lffs-update.lffs-update").update({
      where: { id: existing.id },
      data: { updatedAt: new Date() },
    });
  } else {
    await strapi.db.query("api::lffs-update.lffs-update").create({
      data: { type, updatedAt: new Date() },
    });
  }
}
