import http from 'node:http'
import net from 'node:net'
import process from 'node:process'
import { createOutboundCollector } from '../../dist/runtime/collector/index.js'

function closedPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string')
        return reject(new Error('no port'))
      server.close(() => resolve(address.port))
    })
  })
}

async function main() {
  const port = await closedPort()
  const collector = createOutboundCollector({
    getState: () => ({ requests: {} }),
  })
  collector.start()

  http.get(`http://127.0.0.1:${port}/`, () => {})

  setTimeout(() => {
    process.stdout.write('the request error was swallowed\n')
    process.exit(0)
  }, 1500).unref()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
