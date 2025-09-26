exports.up = async (knex) => {
  const has = await knex.schema.hasTable("cham_cong");
  if (!has) {
    await knex.schema.createTable("cham_cong", (t) => {
      t.increments("id").primary();
      t.integer("nhan_vien_id")
        .unsigned()
        .notNullable()
        .references("id")
        .inTable("nhan_vien")
        .onDelete("CASCADE");
      t.date("ngay").notNullable();
      t.time("check_in").nullable();
      t.time("check_out").nullable();
      t.string("ghi_chu", 500).nullable();
      t.timestamp("created_at").defaultTo(knex.fn.now());
      t.timestamp("updated_at").defaultTo(knex.fn.now());
      t.unique(["nhan_vien_id", "ngay"]);
      t.index(["nhan_vien_id"]);
      t.index(["ngay"]);
    });
  }
};

exports.down = async (knex) => {
  const has = await knex.schema.hasTable("cham_cong");
  if (has) await knex.schema.dropTable("cham_cong");
};
