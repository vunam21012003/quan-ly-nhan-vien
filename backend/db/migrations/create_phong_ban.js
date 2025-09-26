exports.up = async (knex) => {
  const has = await knex.schema.hasTable("phong_ban");
  if (!has) {
    await knex.schema.createTable("phong_ban", (t) => {
      t.increments("id").primary();
      t.string("ten", 191).notNullable().unique();
      t.integer("manager_taikhoan_id").unsigned().nullable(); // sẽ add FK sau
      t.string("mo_ta", 500).nullable();
      t.timestamp("created_at").defaultTo(knex.fn.now());
      t.timestamp("updated_at").defaultTo(knex.fn.now());
    });
  }
};

exports.down = async (knex) => {
  const has = await knex.schema.hasTable("phong_ban");
  if (has) await knex.schema.dropTable("phong_ban");
};
