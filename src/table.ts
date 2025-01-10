import { Hono } from 'hono'
import { sql } from 'kysely'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { GlobalContext } from '.';

const schema = z.object({
  name: z.string(),
  columns: z.array(z.object({
    name: z.string(),
    type: z.enum(['integer', 'text', 'real', 'blob']),
    constraints: z.object({
      primaryKey: z.boolean().optional(),
      unique: z.boolean().optional(),
      notNull: z.boolean().optional(),
      default: z.any().optional(),
      check: z.string().optional(),
      references: z.object({
        table: z.string(),
        column: z.string(),
        onDelete: z.enum(["no action", "restrict", "cascade", "set null", "set default"]).optional(),
        onUpdate: z.enum(["no action", "restrict", "cascade", "set null", "set default"]).optional()
      }).optional()
    }).optional(),
  }))
});

export default new Hono<GlobalContext>()
  // create table
  .post("/", zValidator('json', schema),
    async (c) => {

      const db = c.get('db');

      const { name, columns } = c.req.valid('json')

      // check if table already exists
      const exists = (await db.introspection.getTables()).filter(table => table.name === name).at(0)

      if (exists) {
        console.log(exists)
        return c.json({ message: 'Table already exists' }, 400)
      }

      try {

        let query = db.schema.createTable(name)
          .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
          .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`current_timestamp`))
          .addColumn('updated_at', 'timestamp', (col) => col.notNull().defaultTo(sql`current_timestamp`))

        for (const column of columns) {
          query = query.addColumn(column.name, column.type, (col) => {
            if (!column.constraints) {
              return col
            }
            const { primaryKey, unique, notNull, default: defaultValue, check } = column.constraints

            let temp_col = notNull ? col.notNull() : col

            if (primaryKey) temp_col = temp_col.primaryKey()
            if (unique) temp_col = temp_col.unique()
            if (defaultValue !== undefined) temp_col = temp_col.defaultTo(defaultValue)
            if (check) temp_col = temp_col.check(sql.raw(`${check}`))
            return temp_col
          })
          if (column.constraints?.references) {
            const references = column.constraints?.references
            query = query.addForeignKeyConstraint(
              // tableName_columnName_fk_key
              `${name}_${column.name}_fk_key`,
              //@ts-ignore
              [column.name],
              references.table,
              [references.column],
              (cb) => {
                let temp_cb = cb
                if (references.onDelete) temp_cb = cb.onDelete(references.onDelete)
                if (references.onUpdate) temp_cb = cb.onUpdate(references.onUpdate)
                return temp_cb
              }
            )
          }
        }
        await query.execute()

        const result = (await db.introspection.getTables()).filter(table => table.name === name).at(0)

        if (!result) {
          return c.json({ message: "unable to find table" })
        }

        return c.json(result, 201)
      } catch (e) {
        return c.json({ message: e }, 400)
      }
    })
  // get all tables
  .get("/", async (c) => {
    const db = c.get('db');
    //TODO: get all tables
    const tables = await db.introspection.getTables()
    return c.json(tables)
  })
  // get specific table
  .get("/:name", zValidator('param', schema.pick({ name: true })), async (c) => {

    const db = c.get('db');

    const { name } = c.req.valid('param')
    const table = (await db.introspection.getTables()).filter(value => value.name === name)

    if (table.length === 0) {
      return c.json({ message: "Unable to get table information" })
    }
    return c.json(table.at(0))
  })
  .patch("/rename/:name", zValidator('param', schema.pick({ name: true })), zValidator('json', z.object({
    newName: z.string()
  })), async (c) => {

    const { name } = c.req.valid('param')
    const { newName } = c.req.valid('json')

    const db = c.get('db')

    await db.schema.alterTable(name).renameTo(newName).execute()

    const table = (await db.introspection.getTables()).filter(table => table.name === newName).at(0)

    if (!table) {
      return c.json({ message: "unable to find table" }, 404)
    }
    return c.json(table, 201)
  })
  // update table definition
  .put("/:name", zValidator('param', schema.pick({ name: true })), zValidator('json', z.object({
    columns: z.array(z.object({
      colName: z.string(),
      updatedValues: z.object({
        name: z.string(),
        type: z.enum(['integer', 'text', 'real', 'blob']),
        constraints: z.object({
          primaryKey: z.boolean().optional(),
          unique: z.boolean().optional(),
          notNull: z.boolean().optional(),
          default: z.any().optional(),
          check: z.string().optional(),
        })
      }).partial()
    }))
  })), async (c) => {

    const db = c.get('db');

    const { name } = c.req.valid('param')
    const { columns } = c.req.valid('json')

    // get the table definition
    // get the column information
    // iterate over columns
    // match column names and if match try to change the data

    // check if table does not exists
    const table = (await db.introspection.getTables()).filter(value => value.name === name).at(0)

    if (!table) {
      return c.json({ message: "Unable to get table information" })
    }

    for (const column of columns) {
      const dbColumn = table.columns.filter(col => col.name === column.colName).at(0)

      if (!dbColumn) {
        continue
      }

      const colName = column.updatedValues.name || dbColumn.name;

      if (colName === column.updatedValues.name) {
        await db.schema.alterTable(name).renameColumn(dbColumn.name, column.updatedValues.name).execute()
        return c.json({ message: "renamed successfully" })
      }

      if (!column.updatedValues.type || column.updatedValues.constraints) {
        return c.text('done')
      }

      const alterQuery = db.schema.alterTable(name).alterColumn(colName, (ac) => {
        if (column.updatedValues.type) return ac.setDataType(sql.raw(`${column.updatedValues.type}`))

        if (column.updatedValues.constraints?.notNull === false) return ac.dropNotNull()

        if (column.updatedValues.constraints?.notNull === true) return ac.setNotNull()

        if (column.updatedValues.constraints?.default) return ac.setDefault(column.updatedValues.constraints?.default)

        throw new Error('alter column error')
      })

      console.log(alterQuery.compile().sql)

      await alterQuery.execute()

    }
    return c.text('hello')
  })
  .delete("/:name", zValidator('param', schema.pick({ name: true })), async (c) => {
    const db = c.get('db')
    const { name } = c.req.valid('param')
    await db.schema.dropTable(name).execute()
    return c.text('table removed successfully', 200)
  })