exports.up = async (knex) => {
  const has = await knex.schema.hasTable("hop_dong");
  if (!has) {
    await knex.schema.createTable("hop_dong", (t) => {
      t.increments("id").primary();
      t.integer("nhan_vien_id")
        .unsigned()
        .notNullable()
        .references("id")
        .inTable("nhan_vien")
        .onDelete("CASCADE");
      t.integer("phong_ban_id")
        .unsigned()
        .nullable()
        .references("id")
        .inTable("phong_ban")
        .onDelete("SET NULL");
      t.string("so_hop_dong", 100).notNullable();
      t.string("loai_hop_dong", 100).notNullable();
      t.date("ngay_bat_dau").notNullable();
      t.date("ngay_ket_thuc").nullable();
      t.enu("trang_thai", ["hieu_luc", "het_han", "tam_hoan"]).defaultTo("hieu_luc");
      t.text("ghi_chu").nullable();
      t.timestamp("created_at").defaultTo(knex.fn.now());
      t.timestamp("updated_at").defaultTo(knex.fn.now());
      t.index(["nhan_vien_id"]);
      t.index(["phong_ban_id"]);
      t.index(["trang_thai"]);
    });
  }
};

exports.down = async (knex) => {
  const has = await knex.schema.hasTable("hop_dong");
  if (has) await knex.schema.dropTable("hop_dong");
};
