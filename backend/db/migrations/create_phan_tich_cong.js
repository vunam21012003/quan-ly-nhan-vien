exports.up = async (knex) => {
  const has = await knex.schema.hasTable("phan_tich_cong");
  if (!has) {
    await knex.schema.createTable("phan_tich_cong", (t) => {
      t.increments("id").primary();
      t.integer("nhan_vien_id")
        .unsigned()
        .notNullable()
        .references("id")
        .inTable("nhan_vien")
        .onDelete("CASCADE");
      t.integer("thang").notNullable();
      t.integer("nam").notNullable();
      t.decimal("tong_gio", 10, 2).notNullable().defaultTo(0);
      t.decimal("gio_ngay_thuong", 10, 2).notNullable().defaultTo(0);
      t.decimal("gio_ngay_nghi", 10, 2).notNullable().defaultTo(0);
      t.decimal("gio_tang_ca", 10, 2).notNullable().defaultTo(0);
      t.integer("so_ngay_cong").notNullable().defaultTo(0);
      t.integer("so_ngay_nghi").notNullable().defaultTo(0);
      t.text("ghi_chu").nullable();
      t.timestamp("created_at").defaultTo(knex.fn.now());
      t.timestamp("updated_at").defaultTo(knex.fn.now());
      t.unique(["nhan_vien_id", "thang", "nam"]);
      t.index(["nhan_vien_id"]);
    });
  }
};

exports.down = async (knex) => {
  const has = await knex.schema.hasTable("phan_tich_cong");
  if (has) await knex.schema.dropTable("phan_tich_cong");
};
