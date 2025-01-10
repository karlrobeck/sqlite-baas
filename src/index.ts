import { Hono } from 'hono'
import { contextStorage, getContext } from 'hono/context-storage'
import table from './table'
import type { Kysely } from 'kysely'
import { db } from './db'
import record from './record'

export type GlobalContext = {
  Variables: {
    // biome-ignore lint/suspicious/noExplicitAny: for testing purposes
    db: Kysely<any>
  }
}

// biome-ignore lint/suspicious/noExplicitAny: for testing purposes
export function mainApp(db: Kysely<any>) {
  return new Hono<GlobalContext>()
    .use(contextStorage())
    .use(async (c, next) => {
      c.set('db', db)
      await next()
    })
    .route("/table", table)
    .route("/record", record)
}

export default mainApp(db)
