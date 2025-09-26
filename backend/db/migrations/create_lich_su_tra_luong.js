exports.up = async (knex) => {
  const has = await knex.schema.hasTable("lich_su_tra_luong");
  if (!has) {
    await knex.schema.createTable("lich_su_tra_luong", (t) => {
      t.increments("id").primary();
      t.integer("nhan_vien_id")
        .unsigned()
        .notNullable()
        .references("id")
        .inTable("nhan_vien")
        .onDelete("CASCADE");
      t.integer("thang").notNullable();
      t.integer("nam").notNullable();
      t.decimal("so_tien", 15, 2).notNullable().defaultTo(0);
      t.date("ngay_tra").notNullable();
      t.string("phuong_thuc", 100).nullable();
      t.text("ghi_chu").nullable();
      t.timestamp("created_at").defaultTo(knex.fn.now());
      t.timestamp("updated_at").defaultTo(knex.fn.now());
      t.index(["nhan_vien_id"]);
      t.index(["thang", "nam"]);
    });
  }
};

exports.down = async (knex) => {
  const has = await knex.schema.hasTable("lich_su_tra_luong");
  if (has) await knex.schema.dropTable("lich_su_tra_luong");
};
