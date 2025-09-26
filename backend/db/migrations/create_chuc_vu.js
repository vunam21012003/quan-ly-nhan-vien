exports.up = async (knex) => {
  const has = await knex.schema.hasTable("chuc_vu");
  if (!has) {
    await knex.schema.createTable("chuc_vu", (t) => {
      t.increments("id").primary();
      t.string("ten", 191).notNullable().unique();
      t.string("mo_ta", 500).nullable();
      t.timestamp("created_at").defaultTo(knex.fn.now());
      t.timestamp("updated_at").defaultTo(knex.fn.now());
    });
  }
};

exports.down = async (knex) => {
  const has = await knex.schema.hasTable("chuc_vu");
  if (has) await knex.schema.dropTable("chuc_vu");
};
