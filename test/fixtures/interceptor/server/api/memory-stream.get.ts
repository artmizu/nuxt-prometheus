import type { NitroRuntimeHooks } from 'nitropack/types'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { setTimeout } from 'node:timers/promises'

async function* chunks() {
  yield 'start\n'
  await setTimeout(30)
  yield 'end\n'
}

export default async function memoryStream(event: Parameters<NitroRuntimeHooks['request']>[0]) {
  try {
    await pipeline(Readable.from(chunks()), event.node.res)
  }
  catch (error) {
    if (!event.node.res.destroyed)
      throw error
  }
}
