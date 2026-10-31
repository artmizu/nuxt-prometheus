import process from 'node:process'
import { writeHeapSnapshot } from 'node:v8'

process.on('message', (message) => {
  try {
    if (message.type === 'sample') {
      globalThis.gc()
      globalThis.gc()
      process.send({ memory: process.memoryUsage() })
    }
    else if (message.type === 'snapshot') {
      writeHeapSnapshot(message.path)
      process.send({})
    }
  }
  catch (error) {
    process.send({ error: error.message })
  }
})

process.on('disconnect', () => process.exit())
await import(new URL('../../test/fixtures/interceptor/.output/server/index.mjs', import.meta.url).href)
