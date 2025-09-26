exports.up = async (knex) => {
  const has = await knex.schema.hasTable("tai_khoan");
  if (!has) {
    await knex.schema.createTable("tai_khoan", (t) => {
      t.increments("id").primary();
      t.string("ten_dang_nhap", 191).notNullable().unique();
      t.string("mat_khau", 191).notNullable();
      t.enu("quyen", ["admin", "manager", "nhanvien"]).notNullable().defaultTo("nhanvien");
      t.integer("nhan_vien_id")
        .unsigned()
        .nullable()
        .references("id")
        .inTable("nhan_vien")
        .onDelete("SET NULL");
      t.timestamp("created_at").defaultTo(knex.fn.now());
      t.timestamp("updated_at").defaultTo(knex.fn.now());
      t.index(["nhan_vien_id"]);
      t.index(["quyen"]);
    });
  }

  // Thêm FK phong_ban.manager_taikhoan_id -> tai_khoan.id nếu chưa có
  const hasPB = await knex.schema.hasTable("phong_ban");
  if (hasPB) {
    try {
      await knex.raw(`
        ALTER TABLE phong_ban
        ADD CONSTRAINT fk_phongban_manager
        FOREIGN KEY (manager_taikhoan_id) REFERENCES tai_khoan(id)
        ON DELETE SET NULL
      `);
    } catch (_) {
      /* đã tồn tại thì bỏ qua */
    }
  }
};

exports.down = async (knex) => {
  // Gỡ FK nếu tồn tại
  try {
    await knex.raw(`ALTER TABLE phong_ban DROP FOREIGN KEY fk_phongban_manager`);
  } catch (_) {
    /* ignore */
  }

  const has = await knex.schema.hasTable("tai_khoan");
  if (has) await knex.schema.dropTable("tai_khoan");
};
