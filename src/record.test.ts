import { describe, beforeAll, afterAll, it, expect, beforeEach, afterEach } from "bun:test"
import type { Hono } from "hono"
import { Kysely, sql } from "kysely"
import { mainApp, type GlobalContext } from "."
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { Database } from "bun:sqlite";

describe('record operation', () => {

  // biome-ignore lint/suspicious/noExplicitAny: for testing purposes only
  let db: Kysely<any> | undefined = undefined
  let app: Hono<GlobalContext> | undefined = undefined

  beforeAll(async () => {
    db = new Kysely({
      dialect: new BunSqliteDialect({
        database: new Database(':memory:'),
      }),
    })

    await db.schema.createTable('post')
      .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
      .addColumn('title', 'text', (col) => col.notNull())
      .addColumn('content', 'text', (col) => col.notNull())
      .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`current_timestamp`))
      .addColumn('updated_at', 'timestamp', (col) => col.notNull().defaultTo(sql`current_timestamp`)).execute()

    app = mainApp(db)
  })

  afterAll(() => {
    db?.destroy()
  })

  it('should create a record for the post table', async () => {
    const response = await app?.request('/record/post', {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title: 'my random post',
        content: "my random content here!!"
      })
    })
    expect(response?.status).toBe(201)

    const payload = await response?.json()

    expect(Object.keys(payload)).toContainAllValues(["id", "title", "content", "created_at", "updated_at"])

  })

  it('should read all of the records for the post table', async () => {
    const response = await app?.request('/record/post', {
      method: "GET",
    })
    expect(response?.status).toBe(200)
  })

  it('should read all of the records for the post table with the limit of 3', async () => {
    for (let i = 0; i < 5; i++) {
      await app?.request('/record/post', {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: 'my random post',
          content: "my random content here!!"
        })
      })
    }
    const response = await app?.request('/record/post', {
      method: "GET",
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        limit: 3
      })
    })
    expect(response?.status).toBe(200)

    const payload = await response?.json()

    expect(payload.length).toBe(3)

  })

  it('should read a record for the post table with the limit of 1 with the fields of title and content only', async () => {
    for (let i = 0; i < 5; i++) {
      await app?.request('/record/post', {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: 'my random post',
          content: "my random content here!!"
        })
      })
    }
    const response = await app?.request('/record/post', {
      method: "GET",
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        limit: 1,
        columns: ['title', 'content']
      })
    })
    expect(response?.status).toBe(200)
    const payload = await response?.json()
    expect(payload.length).toBe(1)
    expect(Object.keys(payload[0])).toContainAllValues(['title', 'content'])
  })

  it('should read a specific record based on primary key (id)', async () => {
    // format: record/table/id
    const response = await app?.request('/record/post/1', {
      method: "GET"
    })

    expect(response?.status).toBe(200)
  })

  it('should update a record based on its primary key (id)', async () => {
    const response = await app?.request('/record/post/1', {
      method: "PATCH",
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: "new title"
      })
    });

    expect(response?.status).toBe(200)

    const payload = await response?.json();

    expect(payload.title).toBe('new title')
  })

  it('should delete a record based on its primary key (id)', async () => {

    const response = await app?.request('/record/post/1', {
      method: "DELETE",
    });

    expect(response?.status).toBe(200)
  })
})