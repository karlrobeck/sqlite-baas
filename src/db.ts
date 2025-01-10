import { Kysely } from 'kysely'
import { Database } from "bun:sqlite";
import { BunSqliteDialect } from 'kysely-bun-sqlite';

export const db = new Kysely({
  dialect: new BunSqliteDialect({
    database: new Database('db.sqlite'),
  }),
})