import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { setTimeout } from 'node:timers/promises'
import { defineEventHandler } from 'h3'

async function* chunks() {
  yield 'start\n'
  await setTimeout(30)
  yield 'end\n'
}

export default defineEventHandler(async (event) => {
  try {
    await pipeline(Readable.from(chunks()), event.node.res)
  }
  catch (error) {
    if (!event.node.res.destroyed)
      throw error
  }
})
