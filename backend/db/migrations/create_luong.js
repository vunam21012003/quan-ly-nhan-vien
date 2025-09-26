exports.up = async (knex) => {
  const has = await knex.schema.hasTable("luong");
  if (!has) {
    await knex.schema.createTable("luong", (t) => {
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
      t.integer("thang").notNullable();
      t.integer("nam").notNullable();
      t.decimal("luong_co_ban", 15, 2).notNullable().defaultTo(0);
      t.decimal("phu_cap", 15, 2).notNullable().defaultTo(0);
      t.decimal("thuong", 15, 2).notNullable().defaultTo(0);
      t.decimal("khoan_khac", 15, 2).notNullable().defaultTo(0);
      t.text("ghi_chu").nullable();
      t.timestamp("created_at").defaultTo(knex.fn.now());
      t.timestamp("updated_at").defaultTo(knex.fn.now());
      t.unique(["nhan_vien_id", "thang", "nam"]);
      t.index(["phong_ban_id"]);
    });
  }
};

exports.down = async (knex) => {
  const has = await knex.schema.hasTable("luong");
  if (has) await knex.schema.dropTable("luong");
};
