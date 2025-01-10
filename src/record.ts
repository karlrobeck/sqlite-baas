import { Hono } from "hono";
import type { GlobalContext } from ".";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

export default new Hono<GlobalContext>()
  .post('/:name',
    zValidator('param', z.object({ name: z.string() })),
    zValidator('json', z.record(z.any())),
    async (c) => {

      const db = c.get('db')

      const { name } = c.req.valid('param')
      const payload = c.req.valid('json')

      const result = await db.insertInto(name).values(payload).returningAll().executeTakeFirst()

      return c.json(result, 201)
    })
  .get('/:name',
    zValidator('param', z.object({ name: z.string() })),
    zValidator('json', z.object({
      limit: z.number().optional().default(500),
      columns: z.array(z.string()).default([])
    })), async (c) => {
      const db = c.get('db')

      const { name } = c.req.valid('param')
      const options = c.req.valid('json')
      let query = db.selectFrom(name)

      if (options.columns?.length === 0) {
        query = query.selectAll()
      } else {
        query = query.select(options.columns)
      }

      const results = await query.limit(options.limit).execute()

      return c.json(results, 200)
    })
  .get("/:name/:id",
    zValidator('param', z.object({ name: z.string(), id: z.coerce.number() })),
    async (c) => {

      const db = c.get('db')

      const { name, id } = c.req.valid('param')

      const result = await db.selectFrom(name).selectAll().where('id', '=', id).executeTakeFirst();

      return c.json(result, 200)
    })
  .patch('/:name/:id',
    zValidator('param', z.object({ name: z.string(), id: z.coerce.number() })),
    zValidator('json', z.record(z.any())),
    async (c) => {
      const db = c.get('db')

      const { name, id } = c.req.valid('param');

      const payload = c.req.valid('json');

      const result = await db.updateTable(name).set(payload).where('id', '=', id).returningAll().executeTakeFirst();

      return c.json(result, 200)
    })
  .delete('/:name/:id',
    zValidator('param', z.object({ name: z.string(), id: z.coerce.number() })),
    async (c) => {
      const db = c.get('db')

      const { name, id } = c.req.valid('param');

      const result = await db.deleteFrom(name).where('id', '=', id).returningAll().executeTakeFirst();

      return c.json({
        message: "record deleted successfully"
      }, 200)
    })