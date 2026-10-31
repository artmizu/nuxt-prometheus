import { closeSync, openSync, writeSync } from 'node:fs'

export async function connectInspector(url) {
  const socket = new WebSocket(url)
  const pending = new Map()
  let nextID = 0
  let snapshotFile

  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data)
    if (message.method === 'HeapProfiler.addHeapSnapshotChunk' && snapshotFile !== undefined)
      writeSync(snapshotFile, message.params.chunk)
    const request = pending.get(message.id)
    if (!request)
      return
    pending.delete(message.id)
    clearTimeout(request.timer)
    if (message.error)
      request.reject(new Error(JSON.stringify(message.error)))
    else
      request.resolve(message.result)
  })

  socket.addEventListener('close', () => {
    for (const request of pending.values()) {
      clearTimeout(request.timer)
      request.reject(new Error('Node inspector disconnected'))
    }
    pending.clear()
  })

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.close()
      reject(new Error('Node inspector connection timed out'))
    }, 10000)
    socket.addEventListener('open', () => {
      clearTimeout(timer)
      resolve()
    }, { once: true })
    socket.addEventListener('error', () => {
      clearTimeout(timer)
      reject(new Error('Node inspector connection failed'))
    }, { once: true })
  })

  function command(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++nextID
      const timer = setTimeout(() => {
        pending.delete(id)
        reject(new Error(`Node inspector command timed out: ${method}`))
      }, 60000)
      pending.set(id, { resolve, reject, timer })
      socket.send(JSON.stringify({ id, method, params }))
    })
  }

  async function evaluate(expression) {
    const result = await command('Runtime.evaluate', { expression, returnByValue: true })
    if (result.exceptionDetails)
      throw new Error(JSON.stringify(result.exceptionDetails))
    return result.result.value
  }

  return {
    async sample(label) {
      await command('HeapProfiler.collectGarbage')
      await command('HeapProfiler.collectGarbage')
      return { label, ...await evaluate('process.memoryUsage()') }
    },
    async snapshot(path) {
      snapshotFile = openSync(path, 'w', 0o600)
      try {
        await command('HeapProfiler.takeHeapSnapshot')
      }
      finally {
        closeSync(snapshotFile)
        snapshotFile = undefined
      }
    },
    close() {
      socket.close()
    },
  }
}
