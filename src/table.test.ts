import { describe, beforeAll, afterAll, it, expect } from "bun:test"
import { Kysely, sql } from 'kysely'
import { Database } from "bun:sqlite";
import { BunSqliteDialect } from 'kysely-bun-sqlite';
import type { Hono } from "hono";
import { mainApp, type GlobalContext } from ".";


describe('table operation', () => {

  // biome-ignore lint/suspicious/noExplicitAny: for testing purposes only
  let db: Kysely<any> | undefined = undefined
  let app: Hono<GlobalContext> | undefined = undefined

  beforeAll(() => {
    db = new Kysely({
      dialect: new BunSqliteDialect({
        database: new Database(':memory:'),
      }),
    })
    app = mainApp(db)
  })

  afterAll(() => {
    db?.destroy()
  })

  it("should create a table with default columns (id,created_at,updated_at)", async () => {
    const response = await app?.request('/table', {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: "sample_table",
        columns: [],
      })
    })
    expect(response?.status).toBe(201)
  })

  it("should create a table with native datatypes (integer,text,real,blob)", async () => {
    const response = await app?.request('/table', {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: "sample_table_with_native_types",
        columns: [{
          name: "name",
          type: "text"
        }, {
          name: "age",
          type: "integer",
        }, {
          name: "price",
          type: "real",
        }, {
          name: "data",
          type: "blob"
        }],
      })
    })

    expect(response?.status).toBe(201)

    const payload = await response?.json()

    //@ts-ignore
    expect(payload.columns.map(v => v.name)).toContainAllValues(["id", "created_at", "updated_at", "name", "age", "price", "data"])
  })

  it("should create a table with constraint on it", async () => {
    const response = await app?.request('/table', {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: "sample_table_with_constraints",
        columns: [{
          name: "name",
          type: "text",
          constraints: {
            notNull: true,
            check: "length(name) > 8"
          }
        }, {
          name: "age",
          type: "integer",
          constraints: {
            notNull: true,
            default: 1
          }
        }, {
          name: "price",
          type: "real",
          constraints: {
            notNull: true,
            default: 0.0
          }
        }, {
          name: "data",
          type: "blob"
        }],
      })
    })
    expect(response?.status).toBe(201)
  })

  it("should create a table with foreign keys", async () => {

    await app?.request('/table', {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: "saple_user",
        columns: [{
          name: "email",
          type: "text",
          constraints: {
            notNull: true,
          }
        }, {
          name: "password",
          type: "text",
          constraints: {
            notNull: true,
          }
        }],
      })
    })

    const response = await app?.request('/table', {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: "sample_post",
        columns: [{
          name: "user_id",
          type: "integer",
          constraints: {
            notNull: true,
            references: {
              table: "saple_user",
              column: "id",
              onDelete: "cascade"
            }
          }
        }, {
          name: "title",
          type: "text",
          constraints: {
            notNull: true
          }
        }, {
          name: "content",
          type: "text",
          constraints: {
            notNull: true
          }
        }],
      })
    })
    expect(response?.status).toBe(201)
  })

  it('should get all tables', async () => {
    const response = await app?.request("/table", {
      method: "GET"
    })
    expect(response?.status).toBe(200)

    const payload = await response?.json()

    // this should contain 3 tables
    expect(payload.length).toBe(5)
  })

  it('should get table information for `sample_table_with_native_types`', async () => {
    const response = await app?.request('/table/sample_table_with_native_types', { method: "GET" })

    expect(response?.status).toBe(200)

    // expect to have a name of sample_table_with_native_types

    const payload = await response?.json()

    expect(payload.name).toBe("sample_table_with_native_types")
  })

  it('should rename table `sample_table_with_native_types` to updated_table_with_native_types', async () => {
    const response = await app?.request('/table/rename/sample_table_with_native_types', {
      method: "PATCH",
      headers: {
        "Content-type": "application/json"
      },
      body: JSON.stringify({
        newName: "updated_table_with_native_types"
      })
    })

    expect(response?.status).toBe(201)

    const payload = await response?.json()

    expect(payload.name).toBe('updated_table_with_native_types')
  })

  it.skip('should alter the column data types of updated_table_with_native_types', async () => {

  })

  it.skip('should alter the column constraint of updated_table_with_native_types', async () => {

  })

  it.skip('should alter the foreign key of sample_post to author_table', async () => {

  })

  it('should remove the table', async () => {
    const response = await app?.request('/table/updated_table_with_native_types', {
      method: "DELETE"
    })
    expect(response?.status).toBe(200)
  })

})