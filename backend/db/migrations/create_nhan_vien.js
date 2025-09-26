exports.up = async (knex) => {
  const has = await knex.schema.hasTable("nhan_vien");
  if (!has) {
    await knex.schema.createTable("nhan_vien", (t) => {
      t.increments("id").primary();
      t.string("ho_ten", 191).notNullable();
      t.string("email", 191).nullable().unique();
      t.string("so_dien_thoai", 50).nullable();
      t.string("dia_chi", 500).nullable();
      t.date("ngay_sinh").nullable();
      t.enu("gioi_tinh", ["nam", "nu", "khac"]).defaultTo("nam");
      t.integer("phong_ban_id")
        .unsigned()
        .nullable()
        .references("id")
        .inTable("phong_ban")
        .onDelete("SET NULL");
      t.integer("chuc_vu_id")
        .unsigned()
        .nullable()
        .references("id")
        .inTable("chuc_vu")
        .onDelete("SET NULL");
      t.date("ngay_vao_lam").nullable();
      t.enu("trang_thai", ["dang_lam", "tam_nghi", "da_nghi"]).defaultTo("dang_lam");
      t.timestamp("created_at").defaultTo(knex.fn.now());
      t.timestamp("updated_at").defaultTo(knex.fn.now());
      t.index(["phong_ban_id"]);
      t.index(["chuc_vu_id"]);
      t.index(["trang_thai"]);
    });
  }
};

exports.down = async (knex) => {
  const has = await knex.schema.hasTable("nhan_vien");
  if (has) await knex.schema.dropTable("nhan_vien");
};
